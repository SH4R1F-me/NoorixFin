/**
 * System Events Service — DEC-018
 *
 * The write path for `system_events`, the operational log the admin console's
 * monitoring page reads.
 *
 * Three properties this must have, in priority order:
 *
 * 1. **It can never break a request.** `record()` is synchronous, returns void,
 *    and swallows everything. Telemetry that can 500 the endpoint it observes is
 *    worse than no telemetry.
 * 2. **It is bounded.** Free Tier is the design constraint (DEC-011). Events are
 *    buffered and flushed on an interval, so a 1000-error/second storm costs one
 *    batched INSERT every FLUSH_MS — not 1000 inserts. When the buffer is full
 *    the OLDEST entries are dropped and counted; memory does not grow.
 * 3. **It is service-role only.** There is no INSERT grant or policy for
 *    `authenticated` (see migration 00013), so a user session cannot forge an
 *    entry in the operator's log.
 */
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export type SystemEventLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';

export interface SystemEventInput {
  level: SystemEventLevel;
  eventCode: string;
  message?: string;
  source?: string;
  requestId?: string;
  actorId?: string;
  route?: string;
  method?: string;
  statusCode?: number;
  latencyMs?: number;
  metadata?: Record<string, unknown>;
}

/** Row shape as it goes to Postgres (snake_case). */
interface SystemEventRow {
  level: SystemEventLevel;
  source: string;
  event_code: string;
  message: string;
  request_id: string | null;
  actor_id: string | null;
  route: string | null;
  method: string | null;
  status_code: number | null;
  latency_ms: number | null;
  metadata: Record<string, unknown>;
}

@Injectable()
export class SystemEventsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SystemEventsService.name);

  /** Hard ceiling on buffered rows. Chosen so a full buffer is ~1 INSERT. */
  private static readonly MAX_BUFFER = 500;
  /** Flush cadence. Also the worst-case delay before an event reaches the feed. */
  private static readonly FLUSH_MS = 2000;

  private buffer: SystemEventRow[] = [];
  private timer?: NodeJS.Timeout;
  private flushing = false;
  private droppedSinceLastFlush = 0;
  /** Set once if the service key is absent, so we warn once rather than per event. */
  private persistenceDisabled = false;

  constructor(private readonly supabaseService: SupabaseService) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.flush();
    }, SystemEventsService.FLUSH_MS);
    // Do not hold the event loop open on shutdown.
    this.timer.unref?.();
  }

  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    // Best-effort final flush so events from the last two seconds of uptime —
    // often the most interesting ones, if the process is dying — are not lost.
    await this.flush();
  }

  /**
   * Queue an event. Never throws, never awaits, never blocks the caller.
   */
  record(input: SystemEventInput): void {
    try {
      if (this.persistenceDisabled) return;

      if (this.buffer.length >= SystemEventsService.MAX_BUFFER) {
        // Drop the OLDEST, not the newest: during an incident the most recent
        // events are the ones an operator needs.
        this.buffer.shift();
        this.droppedSinceLastFlush += 1;
      }

      this.buffer.push({
        level: input.level,
        source: input.source ?? 'api',
        event_code: input.eventCode,
        message: truncate(input.message ?? '', 2000),
        request_id: input.requestId ?? null,
        actor_id: input.actorId ?? null,
        route: input.route ? truncate(input.route, 500) : null,
        method: input.method ?? null,
        status_code: input.statusCode ?? null,
        latency_ms: input.latencyMs ?? null,
        metadata: input.metadata ?? {},
      });
    } catch {
      // Telemetry must not be able to fail a request. There is deliberately no
      // logging here either — a logger that throws would defeat the point.
    }
  }

  /** Buffered-but-unwritten count. Surfaced on the admin overview. */
  get pending(): number {
    return this.buffer.length;
  }

  async flush(): Promise<void> {
    if (this.flushing || this.buffer.length === 0) return;
    this.flushing = true;

    // Take the batch before awaiting, so events recorded during the round trip
    // land in the next flush rather than being lost or double-written.
    const batch = this.buffer;
    const dropped = this.droppedSinceLastFlush;
    this.buffer = [];
    this.droppedSinceLastFlush = 0;

    try {
      const client = this.supabaseService.getServiceClient();

      if (dropped > 0) {
        // Silent truncation would read as "nothing else happened". Say so.
        batch.push({
          level: 'WARN',
          source: 'api',
          event_code: 'TELEMETRY_BUFFER_OVERFLOW',
          message: `${dropped} system event(s) dropped: buffer full`,
          request_id: null,
          actor_id: null,
          route: null,
          method: null,
          status_code: null,
          latency_ms: null,
          metadata: { dropped, max_buffer: SystemEventsService.MAX_BUFFER },
        });
      }

      const { error } = await client.from('system_events').insert(batch);
      if (error) {
        this.logger.warn(
          `Failed to persist ${batch.length} system event(s): ${error.message}`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      if (message.includes('Service client not available')) {
        // No service-role key configured. Warn once and stop buffering rather
        // than growing an array nobody will ever drain.
        this.persistenceDisabled = true;
        this.logger.warn(
          'SUPABASE_SERVICE_ROLE_KEY is not set — system event persistence is disabled. ' +
            'The admin monitoring feed will be empty.',
        );
      } else {
        this.logger.warn(`System event flush failed: ${message}`);
      }
      // The batch is dropped, deliberately. Re-queuing a failing batch turns one
      // outage into an unbounded retry loop against the database.
    } finally {
      this.flushing = false;
    }
  }
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}
