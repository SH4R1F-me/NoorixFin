/**
 * Unit-test stand-in for `jose`.
 *
 * ── WHY ──────────────────────────────────────────────────────────────────────
 * `jose@6` ships ESM only (`"exports": { ".": { "default": "./dist/webapi/…" } }`
 * with no CommonJS entry), and this package's Jest setup is CommonJS. Any spec
 * whose import graph reaches `jwt-verifier.service.ts` therefore dies with
 * `SyntaxError: Unexpected token 'export'` inside node_modules — a failure about
 * module formats, in a file the test never meant to load.
 *
 * ── WHY A STUB AND NOT A TRANSFORM ───────────────────────────────────────────
 * Teaching ts-jest to transpile a dependency's ESM build would make every unit
 * test pay for it, and it would be pretending to test something it does not:
 * NO unit test exercises real JWT verification, and none should. Signature,
 * issuer, audience and expiry are Supabase's tokens against Supabase's keys —
 * asserting on them with hand-made fixtures tests the fixture. That path is
 * covered where it is real, by the live checks and the E2E suite, which sign in
 * against an actual Auth server.
 *
 * These exports throw rather than returning a plausible payload. A stub that
 * silently "verifies" anything would turn a test that accidentally depends on
 * real crypto into a passing one, which is the failure this file exists to
 * avoid making possible.
 */
const unavailable = (name: string) => (): never => {
  throw new Error(
    `jose.${name} is stubbed in unit tests. JWT verification is covered by the ` +
      `live and E2E suites against a real Auth server; a unit test reaching it ` +
      `is testing its own fixture. Inject a verifier double instead.`,
  );
};

export const jwtVerify = unavailable('jwtVerify');
export const createRemoteJWKSet = unavailable('createRemoteJWKSet');
export const decodeJwt = unavailable('decodeJwt');
export const SignJWT = unavailable('SignJWT');

export type JWTPayload = Record<string, unknown>;
export type JWTVerifyGetKey = unknown;
