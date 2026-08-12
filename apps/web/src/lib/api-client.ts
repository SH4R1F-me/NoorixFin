import 'server-only';

/**
 * Server-side client for the NestJS API — DEC-005, DEC-009.
 *
 * Runs on the server only. With httpOnly session cookies the browser cannot
 * read the access token, so it cannot attach `Authorization: Bearer` itself.
 * Client components reach the API through Server Components / Server Actions
 * that call this — which is the desired shape anyway: DEC-005 says every
 * financial write goes through NestJS, and this keeps the token off the client.
 *
 * On single-flight refresh (DEC-009): that pattern exists to stop N concurrent
 * browser requests each firing their own refresh. It does not apply here.
 * `proxy.ts` refreshes once per request before any handler runs, so by the time
 * this client reads the session the token is already fresh. Retaining a
 * single-flight lock would be dead code guarding a race that cannot occur.
 */
import { createClient } from './supabase/server';
import { isRetryable, type ApiErrorCode } from '@noorixfin/domain';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/**
 * Codes this client synthesises, which the API can never send.
 *
 * Kept separate from `ApiErrorCode` on purpose: they describe a failure to get
 * an answer, not an answer describing a failure, and conflating the two is how
 * `isRetryable` would end up consulting a catalogue that has no entry for them.
 */
export type ClientErrorCode = 'API_UNREACHABLE' | 'UNKNOWN';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    /**
     * Typed against the published catalogue rather than `string`, so a
     * `code === 'TRANSACTON_NOT_FOUND'` typo is a compile error instead of a
     * branch that silently never runs.
     */
    readonly code: ApiErrorCode | ClientErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** True when the API could not be contacted at all, as opposed to answering with an error. */
  get isUnreachable(): boolean {
    return this.code === 'API_UNREACHABLE';
  }

  /**
   * True when repeating the identical request could plausibly succeed.
   *
   * An unreachable API counts: the request never reached a handler, so nothing
   * about it was rejected. Everything else defers to the catalogue, which
   * fails closed on codes it does not know.
   */
  get isRetryable(): boolean {
    return this.isUnreachable || isRetryable(this.code);
  }
}

/**
 * How long to wait before giving up on the API.
 *
 * Without this, a hung API (accepting the connection but never answering)
 * stalls the whole server render until Next's own timeout — the user sees a
 * blank tab rather than the degraded-but-branded page the callers can render.
 * A refusal fails in milliseconds; a hang is the case this bounds.
 */
const REQUEST_TIMEOUT_MS = 10_000;

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Required on every mutating call (Blueprint §8.3, DEC-010). */
  idempotencyKey?: string;
  /** Next.js fetch cache hint. Defaults to no-store — financial data is never stale-safe. */
  cache?: RequestCache;
};

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  // getSession() here is deliberate and is NOT an authorization decision — we
  // only need the raw access_token to forward. NestJS verifies its signature on
  // arrival. Authorization checks still use getUser() (see supabase/server.ts).
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new ApiError(401, 'NOT_AUTHENTICATED', 'No active session');
  }

  const { method = 'GET', body, idempotencyKey, cache = 'no-store' } = options;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  };
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

  // ── Why this try/catch exists ─────────────────────────────────────────────
  // Before it, the failure modes were backwards: "the API returned 500"
  // degraded gracefully into an ApiError that every caller already handles,
  // while "the API is unreachable" escaped as a raw TypeError. That TypeError
  // was thrown inside getSessionContext(), which runs in dashboard/layout.tsx,
  // so a refused connection took down every dashboard route with a 500 —
  // verified during the 2026-08-04 audit on /dashboard, /transactions,
  // /accounts and /settings.
  //
  // Normalising to ApiError(503) means there is exactly ONE error type leaving
  // this module. Callers already branch on `instanceof ApiError`, so they all
  // inherit the graceful path without changing.
  let response: Response;
  try {
    response = await fetch(`${API_URL}/v1${path}`, {
      method,
      headers,
      cache,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch (error) {
    // Distinguished only in the message: a timeout means the API accepted the
    // connection and stopped answering, which is a different operational fault
    // from nothing listening on the port.
    const timedOut = error instanceof Error && error.name === 'TimeoutError';
    throw new ApiError(
      503,
      'API_UNREACHABLE',
      timedOut
        ? `The API did not respond within ${REQUEST_TIMEOUT_MS / 1000}s`
        : 'Could not reach the API',
    );
  }

  if (!response.ok) {
    // Widened deliberately: the wire can carry a code this build has never
    // heard of — an older client against a newer API. Narrowing it here with a
    // runtime check would only trade an unknown code for a lost one, and
    // `isRetryable` already fails closed on anything it does not recognise.
    let code: ApiErrorCode | ClientErrorCode = 'UNKNOWN';
    let message = response.statusText;
    try {
      const parsed = (await response.json()) as { code?: string; message?: string };
      code = (parsed.code as ApiErrorCode | undefined) ?? code;
      message = parsed.message ?? message;
    } catch {
      // Non-JSON error body (proxy error page, gateway timeout). Keep the status text.
    }
    throw new ApiError(response.status, code, message);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
