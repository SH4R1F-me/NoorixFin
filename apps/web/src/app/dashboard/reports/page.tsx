/**
 * Reports — server component.
 *
 * `category_report()` returns the breakdown, the six-month trend AND the §11.3
 * metadata (period, timezone, currency basis, generated-at) in one payload, so
 * the page is one round trip and the figures cannot come from two moments in
 * time.
 */
import { getActiveWorkspace, getCategoryReport } from '../../../lib/workspace';
import ReportsView from './reports-view';

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const [workspace, params] = await Promise.all([getActiveWorkspace(), searchParams]);

  if (!workspace) {
    return <ReportsView report={{ visible: false }} currency="BDT" />;
  }

  // Validated here as well as in the API: a malformed date reaching Postgres as
  // a literal is a 500 for what is a bad link.
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  const report = await getCategoryReport(
    workspace.id,
    params.from && iso.test(params.from) ? params.from : undefined,
    params.to && iso.test(params.to) ? params.to : undefined,
  );

  return <ReportsView report={report} currency={workspace.base_currency ?? 'BDT'} />;
}
