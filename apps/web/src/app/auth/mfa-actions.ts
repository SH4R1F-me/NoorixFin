'use server';

/**
 * Two-factor authentication — Blueprint §7.2, audit item 18.
 *
 * ── WHY SERVER ACTIONS AND NOT THE BROWSER SDK ──────────────────────────────
 * The documented Supabase flow calls `supabase.auth.mfa.*` from the browser.
 * That cannot work here: under DEC-009 the session lives in httpOnly cookies, so
 * `createBrowserClient` sees no session at all and every one of these calls
 * would run as an anonymous user. Verification also mints a NEW access token
 * carrying `aal2`, and persisting it means writing auth cookies — which only the
 * server can do.
 *
 * The upside is that the TOTP secret never reaches page JavaScript except as the
 * QR image and the typed-entry string, both of which the operator has to see.
 *
 * ── WHY THERE IS NO "DISABLE MFA" ACTION FOR OPERATORS ──────────────────────
 * `unenroll` exists below and is deliberately refused for super admins. A
 * self-service switch that removes the control protecting the admin console
 * means a stolen operator session can simply turn it off, which reduces the
 * whole mechanism to a speed bump. Removing an operator's factor is a
 * service-role operation, like the promotion that made them one (DEC-013).
 */
import { createClient } from '../../lib/supabase/server';
import { apiFetch } from '../../lib/api-client';

export type MfaResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; message: string };

export interface EnrollmentOffer {
  factorId: string;
  /** An SVG data URI from GoTrue — rendered directly, never fetched. */
  qrCode: string;
  /** The same secret in typed form, for authenticators that cannot scan. */
  secret: string;
}

/**
 * Begin enrolment.
 *
 * Any unverified factor left over from an abandoned attempt is removed first.
 * `max_enrolled_factors` is finite, and a user who opens this panel a few times
 * and closes it would otherwise exhaust their allowance with dead factors and
 * then be unable to enrol at all — a lockout caused entirely by hesitation.
 */
export async function beginMfaEnrollment(): Promise<MfaResult<EnrollmentOffer>> {
  const supabase = await createClient();

  // `getUser()`, not `listFactors()`: the latter reads the unverified cookie,
  // and this list decides whether an existing authenticator gets torn down
  // below. Same round trip, verified answer.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const totpFactors = (user?.factors ?? []).filter((f) => f.factor_type === 'totp');

  for (const factor of totpFactors) {
    if (factor.status !== 'verified') {
      await supabase.auth.mfa.unenroll({ factorId: factor.id });
    }
  }

  if (totpFactors.some((f) => f.status === 'verified')) {
    return { ok: false, message: 'An authenticator is already set up on this account.' };
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: `NoorixFin ${new Date().toISOString().slice(0, 10)}`,
  });

  if (error || !data) {
    return {
      ok: false,
      message:
        error?.message ??
        'Could not start enrolment. Two-factor authentication may not be enabled on this project.',
    };
  }

  return {
    ok: true,
    data: {
      factorId: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
    },
  };
}

/**
 * Confirm a code, for both enrolment and step-up.
 *
 * One action for both because GoTrue's flow is identical — challenge, then
 * verify — and the only difference is whether the factor was already verified.
 * Splitting them would duplicate the cookie-rotation path, which is the part
 * that must not diverge.
 */
export async function verifyMfaCode(
  factorId: string,
  code: string,
): Promise<MfaResult> {
  if (!/^\d{6}$/.test(code)) {
    return { ok: false, message: 'Enter the six digits from your authenticator app.' };
  }

  const supabase = await createClient();

  const { data: challenge, error: challengeError } =
    await supabase.auth.mfa.challenge({ factorId });
  if (challengeError || !challenge) {
    return {
      ok: false,
      message: challengeError?.message ?? 'Could not start the challenge. Try again.',
    };
  }

  const { error } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code,
  });

  if (error) {
    // Not "invalid code": clock drift on the operator's device produces the
    // same rejection as a mistyped digit, and someone certain they typed it
    // correctly needs to know the other possibility exists.
    return {
      ok: false,
      message:
        'That code was not accepted. Check the digits, and that the clock on ' +
        'your device is correct.',
    };
  }

  return { ok: true };
}

/**
 * Remove a factor — for ordinary users only.
 *
 * The super-admin refusal is checked against the API's `/me`, not against
 * anything the browser sent: the caller's own claim about their role is not an
 * authorization input.
 */
export async function disableMfa(factorId: string): Promise<MfaResult> {
  try {
    const me = await apiFetch<{ is_super_admin: boolean }>('/me');
    if (me.is_super_admin) {
      return {
        ok: false,
        message:
          'Operator accounts cannot remove their own second factor — a stolen ' +
          'session could otherwise switch off the control protecting the admin ' +
          'console. Ask another operator to remove it at the database level.',
      };
    }
  } catch {
    // If the role cannot be established, refuse. The failure that matters is
    // letting an operator through because a check did not complete.
    return {
      ok: false,
      message: 'Could not verify your account type right now. Try again shortly.',
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}
