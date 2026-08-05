/**
 * First-run setup — Blueprint §5.2.
 *
 * Deliberately OUTSIDE the dashboard route group: the sidebar, the broadcast
 * banner and the admin switch are chrome for a workspace that is not set up
 * yet, and rendering them around a setup wizard invites the user to skip past
 * it into empty screens.
 */
import { redirect } from 'next/navigation';
import { getCurrentUser } from '../../lib/supabase/server';
import { getSessionContext } from '../../lib/session';
import { getActiveWorkspace } from '../../lib/workspace';
import OnboardingView from './onboarding-view';

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');

  const [{ profile }, workspace] = await Promise.all([
    getSessionContext(),
    // Creates the workspace if it does not exist yet — §5.2 step 5 is automatic
    // (DEC-007: one personal workspace per user), so the wizard never asks.
    getActiveWorkspace(),
  ]);

  // Someone who has already finished has no business here, and a bookmark
  // should not put them back through it.
  if (profile?.onboarding_status === 'COMPLETED') redirect('/dashboard');

  return (
    <OnboardingView
      workspaceId={workspace?.id ?? ''}
      initialName={profile?.display_name || user.email?.split('@')[0] || ''}
      initialTimezone={profile?.timezone ?? 'Asia/Dhaka'}
      initialCurrency={profile?.base_currency ?? 'BDT'}
      initialWeekStart={profile?.week_starts_on ?? 6}
    />
  );
}
