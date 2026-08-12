/**
 * The catalogue must describe the API, not a memory of it.
 *
 * `@noorixfin/domain`'s `API_ERRORS` is published for clients to branch on, so
 * a code added to a service and forgotten here is a client that cannot handle
 * a failure it will actually receive. Rather than trust anyone to update two
 * places, this re-derives the truth from the source on every run.
 *
 * It reads `apps/api/src/**\/*.ts` for `code: 'SOME_CODE'` and compares the set
 * with the catalogue's keys. The extraction is deliberately dumb — a literal
 * regex over source text — because anything cleverer would need the codes to
 * be declared in a particular way, and the point is to catch the case where
 * someone did not follow the convention.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  API_ERRORS,
  API_ERROR_CODES,
  INTERNAL_EVENT_CODES,
  isRetryable,
  isKnownErrorCode,
} from '@noorixfin/domain';

const SRC = join(__dirname, '..');

/**
 * Postgres SQLSTATEs and PostgREST codes the API *reads* from driver errors.
 * They are compared against, never thrown, so they must not be catalogued as
 * API error codes. Listed explicitly so a genuinely new code cannot hide by
 * happening to look like one of these.
 */
const NOT_API_CODES = new Set(['PGRST116', 'BDT', 'USD']);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    if (!entry.endsWith('.ts') || entry.includes('.spec.')) return [];
    return [full];
  });
}

function codesInSource(): Set<string> {
  const codes = new Set<string>();
  for (const file of sourceFiles(SRC)) {
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(/code:\s*'([A-Z][A-Z_0-9]*)'/g)) {
      const code = match[1];
      // Purely numeric SQLSTATEs never match the leading-letter pattern, but
      // the named ones do.
      if (!NOT_API_CODES.has(code)) codes.add(code);
    }
  }
  return codes;
}

describe('API error catalogue', () => {
  const inSource = codesInSource();
  const catalogued = new Set<string>([
    ...API_ERROR_CODES,
    ...INTERNAL_EVENT_CODES,
  ]);

  it('finds codes in the source at all (guards the extraction itself)', () => {
    // Without this, a regex that silently stopped matching would make both
    // assertions below pass against two empty sets.
    expect(inSource.size).toBeGreaterThan(50);
    expect(inSource.has('TRANSACTION_NOT_FOUND')).toBe(true);
  });

  it('documents every code the API can emit', () => {
    const undocumented = [...inSource].filter((c) => !catalogued.has(c)).sort();
    // Asserting on the array rather than a count, so a failure names the codes
    // to add instead of just saying the number changed.
    expect(undocumented).toEqual([]);
  });

  it('has no entries for codes the API no longer emits', () => {
    const stale = [...catalogued].filter((c) => !inSource.has(c)).sort();
    expect(stale).toEqual([]);
  });

  it('gives every entry a status, a description and a retry verdict', () => {
    // Collected rather than asserted in the loop: jest's expect takes no
    // message argument, so a bare assertion inside a loop reports only that
    // "false is not true" without saying which of 59 entries was at fault.
    const malformed = Object.entries(API_ERRORS)
      .filter(
        ([, def]) =>
          def.status < 400 ||
          def.status >= 600 ||
          def.description.length <= 10 ||
          typeof def.retryable !== 'boolean',
      )
      .map(([code]) => code);

    expect(malformed).toEqual([]);
  });

  it('never marks a 4xx client mistake as retryable', () => {
    // A validation failure that claims to be retryable sends the mobile outbox
    // into a loop that can never succeed — it would retry a malformed body
    // until the backoff cap, then park it anyway.
    const clientMistakes = [
      'INVALID_AMOUNT',
      'MISSING_TOKEN',
      'CATEGORY_REQUIRED',
    ];
    const wronglyRetryable = clientMistakes.filter((code) => isRetryable(code));

    expect(wronglyRetryable).toEqual([]);
  });

  it('treats an unknown code as non-retryable', () => {
    // Failing closed: a code this build has never heard of is not something to
    // hammer the API with.
    expect(isRetryable('SOMETHING_FROM_THE_FUTURE')).toBe(false);
    expect(isKnownErrorCode('SOMETHING_FROM_THE_FUTURE')).toBe(false);
  });
});
