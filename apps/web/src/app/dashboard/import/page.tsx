import {
  getAccounts,
  getActiveWorkspace,
  getCategories,
  getImportJobs,
  categoryLabel,
} from '../../../lib/workspace';
import { getServerT } from '../../../lib/i18n/locale';
import ImportView from './import-view';

export default async function ImportPage() {
  const [workspace, t] = await Promise.all([getActiveWorkspace(), getServerT()]);
  if (!workspace)
    return (
      <ImportView
        workspaceId=""
        accounts={[]}
        expenseCategories={[]}
        incomeCategories={[]}
        jobs={[]}
      />
    );
  const [accounts, categories, jobs] = await Promise.all([
    getAccounts(workspace.id),
    getCategories(workspace.id),
    getImportJobs(workspace.id),
  ]);
  const active = categories.filter((category) => !category.archived_at);
  return (
    <ImportView
      workspaceId={workspace.id}
      accounts={accounts
        .filter(
          (account) => !account.archived_at && !['CATEGORY', 'SYSTEM'].includes(account.subtype),
        )
        .map((account) => ({ id: account.id, label: account.name }))}
      expenseCategories={active
        .filter((category) => category.kind === 'EXPENSE')
        .map((category) => ({ id: category.id, label: categoryLabel(category, t) }))}
      incomeCategories={active
        .filter((category) => category.kind === 'INCOME')
        .map((category) => ({ id: category.id, label: categoryLabel(category, t) }))}
      jobs={jobs}
    />
  );
}
