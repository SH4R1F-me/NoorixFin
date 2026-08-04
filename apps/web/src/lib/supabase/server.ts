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
