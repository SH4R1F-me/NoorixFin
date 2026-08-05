/**
 * Auth callback — DEC-009.
 *
 * Exchanges the one-time code from an email link (password reset, and later
 * email verification) for a session, writing httpOnly cookies server-side. This
 * was the outstanding W3 item; the forgot-password flow is its first consumer.
 *
 * The code arrives in the URL, so this must run on the server — the browser
 * never holds a token in this design.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '../../../lib/supabase/server';

/** Only in-app relative paths — never an attacker-supplied absolute URL. */
function safeNext(next: string | null): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return '/dashboard';
  return next;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const next = safeNext(searchParams.get('next'));

  // OAuth providers report failure by redirecting back with `error`, not by
  // omitting the code. Without this branch a user who cancels at Google's
  // consent screen lands on "missing_code", which describes our symptom rather
  // than what they did.
  const oauthError = searchParams.get('error');
  if (oauthError) {
    const reason =
      oauthError === 'access_denied' ? 'oauth_cancelled' : 'oauth_failed';
    // The provider's description is attacker-influenceable and goes into a URL
    // we render — pass a fixed code, not the raw text.
    return NextResponse.redirect(`${origin}/auth/login?error=${reason}`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    // Expired or already-used link. Generic reason — the specific failure is
    // not useful to the user and is useful to an attacker.
    return NextResponse.redirect(`${origin}/auth/login?error=invalid_link`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
