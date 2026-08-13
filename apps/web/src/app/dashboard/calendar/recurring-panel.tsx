'use client';

/**
 * Recurring rules — audit §2.3.
 *
 * `recurring_rules` has existed since migration 00015, with a full API, and no
 * screen. So a user could record that rent is due on the 1st exactly once, as a
 * one-off calendar event, and then had to remember to do it again every month —
 * which is the problem a recurring rule exists to solve.
 *
 * ── THE WORDING IS THE FEATURE ──────────────────────────────────────────────
 * Every label here says REMINDER, never "automatic payment". §9.4 is explicit
 * that nothing auto-posts an entry the user has not confirmed, and the schema
 * enforces it — the strongest `behavior` is `AUTO_CREATE_DRAFT`, and a DRAFT is
 * excluded from every aggregation in the database.
 *
 * A finance app that lets someone believe their rent is being paid
 * automatically, when it is not, fails them at the worst possible moment. So
 * the choice is spelled out on the form rather than left to a tooltip, and both
 * options are phrased as things NoorixFin does for you, not to your money.
 *
 * ── WHY IT LIVES ON THE CALENDAR PAGE ───────────────────────────────────────
 * A rule is a statement about the future, and this is the page about the
 * future. Splitting them would mean a user checking what is due next has to
 * know that the thing generating those items is somewhere else.
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarClock, Info, Loader2, Plus, Repeat, Trash2, X } from 'lucide-react';
import { useLocale } from '../../../lib/i18n/locale-provider';
import type { RecurringRuleRow } from '../../../lib/workspace';
import { createRecurringRule, deleteRecurringRule } from '../planning-actions';
import { EmptyState, field, money } from '../planning-ui';

type Frequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

const FREQUENCY_KEYS: Record<Frequency, string> = {
  DAILY: 'calendar.daily',
  WEEKLY: 'calendar.weekly',
  MONTHLY: 'calendar.monthly',
  YEARLY: 'calendar.yearly',
};

export default function RecurringPanel({
  rules,
  accounts,
  categories,
  workspaceId,
  currency,
}: {
  rules: RecurringRuleRow[];
  accounts: { id: string; label: string }[];
  categories: { id: string; label: string; kind?: string }[];
  workspaceId: string;
  currency: string;
}) {
  const { t, locale } = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [showAdd, setShowAdd] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const [name, setName] = useState('');
  const [entryType, setEntryType] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [frequency, setFrequency] = useState<Frequency>('MONTHLY');
  const [intervalCount, setIntervalCount] = useState(1);
  const [nextOccurrence, setNextOccurrence] = useState(() => new Date().toISOString().slice(0, 10));
  const [endsAt, setEndsAt] = useState('');
  const [behavior, setBehavior] = useState<'REMIND_ONLY' | 'AUTO_CREATE_DRAFT'>('REMIND_ONLY');

  // Only categories matching the direction, for the same reason the transaction
  // form does it: an INCOME rule pointing at an expense category would post
  // backwards if it ever became an entry.
  const selectableCategories = categories.filter(
    (category) => !category.kind || category.kind === entryType,
  );

  function mutate(run: () => Promise<{ ok: boolean; message?: string }>, success: string) {
    setNotice(null);
    startTransition(async () => {
      const result = await run();
      if (result.ok) {
        setNotice({ ok: true, text: success });
        router.refresh();
      } else {
        setNotice({ ok: false, text: result.message ?? 'Failed' });
      }
    });
  }

  function submit() {
    mutate(async () => {
      const result = await createRecurringRule({
        workspaceId,
        name,
        entryType,
        amount,
        currency,
        accountId: accountId || undefined,
        categoryId: categoryId || undefined,
        frequency,
        intervalCount,
        nextOccurrence,
        endsAt: endsAt || undefined,
        behavior,
      });
      if (result.ok) {
        setName('');
        setAmount('');
        setEndsAt('');
        setShowAdd(false);
      }
      return result;
    }, t('calendar.ruleSaved'));
  }

  /** "Every 2 months, next on 2026-09-01" — one sentence rather than a table. */
  function describe(rule: RecurringRuleRow): string {
    const every =
      rule.interval_count > 1
        ? `${t('calendar.every')} ${rule.interval_count} · ${t(FREQUENCY_KEYS[rule.frequency])}`
        : t(FREQUENCY_KEYS[rule.frequency]);
    const next = `${t('calendar.nextOn')} ${rule.next_occurrence}`;
    const ends = rule.ends_at ? `${t('calendar.endsOn')} ${rule.ends_at}` : t('calendar.neverEnds');
    return `${every} · ${next} · ${ends}`;
  }

  return (
    <section style={styles.section} aria-labelledby="recurring-heading">
      <div style={styles.header}>
        <h2 id="recurring-heading" style={styles.heading}>
          <Repeat size={17} aria-hidden="true" />
          {t('calendar.recurringRules')}
        </h2>
        <button
          type="button"
          onClick={() => setShowAdd(!showAdd)}
          style={field.ghost}
          aria-expanded={showAdd}
        >
          {showAdd ? <X size={14} aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />}
          {showAdd ? t('app.close') : t('calendar.addRule')}
        </button>
      </div>

      {notice && (
        <p
          role="status"
          style={{
            margin: '0 0 0.75rem',
            fontSize: '0.8125rem',
            color: notice.ok ? 'var(--color-success)' : 'var(--color-error)',
          }}
        >
          {notice.text}
        </p>
      )}

      {showAdd && (
        <div style={styles.form}>
          <div style={styles.formGrid}>
            <div style={field.group}>
              <label style={field.label} htmlFor="rule-name">
                {t('calendar.ruleName')}
              </label>
              <input
                id="rule-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Rent"
                style={field.input}
              />
            </div>

            <div style={field.group}>
              <label style={field.label} htmlFor="rule-type">
                {t('transactions.type')}
              </label>
              <select
                id="rule-type"
                value={entryType}
                onChange={(event) => {
                  setEntryType(event.target.value as 'EXPENSE' | 'INCOME');
                  // The old category belongs to the other direction, so keeping
                  // it would submit a mismatched pair.
                  setCategoryId('');
                }}
                style={field.input}
              >
                <option value="EXPENSE">{t('transactions.expense')}</option>
                <option value="INCOME">{t('transactions.income')}</option>
              </select>
            </div>

            <div style={field.group}>
              <label style={field.label} htmlFor="rule-amount">
                {t('transactions.amount')}
              </label>
              <input
                id="rule-amount"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                inputMode="decimal"
                placeholder="0.00"
                style={field.input}
              />
            </div>

            <div style={field.group}>
              <label style={field.label} htmlFor="rule-account">
                {t('transactions.account')}
              </label>
              <select
                id="rule-account"
                value={accountId}
                onChange={(event) => setAccountId(event.target.value)}
                style={field.input}
              >
                <option value="">{t('transactions.selectAccount')}</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.label}
                  </option>
                ))}
              </select>
            </div>

            <div style={field.group}>
              <label style={field.label} htmlFor="rule-category">
                {t('transactions.category')}
              </label>
              <select
                id="rule-category"
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
                style={field.input}
              >
                <option value="">{t('transactions.selectCategory')}</option>
                {selectableCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.label}
                  </option>
                ))}
              </select>
            </div>

            <div style={field.group}>
              <label style={field.label} htmlFor="rule-frequency">
                {t('calendar.frequency')}
              </label>
              <select
                id="rule-frequency"
                value={frequency}
                onChange={(event) => setFrequency(event.target.value as Frequency)}
                style={field.input}
              >
                {(Object.keys(FREQUENCY_KEYS) as Frequency[]).map((key) => (
                  <option key={key} value={key}>
                    {t(FREQUENCY_KEYS[key])}
                  </option>
                ))}
              </select>
            </div>

            <div style={field.group}>
              <label style={field.label} htmlFor="rule-interval">
                {t('calendar.every')}
              </label>
              <input
                id="rule-interval"
                type="number"
                min={1}
                max={52}
                value={intervalCount}
                onChange={(event) => setIntervalCount(Number(event.target.value) || 1)}
                style={field.input}
              />
            </div>

            <div style={field.group}>
              <label style={field.label} htmlFor="rule-next">
                {t('calendar.nextOn')}
              </label>
              <input
                id="rule-next"
                type="date"
                value={nextOccurrence}
                onChange={(event) => setNextOccurrence(event.target.value)}
                style={field.input}
              />
            </div>

            <div style={field.group}>
              <label style={field.label} htmlFor="rule-ends">
                {t('calendar.endsOn')}
              </label>
              <input
                id="rule-ends"
                type="date"
                value={endsAt}
                onChange={(event) => setEndsAt(event.target.value)}
                style={field.input}
              />
            </div>

            <div style={field.group}>
              <label style={field.label} htmlFor="rule-behavior">
                {t('calendar.recurring')}
              </label>
              <select
                id="rule-behavior"
                value={behavior}
                onChange={(event) =>
                  setBehavior(event.target.value as 'REMIND_ONLY' | 'AUTO_CREATE_DRAFT')
                }
                aria-describedby="rule-behavior-note"
                style={field.input}
              >
                <option value="REMIND_ONLY">{t('calendar.remindOnly')}</option>
                <option value="AUTO_CREATE_DRAFT">{t('calendar.autoDraft')}</option>
              </select>
            </div>
          </div>

          {/*
            Stated on the form, not in a tooltip. Someone choosing between these
            two options is deciding what the app will do with their money, and
            the honest answer — nothing, without you — is the one that has to be
            impossible to miss.
          */}
          <p id="rule-behavior-note" style={styles.note}>
            <Info size={13} aria-hidden="true" />
            {t('calendar.behaviourNote')}
          </p>

          <button type="button" onClick={submit} disabled={pending} style={field.primary}>
            {pending ? (
              <Loader2 size={15} aria-hidden="true" />
            ) : (
              <CalendarClock size={15} aria-hidden="true" />
            )}
            {t('calendar.saveRule')}
          </button>
        </div>
      )}

      {rules.length === 0 ? (
        <EmptyState
          icon={<Repeat size={26} aria-hidden="true" />}
          title={t('calendar.noRules')}
          body={t('calendar.behaviourNote')}
        />
      ) : (
        <ul style={styles.list}>
          {rules.map((rule) => (
            <li key={rule.id} style={styles.row}>
              <div style={styles.rowIcon} aria-hidden="true">
                <Repeat size={15} />
              </div>
              <div style={styles.rowMain}>
                <span style={styles.rowTitle}>
                  {rule.name}
                  {rule.status !== 'ACTIVE' && (
                    <span style={styles.statusBadge}>
                      {t(rule.status === 'PAUSED' ? 'calendar.paused' : 'calendar.ended')}
                    </span>
                  )}
                </span>
                <span style={styles.rowMeta}>{describe(rule)}</span>
                <span style={styles.rowMeta}>
                  {/* Both behaviours read as a reminder, because both are. */}
                  {t(
                    rule.behavior === 'AUTO_CREATE_DRAFT'
                      ? 'calendar.autoDraft'
                      : 'calendar.remindOnly',
                  )}
                </span>
              </div>
              <span style={styles.rowAmount}>
                {money(rule.amount_minor, rule.currency_code || currency, locale)}
              </span>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  mutate(() => deleteRecurringRule(workspaceId, rule.id), t('calendar.ruleDeleted'))
                }
                style={field.ghost}
                // The label says what is lost, because "delete" beside a
                // money figure reads like it removes the money.
                aria-label={`${t('calendar.deleteRule')}: ${rule.name}. ${t('calendar.ruleDeleteNote')}`}
                title={t('calendar.ruleDeleteNote')}
              >
                <Trash2 size={14} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  section: { marginTop: '2rem' },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
    marginBottom: '0.75rem',
    flexWrap: 'wrap',
  },
  heading: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '1rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    margin: 0,
  },
  form: {
    padding: '1rem',
    marginBottom: '1rem',
    background: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: '0.75rem',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '0.75rem',
  },
  note: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.4rem',
    margin: '0.9rem 0',
    fontSize: '0.75rem',
    lineHeight: 1.55,
    color: 'var(--text-secondary)',
  },
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.85rem',
    padding: '0.8rem 1rem',
    background: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: '0.75rem',
  },
  rowIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 34,
    height: 34,
    flexShrink: 0,
    borderRadius: '0.6rem',
    background: 'rgba(59,130,246,0.12)',
    color: 'var(--color-transfer)',
  },
  rowMain: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 },
  rowTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    fontSize: '0.9375rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  statusBadge: {
    padding: '1px 6px',
    borderRadius: '0.35rem',
    background: 'rgba(100,116,139,0.18)',
    color: 'var(--text-secondary)',
    fontSize: '0.6875rem',
    fontWeight: 600,
  },
  rowMeta: { fontSize: '0.75rem', color: 'var(--text-tertiary)' },
  rowAmount: {
    fontSize: '0.9375rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  },
};
