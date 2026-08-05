/**
 * Goals & Debts — server component.
 *
 * `goals_overview()` returns savings progress and debt outstanding already
 * derived from postings; the accounts list is only for the "link an account"
 * dropdown, not for computing anything.
 */
import { getAccounts, getActiveWorkspace, getGoalsOverview } from '../../../lib/workspace';
import GoalsView from './goals-view';

export default async function GoalsPage() {
  const workspace = await getActiveWorkspace();

  if (!workspace) {
    return <GoalsView overview={{ visible: false }} accounts={[]} workspaceId="" currency="BDT" />;
  }

  const [overview, accounts] = await Promise.all([
    getGoalsOverview(workspace.id),
    getAccounts(workspace.id),
  ]);

  return (
    <GoalsView
      overview={overview}
      accounts={accounts}
      workspaceId={workspace.id}
      currency={workspace.base_currency ?? 'BDT'}
    />
  );
}
