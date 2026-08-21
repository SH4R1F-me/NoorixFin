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

export type ApiHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

type MethodKey = Lowercase<ApiHttpMethod>;
type MethodsOf<P extends ApiPath> = {
  [M in MethodKey]: M extends keyof paths[P]
    ? paths[P][M] extends never | undefined
      ? never
      : M
    : never;
}[MethodKey];

type StripVersion<P extends string> = P extends `/v1${infer Rest}` ? Rest : never;
type ExpandParameters<P extends string> =
  P extends `${infer Head}{${string}}${infer Tail}`
    ? `${Head}${string}${ExpandParameters<Tail>}`
    : P;
type RuntimeRoute<P extends ApiPath> = ExpandParameters<StripVersion<P>>;

/** Runtime route accepted by both application transports (the `/v1` prefix is added there). */
export type ApiRuntimePath = {
  [P in ApiPath]: RuntimeRoute<P> | `${RuntimeRoute<P>}?${string}`;
}[ApiPath];

type WithoutQuery<P extends string> = P extends `${infer Route}?${string}` ? Route : P;
type SegmentMatches<Runtime extends string, Contract extends string> =
  Contract extends `{${string}}` ? true : Runtime extends Contract ? true : false;
type RouteMatches<Runtime extends string, Contract extends string> =
  Runtime extends `${infer RuntimeHead}/${infer RuntimeTail}`
    ? Contract extends `${infer ContractHead}/${infer ContractTail}`
      ? SegmentMatches<RuntimeHead, ContractHead> extends true
        ? RouteMatches<RuntimeTail, ContractTail>
        : false
      : false
    : Contract extends `${string}/${string}`
      ? false
      : SegmentMatches<Runtime, Contract>;
type ExactContractPathFor<P extends ApiRuntimePath> = {
  [K in ApiPath]: WithoutQuery<P> extends StripVersion<K>
    ? StripVersion<K> extends WithoutQuery<P>
      ? K
      : never
    : never;
}[ApiPath];
type PatternContractPathFor<P extends ApiRuntimePath> = {
  [K in ApiPath]: RouteMatches<WithoutQuery<P>, StripVersion<K>> extends true ? K : never;
}[ApiPath];
type ContractPathFor<P extends ApiRuntimePath> = [ExactContractPathFor<P>] extends [never]
  ? PatternContractPathFor<P>
  : ExactContractPathFor<P>;

/** HTTP methods actually published for a runtime route. */
export type ApiRuntimeMethod<P extends ApiRuntimePath> = Uppercase<
  MethodsOf<ContractPathFor<P>>
> &
  ApiHttpMethod;

/** Runtime routes that publish the given HTTP method. */
export type ApiRuntimePathForMethod<M extends ApiHttpMethod> =
  {
    [P in ApiPath]: Lowercase<M> extends MethodsOf<P>
      ? RuntimeRoute<P> | `${RuntimeRoute<P>}?${string}`
      : never;
  }[ApiPath];

type OperationFor<
  P extends ApiRuntimePath,
  M extends ApiHttpMethod,
> = paths[ContractPathFor<P>][Lowercase<M> & MethodsOf<ContractPathFor<P>>];

type JsonBodyOf<Operation> = Operation extends {
  requestBody: { content: { 'application/json': infer Body } };
}
  ? Body
  : never;

/** JSON body required by the generated operation, or `never` for bodyless operations. */
export type ApiRuntimeRequestBody<
  P extends ApiRuntimePath,
  M extends ApiHttpMethod,
> = JsonBodyOf<OperationFor<P, M>>;

type SuccessResponse<Responses> = {
  [Status in keyof Responses]: `${Status & (string | number)}` extends `2${string}`
    ? Responses[Status]
    : never;
}[keyof Responses];

type JsonResponseOf<Response> = Response extends {
  content: { 'application/json': infer Body };
}
  ? Body
  : Response extends { content?: never }
    ? undefined
    : unknown;

/** Successful JSON envelope published for the runtime operation. */
export type ApiRuntimeResponse<
  P extends ApiRuntimePath,
  M extends ApiHttpMethod,
> = OperationFor<P, M> extends { responses: infer Responses }
  ? JsonResponseOf<SuccessResponse<Responses>>
  : never;

type BodyOption<Body> = [Body] extends [never]
  ? { body?: never }
  : { body: Body };

/** Shared, generated request contract used by the web and mobile transports. */
export type ApiRuntimeRequestOptions<
  P extends ApiRuntimePath,
  M extends ApiHttpMethod,
> = { method: M } & BodyOption<ApiRuntimeRequestBody<P, M>>;

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
