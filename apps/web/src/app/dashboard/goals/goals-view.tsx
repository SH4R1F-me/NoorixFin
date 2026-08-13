'use client';

/**
 * Goals & Debts.
 *
 * ── PROGRESS IS READ, NEVER TYPED ────────────────────────────────────────────
 * A goal's progress is the linked account's balance, computed from postings by
 * `goals_overview()`. There is no field to edit it, in this UI or in the schema
 * (§9.4: "arbitrary editable 'progress' নয়"). That is why an UNLINKED goal shows
 * "not linked" rather than 0% — `current_minor` is null, and null and zero mean
 * different things: one is "we cannot know", the other is "you have saved
 * nothing". Rendering the first as the second would be a quiet accusation.
 *
 * Debt outstanding is the same: the liability account's balance, so every
 * repayment reduces it without anyone updating a field.
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Target, Plus, X, Trash2, Link2Off, Landmark, Check } from 'lucide-react';
import { useLocale } from '../../../lib/i18n/locale-provider';
import type { AccountRow, GoalsOverview } from '../../../lib/workspace';
import { createGoal, deleteGoal } from '../planning-actions';
import { EmptyState, PageHeader, ProgressBar, field, money, num, percent } from '../planning-ui';

export default function GoalsView({
  overview,
  accounts,
  workspaceId,
  currency,
}: {
  overview: GoalsOverview;
  accounts: AccountRow[];
  workspaceId: string;
  currency: string;
}) {
  const { t, locale } = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [linkedAccountId, setLinkedAccountId] = useState('');

  const goals = overview.goals ?? [];
  const debts = overview.debts ?? [];
  const fmt = (minor: number, code = currency) => money(minor, code, locale);

  // Only asset accounts can hold savings. Offering a credit card here would
  // produce a "goal" whose progress goes down as you use it.
  const savingsAccounts = accounts.filter((a) => a.class === 'ASSET' && !a.archived_at);

  function submit() {
    setFormError(null);
    startTransition(async () => {
      const result = await createGoal({
        workspaceId,
        currency,
        name,
        target,
        targetDate: targetDate || undefined,
        linkedAccountId: linkedAccountId || undefined,
      });
      if (result.ok) {
        setName('');
        setTarget('');
        setTargetDate('');
        setLinkedAccountId('');
        setShowAdd(false);
        router.refresh();
      } else {
        setFormError(result.message);
      }
    });
  }

  function remove(goalId: string) {
    startTransition(async () => {
      const result = await deleteGoal(workspaceId, goalId);
      if (result.ok) router.refresh();
      else setFormError(result.message);
    });
  }

  /**
   * Months to clear a debt at the minimum payment.
   *
   * Deliberately ignores interest and is labelled an ESTIMATE wherever it is
   * shown (§9.4: "calculator result স্পষ্টভাবে estimate হিসেবে label হবে").
   * Returns null rather than a number when there is no minimum payment — an
   * infinite payoff time is not a figure to render.
   */
  function payoffMonths(outstanding: number, minimum: number | null): number | null {
    if (!minimum || minimum <= 0 || outstanding <= 0) return null;
    return Math.ceil(outstanding / minimum);
  }

  return (
    <div>
      <PageHeader
        title={t('goals.title')}
        subtitle={t('goals.subtitle')}
        action={
          <button type="button" onClick={() => setShowAdd(!showAdd)} style={field.primary}>
            {showAdd ? <X size={18} aria-hidden="true" /> : <Plus size={18} aria-hidden="true" />}
            <span>{showAdd ? t('app.close') : t('goals.addGoal')}</span>
          </button>
        }
      />

      {showAdd && (
        <section style={field.panel} aria-label={t('goals.addGoal')}>
          <div style={styles.formGrid}>
            <div style={field.group}>
              <label style={field.label} htmlFor="goal-name">
                {t('goals.goalName')}
              </label>
              <input
                id="goal-name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t('goals.namePlaceholder')}
                style={field.input}
              />
            </div>
            <div style={field.group}>
              <label style={field.label} htmlFor="goal-target">
                {t('goals.targetAmount')}
              </label>
              <input
                id="goal-target"
                type="text"
                inputMode="decimal"
                value={target}
                onChange={(event) => setTarget(event.target.value)}
                placeholder={t('transactions.amountPlaceholder')}
                style={field.input}
              />
            </div>
            <div style={field.group}>
              <label style={field.label} htmlFor="goal-date">
                {t('goals.targetDate')}
              </label>
              <input
                id="goal-date"
                type="date"
                value={targetDate}
                onChange={(event) => setTargetDate(event.target.value)}
                style={field.input}
              />
            </div>
            <div style={field.group}>
              <label style={field.label} htmlFor="goal-account">
                {t('goals.linkedAccount')}
              </label>
              <select
                id="goal-account"
                value={linkedAccountId}
                onChange={(event) => setLinkedAccountId(event.target.value)}
                style={field.input}
              >
                <option value="">{t('goals.noLink')}</option>
                {savingsAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
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
              disabled={pending || !name.trim() || !target.trim()}
              style={{
                ...field.primary,
                opacity: pending || !name.trim() || !target.trim() ? 0.55 : 1,
              }}
            >
              {pending ? t('app.saving') : t('app.save')}
            </button>
          </div>
        </section>
      )}

      {/* ── Savings goals ─────────────────────────────────────────────────── */}
      <h2 style={styles.sectionTitle}>{t('goals.savingsGoal')}</h2>

      {goals.length === 0 ? (
        <EmptyState
          icon={<Target size={30} color="var(--color-primary-500)" aria-hidden="true" />}
          title={t('goals.noGoals')}
          body={t('goals.noGoalsBody')}
          action={
            !showAdd ? (
              <button type="button" onClick={() => setShowAdd(true)} style={field.primary}>
                <Plus size={18} aria-hidden="true" />
                {t('goals.addGoal')}
              </button>
            ) : null
          }
        />
      ) : (
        <ul style={styles.list}>
          {goals.map((goal) => {
            const linked = goal.current_minor !== null;
            const current = goal.current_minor ?? 0;
            const share =
              goal.target_minor > 0 ? Math.round((current / goal.target_minor) * 100) : 0;
            const achieved = linked && current >= goal.target_minor;

            return (
              <li key={goal.id} style={field.card}>
                <div style={styles.goalTop}>
                  <span style={styles.goalName}>{goal.name}</span>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {achieved && (
                      <span
                        style={{
                          ...styles.badge,
                          color: 'var(--color-success)',
                          background: 'rgba(16,185,129,0.12)',
                        }}
                      >
                        <Check size={12} aria-hidden="true" /> {t('goals.achieved')}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => remove(goal.id)}
                      disabled={pending}
                      style={field.ghost}
                      aria-label={`${t('app.delete')} ${goal.name}`}
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {linked ? (
                  <>
                    <ProgressBar
                      value={current}
                      max={goal.target_minor}
                      tone={achieved ? 'good' : 'good'}
                      label={`${goal.name}: ${num(share, locale)}%`}
                    />
                    <div style={styles.goalBottom}>
                      <span style={field.meta}>
                        {fmt(current, goal.currency_code)} {t('app.of')}{' '}
                        {fmt(goal.target_minor, goal.currency_code)}
                      </span>
                      <span
                        style={{
                          ...field.meta,
                          fontWeight: 600,
                          color: 'var(--color-primary-500)',
                        }}
                      >
                        {num(share, locale)}%
                      </span>
                    </div>
                  </>
                ) : (
                  /*
                    Not a 0% bar. `current_minor` is null because no account is
                    linked, and showing that as "0% saved" would state something
                    the system does not know.
                  */
                  <div style={styles.unlinked}>
                    <Link2Off size={15} aria-hidden="true" style={{ flexShrink: 0 }} />
                    <div>
                      <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-primary)' }}>
                        {t('goals.noLink')} · {t('goals.targetAmount')}:{' '}
                        {fmt(goal.target_minor, goal.currency_code)}
                      </p>
                      <p style={{ ...field.meta, margin: '2px 0 0' }}>{t('goals.noLinkBody')}</p>
                    </div>
                  </div>
                )}

                {goal.target_date && (
                  <p style={{ ...field.meta, marginTop: '0.6rem' }}>
                    {t('goals.targetDate')}: {goal.target_date}
                    {goal.days_left !== null &&
                      ` · ${
                        goal.days_left >= 0
                          ? t('goals.daysLeft', { count: num(goal.days_left, locale) })
                          : t('goals.overdue')
                      }`}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* ── Debts ─────────────────────────────────────────────────────────── */}
      <h2 style={{ ...styles.sectionTitle, marginTop: '2rem' }}>{t('goals.debt')}</h2>

      {debts.length === 0 ? (
        <EmptyState
          icon={<Landmark size={30} color="var(--color-primary-500)" aria-hidden="true" />}
          title={t('goals.noDebts')}
          body={t('goals.noDebtsBody')}
          action={
            <a href="/dashboard/accounts" style={{ ...field.primary, textDecoration: 'none' }}>
              {t('accounts.addAccount')}
            </a>
          }
        />
      ) : (
        <>
          <div style={{ ...field.card, marginBottom: '1rem' }}>
            <span style={field.meta}>{t('goals.totalDebt')}</span>
            <p style={{ ...styles.totalValue, color: 'var(--color-error)' }}>
              {fmt(overview.total_debt_minor ?? 0)}
            </p>
          </div>

          <ul style={styles.list}>
            {debts.map((debt) => {
              const months = payoffMonths(debt.outstanding_minor, debt.minimum_payment_minor);
              const paid = debt.principal_minor - debt.outstanding_minor;

              return (
                <li key={debt.ledger_account_id} style={field.card}>
                  <div style={styles.goalTop}>
                    <span style={styles.goalName}>{debt.name}</span>
                    <span style={{ ...styles.amount, color: 'var(--color-error)' }}>
                      {fmt(debt.outstanding_minor, debt.currency_code)}
                    </span>
                  </div>

                  {/* Progress toward clearing it — the inverse of a savings bar. */}
                  {debt.principal_minor > 0 && (
                    <ProgressBar
                      value={Math.max(paid, 0)}
                      max={debt.principal_minor}
                      tone="neutral"
                      label={`${debt.name}: ${fmt(debt.outstanding_minor, debt.currency_code)} ${t('goals.outstanding')}`}
                    />
                  )}

                  <dl style={styles.terms}>
                    <div>
                      <dt style={field.meta}>{t('goals.principal')}</dt>
                      <dd style={styles.termValue}>
                        {fmt(debt.principal_minor, debt.currency_code)}
                      </dd>
                    </div>
                    <div>
                      <dt style={field.meta}>{t('goals.interestRate')}</dt>
                      <dd style={styles.termValue}>
                        {/* No rate is a legitimate state for an informal loan.
                            Showing 0% would be a claim rather than a blank. */}
                        {debt.annual_rate_bps === null
                          ? t('goals.noRate')
                          : percent(debt.annual_rate_bps / 100, locale, 2)}
                      </dd>
                    </div>
                    {debt.minimum_payment_minor !== null && (
                      <div>
                        <dt style={field.meta}>{t('goals.minimumPayment')}</dt>
                        <dd style={styles.termValue}>
                          {fmt(debt.minimum_payment_minor, debt.currency_code)}
                        </dd>
                      </div>
                    )}
                    {debt.due_day !== null && (
                      <div>
                        <dt style={field.meta}>{t('goals.dueDay')}</dt>
                        <dd style={styles.termValue}>{num(debt.due_day, locale)}</dd>
                      </div>
                    )}
                  </dl>

                  {months !== null && (
                    <p style={{ ...field.meta, marginTop: '0.6rem', fontStyle: 'italic' }}>
                      {t('goals.payoffEstimate', { months: num(months, locale) })}
                    </p>
                  )}
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
  sectionTitle: {
    fontSize: '1rem',
    fontWeight: 700,
    color: 'var(--text-secondary)',
    marginBottom: '0.85rem',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
    gap: '1rem',
  },
  list: { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '1rem' },
  goalTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.75rem',
    gap: '0.75rem',
    flexWrap: 'wrap',
  },
  goalName: { fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' },
  goalBottom: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '0.6rem',
    gap: '0.75rem',
    flexWrap: 'wrap',
  },
  unlinked: {
    display: 'flex',
    gap: '0.6rem',
    padding: '0.75rem',
    background: 'var(--bg-input)',
    border: '1px dashed var(--border-primary)',
    borderRadius: '0.625rem',
    color: 'var(--text-tertiary)',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.3rem',
    fontSize: '0.6875rem',
    fontWeight: 600,
    padding: '0.2rem 0.5rem',
    borderRadius: 9999,
  },
  amount: { fontSize: '1rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' },
  totalValue: {
    fontSize: '1.5rem',
    fontWeight: 800,
    margin: '0.35rem 0 0',
    fontVariantNumeric: 'tabular-nums',
  },
  terms: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
    gap: '0.75rem',
    margin: '0.85rem 0 0',
  },
  termValue: {
    margin: '2px 0 0',
    fontSize: '0.875rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
    fontVariantNumeric: 'tabular-nums',
  },
};
