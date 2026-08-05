'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus, Search, ArrowDownLeft, ArrowUpRight, ArrowLeftRight,
  X, TrendingUp, TrendingDown, Repeat, Loader2,
} from 'lucide-react';
import { formatAmount, getCurrency } from '@noorixfin/money';
import { intlLocale } from '@noorixfin/i18n';
import { useLocale } from '../../../lib/i18n/locale-provider';
import { createTransaction } from '../ledger-actions';

export interface Option { id: string; label: string; kind?: string }

export interface TxItem {
  id: string;
  type: string;
  payee: string;
  amount: number;
  cat: string;
  catIcon: string;
  /** Resolved from the postings' ledger account (DEC-015). Absent for transfers. */
  categoryId?: string;
  account: string;
  date: string;
  note: string;
}

export default function TransactionsView({
  transactions,
  categories,
  accounts,
  workspaceId,
  currency,
  drillDownLabel,
}: {
  transactions: TxItem[];
  categories: Option[];
  accounts: Option[];
  workspaceId: string;
  currency: string;
  /**
   * Set when the list was reached from a budget line or a report slice (§5.3).
   * The banner it drives matters: without it a filtered list looks identical to
   * a user having very few transactions, which is an alarming thing to imply.
   */
  drillDownLabel?: string;
}) {
  const { t: tr, locale } = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const fmt = (minor: number) =>
    getCurrency(currency).symbol + formatAmount(minor, currency, intlLocale[locale]);
  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString(intlLocale[locale], { day: 'numeric', month: 'short' });

  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [filterType, setFilterType] = useState('ALL');
  const [selCat, setSelCat] = useState('');
  const [addType, setAddType] = useState<'EXPENSE'|'INCOME'|'TRANSFER'>('EXPENSE');

  // ── add-transaction form state ────────────────────────────────────────────
  // These inputs were UNCONTROLLED and the save button had no handler, so the
  // form could never have submitted anything.
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [payee, setPayee] = useState('');
  const [occurredAt, setOccurredAt] = useState(new Date().toISOString().split('T')[0]);
  const [formError, setFormError] = useState<string | null>(null);

  const selectableCategories = categories.filter(
    (c) => !c.kind || c.kind === (addType === 'INCOME' ? 'INCOME' : 'EXPENSE'),
  );

  function submit() {
    setFormError(null);
    startTransition(async () => {
      const result = await createTransaction({
        workspaceId,
        type: addType,
        amount,
        currency,
        accountId,
        categoryId: addType === 'TRANSFER' ? undefined : categoryId,
        transferToAccountId: addType === 'TRANSFER' ? toAccountId : undefined,
        payee,
        occurredAt,
      });
      if (result.ok) {
        setAmount(''); setPayee(''); setCategoryId(''); setToAccountId('');
        setShowAdd(false);
        // The list is server-rendered; refresh so the new entry appears.
        router.refresh();
      } else {
        setFormError(result.message);
      }
    });
  }

  const filtered = transactions.filter(row => {
    if (filterType !== 'ALL' && row.type !== filterType) return false;
    if (selCat && row.cat !== selCat) return false;
    if (search && !row.payee.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totIn = transactions.filter(row => row.type === 'INCOME').reduce((sum, row) => sum + row.amount, 0);
  const totEx = transactions.filter(row => row.type === 'EXPENSE').reduce((sum, row) => sum + row.amount, 0);

  const s: Record<string, React.CSSProperties> = {
    hdr: { display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'1.5rem', flexWrap:'wrap', gap:'1rem' },
    title: { fontSize:'1.75rem', fontWeight:800, color:'#f8fafc', margin:0, letterSpacing:'-0.02em' },
    sub: { fontSize:'0.8125rem', color:'#8b9ab0', margin:0, marginTop:2 },
    addBtn: { display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.625rem 1.25rem', background:'linear-gradient(135deg,#059669,#10b981)', border:'none', borderRadius:'0.75rem', color:'white', fontWeight:600, fontSize:'0.875rem', cursor:'pointer', fontFamily:'inherit', boxShadow:'0 4px 12px rgba(16,185,129,0.3)' },
    qaBox: { background:'rgba(30,41,59,0.6)', backdropFilter:'blur(20px)', border:'1px solid #334155', borderRadius:'1rem', padding:'1.5rem', marginBottom:'1.5rem' },
    typeSel: { display:'flex', gap:'0.5rem', marginBottom:'1.25rem' },
    typeBtn: { display:'flex', alignItems:'center', gap:'0.375rem', padding:'0.5rem 1rem', background:'transparent', border:'1px solid #334155', borderRadius:'0.625rem', color:'#94a3b8', fontSize:'0.8125rem', fontWeight:500, cursor:'pointer', fontFamily:'inherit', transition:'all 150ms' },
    grid: { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:'1rem', marginBottom:'1.25rem' },
    fg: { display:'flex', flexDirection:'column' as const, gap:'0.375rem' },
    lbl: { fontSize:'0.75rem', fontWeight:500, color:'#94a3b8', textTransform:'uppercase' as const, letterSpacing:'0.05em' },
    inp: { padding:'0.625rem 0.75rem', background:'rgba(15,23,42,0.6)', border:'1px solid #334155', borderRadius:'0.5rem', color:'#f8fafc', fontSize:'0.875rem', fontFamily:'inherit', outline:'none' },
    saveBtn: { alignSelf:'flex-end' as const, padding:'0.625rem 2rem', background:'linear-gradient(135deg,#059669,#10b981)', border:'none', borderRadius:'0.625rem', color:'white', fontWeight:600, fontSize:'0.875rem', cursor:'pointer', fontFamily:'inherit', boxShadow:'0 4px 12px rgba(16,185,129,0.25)' },
    strip: { display:'flex', alignItems:'center', gap:'1.5rem', padding:'1rem 1.25rem', background:'rgba(30,41,59,0.4)', border:'1px solid #1e293b', borderRadius:'0.75rem', marginBottom:'1rem', flexWrap:'wrap' as const },
    si: { display:'flex', alignItems:'center', gap:'0.5rem' },
    sd: { width:1, height:24, background:'#334155' },
    filters: { display:'flex', gap:'0.75rem', marginBottom:'1rem', flexWrap:'wrap' as const, alignItems:'center' },
    srchC: { display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.5rem 0.75rem', background:'rgba(15,23,42,0.6)', border:'1px solid #1e293b', borderRadius:'0.625rem', flex:1, minWidth:200 },
    srchI: { background:'transparent', border:'none', outline:'none', color:'#f8fafc', fontSize:'0.875rem', fontFamily:'inherit', width:'100%' },
    fgr: { display:'flex', gap:'0.25rem' },
    chip: { padding:'0.375rem 0.75rem', background:'transparent', border:'1px solid #1e293b', borderRadius:'0.5rem', color:'#94a3b8', fontSize:'0.8125rem', cursor:'pointer', fontFamily:'inherit', transition:'all 150ms' },
    chipA: { background:'rgba(16,185,129,0.1)', borderColor:'#10b981', color:'#10b981' },
    selF: { padding:'0.375rem 0.75rem', background:'rgba(15,23,42,0.6)', border:'1px solid #1e293b', borderRadius:'0.5rem', color:'#94a3b8', fontSize:'0.8125rem', fontFamily:'inherit', cursor:'pointer' },
    list: { background:'rgba(30,41,59,0.3)', border:'1px solid #1e293b', borderRadius:'1rem', overflow:'hidden' },
    row: { display:'flex', alignItems:'center', gap:'1rem', padding:'1rem 1.25rem', transition:'background 150ms', cursor:'pointer' },
    icon: { width:44, height:44, borderRadius:'0.75rem', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 },
    det: { flex:1, minWidth:0 },
    payee: { fontSize:'0.9375rem', fontWeight:600, color:'#f8fafc', whiteSpace:'nowrap' as const, overflow:'hidden', textOverflow:'ellipsis' },
    meta: { display:'flex', alignItems:'center', gap:'0.375rem', fontSize:'0.75rem', color:'#8b9ab0', marginTop:2, flexWrap:'wrap' as const },
    amtS: { textAlign:'right' as const, flexShrink:0 },
    amt: { fontSize:'0.9375rem', fontWeight:700, fontVariantNumeric:'tabular-nums' as const },
    date: { fontSize:'0.75rem', color:'#8b9ab0', marginTop:2 },
    empty: { display:'flex', flexDirection:'column' as const, alignItems:'center', padding:'3rem' },
    drillBanner: { display:'flex', alignItems:'center', justifyContent:'space-between', gap:'1rem', padding:'0.7rem 1rem', background:'rgba(16,185,129,0.08)', border:'1px solid rgba(16,185,129,0.28)', borderRadius:'0.75rem', color:'#6ee7b7', fontSize:'0.8125rem', marginBottom:'1rem', flexWrap:'wrap' as const },
    drillClear: { color:'#10b981', textDecoration:'none', fontWeight:600, fontSize:'0.8125rem' },
  };

  return (
    <div>
      <div style={s.hdr}>
        <div><h1 style={s.title}>{tr('transactions.title')}</h1></div>
        <button onClick={() => setShowAdd(!showAdd)} style={s.addBtn}>
          {showAdd ? <X size={18}/> : <Plus size={18}/>}
          <span>{showAdd ? tr('app.close') : tr('transactions.addTransaction')}</span>
        </button>
      </div>

      {/*
        Drill-down banner (§5.3). Says which figure this list came from and
        offers the way back — a filtered list with no indication that it is
        filtered is indistinguishable from a nearly-empty ledger.
      */}
      {drillDownLabel && (
        <div style={s.drillBanner} role="status">
          <span>
            {tr('transactions.category')}: <strong>{drillDownLabel}</strong>
          </span>
          <a href="/dashboard/transactions" style={s.drillClear}>
            {tr('app.clear')} ×
          </a>
        </div>
      )}

      {showAdd && (
        <div style={s.qaBox}>
          <div style={s.typeSel}>
            {([['EXPENSE','transactions.expense','#f87171'],['INCOME','transactions.income','#10b981'],['TRANSFER','transactions.transfer','#3b82f6']] as const).map(([kind,labelKey,colour]) => (
              <button key={kind} onClick={() => { setAddType(kind); setCategoryId(''); }} style={{...s.typeBtn, ...(addType===kind ? {background:colour+'18',borderColor:colour,color:colour} : {})}}>
                {kind==='EXPENSE'?<ArrowUpRight size={16}/>:kind==='INCOME'?<ArrowDownLeft size={16}/>:<ArrowLeftRight size={16}/>} {tr(labelKey)}
              </button>
            ))}
          </div>
          <div style={s.grid}>
            <div style={s.fg}>
              <label style={s.lbl} htmlFor="tx-amount">{tr('transactions.amount')} ({getCurrency(currency).symbol})</label>
              <input id="tx-amount" type="number" inputMode="decimal" min="0" step="0.01"
                     placeholder="0.00" value={amount}
                     onChange={e=>setAmount(e.target.value)} style={s.inp}/>
            </div>

            <div style={s.fg}>
              <label style={s.lbl} htmlFor="tx-account">{tr('transactions.account')}</label>
              {/* Real accounts, from the ledger. This was a hardcoded
                  bKash/DBBL/Cash/Nagad list that referenced nothing. */}
              <select id="tx-account" value={accountId} onChange={e=>setAccountId(e.target.value)} style={s.inp}>
                <option value="">{tr('transactions.selectAccount')}</option>
                {accounts.map(a=><option key={a.id} value={a.id}>{a.label}</option>)}
              </select>
            </div>

            {addType!=='TRANSFER' ? (
              <div style={s.fg}>
                <label style={s.lbl} htmlFor="tx-category">{tr('transactions.category')}</label>
                <select id="tx-category" value={categoryId} onChange={e=>setCategoryId(e.target.value)} style={s.inp}>
                  <option value="">{tr('transactions.selectCategory')}</option>
                  {selectableCategories.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
            ) : (
              <div style={s.fg}>
                <label style={s.lbl} htmlFor="tx-to">{tr('transactions.toAccount')}</label>
                <select id="tx-to" value={toAccountId} onChange={e=>setToAccountId(e.target.value)} style={s.inp}>
                  <option value="">{tr('transactions.selectAccount')}</option>
                  {accounts.filter(a=>a.id!==accountId).map(a=><option key={a.id} value={a.id}>{a.label}</option>)}
                </select>
              </div>
            )}

            <div style={s.fg}>
              <label style={s.lbl} htmlFor="tx-payee">{tr('transactions.payee')}</label>
              <input id="tx-payee" type="text" placeholder={tr('transactions.payeePlaceholder')}
                     value={payee} onChange={e=>setPayee(e.target.value)} style={s.inp}/>
            </div>

            <div style={s.fg}>
              <label style={s.lbl} htmlFor="tx-date">{tr('transactions.date')}</label>
              <input id="tx-date" type="date" value={occurredAt}
                     onChange={e=>setOccurredAt(e.target.value)} style={s.inp}/>
            </div>
          </div>

          {accounts.length===0 && (
            <p style={{color:'#fbbf24',fontSize:'0.8125rem',marginBottom:'0.75rem'}}>
              {tr('transactions.needAccount')}
            </p>
          )}
          {formError && (
            <p role="alert" style={{color:'#fca5a5',fontSize:'0.8125rem',marginBottom:'0.75rem'}}>{formError}</p>
          )}

          <div style={{display:'flex',justifyContent:'flex-end'}}>
            <button onClick={submit} disabled={pending || accounts.length===0}
                    style={{...s.saveBtn, opacity: pending||accounts.length===0 ? 0.55 : 1}}>
              {pending ? <Loader2 size={16}/> : null} {tr('transactions.saveTransaction')}
            </button>
          </div>
        </div>
      )}

      <div style={s.strip}>
        <div style={s.si}><TrendingUp size={16} style={{color:'#10b981'}}/><span style={{color:'#94a3b8',fontSize:'0.8125rem'}}>{tr('transactions.income')}</span><span style={{color:'#10b981',fontWeight:600,fontSize:'0.9375rem'}}>{fmt(totIn)}</span></div>
        <div style={s.sd}/>
        <div style={s.si}><TrendingDown size={16} style={{color:'#f87171'}}/><span style={{color:'#94a3b8',fontSize:'0.8125rem'}}>{tr('transactions.expense')}</span><span style={{color:'#f87171',fontWeight:600,fontSize:'0.9375rem'}}>{fmt(totEx)}</span></div>
        <div style={s.sd}/>
        <div style={s.si}><Repeat size={16} style={{color:'#3b82f6'}}/><span style={{color:'#94a3b8',fontSize:'0.8125rem'}}>{tr('dashboard.netCashFlow')}</span><span style={{color:totIn-totEx>=0?'#10b981':'#f87171',fontWeight:600,fontSize:'0.9375rem'}}>{fmt(totIn-totEx)}</span></div>
      </div>

      <div style={s.filters}>
        <div style={s.srchC}><Search size={16} style={{color:'#8b9ab0',flexShrink:0}}/><input type="text" placeholder={tr('app.search')} value={search} onChange={e=>setSearch(e.target.value)} style={s.srchI}/></div>
        <div style={s.fgr}>
          {([['ALL','app.all'],['EXPENSE','transactions.expense'],['INCOME','transactions.income'],['TRANSFER','transactions.transfer']] as const).map(([value,labelKey])=>(
            <button key={value} onClick={()=>setFilterType(value)} style={{...s.chip,...(filterType===value?s.chipA:{})}}>{tr(labelKey)}</button>
          ))}
        </div>
        <select value={selCat} onChange={e=>setSelCat(e.target.value)} style={s.selF} aria-label={tr('transactions.category')}>
          <option value="">{tr('app.all')}</option>
          {categories.map(c=><option key={c.id} value={c.label}>{c.label}</option>)}
        </select>
      </div>

      <div style={s.list}>
        {filtered.map((tx,idx)=>{
          const isE=tx.type==='EXPENSE', isI=tx.type==='INCOME';
          const col=isE?'#f87171':isI?'#10b981':'#3b82f6';
          const pfx=isE?'-':isI?'+':'';
          return (
            <div key={tx.id} style={{...s.row,borderBottom:idx<filtered.length-1?'1px solid #1e293b':'none'}}>
              <div style={{...s.icon,background:isE?'rgba(239,68,68,0.1)':isI?'rgba(16,185,129,0.1)':'rgba(59,130,246,0.1)'}}><span style={{fontSize:'1.25rem'}}>{tx.catIcon}</span></div>
              <div style={s.det}>
                <div style={s.payee}>{tx.payee}</div>
                <div style={s.meta}><span style={{color:'#94a3b8'}}>{tx.cat}</span><span style={{color:'#334155'}}>·</span><span>{tx.account}</span>{tx.note&&<><span style={{color:'#334155'}}>·</span><span>{tx.note}</span></>}</div>
              </div>
              <div style={s.amtS}><div style={{...s.amt,color:col}}>{pfx}{fmt(tx.amount)}</div><div style={s.date}>{fmtDate(tx.date)}</div></div>
            </div>
          );
        })}
        {filtered.length===0&&<div style={s.empty}><Search size={40} style={{color:'#334155',marginBottom:12}}/><p style={{color:'#8b9ab0'}}>{transactions.length===0?tr('transactions.noTransactions'):tr('app.filter')}</p></div>}
      </div>
    </div>
  );
}
