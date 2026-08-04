/**
 * NestJS API client — DEC-005, DEC-010.
 *
 * Every write goes through this, never directly into Supabase. NestJS is the
 * only place that enforces balanced double-entry postings, idempotency, version
 * checks, and audit. A device inserting a `journal_entry` without its balancing
 * `journal_postings` would produce a corrupt ledger that no client-side code
 * could detect — so "sync with Supabase" means pull from Supabase, push through
 * the API.
 */
import { getAccessToken } from './supabase';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** 4xx (except 408/429) means retrying the same payload will fail again. */
  get isPermanent(): boolean {
    return (
      this.status >= 400 &&
      this.status < 500 &&
      this.status !== 408 &&
      this.status !== 429
    );
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Reused across every retry of the same logical write (FIN-02). */
  idempotencyKey?: string;
  signal?: AbortSignal;
};

export async function apiFetch<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const token = await getAccessToken();
  if (!token) {
    throw new ApiError(401, 'NOT_AUTHENTICATED', 'No active session');
  }

  const { method = 'GET', body, idempotencyKey, signal } = options;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

  let response: Response;
  try {
    response = await fetch(`${API_URL}/v1${path}`, {
      method,
      headers,
      ...(signal ? { signal } : {}),
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch (cause) {
    // Network-level failure: offline, DNS, TLS, timeout. Explicitly NOT
    // permanent — the queue must retry these rather than parking them.
    throw new ApiError(
      0,
      'NETWORK_UNAVAILABLE',
      cause instanceof Error ? cause.message : 'Network request failed',
    );
  }

  if (!response.ok) {
    let code = 'UNKNOWN';
    let message = response.statusText;
    try {
      const parsed = (await response.json()) as { code?: string; message?: string };
      code = parsed.code ?? code;
      message = parsed.message ?? message;
    } catch {
      // Non-JSON error body — keep the status text.
    }
    throw new ApiError(response.status, code, message);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
