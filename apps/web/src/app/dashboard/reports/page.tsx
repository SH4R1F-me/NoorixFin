/**
 * Reports — server component.
 *
 * `category_report()` returns the breakdown, the six-month trend AND the §11.3
 * metadata (period, timezone, currency basis, generated-at) in one payload, so
 * the page is one round trip and the figures cannot come from two moments in
 * time.
 */
import {
  getActiveWorkspace,
  getCashFlowReport,
  getCategoryReport,
  getIncomeExpenseReport,
  getNetWorthReport,
} from '../../../lib/workspace';
import ReportsView from './reports-view';

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; granularity?: string }>;
}) {
  const [workspace, params] = await Promise.all([getActiveWorkspace(), searchParams]);

  if (!workspace) {
    return (
      <ReportsView
        report={{ visible: false }}
        cashFlow={{ visible: false }}
        incomeExpense={{ visible: false }}
        netWorth={{ visible: false }}
        currency="BDT"
      />
    );
  }

  // Validated here as well as in the API: a malformed date reaching Postgres as
  // a literal is a 500 for what is a bad link.
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  const from = params.from && iso.test(params.from) ? params.from : undefined;
  const to = params.to && iso.test(params.to) ? params.to : undefined;
  const granularity = ['day', 'week', 'month'].includes(params.granularity ?? '')
    ? params.granularity
    : 'month';
  const [report, cashFlow, incomeExpense, netWorth] = await Promise.all([
    getCategoryReport(workspace.id, from, to),
    getCashFlowReport(workspace.id, from, to, granularity),
    getIncomeExpenseReport(workspace.id, from, to, granularity),
    getNetWorthReport(workspace.id, from, to, granularity),
  ]);

  return (
    <ReportsView
      report={report}
      cashFlow={cashFlow}
      incomeExpense={incomeExpense}
      netWorth={netWorth}
      currency={workspace.base_currency ?? 'BDT'}
    />
  );
}
