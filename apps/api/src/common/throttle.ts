/**
 * Per-endpoint rate-limit tiers — Blueprint §16.2, audit item 14.
 *
 * ── WHY THE GLOBAL THROTTLE WAS NOT ENOUGH ───────────────────────────────────
 * `ThrottlerModule.forRoot` applies one budget to every route, so the limit had
 * to be loose enough for the app's chattiest legitimate behaviour — a dashboard
 * load fires several reads at once. That means the same budget also governs the
 * routes where abuse is cheapest and most damaging:
 *
 *   - **Account deletion and password change.** A single successful call is
 *     destructive or security-relevant. There is no legitimate reason to make
 *     more than a handful per hour, and a loose limit turns "guess the
 *     confirmation" into a viable strategy.
 *   - **Operator mutations.** Suspending users, editing settings, publishing
 *     broadcasts. A compromised operator session should not be able to sweep
 *     the platform at ten writes per second before anyone notices.
 *   - **Ledger writes.** Bounded well above real use, but bounded: a runaway
 *     client retrying a failed write should hit a wall, not fill a ledger.
 *
 * ── WHAT THESE ARE NOT ───────────────────────────────────────────────────────
 * Not a substitute for authorization. Every route below is already behind its
 * guard; the limit bounds the DAMAGE RATE of a caller who is legitimately past
 * the guard, which is the case guards do not cover.
 *
 * Sign-in itself is absent because it does not live here — Supabase Auth
 * handles it and applies its own limits (`supabase/config.toml`). Adding a
 * decorator for it would be a comment pretending to be a control.
 */
import { Throttle } from '@nestjs/throttler';

/**
 * Destructive or credential-adjacent user actions.
 *
 * Deliberately per-hour rather than per-minute: the concern is not burst, it is
 * how many attempts a determined caller accumulates.
 */
export const ThrottleSensitive = () =>
  Throttle({
    short: { limit: 3, ttl: 60_000 },
    medium: { limit: 10, ttl: 3_600_000 },
  });

/**
 * Operator writes. Tighter than a normal user's, which reads backwards until
 * you notice that operator actions are platform-wide: one call suspends a
 * person, and the blast radius of a stolen operator session scales with this
 * number.
 */
export const ThrottleAdminWrite = () =>
  Throttle({
    short: { limit: 5, ttl: 10_000 },
    medium: { limit: 60, ttl: 3_600_000 },
  });

/**
 * Ledger writes. Generous — a user importing a month of receipts by hand is
 * legitimate — but finite.
 */
export const ThrottleLedgerWrite = () =>
  Throttle({
    short: { limit: 10, ttl: 1_000 },
    medium: { limit: 300, ttl: 60_000 },
  });

/**
 * Report and aggregation reads.
 *
 * These are the expensive queries: `category_report` scans six months of
 * postings. A caller refreshing a report in a loop is a database problem long
 * before it is a bandwidth one.
 */
export const ThrottleReport = () =>
  Throttle({
    short: { limit: 5, ttl: 2_000 },
    medium: { limit: 120, ttl: 60_000 },
  });
