/**
 * Transactions — server component (DEC-009).
 *
 * The signed amount is derived from the postings, not stored on the entry:
 * the postings ARE the ledger (DEC-006), so summing them keeps the list honest
 * after a reversal.
 */
import {
  getActiveWorkspace,
  getTransactions,
  getCategories,
  categoryLabel,
} from '../../../lib/workspace';
import TransactionsView, { type TxItem } from './transactions-view';

export default async function TransactionsPage() {
  const workspace = await getActiveWorkspace();
  if (!workspace) return <TransactionsView transactions={[]} categories={['All']} />;

  const [rows, categories] = await Promise.all([
    getTransactions(workspace.id),
    getCategories(workspace.id),
  ]);

  const transactions: TxItem[] = rows.map((t) => ({
    id: t.id,
    type: t.entry_type,
    payee: t.payee ?? t.note ?? t.entry_type,
    amount: t.amount_minor,
    cat: t.entry_type === 'TRANSFER' ? 'Transfer' : '—',
    catIcon: t.entry_type === 'INCOME' ? '💰' : t.entry_type === 'TRANSFER' ? '🔄' : '💳',
    account: '',
    date: t.local_date,
    note: t.note ?? '',
  }));

  return (
    <TransactionsView
      transactions={transactions}
      categories={['All', ...categories.map((c) => categoryLabel(c))]}
    />
  );
}
