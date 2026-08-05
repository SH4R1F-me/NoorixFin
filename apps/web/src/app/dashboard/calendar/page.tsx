/**
 * Calendar & Bills — server component.
 *
 * One aggregation call. `calendar_overview()` derives OVERDUE/DUE from the
 * workspace's own timezone, so a bill due 1 August in Dhaka is not marked late
 * because the server's clock is in UTC (TIME-01).
 */
import { getActiveWorkspace, getCalendarOverview } from '../../../lib/workspace';
import CalendarView from './calendar-view';

export default async function CalendarPage() {
  const workspace = await getActiveWorkspace();

  if (!workspace) {
    return <CalendarView overview={{ visible: false }} workspaceId="" currency="BDT" />;
  }

  const overview = await getCalendarOverview(workspace.id, 30);

  return (
    <CalendarView
      overview={overview}
      workspaceId={workspace.id}
      currency={workspace.base_currency ?? 'BDT'}
    />
  );
}
