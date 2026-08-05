/**
 * Budgets — server component.
 *
 * Two round trips, in parallel: the aggregation (which already carries each
 * line's derived spend) and the category list the editor needs. Spend is NOT
 * computed here — `budget_status()` does it in Postgres, so the browser never
 * receives a posting (DEC-011).
 */
import { getActiveWorkspace, getBudgetStatus, getCategories } from '../../../lib/workspace';
import BudgetsView from './budgets-view';

export default async function BudgetsPage() {
  const workspace = await getActiveWorkspace();

  if (!workspace) {
    // No workspace yet, or the API is unreachable. The shell's degraded banner
    // already explains the second case; the empty view is right for both, and
    // is not a crash in either.
    return (
      <BudgetsView status={{ visible: false }} categories={[]} workspaceId="" currency="BDT" />
    );
  }

  const [status, categories] = await Promise.all([
    getBudgetStatus(workspace.id),
    getCategories(workspace.id),
  ]);

  return (
    <BudgetsView
      status={status}
      categories={categories}
      workspaceId={workspace.id}
      currency={workspace.base_currency ?? 'BDT'}
    />
  );
}
