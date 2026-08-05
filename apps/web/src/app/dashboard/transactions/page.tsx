/**
 * Transactions — server component (DEC-009).
 *
 * The signed amount is derived from the postings, not stored on the entry:
 * the postings ARE the ledger (DEC-006), so summing them keeps the list honest
 * after a reversal.
 *
 * Accounts and categories are fetched WITH their ids so the add-transaction
 * form can post real references. It previously rendered a hardcoded
 * `<option>bKash</option>` list, which is part of why that form could never have
 * worked even if its button had been wired.
 *
 * ── DRILL-DOWN (§5.3) ────────────────────────────────────────────────────────
 * `?category=<id>` filters the list to the entries behind one figure. Budget
 * lines and report slices link here, which is what stops "৳12,500 on food"
 * being a number with nowhere to go — §5.3: "কোনো metric শুধু aggregate number
 * দেখাবে না".
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

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; new?: string }>;
}) {
  const [workspace, t, params] = await Promise.all([
    getActiveWorkspace(),
    getServerT(),
    searchParams,
  ]);

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

  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const filterCategoryId =
    params.category && uuid.test(params.category) ? params.category : undefined;

  const [rows, categoryRows, accountRows] = await Promise.all([
    getTransactions(workspace.id, 50, filterCategoryId),
    getCategories(workspace.id),
    getAccounts(workspace.id),
  ]);

  // Postings reference a category's BACKING ledger account, never the category
  // id (DEC-015). This index turns that back into a category without a query
  // per row.
  const byLedgerAccount = new Map(
    categoryRows.map((category) => [category.ledger_account_id, category]),
  );

  const transactions: TxItem[] = rows.map((row) => {
    const category = (row.ledger_account_ids ?? [])
      .map((id) => byLedgerAccount.get(id))
      .find(Boolean);

    return {
      id: row.id,
      type: row.entry_type,
      payee: row.payee ?? row.note ?? row.entry_type,
      amount: row.amount_minor,
      // Was hardcoded '—' for everything except transfers, so a categorised
      // expense showed no category at all despite the ledger knowing it.
      cat: category
        ? categoryLabel(category, t)
        : row.entry_type === 'TRANSFER'
          ? t('transactions.transfer')
          : '—',
      catIcon:
        category?.icon ??
        (row.entry_type === 'INCOME' ? '💰' : row.entry_type === 'TRANSFER' ? '🔄' : '💳'),
      categoryId: category?.id,
      account: '',
      date: row.local_date,
      note: row.note ?? '',
    };
  });

  const activeCategory = filterCategoryId
    ? categoryRows.find((category) => category.id === filterCategoryId)
    : undefined;

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
      drillDownLabel={activeCategory ? categoryLabel(activeCategory, t) : undefined}
    />
  );
}
