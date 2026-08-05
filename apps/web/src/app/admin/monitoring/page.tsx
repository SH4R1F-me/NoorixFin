/**
 * Monitoring — server component seeds the first page, the client view takes over
 * with the SSE feed. Seeding server-side means the page is useful the instant it
 * paints rather than 3 seconds later.
 */
import { getEvents } from '../../../lib/admin';
import MonitoringView from './monitoring-view';

export default async function MonitoringPage() {
  const events = await getEvents({ limit: 100 });

  return (
    <MonitoringView
      initialEvents={events.ok ? events.data.items : []}
      initialError={events.ok ? null : events.error}
    />
  );
}
