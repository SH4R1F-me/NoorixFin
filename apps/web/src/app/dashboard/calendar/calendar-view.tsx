'use client';

/**
 * Calendar & Bills — upcoming, due and overdue.
 *
 * OVERDUE is not a stored status. `calendar_overview()` derives it from
 * `status='UPCOMING' AND due < today`, so it is correct the instant the page
 * loads. The alternative — a nightly job that stamps rows OVERDUE — means a job
 * that fails silently is the reason a user is never told a bill is late, which
 * on a finance product is a real cost, not an inconvenience.
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  CalendarDays,
  Plus,
  X,
  Check,
  SkipForward,
  AlertTriangle,
  Clock,
  TrendingUp,
  Trash2,
} from 'lucide-react';
import { useLocale } from '../../../lib/i18n/locale-provider';
import type { CalendarOverview } from '../../../lib/workspace';
import {
  createCalendarEvent,
  deleteCalendarEvent,
  setCalendarEventStatus,
} from '../planning-actions';
import { EmptyState, PageHeader, field, money, num } from '../planning-ui';

/**
 * Presentation per status. Each carries an ICON and a WORD as well as a colour
 * — §5.5 forbids conveying status by colour alone, and "overdue" is exactly the
 * kind of state a user must not miss because they cannot distinguish red.
 */
const STATUS_UI = {
  OVERDUE: {
    icon: AlertTriangle,
    colour: 'var(--color-error)',
    bg: 'rgba(239,68,68,0.12)',
    key: 'calendar.overdue',
  },
  DUE: {
    icon: Clock,
    colour: 'var(--color-warning)',
    bg: 'rgba(245,158,11,0.12)',
    key: 'calendar.due',
  },
  UPCOMING: {
    icon: Clock,
    colour: 'var(--color-transfer)',
    bg: 'rgba(59,130,246,0.12)',
    key: 'calendar.upcoming',
  },
  PAID: {
    icon: Check,
    colour: 'var(--color-success)',
    bg: 'rgba(16,185,129,0.12)',
    key: 'calendar.paid',
  },
  SKIPPED: {
    icon: SkipForward,
    colour: 'var(--text-secondary)',
    bg: 'rgba(100,116,139,0.12)',
    key: 'calendar.skipped',
  },
} as const;

