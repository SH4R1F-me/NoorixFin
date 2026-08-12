/**
 * Redaction — what must never reach an error tracker.
 *
 * This is the part of error reporting that is specific to *this* product. An
 * error report is a copy of program state leaving the system, and on a personal
 * finance app that state is someone's salary, their payees and their notes.
 * DEC-016 already forbids operators from seeing a user's ledger through the
 * admin console; shipping the same values to a third-party error tracker would
 * route around that decision rather than honour it.
 *
 * The policy is **deny by default on keys, and scrub values in free text**:
 *
 *   · A key that looks financial or personal is replaced wholesale. Nobody
 *     needs the amount to fix a null-pointer bug.
 *   · A key that looks like a credential is replaced even though it "should
 *     not be there" — the whole point is that it should not be, and one day it
 *     will be.
 *   · Strings that survive are still scrubbed for tokens and long digit runs,
 *     because the sensitive value is often interpolated into a message rather
 *     than sitting in a field.
 */

export const REDACTED = '[redacted]';

/**
 * Matched against the key name, case-insensitively, as a substring.
 *
 * Substring rather than exact match on purpose: `amount`, `amount_minor`,
 * `totalAmount` and `amountMinorUnits` are all the same class of value, and an
 * exact list would miss the fourth one someone adds next month.
 */
const SENSITIVE_KEY = new RegExp(
  [
    // Money and ledger content
    'amount',
    'balance',
    'payee',
    'note',
    'memo',
    'debit',
    'credit',
    'salary',
    'income',
    // Identity
    'email',
    'phone',
    'address',
    'display_name',
    'displayname',
    'full_name',
    'fullname',
    'avatar',
    // Credentials
    'password',
    'token',
    'secret',
    'authorization',
    'cookie',
    'session',
    'api_key',
    'apikey',
    'jwt',
    'bearer',
    'service_role',
    'anon_key',
  ].join('|'),
  'i',
);

/** Values that must be scrubbed even inside an otherwise innocuous string. */
const SENSITIVE_VALUE: Array<[RegExp, string]> = [
  // A JWT anywhere in free text. Three base64url segments.
  [/eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}/g, '<jwt>'],
  [/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer <token>'],
  // Supabase publishable/secret keys.
  [/sb_(?:publishable|secret)_[A-Za-z0-9_-]+/g, '<supabase-key>'],
  // A run of 12+ digits is a card or account number far more often than
  // anything a stack trace needs.
  [/\b\d{12,}\b/g, '<digits>'],
  [/[\w.+-]+@[\w-]+\.[\w.]+/g, '<email>'],
];

export function redactString(value: string): string {
  let out = value;
  for (const [pattern, replacement] of SENSITIVE_VALUE) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

/**
 * Deep-redact an arbitrary structure.
 *
 * `depth` exists because error context is frequently a cyclic object graph (a
 * request holding a socket holding a server holding the request), and a naive
 * walk either stack-overflows or serialises the process. Anything past the
 * limit is summarised rather than followed.
 */
export function redact(value: unknown, depth = 4): unknown {
  if (value === null || value === undefined) return value;

  if (typeof value === 'string') return redactString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'function') return '[function]';

  if (depth <= 0) return '[depth-limit]';

  if (Array.isArray(value)) {
    // Bounded: a 10k-element array in a report is never the useful part.
    return value.slice(0, 50).map((item) => redact(item, depth - 1));
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactString(value.message),
      stack: value.stack ? redactString(value.stack) : undefined,
    };
  }

  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEY.test(key) ? REDACTED : redact(item, depth - 1);
    }
    return out;
  }

  return '[unserialisable]';
}
