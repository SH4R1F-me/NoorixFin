/**
 * Compile-time checks for the helper types.
 *
 * There is no test runner here: this file is checked by `tsc --noEmit` as part
 * of `pnpm typecheck`, and a broken helper is a build failure. That is the
 * right granularity — these types have no runtime behaviour to assert on, and
 * the only way they can be wrong is by failing to resolve.
 *
 * It also serves as the usage example, which is why the assertions are written
 * as the calls a caller would actually make.
 */
import type {
  ApiPath,
  ApiResponse,
  ApiPathParams,
  ApiErrorBody,
  ApiSchemas,
} from './index';

/** Fails to compile if `Actual` is not assignable to `Expected`. */
type Expect<T extends true> = T;
type Extends<Actual, Expected> = Actual extends Expected ? true : false;

// ── The generated paths include the routes added this session ────────────
type _HealthIsAPath = Expect<Extends<'/v1/health', ApiPath>>;
type _ReadyIsAPath = Expect<Extends<'/v1/health/ready', ApiPath>>;
type _TransactionsIsAPath = Expect<
  Extends<'/v1/workspaces/{workspaceId}/transactions', ApiPath>
>;

// ── A response body resolves to an object, not `never` or `any` ──────────
type HealthBody = ApiResponse<'/v1/health', 'get'>;
type _HealthResolves = Expect<Extends<HealthBody, Record<string, unknown>>>;

// ── Path params are extracted with their names ───────────────────────────
type TxParams = ApiPathParams<'/v1/workspaces/{workspaceId}/transactions', 'get'>;
type _WorkspaceIdIsThere = Expect<Extends<TxParams, { workspaceId: string }>>;

// ── The error catalogue reached the generated schema ─────────────────────
type _ErrorBodyExists = Expect<Extends<ApiErrorBody, ApiSchemas['ApiErrorBody']>>;

// `code` must be the enum, not a bare string: if this ever widens to `string`,
// the injected catalogue stopped reaching the document and every client
// silently loses the one field worth branching on.
type ErrorCode = NonNullable<ApiErrorBody>['code'];
type _CodeIsNarrowed = Expect<Extends<'TRANSACTION_NOT_FOUND', ErrorCode>>;
type _CodeIsNotWideString = Expect<Extends<string, ErrorCode> extends true ? false : true>;

// Referenced so the compiler does not report them as unused declarations.
export type _Assertions = [
  _HealthIsAPath,
  _ReadyIsAPath,
  _TransactionsIsAPath,
  _HealthResolves,
  _WorkspaceIdIsThere,
  _ErrorBodyExists,
  _CodeIsNarrowed,
  _CodeIsNotWideString,
];
