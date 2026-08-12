/**
 * The reporter seam.
 *
 * **Why an interface rather than `@sentry/*` directly.** Three reasons, and the
 * third is the one that decided it:
 *
 *   1. This product's public promise is "free, no trackers, self-hostable".
 *      Hard-wiring a SaaS SDK into all three apps makes that promise depend on
 *      a vendor, and makes self-hosters carry a dependency they cannot use.
 *   2. `@sentry/nextjs` wraps `next.config`, injects instrumentation files and
 *      adds a source-map upload step — real surface area to break the build
 *      that was just made green, in exchange for nothing until a DSN exists.
 *   3. The gap the audit actually names is *release tagging, grouping and
 *      traces*, none of which need a vendor. Those are implemented here and
 *      work offline; a vendor plugs in underneath when someone wants one.
 *
 * So the default is a no-op, the API surface is one function, and adding Sentry
 * or an OTLP exporter later is writing one `ErrorReporter` and registering it
 * — not touching any call site.
 */
import { fingerprint } from './fingerprint';
import { redact, redactString } from './redact';
import type { ReleaseInfo } from './release';

export interface ErrorReport {
  /** Stable grouping key. Identical bugs share it; different bugs do not. */
  fingerprint: string;
  name: string;
  message: string;
  stack?: string;
  level: 'error' | 'warning' | 'fatal';
  release: ReleaseInfo;
  /** W3C trace id, when the caller is inside a traced request. */
  traceId?: string;
  /** Redacted. Never contains ledger values — see ./redact. */
  context: Record<string, unknown>;
  timestamp: string;
}

export interface ErrorReporter {
  readonly name: string;
  report(report: ErrorReport): void;
}

/**
 * The default. Does nothing, on purpose.
 *
 * Errors still reach the places they already reached — the API's
 * `system_events` table, the console — so a build with no reporter configured
 * loses nothing it had before.
 */
export const noopReporter: ErrorReporter = {
  name: 'noop',
  report() {
    /* intentionally empty */
  },
};

/** Fans out to several reporters; one throwing never stops the others. */
export function compositeReporter(reporters: ErrorReporter[]): ErrorReporter {
  return {
    name: `composite(${reporters.map((r) => r.name).join(',') || 'empty'})`,
    report(report) {
      for (const reporter of reporters) {
        try {
          reporter.report(report);
        } catch {
          // A telemetry sink that throws must never surface as a product
          // failure — the same rule SystemEventsService follows.
        }
      }
    },
  };
}

export interface CaptureOptions {
  release: ReleaseInfo;
  level?: ErrorReport['level'];
  traceId?: string;
  /** Extra identity for grouping, e.g. the route. */
  context?: string;
  /** Arbitrary structured detail. Redacted before it leaves. */
  extra?: Record<string, unknown>;
  /** Injectable for tests. */
  now?: () => Date;
}

/** Build a redacted, fingerprinted report from an unknown thrown value. */
export function buildReport(error: unknown, options: CaptureOptions): ErrorReport {
  // `throw 'string'` and `throw {code}` are both legal and both happen.
  const err =
    error instanceof Error
      ? error
      : new Error(typeof error === 'string' ? error : JSON.stringify(error));

  return {
    fingerprint: fingerprint({
      name: err.name,
      message: err.message,
      stack: err.stack,
      context: options.context,
    }),
    name: err.name,
    message: redactString(err.message),
    stack: err.stack ? redactString(err.stack) : undefined,
    level: options.level ?? 'error',
    release: options.release,
    traceId: options.traceId,
    context: (redact(options.extra ?? {}) as Record<string, unknown>) ?? {},
    timestamp: (options.now?.() ?? new Date()).toISOString(),
  };
}

/**
 * Process-wide reporter.
 *
 * Module-level state because the alternative is threading a reporter through
 * every call site in three applications, and the thing being configured is
 * genuinely per-process.
 */
let current: ErrorReporter = noopReporter;

export function setErrorReporter(reporter: ErrorReporter): void {
  current = reporter;
}

export function getErrorReporter(): ErrorReporter {
  return current;
}

/**
 * Capture an error. Never throws, never returns a promise to forget to await.
 *
 * Returns the fingerprint so the caller can log or display it — quoting the
 * same id a user saw is what turns "it crashed" into a searchable incident.
 */
export function captureError(error: unknown, options: CaptureOptions): string {
  try {
    const report = buildReport(error, options);
    current.report(report);
    return report.fingerprint;
  } catch {
    return 'unknown';
  }
}
