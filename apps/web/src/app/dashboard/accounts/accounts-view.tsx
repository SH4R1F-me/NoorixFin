'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus, Landmark, CreditCard, Wallet, Banknote, Building2,
  TrendingUp, X, Eye, EyeOff, MoreHorizontal,
} from 'lucide-react';
import { formatAmount, getCurrency } from '@noorixfin/money';
import { intlLocale } from '@noorixfin/i18n';
import { useLocale } from '../../../lib/i18n/locale-provider';
import { createAccount } from '../ledger-actions';

/**
 * Subtypes offered when creating an account, keyed to catalog entries.
 * The values match the API's CreateAccountDto enum exactly — the old form
 * offered `WALLET`/`CARD`, which the API does not accept.
 */
const SUBTYPES = [
  { value: 'CASH', key: 'accounts.cash', icon: Banknote, class: 'ASSET' },
  { value: 'BANK', key: 'accounts.bank', icon: Building2, class: 'ASSET' },
  { value: 'MOBILE_WALLET', key: 'accounts.mobileWallet', icon: Wallet, class: 'ASSET' },
  { value: 'SAVINGS', key: 'accounts.savings', icon: TrendingUp, class: 'ASSET' },
  { value: 'CREDIT_CARD', key: 'accounts.creditCard', icon: CreditCard, class: 'LIABILITY' },
  { value: 'LOAN', key: 'accounts.loan', icon: Landmark, class: 'LIABILITY' },
] as const;

export interface AccountItem {
  id: string;
  name: string;
  class: string;
  subtype: string;
  currency: string;
  balance: number;
  icon: string;
  color: string;
}

