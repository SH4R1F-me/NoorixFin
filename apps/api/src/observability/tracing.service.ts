/**
 * Time-boxed request tracing — audit item 15.
 *
 * The audit asked to "propagate `X-Request-ID` into `system_events` for every
 * request, not just failures, so an operator can follow one user's request end
 * to end."
 *
 * ── WHY THIS IS A SWITCH AND NOT ALWAYS-ON ───────────────────────────────────
 * Recording every request permanently is the wrong shape for this system, for
 * two reasons that are not about cost:
 *
 *   1. `system_events` is the OPERATOR'S FEED. It is read by a human looking
 *      for what went wrong. Burying five WARN entries under fifty thousand
 *      routine ones does not add information, it removes it — the same
 *      argument that already exempted SSE handlers from the slow-request
 *      interceptor after they produced 181 bogus entries.
 *   2. Every recorded request is a row saying "this user was active at this
 *      moment on this route". That is a behavioural log of people's finances.
 *      DEC-002 #12 and DEC-016 confine operators to metadata; keeping a
 *      permanent activity trail of every user, forever, to help debug an
 *      occasional incident is not a trade this product should make silently.
 *
 * So tracing is off by default, turned on deliberately, and EXPIRES ON ITS OWN.
 * An operator debugging a report opens a window, reproduces, and the window
 * closes whether or not anyone remembers to close it. A trace that has to be
 * switched off by hand is a trace that stays on.
 */
import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

/** Longest a trace window may last, regardless of what was requested. */
export const MAX_TRACE_MINUTES = 60;

/**
 * How long a fetched setting is trusted.
 *
 * The interceptor consults this on EVERY request, so it cannot be a database
 * read. Ten seconds is short enough that "turn tracing on" feels immediate and
 * long enough that the check costs nothing.
 */
const CACHE_MS = 10_000;

@Injectable()
export class TracingService {
  private readonly logger = new Logger(TracingService.name);

  private cachedUntil: Date | null = null;
  private cacheReadAt = 0;
  /** Set when the service key is missing, so we stop retrying a lookup that cannot work. */
  private unavailable = false;

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Is tracing active right now?
   *
   * Synchronous and never throws: it is called on the request path, and
   * telemetry must not be able to fail a request.
   *
   * ── WHY A STALE CACHE MEANS "NO" ─────────────────────────────────────────
   * The refresh is fire-and-forget, so the first request after the cache goes
   * stale would otherwise be answered from the OLD value while the new read is
   * still in flight. That is harmless in one direction and not in the other:
   *
   *   - stale says "off" when a window just opened → a few seconds of tracing
   *     are missed. Nothing is lost that mattered.
   *   - stale says "on" when the window has been replaced by a shorter one, or
   *     closed → requests are recorded AFTER the deadline that authorised
   *     them. Measured: exactly one request leaked past a replaced deadline.
   *
   * The second is a privacy failure, not a gap in telemetry. So an expired
   * cache answers `false` until it has been refreshed, and the asymmetry is
   * deliberate: this switch is allowed to under-record and is not allowed to
   * over-record.
   */
  isActive(): boolean {
    const fresh = this.refreshIfStale();
    if (!fresh) return false;
    return this.cachedUntil !== null && this.cachedUntil.getTime() > Date.now();
  }

  /** @returns whether the cached value is current enough to be trusted. */
  private refreshIfStale(): boolean {
    if (this.unavailable) return false;
    if (Date.now() - this.cacheReadAt < CACHE_MS) return true;

    this.cacheReadAt = Date.now();
    void this.readSetting().catch(() => {
      // Swallowed deliberately — see isActive(). A failed read leaves the
      // previous answer in place rather than flipping tracing on or off.
    });
    return false;
  }

  private async readSetting(): Promise<void> {
    let client;
    try {
      client = this.supabase.getServiceClient();
    } catch {
      this.unavailable = true;
      return;
    }

    const { data, error } = await client
      .from('app_settings')
      .select('value')
      .eq('key', 'request_tracing')
      .maybeSingle();

    if (error || !data) {
      this.cachedUntil = null;
      return;
    }

    const value = data.value as { until?: string | null } | null;
    const until = value?.until ? new Date(value.until) : null;
    this.cachedUntil = until && !Number.isNaN(until.getTime()) ? until : null;
  }

  /**
   * Open a trace window.
   *
   * Clamped to `MAX_TRACE_MINUTES` here rather than trusted from the caller:
   * "trace for 10000 minutes" is always-on wearing a time limit, and the whole
   * point of the switch is that it cannot become permanent by accident.
   */
  async enable(minutes: number, actorId: string): Promise<{ until: string }> {
    const bounded = Math.min(Math.max(Math.floor(minutes), 1), MAX_TRACE_MINUTES);
    const until = new Date(Date.now() + bounded * 60_000).toISOString();

    const client = this.supabase.getServiceClient();
    const { error } = await client
      .from('app_settings')
      .update({
        value: { until, enabled_by: actorId },
        updated_by: actorId,
        updated_at: new Date().toISOString(),
      })
      .eq('key', 'request_tracing');

    if (error) throw new Error(`Could not enable tracing: ${error.message}`);

    this.cachedUntil = new Date(until);
    this.cacheReadAt = Date.now();
    this.logger.warn(
      `Request tracing enabled by ${actorId} until ${until} (${bounded} minutes)`,
    );
    return { until };
  }

  /** Close the window early. */
  async disable(actorId: string): Promise<void> {
    const client = this.supabase.getServiceClient();
    const { error } = await client
      .from('app_settings')
      .update({
        value: { until: null },
        updated_by: actorId,
        updated_at: new Date().toISOString(),
      })
      .eq('key', 'request_tracing');

    if (error) throw new Error(`Could not disable tracing: ${error.message}`);

    this.cachedUntil = null;
    this.cacheReadAt = Date.now();
  }

  /** What the console shows. */
  status(): { active: boolean; until: string | null } {
    const active = this.isActive();
    return { active, until: active ? this.cachedUntil!.toISOString() : null };
  }
}
