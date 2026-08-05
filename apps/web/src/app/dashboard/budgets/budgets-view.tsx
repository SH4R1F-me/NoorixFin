'use client';

/**
 * Budgets — planned vs actual per category.
 *
 * Every "spent" figure on this screen is computed by `budget_status()` from
 * journal_postings at request time. Nothing here is a stored total, so a
 * reversal or a corrected transaction is reflected on the next load with no
 * reconciliation step (DEC-022).
 *
 * The screen this replaces rendered three hardcoded rows — খাদ্য ৳12,500/৳20,000
 * and friends — as if they were the user's own budgets. On a finance product
 * that is the most damaging thing a UI can do, and the reason DEC-012 forbids
 * optimistic rendering of derived figures.
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { PiggyBank, Plus, X, Save, AlertTriangle, Check } from 'lucide-react';
import { useLocale } from '../../../lib/i18n/locale-provider';
import type { BudgetStatus, CategoryRow } from '../../../lib/workspace';
import { saveBudget, type BudgetLineInput } from '../planning-actions';
import { EmptyState, PageHeader, ProgressBar, field, labelFor, money, num } from '../planning-ui';

interface DraftLine {
  /** Stable across re-renders so React does not remount an input mid-typing. */
  key: string;
  categoryId: string;
  amount: string;
}

let draftCounter = 0;
const newKey = () => `line-${(draftCounter += 1)}`;

