/**
 * /admin/monitoring/alerts — alert_state rows with acknowledge/resolve actions.
 */
import { getAlerts } from '../../../../lib/admin';
import AlertsView from './alerts-view';

export default async function AlertsPage() {
  const result = await getAlerts();
  return (
    <AlertsView
      alerts={result.ok ? result.data : []}
      error={result.ok ? null : result.error}
    />
  );
}
