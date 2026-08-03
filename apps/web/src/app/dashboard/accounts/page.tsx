'use client';

import { useState } from 'react';
import {
  Plus, Landmark, CreditCard, Wallet, Banknote, Building2,
  TrendingUp, X, Eye, EyeOff, MoreHorizontal,
} from 'lucide-react';

const MOCK_ACCOUNTS = [
  { id: '1', name: 'bKash', class: 'ASSET', subtype: 'WALLET', balance: 1245000, currency: 'BDT', icon: '📱', color: '#e2136e' },
  { id: '2', name: 'DBBL Bank', class: 'ASSET', subtype: 'BANK', balance: 15830000, currency: 'BDT', icon: '🏦', color: '#3b82f6' },
  { id: '3', name: 'DBBL Visa Card', class: 'LIABILITY', subtype: 'CARD', balance: -3500000, currency: 'BDT', icon: '💳', color: '#8b5cf6' },
  { id: '4', name: 'Cash', class: 'ASSET', subtype: 'CASH', balance: 850000, currency: 'BDT', icon: '💵', color: '#10b981' },
  { id: '5', name: 'Nagad', class: 'ASSET', subtype: 'WALLET', balance: 320000, currency: 'BDT', icon: '📲', color: '#f97316' },
  { id: '6', name: 'Emergency Fund', class: 'ASSET', subtype: 'BANK', balance: 25000000, currency: 'BDT', icon: '🛡️', color: '#06b6d4' },
  { id: '7', name: 'Home Loan', class: 'LIABILITY', subtype: 'LOAN', balance: -180000000, currency: 'BDT', icon: '🏠', color: '#ef4444' },
];

function fmt(minor: number) { return '৳' + Math.abs(minor / 100).toLocaleString('en-BD', { minimumFractionDigits: 2 }); }

const SUBTYPES: Record<string, { label: string; icon: React.ElementType }> = {
  CASH: { label: 'Cash', icon: Banknote },
  BANK: { label: 'Bank', icon: Building2 },
  WALLET: { label: 'Wallet', icon: Wallet },
  CARD: { label: 'Card', icon: CreditCard },
  LOAN: { label: 'Loan', icon: Landmark },
};

export default function AccountsPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [privacyMode, setPrivacyMode] = useState(false);

  const assets = MOCK_ACCOUNTS.filter(a => a.class === 'ASSET');
  const liabilities = MOCK_ACCOUNTS.filter(a => a.class === 'LIABILITY');
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
        <div><h1 style={s.title}>অ্যাকাউন্ট</h1><p style={s.sub}>Accounts</p></div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={() => setPrivacyMode(!privacyMode)} style={s.privacyBtn}>
            {privacyMode ? <EyeOff size={14} /> : <Eye size={14} />}
            {privacyMode ? 'Show' : 'Hide'}
          </button>
          <button onClick={() => setShowCreate(!showCreate)} style={s.addBtn}>
            {showCreate ? <X size={18} /> : <Plus size={18} />}
            <span>{showCreate ? 'Close' : 'New Account'}</span>
          </button>
        </div>
      </div>

      {showCreate && (
        <div style={s.createBox}>
          <div style={s.grid}>
            <div style={s.fg}><label style={s.lbl}>Account Name</label><input type="text" placeholder="e.g. bKash" style={s.inp} /></div>
            <div style={s.fg}><label style={s.lbl}>Type</label><select style={s.inp}><option>ASSET</option><option>LIABILITY</option></select></div>
            <div style={s.fg}><label style={s.lbl}>Subtype</label><select style={s.inp}><option>CASH</option><option>BANK</option><option>WALLET</option><option>CARD</option><option>LOAN</option></select></div>
            <div style={s.fg}><label style={s.lbl}>Currency</label><select style={s.inp}><option>BDT</option><option>USD</option></select></div>
            <div style={s.fg}><label style={s.lbl}>Opening Balance</label><input type="number" placeholder="0.00" style={s.inp} /></div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button style={s.saveBtn}>Create Account</button></div>
        </div>
      )}

      {/* Summary Cards */}
      <div style={s.summaryGrid}>
        <div style={s.summaryCard}>
          <span style={s.summaryLabel}>Total Assets</span>
          <span style={{ ...s.summaryValue, color: '#10b981' }}>{mask(fmt(totalAssets))}</span>
        </div>
        <div style={s.summaryCard}>
          <span style={s.summaryLabel}>Total Liabilities</span>
          <span style={{ ...s.summaryValue, color: '#ef4444' }}>{mask(fmt(totalLiabilities))}</span>
        </div>
        <div style={s.summaryCard}>
          <span style={s.summaryLabel}>Net Worth</span>
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
                  <div style={s.cardSubtype}>{SUBTYPES[acc.subtype]?.label || acc.subtype}</div>
                </div>
              </div>
              <div style={{ ...s.cardBalance, color: '#10b981' }}>{mask(fmt(acc.balance))}</div>
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
                    <div style={s.cardSubtype}>{SUBTYPES[acc.subtype]?.label || acc.subtype}</div>
                  </div>
                </div>
                <div style={{ ...s.cardBalance, color: '#ef4444' }}>{mask(fmt(Math.abs(acc.balance)))}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
