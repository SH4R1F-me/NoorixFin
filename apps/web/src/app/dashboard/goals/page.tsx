import { Target } from 'lucide-react';
import { NotYetAvailable } from '../../../components/not-yet-available';

export default function GoalsPage() {
  return (
    <NotYetAvailable
      titleKey="nav.goals"
      icon={<Target size={30} color="#10b981" />}
      summary="Savings goals and debt tracking are Phase 3. Liability accounts already work today — a loan or credit card can be created under Accounts and will post correctly."
      planned={[
        'Savings goals with a target amount and linked accounts',
        'Progress derived from the ledger, not stored separately',
        'Debt details: principal, rate, minimum payment, due day',
      ]}
      blockedBy="Needs the goals and debts APIs (Blueprint §3.4)."
    />
  );
}
