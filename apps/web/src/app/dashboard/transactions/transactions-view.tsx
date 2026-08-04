'use client';

import { useState } from 'react';
import {
  Plus, Search, ArrowDownLeft, ArrowUpRight, ArrowLeftRight,
  X, TrendingUp, TrendingDown, Repeat,
} from 'lucide-react';
import { formatAmount, getCurrency } from '@noorixfin/money';

// See accounts/page.tsx — symbol + formatAmount keeps the ৳ glyph while applying
// the currency's real exponent instead of a hardcoded /100.
function fmt(minor: number, currency = 'BDT') {
  return getCurrency(currency).symbol + formatAmount(minor, currency, 'en-BD');
}
function fmtDate(d: string) { const dt = new Date(d); return `${dt.getDate()} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][dt.getMonth()]}`; }

export interface TxItem {
  id: string;
  type: string;
  payee: string;
  amount: number;
  cat: string;
  catIcon: string;
  account: string;
  date: string;
  note: string;
}

export default function TransactionsView({
  transactions,
  categories,
}: {
  transactions: TxItem[];
  categories: string[];
}) {
  const MOCK_TXS = transactions;
  const CATEGORIES = categories;
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [filterType, setFilterType] = useState('ALL');
  const [selCat, setSelCat] = useState('All');
  const [addType, setAddType] = useState<'EXPENSE'|'INCOME'|'TRANSFER'>('EXPENSE');

  const filtered = MOCK_TXS.filter(t => {
    if (filterType !== 'ALL' && t.type !== filterType) return false;
    if (selCat !== 'All' && t.cat !== selCat) return false;
    if (search && !t.payee.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totIn = MOCK_TXS.filter(t => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0);
  const totEx = MOCK_TXS.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0);

  const s: Record<string, React.CSSProperties> = {
    hdr: { display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'1.5rem', flexWrap:'wrap', gap:'1rem' },
    title: { fontSize:'1.75rem', fontWeight:800, color:'#f8fafc', margin:0, letterSpacing:'-0.02em' },
    sub: { fontSize:'0.8125rem', color:'#64748b', margin:0, marginTop:2 },
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
    meta: { display:'flex', alignItems:'center', gap:'0.375rem', fontSize:'0.75rem', color:'#64748b', marginTop:2, flexWrap:'wrap' as const },
    amtS: { textAlign:'right' as const, flexShrink:0 },
    amt: { fontSize:'0.9375rem', fontWeight:700, fontVariantNumeric:'tabular-nums' as const },
    date: { fontSize:'0.75rem', color:'#64748b', marginTop:2 },
    empty: { display:'flex', flexDirection:'column' as const, alignItems:'center', padding:'3rem' },
  };

  return (
    <div>
      <div style={s.hdr}>
        <div><h1 style={s.title}>লেনদেন</h1><p style={s.sub}>Transactions</p></div>
        <button onClick={() => setShowAdd(!showAdd)} style={s.addBtn}>
          {showAdd ? <X size={18}/> : <Plus size={18}/>}
          <span>{showAdd ? 'Close' : 'Add Transaction'}</span>
        </button>
      </div>

      {showAdd && (
        <div style={s.qaBox}>
          <div style={s.typeSel}>
            {([['EXPENSE','Expense','#ef4444'],['INCOME','Income','#10b981'],['TRANSFER','Transfer','#3b82f6']] as const).map(([t,l,c]) => (
              <button key={t} onClick={() => setAddType(t as any)} style={{...s.typeBtn, ...(addType===t ? {background:c+'18',borderColor:c,color:c} : {})}}>
                {t==='EXPENSE'?<ArrowUpRight size={16}/>:t==='INCOME'?<ArrowDownLeft size={16}/>:<ArrowLeftRight size={16}/>} {l}
              </button>
            ))}
          </div>
          <div style={s.grid}>
            <div style={s.fg}><label style={s.lbl}>Amount (৳)</label><input type="number" placeholder="0.00" style={s.inp}/></div>
            <div style={s.fg}><label style={s.lbl}>Account</label><select style={s.inp}><option>bKash</option><option>DBBL Bank</option><option>Cash</option><option>Nagad</option></select></div>
            {addType!=='TRANSFER' ? (
              <div style={s.fg}><label style={s.lbl}>Category</label><select style={s.inp}>{CATEGORIES.filter(c=>c!=='All').map(c=><option key={c}>{c}</option>)}</select></div>
            ) : (
              <div style={s.fg}><label style={s.lbl}>To Account</label><select style={s.inp}><option>Cash</option><option>DBBL Bank</option></select></div>
            )}
            <div style={s.fg}><label style={s.lbl}>Payee / Note</label><input type="text" placeholder="Who did you pay?" style={s.inp}/></div>
            <div style={s.fg}><label style={s.lbl}>Date</label><input type="date" defaultValue={new Date().toISOString().split('T')[0]} style={s.inp}/></div>
            <div style={s.fg}><label style={s.lbl}>Tags</label><input type="text" placeholder="e.g. urgent, monthly" style={s.inp}/></div>
          </div>
          <div style={{display:'flex',justifyContent:'flex-end'}}><button style={s.saveBtn}>Save Transaction</button></div>
        </div>
      )}

      <div style={s.strip}>
        <div style={s.si}><TrendingUp size={16} style={{color:'#10b981'}}/><span style={{color:'#94a3b8',fontSize:'0.8125rem'}}>Income</span><span style={{color:'#10b981',fontWeight:600,fontSize:'0.9375rem'}}>{fmt(totIn)}</span></div>
        <div style={s.sd}/>
        <div style={s.si}><TrendingDown size={16} style={{color:'#ef4444'}}/><span style={{color:'#94a3b8',fontSize:'0.8125rem'}}>Expense</span><span style={{color:'#ef4444',fontWeight:600,fontSize:'0.9375rem'}}>{fmt(totEx)}</span></div>
        <div style={s.sd}/>
        <div style={s.si}><Repeat size={16} style={{color:'#3b82f6'}}/><span style={{color:'#94a3b8',fontSize:'0.8125rem'}}>Net</span><span style={{color:totIn-totEx>=0?'#10b981':'#ef4444',fontWeight:600,fontSize:'0.9375rem'}}>{fmt(totIn-totEx)}</span></div>
      </div>

      <div style={s.filters}>
        <div style={s.srchC}><Search size={16} style={{color:'#64748b',flexShrink:0}}/><input type="text" placeholder="Search transactions..." value={search} onChange={e=>setSearch(e.target.value)} style={s.srchI}/></div>
        <div style={s.fgr}>
          {['ALL','EXPENSE','INCOME','TRANSFER'].map(t=>(
            <button key={t} onClick={()=>setFilterType(t)} style={{...s.chip,...(filterType===t?s.chipA:{})}}>{t==='ALL'?'All':t.charAt(0)+t.slice(1).toLowerCase()}</button>
          ))}
        </div>
        <select value={selCat} onChange={e=>setSelCat(e.target.value)} style={s.selF}>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select>
      </div>

      <div style={s.list}>
        {filtered.map((tx,idx)=>{
          const isE=tx.type==='EXPENSE', isI=tx.type==='INCOME';
          const col=isE?'#ef4444':isI?'#10b981':'#3b82f6';
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
        {filtered.length===0&&<div style={s.empty}><Search size={40} style={{color:'#334155',marginBottom:12}}/><p style={{color:'#64748b'}}>No transactions found</p></div>}
      </div>
    </div>
  );
}
