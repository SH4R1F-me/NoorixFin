import { BarChart3 } from 'lucide-react';
import { NotYetAvailable } from '../../../components/not-yet-available';

export default function ReportsPage() {
  return (
    <NotYetAvailable
      titleKey="nav.reports"
      icon={<BarChart3 size={30} color="#10b981" />}
      summary="Reporting is Phase 3. The dashboard already shows a real server-side aggregation of net worth and this month's cash flow; reports extend that with history and drill-down."
      planned={[
        'Cash flow and net worth over time',
        'Category breakdown with drill-down to the source transactions',
        'Report metadata: period, timezone, currency, generated-at',
      ]}
      blockedBy="Needs the reports API (Blueprint §3.5). The dashboard summary uses workspace_summary() as a first step."
    />
  );
}
