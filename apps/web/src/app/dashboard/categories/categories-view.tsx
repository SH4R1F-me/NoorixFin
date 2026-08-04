'use client';

import { useState } from 'react';
import { Plus, X, Edit3, Grid, List } from 'lucide-react';

export interface CategoryItem { id: string; name: string; kind: string; icon: string; color: string; isSystem: boolean }

export default function CategoriesView({ categories }: { categories: CategoryItem[] }) {
  const SYSTEM_CATEGORIES = categories;
  const [filter, setFilter] = useState<'ALL' | 'EXPENSE' | 'INCOME'>('ALL');
  const [showCreate, setShowCreate] = useState(false);
  const [view, setView] = useState<'grid' | 'list'>('grid');

  const filtered = SYSTEM_CATEGORIES.filter(c => filter === 'ALL' || c.kind === filter);
  const expense = filtered.filter(c => c.kind === 'EXPENSE');
  const income = filtered.filter(c => c.kind === 'INCOME');

  const s: Record<string, React.CSSProperties> = {
    hdr: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' },
    title: { fontSize: '1.75rem', fontWeight: 800, color: '#f8fafc', margin: 0 },
    sub: { fontSize: '0.8125rem', color: '#64748b', margin: 0, marginTop: 2 },
    btns: { display: 'flex', gap: '0.5rem' },
    addBtn: { display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 1.25rem', background: 'linear-gradient(135deg,#059669,#10b981)', border: 'none', borderRadius: '0.75rem', color: 'white', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 12px rgba(16,185,129,0.3)' },
    viewBtn: { background: 'rgba(30,41,59,0.5)', border: '1px solid #1e293b', borderRadius: '0.5rem', color: '#94a3b8', padding: '0.5rem', display: 'flex', cursor: 'pointer' },
    filters: { display: 'flex', gap: '0.25rem', marginBottom: '1.5rem' },
    chip: { padding: '0.5rem 1rem', background: 'transparent', border: '1px solid #1e293b', borderRadius: '0.5rem', color: '#94a3b8', fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 150ms' },
    chipA: { background: 'rgba(16,185,129,0.1)', borderColor: '#10b981', color: '#10b981' },
    section: { marginBottom: '2rem' },
    sectionTitle: { fontSize: '0.875rem', fontWeight: 700, color: '#94a3b8', marginBottom: '0.75rem', textTransform: 'uppercase' as const, letterSpacing: '0.05em' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem' },
    card: { padding: '1.25rem', background: 'rgba(30,41,59,0.4)', border: '1px solid #1e293b', borderRadius: '1rem', cursor: 'pointer', transition: 'all 200ms', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '0.75rem', textAlign: 'center' as const, position: 'relative' as const },
    catIcon: { width: 52, height: 52, borderRadius: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' },
    catName: { fontSize: '0.8125rem', fontWeight: 600, color: '#f8fafc' },
    badge: { fontSize: '0.625rem', padding: '0.125rem 0.375rem', borderRadius: '0.25rem', background: 'rgba(100,116,139,0.2)', color: '#94a3b8', position: 'absolute' as const, top: 8, right: 8 },
    createBox: { background: 'rgba(30,41,59,0.6)', backdropFilter: 'blur(20px)', border: '1px solid #334155', borderRadius: '1rem', padding: '1.5rem', marginBottom: '1.5rem' },
    formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: '1rem', marginBottom: '1.25rem' },
    fg: { display: 'flex', flexDirection: 'column' as const, gap: '0.375rem' },
    lbl: { fontSize: '0.75rem', fontWeight: 500, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: '0.05em' },
    inp: { padding: '0.625rem 0.75rem', background: 'rgba(15,23,42,0.6)', border: '1px solid #334155', borderRadius: '0.5rem', color: '#f8fafc', fontSize: '0.875rem', fontFamily: 'inherit', outline: 'none' },
    saveBtn: { padding: '0.625rem 2rem', background: 'linear-gradient(135deg,#059669,#10b981)', border: 'none', borderRadius: '0.625rem', color: 'white', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit' },
    listRow: { display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', borderBottom: '1px solid #1e293b', transition: 'background 150ms', cursor: 'pointer' },
    listIcon: { width: 36, height: 36, borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.125rem', flexShrink: 0 },
    listName: { flex: 1, fontSize: '0.875rem', fontWeight: 500, color: '#f8fafc' },
    listBadge: { fontSize: '0.6875rem', padding: '0.125rem 0.5rem', borderRadius: '0.25rem', color: '#94a3b8' },
  };

  const renderCategory = (c: typeof SYSTEM_CATEGORIES[0]) => {
    if (view === 'grid') {
      return (
        <div key={c.id} style={s.card}>
          {c.isSystem && <span style={s.badge}>System</span>}
          <div style={{ ...s.catIcon, background: c.color + '18' }}>{c.icon}</div>
          <div style={s.catName}>{c.name}</div>
        </div>
      );
    }
    return (
      <div key={c.id} style={s.listRow}>
        <div style={{ ...s.listIcon, background: c.color + '18' }}>{c.icon}</div>
        <span style={s.listName}>{c.name}</span>
        <span style={{ ...s.listBadge, background: c.kind === 'EXPENSE' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', color: c.kind === 'EXPENSE' ? '#ef4444' : '#10b981' }}>
          {c.kind}
        </span>
        {c.isSystem && <span style={{ ...s.listBadge, background: 'rgba(100,116,139,0.1)' }}>System</span>}
      </div>
    );
  };

  return (
    <div>
      <div style={s.hdr}>
        <div><h1 style={s.title}>ক্যাটাগরি</h1><p style={s.sub}>Categories</p></div>
        <div style={s.btns}>
          <button onClick={() => setView(view === 'grid' ? 'list' : 'grid')} style={s.viewBtn}>
            {view === 'grid' ? <List size={16} /> : <Grid size={16} />}
          </button>
          <button onClick={() => setShowCreate(!showCreate)} style={s.addBtn}>
            {showCreate ? <X size={18} /> : <Plus size={18} />}
            <span>{showCreate ? 'Close' : 'New Category'}</span>
          </button>
        </div>
      </div>

      {showCreate && (
        <div style={s.createBox}>
          <div style={s.formGrid}>
            <div style={s.fg}><label style={s.lbl}>Name</label><input type="text" placeholder="e.g. Groceries" style={s.inp} /></div>
            <div style={s.fg}><label style={s.lbl}>Type</label><select style={s.inp}><option>EXPENSE</option><option>INCOME</option></select></div>
            <div style={s.fg}><label style={s.lbl}>Icon (Emoji)</label><input type="text" placeholder="🛒" style={s.inp} /></div>
            <div style={s.fg}><label style={s.lbl}>Color</label><input type="color" defaultValue="#10b981" style={{ ...s.inp, padding: '0.25rem' }} /></div>
            <div style={s.fg}><label style={s.lbl}>Parent Category</label><select style={s.inp}><option value="">None (Top Level)</option>{SYSTEM_CATEGORIES.filter(c => !c.isSystem).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button style={s.saveBtn}>Create Category</button></div>
        </div>
      )}

      <div style={s.filters}>
        {(['ALL', 'EXPENSE', 'INCOME'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ ...s.chip, ...(filter === f ? s.chipA : {}) }}>
            {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {(filter === 'ALL' || filter === 'EXPENSE') && expense.length > 0 && (
        <div style={s.section}>
          <div style={s.sectionTitle}>Expense Categories ({expense.length})</div>
          {view === 'grid' ? (
            <div style={s.grid}>{expense.map(renderCategory)}</div>
          ) : (
            <div style={{ background: 'rgba(30,41,59,0.3)', border: '1px solid #1e293b', borderRadius: '1rem', overflow: 'hidden' }}>
              {expense.map(renderCategory)}
            </div>
          )}
        </div>
      )}

      {(filter === 'ALL' || filter === 'INCOME') && income.length > 0 && (
        <div style={s.section}>
          <div style={s.sectionTitle}>Income Categories ({income.length})</div>
          {view === 'grid' ? (
            <div style={s.grid}>{income.map(renderCategory)}</div>
          ) : (
            <div style={{ background: 'rgba(30,41,59,0.3)', border: '1px solid #1e293b', borderRadius: '1rem', overflow: 'hidden' }}>
              {income.map(renderCategory)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
