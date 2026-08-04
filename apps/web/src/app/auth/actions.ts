'use server';

/**
 * Server-side auth actions — DEC-009.
 *
 * Sign-in/up/out run on the server so the session cookies are written with
 * `httpOnly`. The browser never sees a token, so an injected script cannot
 * exfiltrate one. This is why the login page posts to these actions instead of
 * calling `supabase.auth.signInWithPassword()` in the browser.
 *
 * Each action returns a plain serialisable result rather than throwing, so the
 * client component can render an error without a redirect round-trip.
 */
import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase/server';

export type AuthResult = { ok: true } | { ok: false; code: string };

/** Only allow relative in-app paths — never an attacker-supplied absolute URL. */
function safeNext(next: string | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return '/dashboard';
  return next;
}

export async function signIn(
  email: string,
  password: string,
  next?: string,
): Promise<AuthResult> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Do not echo the provider message — it distinguishes "no such user" from
    // "wrong password", which is a user-enumeration oracle.
    return { ok: false, code: 'invalidCredentials' };
  }

  redirect(safeNext(next));
}

export async function signUp(email: string, password: string): Promise<AuthResult> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return { ok: false, code: 'registerFailed' };
  }

  return { ok: true };
}

/**
 * Send a password-reset email.
 *
 * Always reports success, even for an address with no account: telling the
 * caller whether an email exists is a user-enumeration oracle, and a password
 * reset form is the easiest place to probe one.
 *
 * Locally the mail is caught by Mailpit at http://localhost:54324 rather than
 * being delivered.
 */
export async function requestPasswordReset(email: string): Promise<AuthResult> {
  const supabase = await createClient();

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/dashboard`,
  });

  return { ok: true };
}

export async function signOut(): Promise<never> {
  const supabase = await createClient();
  // Global scope revokes every refresh token for this user, not just this
  // device's — "sign out everywhere" is the safe default for a finance app.
  await supabase.auth.signOut({ scope: 'global' });
  redirect('/auth/login');
}
