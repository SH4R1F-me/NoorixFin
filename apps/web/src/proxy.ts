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
 * Content Security Policy (audit gap S1).
 *
 * The nonce lives here rather than in `next.config.ts` because it must be
 * unique per request. Next.js reads the nonce out of the `Content-Security-
 * Policy` request header during render and attaches it to its own framework
 * and flight scripts automatically, so no component has to thread it through.
 *
 * **Why a nonce is affordable here.** The Next docs warn that nonce-based CSP
 * forces every page into dynamic rendering. That warning does not cost this app
 * anything: `next build` reports all 39 routes as `ƒ (Dynamic)` already,
 * because the root layout resolves the user's locale from a cookie (DEC-021).
 * There is no static generation left to lose, so the strong option is free.
 *
 * **Why `style-src` still carries `'unsafe-inline'`.** A nonce covers `<style>`
 * elements, not `style=""` attributes, and the web app styles almost everything
 * with React inline style objects (audit gap E2). A nonce and `'unsafe-inline'`
 * cannot be combined — per the CSP spec a browser that understands the nonce
 * ignores `'unsafe-inline'` entirely — so asking for both would silently blank
 * the site's styling. This is the one deliberate weakening in the policy, and
 * the `@noorixfin/ui` work is what removes the need for it.
 */
function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV === 'development';

  // The browser talks to Supabase directly for auth (DEC-009 keeps the API
  // itself unreachable from the browser, so NEXT_PUBLIC_API_URL is not needed
  // in connect-src). Storage serves the public site-assets bucket for logos.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';

  const directives: string[] = [
    `default-src 'self'`,
    // 'strict-dynamic' means scripts loaded BY a nonced script are trusted too,
    // which is what lets Next's chunk loading work without listing every chunk.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' blob: data:${supabaseUrl ? ` ${supabaseUrl}` : ''}`,
    `font-src 'self' data:`,
    // ws: is the dev-server hot-reload socket; it is absent in production.
    `connect-src 'self'${supabaseUrl ? ` ${supabaseUrl}` : ''}${isDev ? ' ws: wss:' : ''}`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `frame-src 'none'`,
    `manifest-src 'self'`,
    `worker-src 'self' blob:`,
  ];

  // Would rewrite http://localhost subresource requests to https and break
  // local development, so it is production-only.
  if (!isDev) directives.push('upgrade-insecure-requests');

  return directives.join('; ');
}

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
  // Unpredictable and unique per request — a guessable nonce is no nonce.
  const nonce = crypto.randomUUID().replace(/-/g, '');
  const csp = buildCsp(nonce);

  /**
   * Next.js injects the nonce into its own scripts by parsing the CSP off the
   * REQUEST headers, so both values have to be forwarded inward, not merely set
   * on the response. Rebuilt on each call rather than captured once, because
   * Supabase rotates auth cookies mid-request and `request.headers` has to be
   * read after that mutation, not before it.
   */
  const forwardHeaders = () => {
    const headers = new Headers(request.headers);
    headers.set('x-nonce', nonce);
    headers.set('Content-Security-Policy', csp);
    return headers;
  };

  /** Every exit from this function goes through here, redirects included. */
  const withCsp = <T extends NextResponse>(res: T): T => {
    res.headers.set('Content-Security-Policy', csp);
    return res;
  };

  let response = NextResponse.next({ request: { headers: forwardHeaders() } });

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
          response = NextResponse.next({ request: { headers: forwardHeaders() } });
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
    return withCsp(NextResponse.redirect(redirectUrl));
  }

  if (user && AUTH_ROUTES.includes(pathname)) {
    return withCsp(NextResponse.redirect(new URL('/dashboard', request.url)));
  }

  return withCsp(response);
}

export const config = {
  // Skip static assets and image optimization — refreshing a session for every
  // icon request would burn Supabase auth calls for nothing (DEC-011).
  matcher: ['/((?!_next/static|_next/image|favicon.ico|images/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
