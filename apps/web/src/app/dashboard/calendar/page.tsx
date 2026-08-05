import { Calendar } from 'lucide-react';
import { NotYetAvailable } from '../../../components/not-yet-available';

export default function CalendarPage() {
  return (
    <NotYetAvailable
      titleKey="nav.calendar"
      icon={<Calendar size={30} color="#10b981" />}
      summary="Bill tracking and the financial calendar are Phase 3. The dashboard's bills panel renders an empty state for the same reason — it will not show invented reminders."
      planned={[
        'Bill, income, goal and custom events with due dates',
        'Status tracking: upcoming, due, paid, skipped, overdue',
        'Recurring rules that either remind or create a draft transaction',
        'In-app reminders via the transactional outbox',
      ]}
      blockedBy="Needs the calendar and recurring-rules APIs (Blueprint §3.2, §3.3)."
    />
  );
}
