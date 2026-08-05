import { PiggyBank } from 'lucide-react';
import { NotYetAvailable } from '../../../components/not-yet-available';

export default function BudgetsPage() {
  return (
    <NotYetAvailable
      titleKey="nav.budgets"
      icon={<PiggyBank size={30} color="#10b981" />}
      summary="Budgets are part of Phase 3. The ledger they will read from is live — categories and transactions already record real data — but the budget model itself is not built."
      planned={[
        'Per-category monthly limits (DEC-002 #6: simple limits for MVP, not envelopes)',
        'Spent vs planned, computed from the ledger rather than stored',
        'Alert thresholds as a category approaches its limit',
      ]}
      blockedBy="Needs the budgets API (Blueprint §3.1) — no endpoint exists yet."
    />
  );
}
