/**
 * The API error catalogue (audit gap A5).
 *
 * `GlobalHttpExceptionFilter` has always shaped failures as
 * `{ statusCode, code, message, requestId, timestamp, path }`. What did not
 * exist was any published list of what `code` can be — so a client wanting to
 * branch on a specific failure had to grep the API source, and a renamed code
 * broke that client silently at runtime.
 *
 * Every entry below was read out of `apps/api/src`, not designed here. The test
 * at `apps/api/src/common/errors.catalogue.spec.ts` re-extracts the codes from
 * the source on every run and fails if the two disagree — a hand-maintained
 * catalogue is a catalogue that rots, and this one is load-bearing for clients.
 *
 * `retryable` is the field worth getting right: it says whether repeating the
 * identical request could plausibly succeed. It is what the mobile outbox needs
 * in order to decide between backing off and parking a mutation as
 * NEEDS_ATTENTION, and today that decision is made from HTTP status alone.
 */

/** HTTP status paired with a code, and whether a retry could ever help. */
export interface ApiErrorDefinition {
  /** The HTTP status the API actually returns with this code today. */
  status: number;
  /** Could an identical retry succeed? `false` means fix the request first. */
  retryable: boolean;
  /** One line, in terms a client author can act on. */
  description: string;
}

/**
 * Codes not raised by a `throw`. They travel as `system_events.event_code` or
 * inside a returned object, so they can appear in an operator's monitoring feed
 * but never in an HTTP response body.
 */
export const INTERNAL_EVENT_CODES = [
  'ADMIN_OPERATION_FAILED',
  'DB_PRIVILEGE_MISSING',
  'TELEMETRY_BUFFER_OVERFLOW',
] as const;

