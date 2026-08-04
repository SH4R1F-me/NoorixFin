/**
 * Dashboard layout — server component (DEC-009).
 *
 * Reads the signature-verified user via getUser() and hands the email to the
 * client shell. proxy.ts has already redirected unauthenticated requests before
 * this renders; the null check below is defence-in-depth, not the primary gate.
 */
import { redirect } from 'next/navigation';
import { getCurrentUser } from '../../lib/supabase/server';
import DashboardShell from './dashboard-shell';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');

  return <DashboardShell userEmail={user.email ?? ''}>{children}</DashboardShell>;
}
