/**
 * /admin/security — security overview dashboard.
 * Aggregates auth events, session count, and anomalies into a single view.
 */
import {
  getAuthEvents,
  getActiveSessions,
  getAnomalies,
} from '../../../lib/admin';
import SecurityDashboard from './security-dashboard';

export default async function SecurityPage() {
  const [authResult, sessionResult, anomalyResult] = await Promise.all([
    getAuthEvents({ limit: 5 }),
    getActiveSessions({ limit: 1 }),
    getAnomalies(),
  ]);

  return (
    <SecurityDashboard
      recentAuth={authResult.ok ? authResult.data.items : []}
      totalSessions={sessionResult.ok ? sessionResult.data.total : 0}
      anomalies={anomalyResult.ok ? anomalyResult.data : null}
      authError={authResult.ok ? null : authResult.error}
    />
  );
}
