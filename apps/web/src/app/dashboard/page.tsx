/**
 * Dashboard index — server component (DEC-009, DEC-011, DEC-012).
 *
 * The summary comes from a single Postgres aggregation (`workspace_summary`),
 * not from pulling every posting to the client and summing (DEC-011). Amounts
 * are minor units all the way to the formatter — no floating point (DEC-004).
 *
 * DEC-012: these figures are derived from the ledger and are NEVER rendered
 * optimistically. They arrive server-side or they show a skeleton (loading.tsx).
 */
import { formatAmount, getCurrency } from '@noorixfin/money';
import {
  getActiveWorkspace,
  getTransactions,
  apiSummary,
  type WorkspaceSummary,
} from '../../lib/workspace';
import DashboardView, { type SummaryCard, type RecentTx } from './dashboard-view';

/**
 * Month-over-month change.
 *
 * Returns null when the prior month is zero: the change is genuinely undefined,
 * and "+100%" would be a fabricated number on a finance dashboard. The view
 * omits the badge entirely in that case.
 */
function changeLabel(current: number, previous: number): { text: string | null; positive: boolean } {
  if (previous === 0) return { text: null, positive: current >= 0 };
  const delta = ((current - previous) / Math.abs(previous)) * 100;
  const sign = delta >= 0 ? '+' : '';
  return { text: `${sign}${delta.toFixed(1)}%`, positive: delta >= 0 };
}

function money(minor: number, currency: string): string {
  return `${getCurrency(currency).symbol} ${formatAmount(minor, currency, 'en-BD')}`;
}

export default async function DashboardPage() {
  const workspace = await getActiveWorkspace();

  if (!workspace) {
    return <DashboardView summaryCards={[]} recentTransactions={[]} upcomingBills={[]} />;
  }

  const [summary, transactions] = await Promise.all([
    apiSummary(workspace.id),
    getTransactions(workspace.id, 5),
  ]);

  const currency = workspace.base_currency ?? 'BDT';
  const s: WorkspaceSummary = summary ?? {
    visible: false, net_worth: 0, income: 0, expense: 0, net: 0,
    prev_income: 0, prev_expense: 0, prev_net: 0, account_count: 0,
  };

  const incomeChange = changeLabel(s.income, s.prev_income);
  // For expense, spending LESS than last month is the good direction, so the
  // colour is inverted relative to the raw delta.
  const expenseChange = changeLabel(s.expense, s.prev_expense);
  const netChange = changeLabel(s.net, s.prev_net);

  const summaryCards: SummaryCard[] = [
    {
      title: 'মোট ব্যালেন্স', titleEn: 'Total Balance',
      amount: money(s.net_worth, currency),
      change: null, // net worth is a stock, not a flow — a MoM % is meaningless
      positive: s.net_worth >= 0,
      iconKey: 'wallet',
      gradient: 'linear-gradient(135deg, #059669, #10b981)',
    },
    {
      title: 'এই মাসের আয়', titleEn: 'This Month Income',
      amount: money(s.income, currency),
      change: incomeChange.text, positive: incomeChange.positive,
      iconKey: 'up',
      gradient: 'linear-gradient(135deg, #0284c7, #38bdf8)',
    },
    {
      title: 'এই মাসের খরচ', titleEn: 'This Month Expense',
      amount: money(s.expense, currency),
      change: expenseChange.text, positive: !expenseChange.positive,
      iconKey: 'down',
      gradient: 'linear-gradient(135deg, #dc2626, #f87171)',
    },
    {
      title: 'নিট ক্যাশ ফ্লো', titleEn: 'Net Cash Flow',
      amount: money(s.net, currency),
      change: netChange.text, positive: s.net >= 0,
      iconKey: 'flow',
      gradient: 'linear-gradient(135deg, #7c3aed, #a78bfa)',
    },
  ];

  const recentTransactions: RecentTx[] = transactions.map((t) => ({
    payee: t.payee ?? t.note ?? t.entry_type,
    // Expenses render negative; the ledger stores magnitude, direction is the
    // entry type (DEC-006).
    amount: t.entry_type === 'INCOME' ? t.amount_minor : -t.amount_minor,
    category: t.entry_type,
    date: t.local_date,
  }));

  return (
    <DashboardView
      summaryCards={summaryCards}
      recentTransactions={recentTransactions}
      // Bills need the calendar/recurring modules (Phase 3), which have no API
      // yet. Empty rather than fabricated — the view renders its empty state.
      upcomingBills={[]}
    />
  );
}
