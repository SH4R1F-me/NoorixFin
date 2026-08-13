import { getAccounts, getActiveWorkspace, getDebts } from '../../../lib/workspace';
import DebtsView from './debts-view';

export default async function DebtsPage() {
  const workspace = await getActiveWorkspace();
  if (!workspace)
    return (
      <DebtsView
        workspaceId=""
        currency="BDT"
        accounts={[]}
        overview={{ debts: [], total_debt_minor: 0 }}
      />
    );
  const [accounts, overview] = await Promise.all([
    getAccounts(workspace.id),
    getDebts(workspace.id),
  ]);
  return (
    <DebtsView
      workspaceId={workspace.id}
      currency={workspace.base_currency ?? 'BDT'}
      accounts={accounts.filter((account) => account.class === 'LIABILITY' && !account.archived_at)}
      overview={overview}
    />
  );
}