export const API_ERRORS = {
  // ── Authentication (401) ────────────────────────────────────────────────
  MISSING_TOKEN: {
    status: 401,
    retryable: false,
    description: 'No Authorization header, or it was not a Bearer token.',
  },
  INVALID_TOKEN: {
    status: 401,
    retryable: false,
    description: 'Signature, issuer, audience or expiry check failed. Refresh and retry once.',
  },
  AUTH_FAILED: {
    status: 401,
    retryable: false,
    description: 'The token was well-formed but could not be verified.',
  },

  // ── Authorization (403) ─────────────────────────────────────────────────
  NOT_WORKSPACE_MEMBER: {
    status: 403,
    retryable: false,
    description: 'The caller is not a member of this workspace. SUPER_ADMIN does not bypass this.',
  },
  NOT_SUPER_ADMIN: {
    status: 403,
    retryable: false,
    description: 'Operator-only route reached by a non-operator.',
  },
  MFA_REQUIRED: {
    status: 403,
    retryable: false,
    description: 'The admin console requires a session at assurance level aal2 (DEC-024).',
  },
  ACCOUNT_NOT_ACTIVE: {
    status: 403,
    retryable: false,
    description: 'The profile is suspended or pending deletion.',
  },
  NOT_AUTHENTICATED: {
    status: 403,
    retryable: false,
    description: 'No authenticated principal on a route that requires one.',
  },
  AUTHZ_CHECK_FAILED: {
    status: 503,
    retryable: true,
    description: 'The authorization check itself could not run — a dependency was unavailable.',
  },

  // ── Idempotency (409 / 422) ─────────────────────────────────────────────
  IDEMPOTENCY_KEY_REQUIRED: {
    status: 422,
    retryable: false,
    description: 'An operator write reached the interceptor without an Idempotency-Key header.',
  },
  IDEMPOTENCY_KEY_REUSED: {
    status: 422,
    retryable: false,
    description: 'The same key arrived with a different payload. Use a new key.',
  },
  IDEMPOTENCY_KEY_TOO_LONG: {
    status: 422,
    retryable: false,
    description: 'The key exceeded the stored column width.',
  },
  IDEMPOTENCY_IN_PROGRESS: {
    status: 409,
    retryable: true,
    description: 'An identical request is still running. Retry after a short backoff.',
  },

  // ── Not found (404) ─────────────────────────────────────────────────────
  NOT_FOUND: { status: 404, retryable: false, description: 'Generic missing resource.' },
  WORKSPACE_NOT_FOUND: { status: 404, retryable: false, description: 'No such workspace.' },
  ACCOUNT_NOT_FOUND: { status: 404, retryable: false, description: 'No such financial account.' },
  CATEGORY_NOT_FOUND: { status: 404, retryable: false, description: 'No such category.' },
  PARENT_CATEGORY_NOT_FOUND: {
    status: 404,
    retryable: false,
    description: 'The requested parent category does not exist in this workspace.',
  },
  TRANSACTION_NOT_FOUND: { status: 404, retryable: false, description: 'No such journal entry.' },
  TAG_NOT_FOUND: { status: 404, retryable: false, description: 'No such tag.' },
  GOAL_NOT_FOUND: { status: 404, retryable: false, description: 'No such savings goal.' },
  EVENT_NOT_FOUND: { status: 404, retryable: false, description: 'No such calendar event.' },
  USER_NOT_FOUND: { status: 404, retryable: false, description: 'No such user profile.' },
  DEVICE_NOT_FOUND: { status: 404, retryable: false, description: 'No such active user device.' },
  TRANSACTION_NOT_REVERSIBLE: {
    status: 404,
    retryable: false,
    // See KNOWN_STATUS_INCONSISTENCIES — this is a state conflict wearing a 404.
    description:
      'The entry exists but cannot be reversed (already reversed, or not an entry type that can be).',
  },

  // ── Conflict (409) ──────────────────────────────────────────────────────
  PERSONAL_WORKSPACE_EXISTS: {
    status: 409,
    retryable: false,
    description: 'This user already has a personal workspace (DEC-007 allows exactly one).',
  },

  // ── Validation and state (400) ──────────────────────────────────────────
  INVALID_AMOUNT: {
    status: 400,
    retryable: false,
    description: 'Amount was not a positive minor-unit decimal string.',
  },
  AMOUNT_TOO_LARGE: {
    status: 400,
    retryable: false,
    description: 'Amount exceeded the maximum a bigint minor-unit column can hold.',
  },
  INVALID_TYPE: {
    status: 400,
    retryable: false,
    description: 'Unrecognised entry or account type.',
  },
  INVALID_VALUE: { status: 400, retryable: false, description: 'A field failed a domain rule.' },
  INVALID_REFERENCE: {
    status: 400,
    retryable: false,
    description: 'A referenced row does not exist or belongs to another workspace.',
  },
  CATEGORY_REQUIRED: {
    status: 400,
    retryable: false,
    description: 'This entry type requires a category.',
  },
  CATEGORY_KIND_MISMATCH: {
    status: 400,
    retryable: false,
    description: 'The category kind does not match the entry type (income category on an expense).',
  },
  DESTINATION_REQUIRED: {
    status: 400,
    retryable: false,
    description: 'A transfer needs a destination account.',
  },
  NOT_A_LIABILITY: {
    status: 400,
    retryable: false,
    description: 'Debt details were supplied for an account that is not a liability.',
  },
  NO_POSTINGS: {
    status: 400,
    retryable: false,
    description: 'The entry would have produced no postings — a ledger write must balance.',
  },
  ALREADY_REVERSED: {
    status: 400,
    retryable: false,
    description:
      'This entry already has a reversal. History is append-only; there is nothing further to undo.',
  },
  EMPTY_PATCH: { status: 400, retryable: false, description: 'A PATCH body contained no fields.' },
  NO_CHANGES: {
    status: 400,
    retryable: false,
    description: 'The patch matched the stored values.',
  },
  ALREADY_PENDING: {
    status: 400,
    retryable: false,
    description: 'A deletion request is already open for this account.',
  },
  NOT_PENDING: {
    status: 400,
    retryable: false,
    description: 'There is no open deletion request to cancel.',
  },
  CONFIRMATION_MISMATCH: {
    status: 400,
    retryable: false,
    description: 'The typed confirmation did not match what the destructive action required.',
  },
  CANNOT_SUSPEND_SELF: {
    status: 400,
    retryable: false,
    description: 'An operator cannot suspend their own account.',
  },
  LAST_SUPER_ADMIN: {
    status: 400,
    retryable: false,
    // See KNOWN_STATUS_INCONSISTENCIES — also thrown as 403 from another path.
    description:
      'The action would remove the last active operator, leaving the console unreachable.',
  },
  UNKNOWN_SETTING: {
    status: 400,
    retryable: false,
    description: 'The settings key is not in the known-settings allowlist.',
  },
  SYNC_CURSOR_STALLED: {
    status: 400,
    retryable: false,
    description: 'The supplied sync cursor is too old to resume from. Do a full pull.',
  },

  // ── Upstream write failures (400) ───────────────────────────────────────
  // These wrap a database error the caller cannot fix by changing the request,
  // but which is reported as 400 today rather than 5xx. Grouped so that is
  // visible rather than scattered.
  SYNC_FAILED: { status: 400, retryable: true, description: 'The delta-sync query failed.' },
  REVERSAL_FAILED: {
    status: 400,
    retryable: true,
    description: 'The reversal transaction failed.',
  },
  SUMMARY_FAILED: {
    status: 400,
    retryable: true,
    description: 'The workspace summary rollup failed.',
  },
  AGGREGATION_FAILED: {
    status: 400,
    retryable: true,
    description: 'A reporting aggregation failed.',
  },
  PLANNING_WRITE_FAILED: {
    status: 400,
    retryable: true,
    description: 'A budget/goal/calendar write failed.',
  },
  CATEGORY_CREATE_FAILED: {
    status: 400,
    retryable: true,
    description: 'The category insert failed.',
  },
  CATEGORY_SEED_FAILED: {
    status: 400,
    retryable: true,
    description: 'Seeding default categories failed.',
  },
  ONBOARDING_UPDATE_FAILED: {
    status: 400,
    retryable: true,
    description: 'The onboarding state write failed.',
  },
  DELETION_REQUEST_FAILED: {
    status: 400,
    retryable: true,
    description: 'Opening the deletion request failed.',
  },
  CANCEL_FAILED: {
    status: 400,
    retryable: true,
    description: 'Cancelling the deletion request failed.',
  },
  SUSPEND_FAILED: { status: 400, retryable: true, description: 'The suspension write failed.' },
  REINSTATE_FAILED: {
    status: 400,
    retryable: true,
    description: 'The reinstatement write failed.',
  },
  DISMISS_FAILED: {
    status: 400,
    retryable: true,
    description: 'Recording the broadcast dismissal failed.',
  },
  BROADCASTS_UNAVAILABLE: {
    status: 400,
    retryable: true,
    description: 'Broadcasts could not be read.',
  },
} as const satisfies Record<string, ApiErrorDefinition>;