export default function AccountsView({
  accounts,
  workspaceId,
  currency = 'BDT',
}: {
  accounts: AccountItem[];
  workspaceId: string;
  currency?: string;
}) {
  const { t, locale } = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showCreate, setShowCreate] = useState(false);
  const [privacyMode, setPrivacyMode] = useState(false);

  const fmt = (minor: number, code = currency) =>
    getCurrency(code).symbol + formatAmount(Math.abs(minor), code, intlLocale[locale]);

  // ── create-account form (previously uncontrolled inputs + a dead button) ──
  const [name, setName] = useState('');
  const [subtype, setSubtype] = useState<string>('CASH');
  const [formError, setFormError] = useState<string | null>(null);

  const chosen = SUBTYPES.find((option) => option.value === subtype) ?? SUBTYPES[0];
  /** Translated display name for a stored subtype, falling back to the raw code. */
  const subtypeLabel = (value: string) => {
    const match = SUBTYPES.find((option) => option.value === value);
    return match ? t(match.key) : value;
  };

  function submit() {
    setFormError(null);
    startTransition(async () => {
      const result = await createAccount({
        workspaceId,
        name,
        // Class follows the subtype rather than being a second dropdown the user
        // can contradict — a CREDIT_CARD is never an ASSET.
        accountClass: chosen.class,
        subtype: chosen.value,
        currency,
      });
      if (result.ok) {
        setName('');
        setShowCreate(false);
        router.refresh();
      } else {
        setFormError(result.message);
      }
    });
  }

  const assets = accounts.filter(a => a.class === 'ASSET');
  const liabilities = accounts.filter(a => a.class === 'LIABILITY');
  const totalAssets = assets.reduce((s, a) => s + a.balance, 0);
  const totalLiabilities = liabilities.reduce((s, a) => s + Math.abs(a.balance), 0);
  const netWorth = totalAssets - totalLiabilities;

  const s: Record<string, React.CSSProperties> = {
    hdr: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' },
    title: { fontSize: '1.75rem', fontWeight: 800, color: '#f8fafc', margin: 0 },
    sub: { fontSize: '0.8125rem', color: '#64748b', margin: 0, marginTop: 2 },
    addBtn: { display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 1.25rem', background: 'linear-gradient(135deg,#059669,#10b981)', border: 'none', borderRadius: '0.75rem', color: 'white', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 12px rgba(16,185,129,0.3)' },
    summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' },
    summaryCard: { padding: '1.25rem', background: 'rgba(30,41,59,0.5)', backdropFilter: 'blur(12px)', border: '1px solid #1e293b', borderRadius: '1rem', display: 'flex', flexDirection: 'column' as const, gap: '0.5rem' },
    summaryLabel: { fontSize: '0.75rem', fontWeight: 500, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: '0.05em' },
    summaryValue: { fontSize: '1.5rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums' as const },
    section: { marginBottom: '2rem' },
    sectionTitle: { fontSize: '1rem', fontWeight: 700, color: '#94a3b8', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' },
    cardGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' },
    card: { padding: '1.25rem', background: 'rgba(30,41,59,0.4)', border: '1px solid #1e293b', borderRadius: '1rem', cursor: 'pointer', transition: 'all 200ms', display: 'flex', flexDirection: 'column' as const, gap: '1rem' },
    cardTop: { display: 'flex', alignItems: 'center', gap: '0.75rem' },
    cardIcon: { width: 44, height: 44, borderRadius: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', flexShrink: 0 },
    cardInfo: { flex: 1 },
    cardName: { fontSize: '0.9375rem', fontWeight: 600, color: '#f8fafc' },
    cardSubtype: { fontSize: '0.75rem', color: '#64748b', marginTop: 1 },
    cardBalance: { fontSize: '1.25rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums' as const },
    privacyBtn: { background: 'rgba(30,41,59,0.5)', border: '1px solid #1e293b', borderRadius: '0.5rem', color: '#94a3b8', padding: '0.375rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.375rem', cursor: 'pointer', fontSize: '0.8125rem', fontFamily: 'inherit' },
    createBox: { background: 'rgba(30,41,59,0.6)', backdropFilter: 'blur(20px)', border: '1px solid #334155', borderRadius: '1rem', padding: '1.5rem', marginBottom: '1.5rem' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: '1rem', marginBottom: '1.25rem' },
    fg: { display: 'flex', flexDirection: 'column' as const, gap: '0.375rem' },
    lbl: { fontSize: '0.75rem', fontWeight: 500, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: '0.05em' },
    inp: { padding: '0.625rem 0.75rem', background: 'rgba(15,23,42,0.6)', border: '1px solid #334155', borderRadius: '0.5rem', color: '#f8fafc', fontSize: '0.875rem', fontFamily: 'inherit', outline: 'none' },
    saveBtn: { padding: '0.625rem 2rem', background: 'linear-gradient(135deg,#059669,#10b981)', border: 'none', borderRadius: '0.625rem', color: 'white', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 12px rgba(16,185,129,0.25)' },
  };

  const mask = (val: string) => privacyMode ? '••••••' : val;

  return (
    <div>
      <div style={s.hdr}>
        <div><h1 style={s.title}>{t('accounts.title')}</h1></div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={() => setPrivacyMode(!privacyMode)} style={s.privacyBtn}>
            {privacyMode ? <EyeOff size={14} /> : <Eye size={14} />}
            {privacyMode ? 'Show' : 'Hide'}
          </button>
          <button onClick={() => setShowCreate(!showCreate)} style={s.addBtn}>
            {showCreate ? <X size={18} /> : <Plus size={18} />}
            <span>{showCreate ? t('app.close') : t('accounts.addAccount')}</span>
          </button>
        </div>
      </div>

      {showCreate && (
        <div style={s.createBox}>
          <div style={s.grid}>
            <div style={s.fg}>
              <label style={s.lbl} htmlFor="acc-name">{t('accounts.accountName')}</label>
              <input id="acc-name" type="text" placeholder={t('accounts.namePlaceholder')}
                     value={name} onChange={e=>setName(e.target.value)} style={s.inp} />
            </div>
            <div style={s.fg}>
              <label style={s.lbl} htmlFor="acc-subtype">{t('accounts.accountType')}</label>
              <select id="acc-subtype" value={subtype} onChange={e=>setSubtype(e.target.value)} style={s.inp}>
                {SUBTYPES.map(option=>(
                  <option key={option.value} value={option.value}>{t(option.key)}</option>
                ))}
              </select>
            </div>
            <div style={s.fg}>
              <label style={s.lbl}>{t('accounts.currency')}</label>
              {/* One currency per workspace today (DEC-002 #7 is still open), so
                  this reflects the workspace rather than offering a choice the
                  ledger cannot yet honour. */}
              <input value={currency} readOnly style={{...s.inp, opacity:0.7}} />
            </div>
          </div>

          {formError && (
            <p role="alert" style={{color:'#fca5a5',fontSize:'0.8125rem',marginBottom:'0.75rem'}}>{formError}</p>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={submit} disabled={pending || !name.trim()}
                    style={{...s.saveBtn, opacity: pending||!name.trim() ? 0.55 : 1}}>
              {t('accounts.createAccount')}
            </button>
          </div>
        </div>
      )}

      {accounts.length === 0 && !showCreate && (
        <p style={{ color: '#64748b', fontSize: '0.875rem', margin: '2rem 0' }}>
          {t('accounts.noAccountsBody')}
        </p>
      )}

      {/* Summary Cards */}
      <div style={s.summaryGrid}>
        <div style={s.summaryCard}>
          <span style={s.summaryLabel}>{t('accounts.asset')}</span>
          <span style={{ ...s.summaryValue, color: '#10b981' }}>{mask(fmt(totalAssets))}</span>
        </div>
        <div style={s.summaryCard}>
          <span style={s.summaryLabel}>{t('accounts.liability')}</span>
          <span style={{ ...s.summaryValue, color: '#ef4444' }}>{mask(fmt(totalLiabilities))}</span>
        </div>
        <div style={s.summaryCard}>
          <span style={s.summaryLabel}>{t('reports.netWorth')}</span>
          <span style={{ ...s.summaryValue, color: netWorth >= 0 ? '#10b981' : '#ef4444' }}>{mask(fmt(netWorth))}</span>
        </div>
      </div>

      {/* Asset Accounts */}
      <div style={s.section}>
        <div style={s.sectionTitle}><TrendingUp size={16} style={{ color: '#10b981' }} /> Assets ({assets.length})</div>
        <div style={s.cardGrid}>
          {assets.map(acc => (
            <div key={acc.id} style={s.card}>
              <div style={s.cardTop}>
                <div style={{ ...s.cardIcon, background: acc.color + '18' }}>{acc.icon}</div>
                <div style={s.cardInfo}>
                  <div style={s.cardName}>{acc.name}</div>
                  <div style={s.cardSubtype}>{subtypeLabel(acc.subtype)}</div>
                </div>
              </div>
              <div style={{ ...s.cardBalance, color: '#10b981' }}>{mask(fmt(acc.balance, acc.currency))}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Liability Accounts */}
      {liabilities.length > 0 && (
        <div style={s.section}>
          <div style={s.sectionTitle}><CreditCard size={16} style={{ color: '#ef4444' }} /> Liabilities ({liabilities.length})</div>
          <div style={s.cardGrid}>
            {liabilities.map(acc => (
              <div key={acc.id} style={s.card}>
                <div style={s.cardTop}>
                  <div style={{ ...s.cardIcon, background: acc.color + '18' }}>{acc.icon}</div>
                  <div style={s.cardInfo}>
                    <div style={s.cardName}>{acc.name}</div>
                    <div style={s.cardSubtype}>{subtypeLabel(acc.subtype)}</div>
                  </div>
                </div>
                <div style={{ ...s.cardBalance, color: '#ef4444' }}>{mask(fmt(acc.balance, acc.currency))}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
