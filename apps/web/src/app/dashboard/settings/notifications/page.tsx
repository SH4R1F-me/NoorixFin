import { getNotificationPreferences } from './actions';
import NotificationPreferencesView from './preferences-view';

export default async function NotificationPreferencesPage() {
  const data = await getNotificationPreferences();
  return (
    <NotificationPreferencesView
      initial={data}
      vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''}
    />
  );
}
