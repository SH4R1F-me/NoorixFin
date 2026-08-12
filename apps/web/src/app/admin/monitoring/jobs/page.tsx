/**
 * /admin/monitoring/jobs — scheduled jobs (pg_cron) view.
 */
import { getScheduledJobs } from '../../../../lib/admin';
import JobsView from './jobs-view';

export default async function JobsPage() {
  const result = await getScheduledJobs();
  return (
    <JobsView
      data={result.ok ? result.data : null}
      error={result.ok ? null : result.error}
    />
  );
}