export default function BudgetsView({
  status,
  categories,
  workspaceId,
  currency,
}: {
  status: BudgetStatus;
  categories: CategoryRow[];
  workspaceId: string;
  currency: string;
}) {
  const { t, locale } = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const lines = status.lines ?? [];
  const hasBudget = status.has_budget === true && lines.length > 0;

  // Only EXPENSE categories can be limited. Budgeting income is a different
  // feature (a target, not a cap) and offering it here would silently produce
  // lines whose "spent" is computed with the wrong sign.
  const budgetable = categories.filter((c) => c.kind === 'EXPENSE' && !c.archived_at);

  const [draft, setDraft] = useState<DraftLine[]>(() =>
    lines.length > 0
      ? lines.map((line) => ({
          key: newKey(),
          categoryId: line.category_id,
          // Minor units back to a human string for the input, using the same
          // exponent the action will use to convert it back.
          amount: (line.planned_minor / 100).toFixed(2),
        }))
      : [{ key: newKey(), categoryId: budgetable[0]?.id ?? '', amount: '' }],
  );

  const fmt = (minor: number) => money(minor, currency, locale);

  function submit() {
    setFormError(null);
    const payload: BudgetLineInput[] = draft.map((line) => ({
      categoryId: line.categoryId,
      amount: line.amount,
    }));

    startTransition(async () => {
      const result = await saveBudget({
        workspaceId,
        currency,
        name: status.name ?? 'Monthly',
        lines: payload,
      });
      if (result.ok) {
        setEditing(false);
        router.refresh();
      } else {
        setFormError(result.message);
      }
    });
  }

  const plannedTotal = status.planned_total ?? 0;
  const spentTotal = status.spent_total ?? 0;

  return (
    <div>
      <PageHeader
        title={t('budgets.title')}
        subtitle={t('budgets.subtitle')}
        action={
          budgetable.length > 0 ? (
            <button type="button" onClick={() => setEditing(!editing)} style={field.primary}>
              {editing ? <X size={18} aria-hidden="true" /> : <Plus size={18} aria-hidden="true" />}
              <span>
                {editing
                  ? t('app.close')
                  : hasBudget
                    ? t('budgets.editBudget')
                    : t('budgets.createBudget')}
              </span>
            </button>
          ) : null
        }
      />

      {budgetable.length === 0 && (
        <EmptyState
          icon={<PiggyBank size={30} color="#10b981" aria-hidden="true" />}
          title={t('budgets.noBudget')}
          body={t('budgets.needCategories')}
          action={
            <a href="/dashboard/categories" style={{ ...field.primary, textDecoration: 'none' }}>
              {t('categories.createCategory')}
            </a>
          }
        />
      )}

      {editing && budgetable.length > 0 && (
        <section style={field.panel} aria-label={t('budgets.editBudget')}>
          {draft.map((line, index) => (
            <div key={line.key} style={styles.editRow}>
              <div style={{ ...field.group, flex: 2 }}>
                <label style={field.label} htmlFor={`cat-${line.key}`}>
                  {t('transactions.category')}
                </label>
                <select
                  id={`cat-${line.key}`}
                  value={line.categoryId}
                  onChange={(event) =>
                    setDraft((current) =>
                      current.map((row, i) =>
                        i === index ? { ...row, categoryId: event.target.value } : row,
                      ),
                    )
                  }
                  style={field.input}
                >
                  {budgetable.map((category) => (
                    <option key={category.id} value={category.id}>
                      {labelFor(category, t)}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ ...field.group, flex: 1 }}>
                <label style={field.label} htmlFor={`amt-${line.key}`}>
                  {t('budgets.limit')}
                </label>
                <input
                  id={`amt-${line.key}`}
                  type="text"
                  inputMode="decimal"
                  placeholder={t('transactions.amountPlaceholder')}
                  value={line.amount}
                  onChange={(event) =>
                    setDraft((current) =>
                      current.map((row, i) =>
                        i === index ? { ...row, amount: event.target.value } : row,
                      ),
                    )
                  }
                  style={field.input}
                />
              </div>

              <button
                type="button"
                onClick={() => setDraft((current) => current.filter((_, i) => i !== index))}
                style={{ ...field.ghost, alignSelf: 'flex-end', marginBottom: 1 }}
                aria-label={`${t('budgets.removeLine')} ${labelFor(
                  budgetable.find((c) => c.id === line.categoryId) ?? {},
                  t,
                )}`}
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          ))}

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() =>
                setDraft((current) => [
                  ...current,
                  { key: newKey(), categoryId: budgetable[0]?.id ?? '', amount: '' },
                ])
              }
              style={field.ghost}
            >
              <Plus size={14} aria-hidden="true" />
              {t('budgets.addLine')}
            </button>

            <button
              type="button"
              onClick={submit}
              disabled={pending}
              style={{ ...field.primary, opacity: pending ? 0.55 : 1 }}
            >
              <Save size={16} aria-hidden="true" />
              {pending ? t('app.saving') : t('budgets.saveBudget')}
            </button>
          </div>

          {formError && (
            <p role="alert" style={field.error}>
              {formError}
            </p>
          )}
        </section>
      )}

      {!hasBudget && !editing && budgetable.length > 0 && (
        <EmptyState
          icon={<PiggyBank size={30} color="#10b981" aria-hidden="true" />}
          title={t('budgets.noBudget')}
          body={t('budgets.noBudgetBody')}
          action={
            <button type="button" onClick={() => setEditing(true)} style={field.primary}>
              <Plus size={18} aria-hidden="true" />
              {t('budgets.createBudget')}
            </button>
          }
        />
      )}

      {hasBudget && (
        <>
          <div style={styles.totals}>
            <div style={field.card}>
              <span style={field.meta}>{t('budgets.planned')}</span>
              <p style={styles.totalValue}>{fmt(plannedTotal)}</p>
            </div>
            <div style={field.card}>
              <span style={field.meta}>{t('budgets.spent')}</span>
              <p style={styles.totalValue}>{fmt(spentTotal)}</p>
            </div>
            <div style={field.card}>
              <span style={field.meta}>{t('budgets.remaining')}</span>
              <p
                style={{
                  ...styles.totalValue,
                  color: plannedTotal - spentTotal >= 0 ? '#10b981' : '#ef4444',
                }}
              >
                {fmt(plannedTotal - spentTotal)}
              </p>
            </div>
          </div>

          {status.period_start && (
            <p style={{ ...field.meta, marginBottom: '1rem' }}>
              {t('budgets.period')}: {status.period_start} → {status.period_end}
            </p>
          )}

          <ul style={styles.list}>
            {lines.map((line) => {
              const percent =
                line.planned_minor > 0
                  ? Math.round((line.spent_minor / line.planned_minor) * 100)
                  : 0;
              const over = line.remaining_minor < 0;
              const near =
                !over && line.alert_threshold_pct > 0 && percent >= line.alert_threshold_pct;
              const name = labelFor(line, t);

              return (
                <li key={line.line_id} style={field.card}>
                  <div style={styles.lineTop}>
                    <span style={styles.lineName}>
                      <span aria-hidden="true">{line.icon}</span> {name}
                    </span>

                    {/*
                      §5.5: status must not be colour alone. Each state carries an
                      icon AND a word, so it survives greyscale, low vision, and a
                      screen reader.
                    */}
                    {over ? (
                      <span style={{ ...styles.badge, color: '#fca5a5', background: 'rgba(239,68,68,0.12)' }}>
                        <AlertTriangle size={13} aria-hidden="true" /> {t('budgets.overBudget')}
                      </span>
                    ) : near ? (
                      <span style={{ ...styles.badge, color: '#fcd34d', background: 'rgba(245,158,11,0.12)' }}>
                        <AlertTriangle size={13} aria-hidden="true" /> {t('budgets.nearLimit')}
                      </span>
                    ) : (
                      <span style={{ ...styles.badge, color: '#6ee7b7', background: 'rgba(16,185,129,0.12)' }}>
                        <Check size={13} aria-hidden="true" /> {t('budgets.onTrack')}
                      </span>
                    )}
                  </div>

                  <ProgressBar
                    value={line.spent_minor}
                    max={line.planned_minor}
                    tone={over ? 'over' : near ? 'warn' : 'good'}
                    label={`${name}: ${t('budgets.usedPercent', { percent: num(percent, locale) })}`}
                  />

                  <div style={styles.lineBottom}>
                    <span style={field.meta}>
                      {fmt(line.spent_minor)} {t('app.of')} {fmt(line.planned_minor)}
                    </span>
                    <span
                      style={{
                        ...field.meta,
                        color: over ? '#fca5a5' : '#94a3b8',
                        fontWeight: 600,
                      }}
                    >
                      {over
                        ? `−${fmt(line.remaining_minor)}`
                        : `${fmt(line.remaining_minor)} ${t('budgets.remaining')}`}
                    </span>
                  </div>

                  {/* Drill-down: §5.3 — "কোনো metric শুধু aggregate number দেখাবে
                      না". Every figure above leads to the entries behind it. */}
                  <a
                    href={`/dashboard/transactions?category=${line.category_id}`}
                    style={styles.drill}
                  >
                    {t('dashboard.drillDown')} →
                  </a>
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
  totals: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '1rem',
    marginBottom: '1.5rem',
  },
  totalValue: {
    fontSize: '1.5rem',
    fontWeight: 800,
    color: '#f8fafc',
    margin: '0.35rem 0 0',
    fontVariantNumeric: 'tabular-nums',
  },
  list: { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '1rem' },
  lineTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.75rem',
    gap: '0.75rem',
    flexWrap: 'wrap',
  },
  lineName: { fontSize: '0.9375rem', fontWeight: 600, color: '#f8fafc' },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.3rem',
    fontSize: '0.6875rem',
    fontWeight: 600,
    padding: '0.2rem 0.5rem',
    borderRadius: 9999,
  },
  lineBottom: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '0.6rem',
    gap: '0.75rem',
    flexWrap: 'wrap',
  },
  drill: {
    display: 'inline-block',
    marginTop: '0.75rem',
    fontSize: '0.75rem',
    color: '#10b981',
    textDecoration: 'none',
  },
  editRow: { display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' },
};
