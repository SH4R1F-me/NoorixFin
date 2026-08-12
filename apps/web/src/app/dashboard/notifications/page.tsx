import { listNotifications } from './actions';
import NotificationsView from './notifications-view';

export default async function NotificationsPage() {
  const page = await listNotifications('all');
  return <NotificationsView initialItems={page.items} />;
}
