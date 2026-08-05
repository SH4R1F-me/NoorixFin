/**
 * Next.js Proxy — session refresh + route protection (DEC-009).
 *
 * NOTE: in Next.js 16 the `middleware` file convention was renamed to `proxy`,
 * and the exported function is `proxy`, not `middleware`.
 *
 * This runs before every matched request. Calling `getUser()` here is what
 * triggers a token refresh when the access token has expired; the rotated
 * cookies are written onto the response so the user is never bounced to login
 * mid-session. Server Components cannot set cookies, so if this file stops
 * running, sessions silently stop refreshing.
 */
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

/**
 * Routes that require an authenticated user.
 *
 * `/admin` is listed for the sign-in redirect only — this file does NOT check
 * whether the user is an operator. Doing so would mean a `profiles` lookup on
 * every matched request including static-ish navigations, which is the per-
 * request database cost DEC-011 exists to avoid. The role check lives in
 * app/admin/layout.tsx (which calls notFound()), backed by SuperAdminGuard in
 * the API and RLS in the database.
 */
const PROTECTED_PREFIXES = ['/dashboard', '/admin'];

/** Routes that an already-authenticated user should not see. */
const AUTH_ROUTES = ['/auth', '/auth/login'];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: AUTH_COOKIE_OPTIONS,
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, { ...AUTH_COOKIE_OPTIONS, ...options });
          }
          // @supabase/ssr supplies no-store cache headers alongside auth
          // cookies. These MUST be applied: without them a CDN or reverse proxy
          // can cache a response carrying one user's session cookie and serve
          // it to somebody else.
          for (const [key, value] of Object.entries(headers)) {
            response.headers.set(key, value);
          }
        },
      },
    },
  );

  // Signature-verified. Do not substitute getSession() — it does not verify.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))) {
    const redirectUrl = new URL('/auth/login', request.url);
    // Preserve intent so login can send the user back where they were going.
    redirectUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && AUTH_ROUTES.includes(pathname)) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return response;
}

export const config = {
  // Skip static assets and image optimization — refreshing a session for every
  // icon request would burn Supabase auth calls for nothing (DEC-011).
  matcher: ['/((?!_next/static|_next/image|favicon.ico|images/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
