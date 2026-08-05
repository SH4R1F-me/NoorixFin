/**
 * Auth configuration shared by server actions and client components.
 *
 * Lives outside app/auth/actions.ts because a `'use server'` module may only
 * export async functions — a sync helper or a type export there is a build
 * error, not a style problem.
 */

/**
 * Whether to offer Google sign-in.
 *
 * Read from a NEXT_PUBLIC_ variable so the same answer is available during
 * server rendering and in the browser bundle. When false the UI shows an
 * explicit "not configured" state rather than a button that would bounce the
 * user into a provider error page.
 */
export const GOOGLE_AUTH_ENABLED =
  process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === 'true';

export interface LinkedIdentity {
  id: string;
  provider: string;
  email: string | null;
  created_at: string | null;
}

/** Providers this app knows how to present. */
export const PROVIDER_LABELS: Record<string, string> = {
  email: 'Email & password',
  google: 'Google',
};
