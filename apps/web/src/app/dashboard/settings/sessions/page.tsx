/**
 * /dashboard/settings/sessions — Sessions & Devices page (gap S2).
 *
 * Shows every active device session for the current user and lets them
 * revoke individual sessions or sign out of all other devices.
 */
import { redirect } from 'next/navigation';
import { getSessionContext } from '../../../../lib/session';
import { listMyDevices } from './actions';
import SessionsView from './sessions-view';

export default async function SessionsPage() {
  const { profile } = await getSessionContext();
  if (!profile) redirect('/auth/login');

  const devices = await listMyDevices();

  return <SessionsView devices={devices} />;
}
