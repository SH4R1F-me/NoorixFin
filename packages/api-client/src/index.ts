/**
 * @noorixfin/api-client — types generated from the API's own OpenAPI document.
 *
 * This package was an `echo 'TODO'` for the project's whole life, and in its
 * absence `apps/web/src/lib/api-client.ts` and `apps/mobile/src/lib/api.ts`
 * each grew a hand-maintained idea of what the API returns. Nothing checked
 * either against the server, so a renamed field stayed green in both clients
 * and failed at runtime, on a device, in production.
 *
 * **What this deliberately does NOT do: replace either transport.** Both
 * `apiFetch` implementations carry behaviour that matters and is specific to
 * where they run — the web one enforces a 10-second timeout and converts an
 * unreachable API into a branded degraded page (§6), the mobile one supplies
 * the outbox row id as the idempotency key across retries (§7). A generated
 * runtime client would have to reimplement both to be adopted, which is how
 * generated clients end up unused. Types are the part that was actually
 * missing; the transports were never the problem.
 *
 * Regenerate with `pnpm --filter @noorixfin/api-client generate`.
 * CI fails on drift via `check:fresh`.
 */
import type { paths, components, operations } from './schema';

export type { paths, components, operations };

/** Every schema the API publishes, e.g. `ApiSchemas['ApiErrorBody']`. */
export type ApiSchemas = components['schemas'];

export const API_VERSION = 'v1';

/** Base API path. */
export function getApiUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, '')}/${API_VERSION}`;
}

// ─── Type helpers ─────────────────────────────────────────────────────────
//
// Reaching into the generated `paths` type by hand is verbose enough that
// callers give up and write `any`, which loses exactly what generating the
// types bought. These make the common lookups one line.

/** Paths the API serves, as a union of string literals. */
export type ApiPath = keyof paths;

type MethodsOf<P extends ApiPath> = keyof paths[P];

/**
 * The 200/201 response body for a path and method.
 *
 * @example
 *   type Health = ApiResponse<'/v1/health', 'get'>;
 */
export type ApiResponse<
  P extends ApiPath,
  M extends MethodsOf<P>,
> = paths[P][M] extends {
  responses: infer R;
}
  ? R extends { 200: { content: { 'application/json': infer B } } }
    ? B
    : R extends { 201: { content: { 'application/json': infer B } } }
      ? B
      : never
  : never;

/** The JSON request body for a path and method. */
export type ApiRequestBody<
  P extends ApiPath,
  M extends MethodsOf<P>,
> = paths[P][M] extends {
  requestBody?: { content: { 'application/json': infer B } };
}
  ? B
  : never;

/** Path parameters for a path and method, e.g. `{ workspaceId: string }`. */
export type ApiPathParams<
  P extends ApiPath,
  M extends MethodsOf<P>,
> = paths[P][M] extends { parameters: { path: infer Q } } ? Q : never;

/** Query parameters for a path and method. */
export type ApiQueryParams<
  P extends ApiPath,
  M extends MethodsOf<P>,
> = paths[P][M] extends { parameters: { query?: infer Q } } ? Q : never;

/**
 * The error body every failure uses.
 *
 * Prefer `@noorixfin/domain`'s `ApiErrorCode` when branching: it is a union of
 * the actual codes, whereas the generated schema types `code` as the enum but
 * without the retryability metadata the outbox needs.
 */
export type ApiErrorBody = ApiSchemas['ApiErrorBody'];
