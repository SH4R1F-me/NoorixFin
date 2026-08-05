/**
 * Settings — server component.
 *
 * Was a client component with hardcoded defaults and no data source. Now it
 * loads the real profile and the account's linked sign-in methods, so the
 * controls reflect what is actually stored.
 */
import { redirect } from 'next/navigation';
import { getSessionContext } from '../../../lib/session';
import { listIdentities } from '../../auth/actions';
import SettingsView from './settings-view';

export default async function SettingsPage() {
  const [{ profile }, identities] = await Promise.all([
    getSessionContext(),
    listIdentities(),
  ]);

  // proxy.ts already gates /dashboard, so this is the API-unreachable case
  // rather than the unauthenticated one — send them to sign in rather than
  // rendering a settings form bound to nothing.
  if (!profile) redirect('/auth/login');

  return <SettingsView profile={profile} identities={identities} />;
}
