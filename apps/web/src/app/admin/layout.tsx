/**
 * Admin layout — the third of three independent gates (DEC-016).
 *
 *   1. SuperAdminGuard in the API
 *   2. RLS + the `is_super_admin()` checks inside the admin RPCs
 *   3. this layout
 *
 * `notFound()` rather than `redirect('/dashboard')`: a redirect confirms the
 * route exists and that the caller simply lacks the role. A 404 reveals nothing
 * — to a non-operator the console is indistinguishable from a typo. That is a
 * small thing, but it is free, and enumeration of an admin surface is where
 * targeted attacks start.
 *
 * This is defence in depth, NOT the security boundary. If this file were deleted
 * the console would still return nothing: every panel's data comes from an API
 * the guard protects and a database that re-checks the role.
 */
import { notFound } from 'next/navigation';
import { getSessionContext } from '../../lib/session';
import { getMfaState } from '../../lib/supabase/server';
import AdminShell from './admin-shell';
import MfaGate from './mfa-gate';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile, isSuperAdmin } = await getSessionContext();

  // A suspended or pending-deletion operator keeps the flag but loses the
  // console — mirroring the same check in SuperAdminGuard, so the UI and the
  // API cannot disagree about who is allowed in.
  if (!isSuperAdmin || profile?.status !== 'ACTIVE') notFound();

  // ── Second factor (audit item 18) ──────────────────────────────────────────
  // Ordered AFTER the operator check on purpose. A non-operator has already
  // received notFound() above, so the step-up screen is only ever shown to
  // someone who is genuinely an operator — it never tells a stranger that an
  // admin console exists behind an MFA prompt.
  //
  // A prompt, not a 404: this person is allowed in, they just have not proved
  // it for this session, and a 404 would send a legitimate operator debugging
  // their own permissions. The API refuses independently, so this screen is the
  // usable face of a decision that is enforced elsewhere — deleting it would
  // leave every panel empty with a MFA_REQUIRED error rather than open the door.
  const mfa = await getMfaState();
  if (!mfa.stepped) {
    return <MfaGate enrolled={mfa.enrolled} factorId={mfa.factorId} />;
  }

  return (
    <AdminShell email={profile.email} displayName={profile.display_name}>
      {children}
    </AdminShell>
  );
}
