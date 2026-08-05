/**
 * Transactions — server component (DEC-009).
 *
 * The signed amount is derived from the postings, not stored on the entry:
 * the postings ARE the ledger (DEC-006), so summing them keeps the list honest
 * after a reversal.
 *
 * Accounts and categories are now fetched WITH their ids so the add-transaction
 * form can post real references. It previously rendered a hardcoded
 * `<option>bKash</option>` list, which is part of why that form could never have
 * worked even if its button had been wired.
 */
import {
  getActiveWorkspace,
  getTransactions,
  getCategories,
  getAccounts,
  categoryLabel,
} from '../../../lib/workspace';
import { getServerT } from '../../../lib/i18n/locale';
import TransactionsView, { type TxItem } from './transactions-view';

export default async function TransactionsPage() {
  const [workspace, t] = await Promise.all([getActiveWorkspace(), getServerT()]);

  if (!workspace) {
    return (
      <TransactionsView
        transactions={[]}
        categories={[]}
        accounts={[]}
        workspaceId=""
        currency="BDT"
      />
    );
  }

  const [rows, categoryRows, accountRows] = await Promise.all([
    getTransactions(workspace.id),
    getCategories(workspace.id),
    getAccounts(workspace.id),
  ]);

  const transactions: TxItem[] = rows.map((row) => ({
    id: row.id,
    type: row.entry_type,
    payee: row.payee ?? row.note ?? row.entry_type,
    amount: row.amount_minor,
    cat: row.entry_type === 'TRANSFER' ? t('transactions.transfer') : '—',
    catIcon: row.entry_type === 'INCOME' ? '💰' : row.entry_type === 'TRANSFER' ? '🔄' : '💳',
    account: '',
    date: row.local_date,
    note: row.note ?? '',
  }));

  return (
    <TransactionsView
      transactions={transactions}
      categories={categoryRows
        .filter((category) => !category.archived_at)
        .map((category) => ({
          id: category.id,
          label: categoryLabel(category, t),
          kind: category.kind,
        }))}
      // Category-backing and system accounts are ledger plumbing, not places a
      // user spends from — offering them would let someone post a transaction
      // against their own "Food" expense account.
      accounts={accountRows
        .filter(
          (account) =>
            !account.archived_at &&
            account.subtype !== 'CATEGORY' &&
            account.subtype !== 'SYSTEM',
        )
        .map((account) => ({ id: account.id, label: account.name }))}
      workspaceId={workspace.id}
      currency={workspace.base_currency ?? 'BDT'}
    />
  );
}
