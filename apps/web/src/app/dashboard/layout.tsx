/**
 * Dashboard layout — server component (DEC-009).
 *
 * Reads the signature-verified user via getUser() and hands the email to the
 * client shell. proxy.ts has already redirected unauthenticated requests before
 * this renders; the null check below is defence-in-depth, not the primary gate.
 *
 * DUAL ROLE (DEC-016): an operator uses this dashboard for their OWN finances,
 * exactly like any other user — nothing on this side of the app behaves
 * differently for them. The only difference is the extra switch in the sidebar,
 * driven by `isSuperAdmin` resolved server-side. A normal user's markup does not
 * contain the switch at all, rather than containing it hidden.
 */
import { redirect } from 'next/navigation';
import { getCurrentUser } from '../../lib/supabase/server';
import { getSessionContext, getMyBroadcasts, getPublicSettings } from '../../lib/session';
import DashboardShell from './dashboard-shell';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');

  // Fetched together; getSessionContext is React-cached so pages in the same
  // render reuse it rather than issuing another /me call (DEC-011).
  const [{ profile, isSuperAdmin, apiReachable }, broadcasts, settings] = await Promise.all([
    getSessionContext(),
    getMyBroadcasts(),
    getPublicSettings(),
  ]);

  return (
    <DashboardShell
      userEmail={user.email ?? ''}
      displayName={profile?.display_name ?? ''}
      isSuperAdmin={isSuperAdmin}
      // Every panel below will be empty when this is false. Saying so is the
      // difference between "the service is down" and "my money is missing".
      apiReachable={apiReachable}
      broadcasts={broadcasts}
      maintenance={settings.maintenance_mode ?? null}
      donationUrl={settings.donation_url?.value ?? ''}
      appVersion={settings.app_version?.value ?? ''}
    >
      {children}
    </DashboardShell>
  );
}
