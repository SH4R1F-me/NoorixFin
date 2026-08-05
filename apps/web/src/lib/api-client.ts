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

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

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

  const response = await fetch(`${API_URL}/v1${path}`, {
    method,
    headers,
    cache,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (!response.ok) {
    let code = 'UNKNOWN';
    let message = response.statusText;
    try {
      const parsed = (await response.json()) as { code?: string; message?: string };
      code = parsed.code ?? code;
      message = parsed.message ?? message;
    } catch {
      // Non-JSON error body (proxy error page, gateway timeout). Keep the status text.
    }
    throw new ApiError(response.status, code, message);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