/** Every code the API can put in an error body. */
export type ApiErrorCode = keyof typeof API_ERRORS;

export const API_ERROR_CODES = Object.keys(API_ERRORS) as ApiErrorCode[];

/**
 * Recorded rather than quietly normalised. Changing a status is a breaking
 * change for any client already branching on it, so these are documented as
 * they behave today and left for an explicit decision.
 *
 * 1. `LAST_SUPER_ADMIN` is 400 from `admin.service.ts` (demoting another
 *    operator) and 403 from `account.service.ts` (an operator requesting their
 *    own deletion). One code, two statuses.
 * 2. `TRANSACTION_NOT_REVERSIBLE` is a 404, so a client cannot tell "no such
 *    transaction" from "this one cannot be reversed" by status alone. 409
 *    would say what is actually true.
 */
export const KNOWN_STATUS_INCONSISTENCIES = [
  { code: 'LAST_SUPER_ADMIN', statuses: [400, 403] },
  { code: 'TRANSACTION_NOT_REVERSIBLE', statuses: [404], shouldBe: 409 },
] as const;

/** The wire shape of every failure, as built by GlobalHttpExceptionFilter. */
export interface ApiErrorBody {
  statusCode: number;
  code: ApiErrorCode | string;
  message: string;
  requestId: string;
  timestamp: string;
  path: string;
  /** Present only on validation failures. */
  fieldErrors?: Record<string, string[]>;
}

/** True when repeating the identical request could plausibly succeed. */
export function isRetryable(code: string): boolean {
  return API_ERRORS[code as ApiErrorCode]?.retryable ?? false;
}

export function isKnownErrorCode(code: string): code is ApiErrorCode {
  return code in API_ERRORS;
}
