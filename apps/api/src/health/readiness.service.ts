/**
 * Readiness state and dependency probes (audit gaps R5, R6).
 *
 * Liveness and readiness answer different questions, and conflating them is
 * how a rolling deploy drops requests:
 *
 *   - **Liveness**  — "is this process healthy enough to keep running?"
 *                     A `false` here means RESTART me.
 *   - **Readiness** — "should traffic be routed to me right now?"
 *                     A `false` here means WAIT — do not kill me.
 *
 * A process whose database has briefly gone away is not ready, but restarting
 * it fixes nothing and loses in-flight work. That distinction is the entire
 * reason the two probes are separate endpoints.
 */
import { Injectable, Logger, type OnApplicationShutdown } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface ProbeResult {
  name: string;
  ok: boolean;
  latency_ms: number;
  error: string | null;
}

/** A probe slower than this is treated as a failure, not as a slow success. */
const PROBE_TIMEOUT_MS = 5_000;

/**
 * Readiness answers are cached this long. Orchestrators poll readiness every
 * second or two per replica; without this, the probe itself becomes a steady
 * source of database queries — precisely the per-request cost DEC-011 exists
 * to avoid. Short enough that a real outage is noticed within one poll cycle.
 */
const CACHE_TTL_MS = 2_000;

@Injectable()
export class ReadinessService implements OnApplicationShutdown {
  private readonly logger = new Logger(ReadinessService.name);

  /**
   * Flipped false the moment shutdown begins, before Nest closes the server.
   * This is the half of graceful shutdown that actually prevents dropped
   * requests: the load balancer sees 503 on the next poll and stops sending
   * new work, while requests already in flight run to completion.
   */
  private shuttingDown = false;

  private cache: { at: number; result: ReadinessReport } | null = null;

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Called twice on a signal shutdown — once by main.ts's handler to flip
   * readiness before the drain, then again by Nest's lifecycle when
   * `app.close()` runs. Flipping a boolean twice is harmless; logging it twice
   * reads like two shutdowns, so only the first call speaks.
   */
  onApplicationShutdown(signal?: string) {
    if (this.shuttingDown) return;
    this.shuttingDown = true;
    this.logger.log(
      `Shutdown signal ${signal ?? 'unknown'} — readiness is now false`,
    );
  }

  isShuttingDown(): boolean {
    return this.shuttingDown;
  }

  async check(): Promise<ReadinessReport> {
    if (this.shuttingDown) {
      return {
        status: 'shutting_down',
        checks: [],
        checked_at: new Date().toISOString(),
      };
    }

    const now = Date.now();
    if (this.cache && now - this.cache.at < CACHE_TTL_MS)
      return this.cache.result;

    const checks = await Promise.all([
      this.probe('database', async () => {
        // Service role, not a user token: readiness is asked by an orchestrator
        // that holds no session. `app_settings` is tiny and always present.
        const { error } = await this.supabaseService
          .getServiceClient()
          .from('app_settings')
          .select('key')
          .limit(1);
        if (error) throw new Error(error.message);
      }),
      this.probe('auth', async () => {
        const response = await fetch(
          `${this.supabaseService.getSupabaseUrl()}/auth/v1/health`,
          {
            headers: this.supabaseService.getGatewayHeaders(),
            signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
          },
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
      }),
    ]);

    const result: ReadinessReport = {
      status: checks.every((c) => c.ok) ? 'ready' : 'not_ready',
      checks,
      checked_at: new Date().toISOString(),
    };

    this.cache = { at: now, result };
    return result;
  }

  private async probe(
    name: string,
    fn: () => Promise<void>,
  ): Promise<ProbeResult> {
    const started = Date.now();
    // `Promise.race` settles, but the loser keeps running. Without clearing
    // this in `finally`, every successful probe leaves a 5-second timer behind
    // — harmless one at a time, but readiness is polled continuously, and it
    // is enough to hold the event loop open (Jest refused to exit on it).
    let timer: NodeJS.Timeout | undefined;
    try {
      // Belt and braces: a client that ignores AbortSignal cannot hang the
      // probe past the timeout and make readiness itself the outage.
      await Promise.race([
        fn(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () =>
              reject(new Error(`probe timed out after ${PROBE_TIMEOUT_MS}ms`)),
            PROBE_TIMEOUT_MS,
          );
        }),
      ]);
      return { name, ok: true, latency_ms: Date.now() - started, error: null };
    } catch (error) {
      return {
        name,
        ok: false,
        latency_ms: Date.now() - started,
        error: error instanceof Error ? error.message : 'unknown error',
      };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

export interface ReadinessReport {
  status: 'ready' | 'not_ready' | 'shutting_down';
  checks: ProbeResult[];
  checked_at: string;
}
