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
import AdminShell from './admin-shell';

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

  return (
    <AdminShell email={profile.email} displayName={profile.display_name}>
      {children}
    </AdminShell>
  );
}
