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
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient } from '../../lib/supabase/server';
import { GOOGLE_AUTH_ENABLED, type LinkedIdentity } from '../../lib/auth-config';

/**
 * A Supabase client with NO cookie wiring, used only to verify a password.
 *
 * `persistSession: false` is the important flag: the request-scoped client from
 * lib/supabase/server writes session cookies, so verifying a password with it
 * would overwrite the caller's live session — and a *failed* verification could
 * sign them out mid-action.
 */
function createIsolatedClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  );
}

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

// ─── Google OAuth ───────────────────────────────────────────────────────────
//
// The provider is configured in supabase/config.toml behind environment
// variables. Until credentials are supplied, NEXT_PUBLIC_GOOGLE_AUTH_ENABLED
// stays false and the UI renders an explicit "not configured" state — a button
// that leads to a provider error is worse than no button.

/**
 * Start the Google OAuth flow.
 *
 * `signInWithOAuth` on the server does NOT redirect by itself — it returns the
 * provider URL for the caller to navigate to. We redirect explicitly. The
 * provider sends the user back to /auth/callback, which exchanges the code for a
 * session and writes httpOnly cookies (DEC-009), exactly like the reset-password
 * flow already does.
 */
export async function signInWithGoogle(next?: string): Promise<AuthResult> {
  if (!GOOGLE_AUTH_ENABLED) {
    return { ok: false, code: 'googleNotConfigured' };
  }

  const supabase = await createClient();
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(safeNext(next))}`,
    },
  });

  if (error || !data?.url) {
    return { ok: false, code: 'googleFailed' };
  }

  redirect(data.url);
}

/**
 * Link Google to the signed-in account from Profile Settings.
 *
 * Requires `enable_manual_linking = true` in config.toml — without it GoTrue
 * rejects the call rather than silently creating a second account, which is the
 * failure people hit when a linked provider "creates a duplicate user".
 */
export async function linkGoogleIdentity(): Promise<AuthResult> {
  if (!GOOGLE_AUTH_ENABLED) {
    return { ok: false, code: 'googleNotConfigured' };
  }

  const supabase = await createClient();
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

  const { data, error } = await supabase.auth.linkIdentity({
    provider: 'google',
    options: { redirectTo: `${origin}/auth/callback?next=/dashboard/settings` },
  });

  if (error || !data?.url) {
    return { ok: false, code: 'linkFailed' };
  }

  redirect(data.url);
}

export async function listIdentities(): Promise<LinkedIdentity[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUserIdentities();
  if (error || !data) return [];

  return data.identities.map((identity) => ({
    id: identity.identity_id ?? identity.id,
    provider: identity.provider,
    email: (identity.identity_data?.email as string | undefined) ?? null,
    created_at: identity.created_at ?? null,
  }));
}

/**
 * Unlink a provider.
 *
 * Refuses to remove the last identity: an account with no sign-in method is
 * unreachable by its owner and unrecoverable without operator intervention.
 * Supabase enforces this too — we check first so the user gets a sentence
 * instead of a provider error code.
 */
export async function unlinkIdentity(identityId: string): Promise<AuthResult> {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getUserIdentities();
  if (error || !data) return { ok: false, code: 'unlinkFailed' };

  if (data.identities.length <= 1) {
    return { ok: false, code: 'lastIdentity' };
  }

  const target = data.identities.find(
    (identity) => (identity.identity_id ?? identity.id) === identityId,
  );
  if (!target) return { ok: false, code: 'unlinkFailed' };

  const { error: unlinkError } = await supabase.auth.unlinkIdentity(target);
  if (unlinkError) return { ok: false, code: 'unlinkFailed' };

  return { ok: true };
}

/**
 * Change password, with re-authentication.
 *
 * The current password is verified first by attempting a sign-in with it. That
 * is the re-auth step: without it, anyone who walks up to an unlocked browser
 * can change the password and take the account permanently. Supabase's
 * `secure_password_change` provides a server-side version of the same rule; this
 * check makes the requirement explicit and gives a usable error message.
 *
 * The verification uses a SEPARATE client with no cookie handlers, so a failed
 * attempt cannot disturb the caller's live session cookies.
 */
export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<AuthResult> {
  if (newPassword.length < 8) {
    return { ok: false, code: 'passwordTooShort' };
  }
  if (currentPassword === newPassword) {
    return { ok: false, code: 'passwordUnchanged' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false, code: 'notAuthenticated' };

  const verifier = createIsolatedClient();
  const { error: reauthError } = await verifier.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (reauthError) {
    return { ok: false, code: 'currentPasswordWrong' };
  }
  // Drop the throwaway session immediately — it exists only to prove the
  // password, and leaving it alive would be a live refresh token nobody owns.
  await verifier.auth.signOut({ scope: 'local' });

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    return { ok: false, code: 'passwordChangeFailed' };
  }

  return { ok: true };
}
