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
import { intlLocale, type SupportedLanguage } from '@noorixfin/i18n';
import { getLocale } from '../../lib/i18n/locale';
import {
  getActiveWorkspace,
  getTransactions,
  apiSummary,
  getBudgetStatus,
  getCalendarOverview,
  getGoalsOverview,
  type CalendarEvent,
  type WorkspaceSummary,
} from '../../lib/workspace';
import DashboardView, {
  type SummaryCard,
  type RecentTx,
  type BudgetPanelLine,
  type BillPanelItem,
  type GoalPanelItem,
} from './dashboard-view';

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

/**
 * Format an amount in the reader's language.
 *
 * Was hardcoded to `'en-BD'`, so a Bangla UI still rendered Latin digits and
 * Western grouping. `intlLocale` maps bn → `bn-BD`, which yields Bengali digits
 * and the lakh/crore grouping a Bangladeshi reader expects (৳ ১,২৫,৪৮০.০০).
 */
function money(minor: number, currency: string, locale: SupportedLanguage): string {
  return `${getCurrency(currency).symbol} ${formatAmount(minor, currency, intlLocale[locale])}`;
}

export default async function DashboardPage() {
  const [workspace, locale] = await Promise.all([getActiveWorkspace(), getLocale()]);

  if (!workspace) {
    return (
      <DashboardView
        summaryCards={[]}
        recentTransactions={[]}
        upcomingBills={[]}
        budgetLines={[]}
        goals={[]}
      />
    );
  }

  // Four aggregations in parallel. Each is ONE Postgres function returning one
  // payload (DEC-011) — the alternative is four waterfalls of raw rows the
  // browser then has to sum, on the page a user opens most often.
  //
  // Every one of these fetchers swallows its own failure and returns an empty
  // shape, so a single unavailable panel degrades to its empty state rather
  // than taking the dashboard down with it.
  const [summary, transactions, budget, calendar, goalsOverview] = await Promise.all([
    apiSummary(workspace.id),
    getTransactions(workspace.id, 5),
    getBudgetStatus(workspace.id),
    // A fortnight, not the calendar page's 30 days: this panel is "what needs
    // attention", and a bill three weeks out does not.
    getCalendarOverview(workspace.id, 14),
    getGoalsOverview(workspace.id),
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
      titleKey: 'dashboard.totalBalance',
      amount: money(s.net_worth, currency, locale),
      change: null, // net worth is a stock, not a flow — a MoM % is meaningless
      positive: s.net_worth >= 0,
      iconKey: 'wallet',
      gradient: 'linear-gradient(135deg, #059669, #10b981)',
      // Net worth breaks down by ACCOUNT, not by transaction — it is a stock,
      // and the accounts page is where its components live.
      href: '/dashboard/accounts',
    },
    {
      titleKey: 'dashboard.thisMonthIncome',
      amount: money(s.income, currency, locale),
      change: incomeChange.text, positive: incomeChange.positive,
      iconKey: 'up',
      gradient: 'linear-gradient(135deg, #0284c7, #38bdf8)',
      href: '/dashboard/reports',
    },
    {
      titleKey: 'dashboard.thisMonthExpense',
      amount: money(s.expense, currency, locale),
      change: expenseChange.text, positive: !expenseChange.positive,
      iconKey: 'down',
      gradient: 'linear-gradient(135deg, #dc2626, #f87171)',
      href: '/dashboard/reports',
    },
    {
      titleKey: 'dashboard.netCashFlow',
      amount: money(s.net, currency, locale),
      change: netChange.text, positive: s.net >= 0,
      iconKey: 'flow',
      gradient: 'linear-gradient(135deg, #7c3aed, #a78bfa)',
      href: '/dashboard/reports',
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

  // §5.3 items 3, 4, 5 and 6 — previously "coming soon" placeholders because
  // the features did not exist. Every figure below is derived from the ledger
  // by the aggregations above; none of it is stored or guessed (DEC-012).
  const budgetLines: BudgetPanelLine[] = (budget.lines ?? [])
    // The three closest to their limit. A dashboard panel is a summary, and
    // showing twenty lines here would make the one that matters harder to see.
    .map((line) => ({
      categoryId: line.category_id,
      name: line.custom_name ?? line.translation_key ?? 'Unnamed',
      translationKey: line.translation_key,
      icon: line.icon,
      spent: line.spent_minor,
      planned: line.planned_minor,
      over: line.remaining_minor < 0,
    }))
    .sort((a, b) => b.spent / Math.max(b.planned, 1) - a.spent / Math.max(a.planned, 1))
    .slice(0, 3);

  // Settled events are history and belong on the calendar page, not on a panel
  // whose job is "what needs attention". The predicate narrows the union so the
  // panel's own type cannot receive a PAID row.
  const needsAttention = (
    event: CalendarEvent,
  ): event is CalendarEvent & { status: 'UPCOMING' | 'DUE' | 'OVERDUE' } =>
    event.status === 'OVERDUE' || event.status === 'DUE' || event.status === 'UPCOMING';

  const upcomingBills: BillPanelItem[] = (calendar.events ?? [])
    .filter(needsAttention)
    .slice(0, 4)
    .map((event) => ({
      id: event.id,
      name: event.title,
      amount: event.amount_minor ?? 0,
      date: event.local_date,
      daysAway: event.days_away,
      status: event.status,
      isIncome: event.type === 'INCOME',
    }));

  const goals: GoalPanelItem[] = (goalsOverview.goals ?? [])
    .filter((goal) => goal.status === 'ACTIVE')
    .slice(0, 2)
    .map((goal) => ({
      id: goal.id,
      name: goal.name,
      // Preserved as null rather than coerced to 0 — an unlinked goal renders
      // "link an account", not "0% saved".
      current: goal.current_minor,
      target: goal.target_minor,
    }));

  return (
    <DashboardView
      currencySymbol={getCurrency(currency).symbol}
      // The CODE too, not just the symbol: the view formats minor units and
      // needs the currency's exponent to do it correctly.
      currency={currency}
      summaryCards={summaryCards}
      recentTransactions={recentTransactions}
      upcomingBills={upcomingBills}
      budgetLines={budgetLines}
      goals={goals}
      totalDebt={goalsOverview.total_debt_minor ?? 0}
    />
  );
}
