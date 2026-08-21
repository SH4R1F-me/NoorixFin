/**
 * Client-side error reporting for the web app (audit gap R1).
 *
 * The API records its own failures in `system_events`, but a failure that
 * happens **in the browser** — a hydration mismatch, a client component
 * throwing, a render error in a boundary — never reaches the server at all.
 * Those were previously `console.error` and nothing else, which means they were
 * invisible unless a user happened to have devtools open and mention it.
 *
 * **Why the release is threaded through `NEXT_PUBLIC_*`.** Next inlines only
 * that prefix into the browser bundle, so `resolveRelease()`'s normal
 * environment lookup returns nothing client-side. Passing them explicitly is
 * what makes a browser error carry the same release string as a server one —
 * without which the two halves of one bad deploy cannot be correlated.
 */
import {
  captureError,
  DurableHttpErrorReporter,
  fingerprint,
  resolveRelease,
  setErrorReporter,
  type ErrorReport,
} from '@noorixfin/observability';

export const WEB_RELEASE = resolveRelease('web', {
  APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION,
  APP_COMMIT: process.env.NEXT_PUBLIC_APP_COMMIT,
  NODE_ENV: process.env.NODE_ENV,
});

let browserReporter: DurableHttpErrorReporter | null = null;

function ensureBrowserReporter(): void {
  const endpoint = process.env.NEXT_PUBLIC_ERROR_EXPORT_URL;
  if (browserReporter || !endpoint || typeof window === 'undefined') return;
  const key = 'noorixfin.error-export-queue.v1';
  browserReporter = new DurableHttpErrorReporter({
    endpoint,
    store: {
      load: async () => {
        try {
          const parsed = JSON.parse(window.localStorage.getItem(key) ?? '[]') as unknown;
          return Array.isArray(parsed) ? (parsed as ErrorReport[]) : [];
        } catch {
          return [];
        }
      },
      save: async (reports) => {
        window.localStorage.setItem(key, JSON.stringify(reports));
      },
    },
    fetch: async (url, init) => {
      const response = await window.fetch(url, {
        ...init,
        signal: AbortSignal.timeout(10_000),
      });
      return { ok: response.ok, status: response.status };
    },
  });
  setErrorReporter(browserReporter);
}

/**
 * The id shown to the user — pure, so a component can compute it during render.
 *
 * Split from `reportClientError` because reporting is a side effect and this is
 * not. An error boundary needs the id to *render*, and deriving it in an effect
 * would mean a `setState` inside `useEffect` — a cascading extra render, and
 * exactly what `react-hooks/set-state-in-effect` exists to stop.
 *
 * Must stay in step with `captureError`'s own fingerprint: same inputs, same
 * id. `packages/observability/src/index.test.ts` ("agrees with a direct
 * fingerprint() call on the same inputs") asserts they do, because a silent
 * divergence would show the user an id that matches nothing an operator can
 * search for — worse than showing no id at all, because it looks actionable.
 */
export function clientFingerprint(error: Error, context: string): string {
  return fingerprint({
    name: error.name,
    message: error.message,
    stack: error.stack,
    context,
  });
}

/**
 * Report a browser-side error and return its fingerprint.
 *
 * The fingerprint is shown to the user in the error state. That is the point:
 * "quote this id" turns an unreproducible complaint into one row an operator
 * can find, and it groups every user hitting the same bug under one id rather
 * than N unrelated reports.
 *
 * Next's own `digest` is passed as context because it is what appears in the
 * server log for a server-render failure — including it means the client
 * fingerprint and the server entry can be joined.
 */
export function reportClientError(error: Error & { digest?: string }, context: string): string {
  ensureBrowserReporter();
  return captureError(error, {
    release: WEB_RELEASE,
    context,
    extra: {
      digest: error.digest,
      // Redacted downstream. A dashboard path can name a resource, so this
      // goes through the same scrubbing as everything else.
      pathname: typeof window === 'undefined' ? undefined : window.location.pathname,
    },
  });
}
