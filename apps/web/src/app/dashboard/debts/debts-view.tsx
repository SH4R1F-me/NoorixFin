'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Landmark, Pencil, Plus, Trash2, X } from 'lucide-react';
import { toMajorUnits } from '@noorixfin/money';
import type { AccountRow, DebtsOverview, DebtSummary } from '../../../lib/workspace';
import { useLocale } from '../../../lib/i18n/locale-provider';
import { deleteDebtTerms, saveDebtTerms } from '../planning-actions';
import { EmptyState, ProgressBar, field, money, num, percent } from '../planning-ui';

export default function DebtsView({
  workspaceId,
  currency,
  accounts,
  overview,
}: {
  workspaceId: string;
  currency: string;
  accounts: AccountRow[];
  overview: DebtsOverview;
}) {
  const { t, locale } = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [accountId, setAccountId] = useState('');
  const [principal, setPrincipal] = useState('');
  const [rate, setRate] = useState('');
  const [minimum, setMinimum] = useState('');
  const [dueDay, setDueDay] = useState('');
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const fmt = (value: number, code = currency) => money(value, code, locale);

  function edit(debt?: DebtSummary) {
    setAccountId(debt?.ledger_account_id ?? '');
    setPrincipal(debt ? String(toMajorUnits(debt.principal_minor, debt.currency_code)) : '');
    setRate(debt?.annual_rate_bps == null ? '' : String(debt.annual_rate_bps / 100));
    setMinimum(
      debt?.minimum_payment_minor == null
        ? ''
        : String(toMajorUnits(debt.minimum_payment_minor, debt.currency_code)),
    );
    setDueDay(debt?.due_day == null ? '' : String(debt.due_day));
    setShowForm(true);
  }

  function save() {
    setNotice(null);
    startTransition(async () => {
      const result = await saveDebtTerms({
        workspaceId,
        currency,
        ledgerAccountId: accountId,
        principal,
        annualRatePercent: rate || undefined,
        minimumPayment: minimum || undefined,
        dueDay: dueDay ? Number(dueDay) : undefined,
      });
      setNotice({ ok: result.ok, text: result.ok ? t('debts.saved') : result.message });
      if (result.ok) {
        setShowForm(false);
        router.refresh();
      }
    });
  }

  function remove(account: string) {
    setNotice(null);
    startTransition(async () => {
      const result = await deleteDebtTerms(workspaceId, account);
      setNotice({ ok: result.ok, text: result.ok ? t('debts.removed') : result.message });
      if (result.ok) router.refresh();
    });
  }

  return (
    <main>
      <header style={styles.header}>
        <div>
          <div style={styles.eyebrow}>
            <Landmark size={15} aria-hidden="true" />
            {t('debts.repaymentPlan')}
          </div>
          <h1 style={styles.title}>{t('debts.title')}</h1>
          <p style={styles.subtitle}>{t('debts.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={() => (showForm ? setShowForm(false) : edit())}
          style={field.primary}
        >
          {showForm ? <X size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
          {showForm ? t('app.close') : t('debts.addTerms')}
        </button>
      </header>

      <section style={styles.total} aria-label={t('goals.totalDebt')}>
        <span style={field.meta}>{t('goals.totalDebt')}</span>
        <strong style={styles.totalValue}>{fmt(overview.total_debt_minor)}</strong>
      </section>

      {showForm && (
        <section style={field.panel} aria-label={t('debts.addTerms')}>
          <div style={styles.formGrid}>
            <label style={field.group}>
              {t('transactions.account')}
              <select
                id="debt-account"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                style={field.input}
              >
                <option value="">{t('transactions.selectAccount')}</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </label>
            <label style={field.group}>
              {t('goals.principal')}
              <input
                id="debt-principal"
                inputMode="decimal"
                value={principal}
                onChange={(e) => setPrincipal(e.target.value)}
                style={field.input}
              />
            </label>
            <label style={field.group}>
              {t('goals.interestRate')} (%)
              <input
                id="debt-rate"
                inputMode="decimal"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                style={field.input}
              />
            </label>
            <label style={field.group}>
              {t('goals.minimumPayment')}
              <input
                id="debt-minimum"
                inputMode="decimal"
                value={minimum}
                onChange={(e) => setMinimum(e.target.value)}
                style={field.input}
              />
            </label>
            <label style={field.group}>
              {t('goals.dueDay')}
              <input
                id="debt-due-day"
                type="number"
                min={1}
                max={31}
                value={dueDay}
                onChange={(e) => setDueDay(e.target.value)}
                style={field.input}
              />
            </label>
          </div>
          <p style={styles.estimateNote}>{t('debts.balanceNote')}</p>
          <button
            type="button"
            disabled={pending || !accountId || !principal}
            onClick={save}
            style={field.primary}
          >
            {t('app.save')}
          </button>
        </section>
      )}

      {notice && (
        <p
          role="status"
          style={{ color: notice.ok ? 'var(--color-success)' : 'var(--color-error)' }}
        >
          {notice.text}
        </p>
      )}

      {accounts.length === 0 ? (
        <EmptyState
          icon={<Landmark size={28} aria-hidden="true" />}
          title={t('goals.noDebts')}
          body={t('goals.noDebtsBody')}
          action={
            <Link href="/dashboard/accounts" style={{ ...field.primary, textDecoration: 'none' }}>
              {t('accounts.addAccount')}
            </Link>
          }
        />
      ) : overview.debts.length === 0 ? (
        <EmptyState
          icon={<Landmark size={28} aria-hidden="true" />}
          title={t('debts.noTerms')}
          body={t('debts.noTermsBody')}
          action={
            <button type="button" onClick={() => edit()} style={field.primary}>
              {t('debts.addTerms')}
            </button>
          }
        />
      ) : (
        <ul style={styles.list}>
          {overview.debts.map((debt) => {
            const paid = Math.max(debt.principal_minor - debt.outstanding_minor, 0);
            const months = debt.minimum_payment_minor
              ? Math.ceil(debt.outstanding_minor / debt.minimum_payment_minor)
              : null;
            return (
              <li key={debt.ledger_account_id} style={field.card}>
                <div style={styles.rowTop}>
                  <div>
                    <strong>{debt.name}</strong>
                    <div style={field.meta}>{t('goals.outstanding')}</div>
                  </div>
                  <strong style={styles.amount}>
                    {fmt(debt.outstanding_minor, debt.currency_code)}
                  </strong>
                </div>
                <ProgressBar
                  value={paid}
                  max={debt.principal_minor}
                  tone="neutral"
                  label={`${debt.name}: ${fmt(debt.outstanding_minor, debt.currency_code)} ${t('goals.outstanding')}`}
                />
                <dl style={styles.terms}>
                  <div>
                    <dt style={field.meta}>{t('goals.principal')}</dt>
                    <dd>{fmt(debt.principal_minor, debt.currency_code)}</dd>
                  </div>
                  <div>
                    <dt style={field.meta}>{t('goals.interestRate')}</dt>
                    <dd>
                      {debt.annual_rate_bps == null
                        ? t('goals.noRate')
                        : percent(debt.annual_rate_bps / 100, locale, 2)}
                    </dd>
                  </div>
                  <div>
                    <dt style={field.meta}>{t('goals.minimumPayment')}</dt>
                    <dd>
                      {debt.minimum_payment_minor == null
                        ? '—'
                        : fmt(debt.minimum_payment_minor, debt.currency_code)}
                    </dd>
                  </div>
                  <div>
                    <dt style={field.meta}>{t('goals.dueDay')}</dt>
                    <dd>{debt.due_day == null ? '—' : num(debt.due_day, locale)}</dd>
                  </div>
                </dl>
                {months !== null && (
                  <p style={styles.estimateNote}>
                    {t('goals.payoffEstimate', { months: num(months, locale) })}
                  </p>
                )}
                <div style={styles.actions}>
                  <button type="button" onClick={() => edit(debt)} style={field.ghost}>
                    <Pencil size={14} aria-hidden="true" />
                    {t('app.edit')}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(debt.ledger_account_id)}
                    style={field.ghost}
                    aria-label={`${t('debts.removeTerms')}: ${debt.name}`}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                    {t('debts.removeTerms')}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: '1rem',
    flexWrap: 'wrap',
    marginBottom: '1rem',
  },
  eyebrow: {
    display: 'flex',
    gap: '0.4rem',
    alignItems: 'center',
    color: 'var(--color-transfer)',
    fontSize: '0.75rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  title: { margin: '0.35rem 0', color: 'var(--text-primary)', fontSize: '2rem' },
  subtitle: { margin: 0, color: 'var(--text-secondary)' },
  total: {
    padding: '1rem',
    background: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: '0.85rem',
    marginBottom: '1rem',
  },
  totalValue: {
    display: 'block',
    color: 'var(--color-error)',
    fontSize: '1.55rem',
    marginTop: '0.25rem',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))',
    gap: '0.8rem',
    marginBottom: '0.75rem',
  },
  list: { listStyle: 'none', padding: 0, display: 'grid', gap: '0.8rem' },
  rowTop: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '1rem',
    marginBottom: '0.75rem',
  },
  amount: { color: 'var(--color-error)' },
  terms: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))',
    gap: '0.75rem',
    margin: '0.8rem 0',
  },
  estimateNote: { color: 'var(--text-tertiary)', fontSize: '0.78rem', fontStyle: 'italic' },
  actions: { display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' },
};