export default function CalendarView({
  overview,
  workspaceId,
  currency,
}: {
  overview: CalendarOverview;
  workspaceId: string;
  currency: string;
}) {
  const { t, locale } = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [type, setType] = useState<'BILL' | 'INCOME'>('BILL');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().slice(0, 10));

  const events = overview.events ?? [];
  const fmt = (minor: number) => money(minor, currency, locale);

  function submit() {
    setFormError(null);
    startTransition(async () => {
      const result = await createCalendarEvent({
        workspaceId,
        currency,
        type,
        title,
        amount,
        dueDate,
      });
      if (result.ok) {
        setTitle('');
        setAmount('');
        setShowAdd(false);
        router.refresh();
      } else {
        setFormError(result.message);
      }
    });
  }

  function mutate(action: () => Promise<{ ok: boolean; message?: string }>) {
    setFormError(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) router.refresh();
      else setFormError(result.message ?? t('app.error'));
    });
  }

  /** "in 3 days" / "due today" / "2 days ago" — never a bare signed integer. */
  function whenLabel(daysAway: number): string {
    if (daysAway === 0) return t('calendar.dueToday');
    if (daysAway > 0) return t('calendar.inDays', { count: num(daysAway, locale) });
    return t('calendar.daysAgo', { count: num(Math.abs(daysAway), locale) });
  }

  // Overdue first: it is the only group that needs action today.
  const ORDER = { OVERDUE: 0, DUE: 1, UPCOMING: 2, PAID: 3, SKIPPED: 4 } as const;
  const sorted = [...events].sort(
    (a, b) => ORDER[a.status] - ORDER[b.status] || a.local_date.localeCompare(b.local_date),
  );

  return (
    <div>
      <PageHeader
        title={t('calendar.title')}
        subtitle={t('calendar.subtitle')}
        action={
          <button type="button" onClick={() => setShowAdd(!showAdd)} style={field.primary}>
            {showAdd ? <X size={18} aria-hidden="true" /> : <Plus size={18} aria-hidden="true" />}
            <span>{showAdd ? t('app.close') : t('calendar.addEvent')}</span>
          </button>
        }
      />

      {(overview.overdue_count ?? 0) > 0 && (
        <div style={styles.alertBar} role="status">
          <AlertTriangle size={17} aria-hidden="true" style={{ flexShrink: 0 }} />
          <span>
            {num(overview.overdue_count ?? 0, locale)} {t('calendar.overdue')}
          </span>
        </div>
      )}

      {showAdd && (
        <section style={field.panel} aria-label={t('calendar.addEvent')}>
          <div style={styles.typeRow} role="group" aria-label={t('transactions.title')}>
            {(['BILL', 'INCOME'] as const).map((option) => {
              const active = type === option;
              const colour = option === 'BILL' ? 'var(--color-error)' : 'var(--color-primary-500)';
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setType(option)}
                  aria-pressed={active}
                  style={{
                    ...field.ghost,
                    ...(active
                      ? { background: `${colour}18`, borderColor: colour, color: colour }
                      : {}),
                  }}
                >
                  {option === 'BILL' ? t('calendar.bill') : t('calendar.expectedIncome')}
                </button>
              );
            })}
          </div>

          <div style={styles.formGrid}>
            <div style={field.group}>
              <label style={field.label} htmlFor="ev-title">
                {t('calendar.eventTitle')}
              </label>
              <input
                id="ev-title"
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={t('calendar.titlePlaceholder')}
                style={field.input}
              />
            </div>
            <div style={field.group}>
              <label style={field.label} htmlFor="ev-amount">
                {t('transactions.amount')}
              </label>
              <input
                id="ev-amount"
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder={t('transactions.amountPlaceholder')}
                style={field.input}
              />
            </div>
            <div style={field.group}>
              <label style={field.label} htmlFor="ev-date">
                {t('calendar.dueDate')}
              </label>
              <input
                id="ev-date"
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                style={field.input}
              />
            </div>
          </div>

          {formError && (
            <p role="alert" style={field.error}>
              {formError}
            </p>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button
              type="button"
              onClick={submit}
              disabled={pending || !title.trim()}
              style={{ ...field.primary, opacity: pending || !title.trim() ? 0.55 : 1 }}
            >
              {pending ? t('app.saving') : t('app.save')}
            </button>
          </div>
        </section>
      )}

      {sorted.length === 0 && !showAdd && (
        <EmptyState
          icon={<CalendarDays size={30} color="var(--color-primary-500)" aria-hidden="true" />}
          title={t('calendar.noEvents')}
          body={t('calendar.noEventsBody')}
          action={
            <button type="button" onClick={() => setShowAdd(true)} style={field.primary}>
              <Plus size={18} aria-hidden="true" />
              {t('calendar.addEvent')}
            </button>
          }
        />
      )}

      {sorted.length > 0 && (
        <>
          {(overview.due_soon_total_minor ?? 0) > 0 && (
            <div style={{ ...field.card, marginBottom: '1.25rem' }}>
              <span style={field.meta}>{t('calendar.dueSoon')}</span>
              <p style={styles.totalValue}>{fmt(overview.due_soon_total_minor ?? 0)}</p>
            </div>
          )}

          <ul style={styles.list}>
            {sorted.map((event) => {
              const ui = STATUS_UI[event.status];
              const Icon = ui.icon;
              const settled = event.status === 'PAID' || event.status === 'SKIPPED';

              return (
                <li key={event.id} style={{ ...field.card, opacity: settled ? 0.6 : 1 }}>
                  <div style={styles.row}>
                    <div
                      style={{ ...styles.iconWrap, background: ui.bg, color: ui.colour }}
                      aria-hidden="true"
                    >
                      {event.type === 'INCOME' ? <TrendingUp size={18} /> : <Icon size={18} />}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={styles.title}>{event.title}</p>
                      <p style={field.meta}>
                        {event.local_date}
                        {!settled && ` · ${whenLabel(event.days_away)}`}
                      </p>
                    </div>

                    <div style={styles.right}>
                      {event.amount_minor !== null && (
                        <span
                          style={{
                            ...styles.amount,
                            color:
                              event.type === 'INCOME'
                                ? 'var(--color-primary-500)'
                                : 'var(--text-primary)',
                          }}
                        >
                          {event.type === 'INCOME' ? '+' : ''}
                          {fmt(event.amount_minor)}
                        </span>
                      )}
                      <span style={{ ...styles.badge, color: ui.colour, background: ui.bg }}>
                        <Icon size={12} aria-hidden="true" /> {t(ui.key)}
                      </span>
                    </div>
                  </div>

                  <div style={styles.actions}>
                    {!settled && (
                      <>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() =>
                            mutate(() => setCalendarEventStatus(workspaceId, event.id, 'PAID'))
                          }
                          style={field.ghost}
                        >
                          <Check size={14} aria-hidden="true" /> {t('calendar.markPaid')}
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() =>
                            mutate(() => setCalendarEventStatus(workspaceId, event.id, 'SKIPPED'))
                          }
                          style={field.ghost}
                        >
                          <SkipForward size={14} aria-hidden="true" /> {t('calendar.markSkipped')}
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => mutate(() => deleteCalendarEvent(workspaceId, event.id))}
                      style={field.ghost}
                      aria-label={`${t('app.delete')} ${event.title}`}
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  alertBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.7rem',
    padding: '0.85rem 1rem',
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.32)',
    borderRadius: '0.75rem',
    color: 'var(--color-error)',
    fontSize: '0.875rem',
    marginBottom: '1.25rem',
  },
  typeRow: { display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
    gap: '1rem',
  },
  list: { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.75rem' },
  row: { display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: '0.625rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  title: { fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 },
  right: { display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' },
  amount: { fontSize: '0.9375rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.3rem',
    fontSize: '0.6875rem',
    fontWeight: 600,
    padding: '0.2rem 0.5rem',
    borderRadius: 9999,
  },
  actions: { display: 'flex', gap: '0.5rem', marginTop: '0.85rem', flexWrap: 'wrap' },
  totalValue: {
    fontSize: '1.5rem',
    fontWeight: 800,
    color: 'var(--text-primary)',
    margin: '0.35rem 0 0',
    fontVariantNumeric: 'tabular-nums',
  },
};
