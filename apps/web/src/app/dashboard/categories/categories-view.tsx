'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X, Grid, List } from 'lucide-react';
import { useLocale } from '../../../lib/i18n/locale-provider';
import { createCategory } from '../ledger-actions';

export interface CategoryItem {
  id: string;
  name: string;
  kind: string;
  icon: string;
  color: string;
  isSystem: boolean;
}

export default function CategoriesView({
  categories,
  workspaceId,
}: {
  categories: CategoryItem[];
  workspaceId: string;
}) {
  const { t } = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [filter, setFilter] = useState<'ALL' | 'EXPENSE' | 'INCOME'>('ALL');
  const [showCreate, setShowCreate] = useState(false);
  const [view, setView] = useState<'grid' | 'list'>('grid');

  // ── create-category form (previously uncontrolled + a dead button) ────────
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  const [icon, setIcon] = useState('🛒');
  // Native colour inputs require a literal hex value; CSS variables are not a
  // valid form value even though they are correct everywhere the colour paints.
  const [colour, setColour] = useState('#10b981');
  const [formError, setFormError] = useState<string | null>(null);

  function submit() {
    setFormError(null);
    startTransition(async () => {
      const result = await createCategory({ workspaceId, name, kind, icon, color: colour });
      if (result.ok) {
        setName('');
        setShowCreate(false);
        router.refresh();
      } else {
        setFormError(result.message);
      }
    });
  }

  const filtered = categories.filter((c) => filter === 'ALL' || c.kind === filter);
  const expense = filtered.filter((c) => c.kind === 'EXPENSE');
  const income = filtered.filter((c) => c.kind === 'INCOME');

  const s: Record<string, React.CSSProperties> = {
    hdr: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: '1.5rem',
      flexWrap: 'wrap',
      gap: '1rem',
    },
    title: { fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 },
    sub: { fontSize: '0.8125rem', color: 'var(--text-tertiary)', margin: 0, marginTop: 2 },
    btns: { display: 'flex', gap: '0.5rem' },
    addBtn: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      padding: '0.625rem 1.25rem',
      background: 'linear-gradient(135deg,var(--color-primary-600),var(--color-primary-500))',
      border: 'none',
      borderRadius: '0.75rem',
      color: 'white',
      fontWeight: 600,
      fontSize: '0.875rem',
      cursor: 'pointer',
      fontFamily: 'inherit',
      boxShadow: '0 4px 12px rgba(16,185,129,0.3)',
    },
    viewBtn: {
      background: 'var(--bg-card)',
      border: '1px solid var(--border-primary)',
      borderRadius: '0.5rem',
      color: 'var(--text-secondary)',
      padding: '0.5rem',
      display: 'flex',
      cursor: 'pointer',
    },
    filters: { display: 'flex', gap: '0.25rem', marginBottom: '1.5rem' },
    chip: {
      padding: '0.5rem 1rem',
      background: 'transparent',
      border: '1px solid var(--border-primary)',
      borderRadius: '0.5rem',
      color: 'var(--text-secondary)',
      fontSize: '0.8125rem',
      cursor: 'pointer',
      fontFamily: 'inherit',
      transition: 'all 150ms',
    },
    chipA: {
      background: 'rgba(16,185,129,0.1)',
      borderColor: 'var(--color-primary-500)',
      color: 'var(--color-primary-500)',
    },
    section: { marginBottom: '2rem' },
    sectionTitle: {
      fontSize: '0.875rem',
      fontWeight: 700,
      color: 'var(--text-secondary)',
      marginBottom: '0.75rem',
      textTransform: 'uppercase' as const,
      letterSpacing: '0.05em',
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
      gap: '0.75rem',
    },
    card: {
      padding: '1.25rem',
      background: 'var(--bg-card)',
      border: '1px solid var(--border-primary)',
      borderRadius: '1rem',
      cursor: 'pointer',
      transition: 'all 200ms',
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      gap: '0.75rem',
      textAlign: 'center' as const,
      position: 'relative' as const,
    },
    catIcon: {
      width: 52,
      height: 52,
      borderRadius: '1rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '1.5rem',
    },
    catName: { fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' },
    badge: {
      fontSize: '0.625rem',
      padding: '0.125rem 0.375rem',
      borderRadius: '0.25rem',
      background: 'rgba(100,116,139,0.2)',
      color: 'var(--text-secondary)',
      position: 'absolute' as const,
      top: 8,
      right: 8,
    },
    createBox: {
      background: 'var(--bg-card)',
      backdropFilter: 'blur(20px)',
      border: '1px solid var(--border-primary)',
      borderRadius: '1rem',
      padding: '1.5rem',
      marginBottom: '1.5rem',
    },
    formGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))',
      gap: '1rem',
      marginBottom: '1.25rem',
    },
    fg: { display: 'flex', flexDirection: 'column' as const, gap: '0.375rem' },
    lbl: {
      fontSize: '0.75rem',
      fontWeight: 500,
      color: 'var(--text-secondary)',
      textTransform: 'uppercase' as const,
      letterSpacing: '0.05em',
    },
    inp: {
      padding: '0.625rem 0.75rem',
      background: 'var(--bg-input)',
      border: '1px solid var(--border-primary)',
      borderRadius: '0.5rem',
      color: 'var(--text-primary)',
      fontSize: '0.875rem',
      fontFamily: 'inherit',
      outline: 'none',
    },
    saveBtn: {
      padding: '0.625rem 2rem',
      background: 'linear-gradient(135deg,var(--color-primary-600),var(--color-primary-500))',
      border: 'none',
      borderRadius: '0.625rem',
      color: 'white',
      fontWeight: 600,
      fontSize: '0.875rem',
      cursor: 'pointer',
      fontFamily: 'inherit',
    },
    listRow: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      padding: '0.75rem 1rem',
      borderBottom: '1px solid var(--border-primary)',
      transition: 'background 150ms',
      cursor: 'pointer',
    },
    listIcon: {
      width: 36,
      height: 36,
      borderRadius: '0.5rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '1.125rem',
      flexShrink: 0,
    },
    listName: { flex: 1, fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' },
    listBadge: {
      fontSize: '0.6875rem',
      padding: '0.125rem 0.5rem',
      borderRadius: '0.25rem',
      color: 'var(--text-secondary)',
    },
  };

  const renderCategory = (c: CategoryItem) => {
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
        <span
          style={{
            ...s.listBadge,
            background: c.kind === 'EXPENSE' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
            color: c.kind === 'EXPENSE' ? 'var(--color-error)' : 'var(--color-primary-500)',
          }}
        >
          {c.kind}
        </span>
        {c.isSystem && (
          <span style={{ ...s.listBadge, background: 'rgba(100,116,139,0.1)' }}>System</span>
        )}
      </div>
    );
  };

  return (
    <div>
      <div style={s.hdr}>
        <div>
          <h1 style={s.title}>{t('categories.title')}</h1>
        </div>
        <div style={s.btns}>
          {/*
            Icon-only, so it needs a name a screen reader can announce — an axe
            scan reported this as the app's one nameless button. The label
            describes what the click DOES rather than the current state, which is
            what a user hearing it before pressing needs.
          */}
          <button
            onClick={() => setView(view === 'grid' ? 'list' : 'grid')}
            style={s.viewBtn}
            aria-label={t(view === 'grid' ? 'categories.switchToList' : 'categories.switchToGrid')}
          >
            {view === 'grid' ? (
              <List size={16} aria-hidden="true" />
            ) : (
              <Grid size={16} aria-hidden="true" />
            )}
          </button>
          <button onClick={() => setShowCreate(!showCreate)} style={s.addBtn}>
            {showCreate ? <X size={18} /> : <Plus size={18} />}
            <span>{showCreate ? t('app.close') : t('categories.createCategory')}</span>
          </button>
        </div>
      </div>

      {showCreate && (
        <div style={s.createBox}>
          <div style={s.formGrid}>
            <div style={s.fg}>
              <label style={s.lbl} htmlFor="cat-name">
                {t('categories.categoryName')}
              </label>
              <input
                id="cat-name"
                type="text"
                placeholder={t('categories.namePlaceholder')}
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={s.inp}
              />
            </div>
            <div style={s.fg}>
              <label style={s.lbl} htmlFor="cat-kind">
                {t('categories.kind')}
              </label>
              <select
                id="cat-kind"
                value={kind}
                onChange={(e) => setKind(e.target.value as 'EXPENSE' | 'INCOME')}
                style={s.inp}
              >
                <option value="EXPENSE">{t('transactions.expense')}</option>
                <option value="INCOME">{t('transactions.income')}</option>
              </select>
            </div>
            <div style={s.fg}>
              <label style={s.lbl} htmlFor="cat-icon">
                {t('categories.icon')}
              </label>
              <input
                id="cat-icon"
                type="text"
                maxLength={4}
                placeholder="🛒"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                style={s.inp}
              />
            </div>
            <div style={s.fg}>
              <label style={s.lbl} htmlFor="cat-color">
                {t('categories.color')}
              </label>
              <input
                id="cat-color"
                type="color"
                value={colour}
                onChange={(e) => setColour(e.target.value)}
                style={{ ...s.inp, padding: '0.25rem' }}
              />
            </div>
            {/* "Parent category" was offered but `parent_id` is not sent by this
                form and sub-category rendering does not exist — an input that
                changes nothing is worse than an absent one. */}
          </div>

          {formError && (
            <p
              role="alert"
              style={{
                color: 'var(--color-error)',
                fontSize: '0.8125rem',
                marginBottom: '0.75rem',
              }}
            >
              {formError}
            </p>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={submit}
              disabled={pending || !name.trim()}
              style={{ ...s.saveBtn, opacity: pending || !name.trim() ? 0.55 : 1 }}
            >
              {t('categories.createCategory')}
            </button>
          </div>
        </div>
      )}

      <div style={s.filters}>
        {(['ALL', 'EXPENSE', 'INCOME'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{ ...s.chip, ...(filter === f ? s.chipA : {}) }}
          >
            {f === 'ALL'
              ? t('app.all')
              : f === 'EXPENSE'
                ? t('transactions.expense')
                : t('transactions.income')}
          </button>
        ))}
      </div>

      {(filter === 'ALL' || filter === 'EXPENSE') && expense.length > 0 && (
        <div style={s.section}>
          <div style={s.sectionTitle}>
            {t('transactions.expense')} ({expense.length})
          </div>
          {view === 'grid' ? (
            <div style={s.grid}>{expense.map(renderCategory)}</div>
          ) : (
            <div
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-primary)',
                borderRadius: '1rem',
                overflow: 'hidden',
              }}
            >
              {expense.map(renderCategory)}
            </div>
          )}
        </div>
      )}

      {(filter === 'ALL' || filter === 'INCOME') && income.length > 0 && (
        <div style={s.section}>
          <div style={s.sectionTitle}>
            {t('transactions.income')} ({income.length})
          </div>
          {view === 'grid' ? (
            <div style={s.grid}>{income.map(renderCategory)}</div>
          ) : (
            <div
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-primary)',
                borderRadius: '1rem',
                overflow: 'hidden',
              }}
            >
              {income.map(renderCategory)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
