/**
 * Supabase client for server-side usage — DEC-009.
 *
 * Session lives in httpOnly cookies, so it is never readable from JavaScript.
 * That is the whole point: an XSS on a finance app must not become account
 * takeover. The consequence is that `createBrowserClient` can no longer see the
 * session — all auth happens through server actions and this client.
 *
 * ALWAYS use `getUser()` for authorization decisions, never `getSession()`:
 * getSession() reads the cookie without verifying the JWT signature, so on the
 * server it is attacker-controlled input.
 */
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/** Cookie flags for every auth cookie we write (DEC-009). */
export const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

/**
 * Create a request-scoped Supabase client bound to Next's cookie store.
 * Never share the returned client across requests.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: AUTH_COOKIE_OPTIONS,
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, { ...AUTH_COOKIE_OPTIONS, ...options });
            }
          } catch {
            // Server Components cannot set cookies. This is safe to swallow
            // *only* because proxy.ts refreshes the session on every matched
            // request and writes the rotated cookies to the response there.
          }
        },
      },
    },
  );
}

/**
 * The signature-verified current user, or null.
 * This is the only trustworthy source of identity on the server.
 */
export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** What the second-factor state of this session is — audit item 18. */
export interface MfaState {
  /** A verified TOTP factor exists on the account. */
  enrolled: boolean;
  /** THIS session has presented it. */
  stepped: boolean;
  /** The verified factor's id, for issuing a challenge. */
  factorId: string | null;
}

/**
 * Read the session's assurance level.
 *
 * Two facts, and the UI needs both because they call for different screens:
 * whether the ACCOUNT has an authenticator (no → an enrolment flow) and whether
 * THIS SESSION has presented it (no → a six-digit box). Reporting either as the
 * other sends the operator somewhere that cannot help them.
 *
 * ── WHY getUser() FIRST, AND WHY THE CLAIM IS READ BY HAND ───────────────────
 * `mfa.getAuthenticatorAssuranceLevel()` and `mfa.listFactors()` both read the
 * session out of the cookie WITHOUT verifying its signature — which is why the
 * SDK logs a warning about it, and why the rule at the top of this file says
 * authorization decisions use `getUser()`. On the server the cookie is
 * attacker-supplied input, so a forged `aal2` would otherwise render the
 * console (empty, since the API re-checks — but rendered).
 *
 * `getUser()` sends the access token to the Auth server, which validates its
 * signature. Once that has succeeded the token is authentic, so reading `aal`
 * out of it is sound — and `user.factors` comes back verified in the same
 * round trip, so this costs one call rather than three.
 *
 * Failures resolve to "not enrolled, not stepped up" — the closed answer. A
 * wrong `false` costs a redundant prompt; a wrong `true` would open a door.
 */
export async function getMfaState(): Promise<MfaState> {
  const supabase = await createClient();
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) return { enrolled: false, stepped: false, factorId: null };

    const verified = (user.factors ?? []).find(
      (factor) => factor.factor_type === 'totp' && factor.status === 'verified',
    );

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const aal = session?.access_token ? readAalClaim(session.access_token) : null;

    return {
      enrolled: Boolean(verified),
      stepped: aal === 'aal2',
      factorId: verified?.id ?? null,
    };
  } catch {
    return { enrolled: false, stepped: false, factorId: null };
  }
}

/**
 * Pull `aal` out of an access token that has ALREADY been verified by
 * `getUser()`.
 *
 * Decoding without verifying would be indefensible on its own; it is safe here
 * only because the caller established authenticity first. Kept as a named
 * function so that ordering is a visible precondition rather than an accident
 * of where the lines happen to sit.
 */
function readAalClaim(accessToken: string): string | null {
  try {
    const payload = accessToken.split('.')[1];
    if (!payload) return null;
    const claims = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8'),
    ) as { aal?: unknown };
    return typeof claims.aal === 'string' ? claims.aal : null;
  } catch {
    return null;
  }
}
