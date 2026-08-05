/**
 * Calendar & Bills — server component.
 *
 * One aggregation call. `calendar_overview()` derives OVERDUE/DUE from the
 * workspace's own timezone, so a bill due 1 August in Dhaka is not marked late
 * because the server's clock is in UTC (TIME-01).
 */
import {
  getAccounts,
  getActiveWorkspace,
  getCalendarOverview,
  getCategories,
  getRecurringRules,
  categoryLabel,
} from '../../../lib/workspace';
import { getServerT } from '../../../lib/i18n/locale';
import CalendarView from './calendar-view';
import RecurringPanel from './recurring-panel';

export default async function CalendarPage() {
  const workspace = await getActiveWorkspace();

  if (!workspace) {
    return <CalendarView overview={{ visible: false }} workspaceId="" currency="BDT" />;
  }

  // One round of parallel reads. The recurring panel needs accounts and
  // categories to offer real choices — the same reason the transaction form
  // does, and the reason the audit called the old hardcoded dropdowns fiction.
  const [overview, rules, accountRows, categoryRows, t] = await Promise.all([
    getCalendarOverview(workspace.id, 30),
    getRecurringRules(workspace.id),
    getAccounts(workspace.id),
    getCategories(workspace.id),
    getServerT(),
  ]);

  const currency = workspace.base_currency ?? 'BDT';

  return (
    <>
      <CalendarView
        overview={overview}
        workspaceId={workspace.id}
        currency={currency}
      />
      <RecurringPanel
        rules={rules}
        // Category-backing and system accounts are ledger plumbing, not places
        // money moves from.
        accounts={accountRows
          .filter(
            (account) =>
              !account.archived_at &&
              account.subtype !== 'CATEGORY' &&
              account.subtype !== 'SYSTEM',
          )
          .map((account) => ({ id: account.id, label: account.name }))}
        categories={categoryRows
          .filter((category) => !category.archived_at)
          .map((category) => ({
            id: category.id,
            label: categoryLabel(category, t),
            kind: category.kind,
          }))}
        workspaceId={workspace.id}
        currency={currency}
      />
    </>
  );
}
