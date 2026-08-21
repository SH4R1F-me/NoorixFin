/**
 * @noorixfin/observability — release identity, error grouping, redaction and
 * trace context, shared by the API, the web app and the mobile app.
 *
 * Audit gap R1 was "no error tracking or APM". It named three concrete
 * shortcomings of the existing `system_events` table: no release tagging, no
 * stack-trace grouping, and no traces. All three are fixed here, and none of
 * them needs a vendor — which matters, because this product advertises itself
 * as free, self-hostable and free of trackers.
 *
 * Adding a hosted error tracker later means implementing one `ErrorReporter`
 * and calling `setErrorReporter`. No call site changes.
 *
 * ```ts
 * // apps/api/src/main.ts
 * const release = resolveRelease('api');
 * setErrorReporter(compositeReporter([myAdapter]));   // optional
 *
 * // anywhere
 * const id = captureError(error, { release, context: 'POST /v1/transactions' });
 * ```
 */
export { resolveRelease, type ReleaseInfo } from './release';

export { fingerprint, normaliseMessage, normaliseStack } from './fingerprint';

export { redact, redactString, REDACTED } from './redact';

export {
  buildReport,
  captureError,
  compositeReporter,
  getErrorReporter,
  noopReporter,
  setErrorReporter,
  type CaptureOptions,
  type ErrorReport,
  type ErrorReporter,
} from './reporter';

export {
  DurableHttpErrorReporter,
  toOtlpLogs,
  type DurableHttpReporterOptions,
  type ErrorExportFetch,
  type ErrorReportStore,
} from './durable-http-reporter';

export {
  childSpan,
  formatTraceparent,
  newTraceContext,
  parseTraceparent,
  type TraceContext,
} from './trace';
