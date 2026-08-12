import { getNotificationTemplates } from '../../../../lib/admin';
import { ErrorState } from '../../ui';
import NotificationTemplatesView from './templates-view';

export default async function NotificationTemplatesPage() {
  const result = await getNotificationTemplates();
  if (!result.ok) return <ErrorState error={result.error} />;
  return <NotificationTemplatesView templates={result.data} />;
}
