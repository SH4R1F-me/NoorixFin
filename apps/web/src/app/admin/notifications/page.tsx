import { getNotificationCampaigns } from '../../../lib/admin';
import { ErrorState } from '../ui';
import AdminNotificationsView from './notifications-view';

export default async function AdminNotificationsPage() {
  const result = await getNotificationCampaigns();
  if (!result.ok) return <ErrorState error={result.error} />;
  return <AdminNotificationsView campaigns={result.data} />;
}
