/**
 * /admin/security/anomalies — new device logins + throttle abusers.
 */
import { getAnomalies } from '../../../../lib/admin';
import AnomaliesView from './anomalies-view';

export default async function AnomaliesPage() {
  const result = await getAnomalies();

  return (
    <AnomaliesView
      data={result.ok ? result.data : null}
      error={result.ok ? null : result.error}
    />
  );
}
