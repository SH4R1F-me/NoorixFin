'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeftRight,
  BarChart3,
  Landmark,
  LayoutDashboard,
  Plus,
  Search,
  X,
} from 'lucide-react';

type SearchItem = {
  id: string;
  kind: 'transaction' | 'account' | 'category' | 'tag' | 'recurring';
  title: string;
  subtitle: string | null;
  href: string;
};

const QUICK_LINKS = [
  { title: 'Dashboard', subtitle: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  {
    title: 'Add transaction',
    subtitle: 'Record income or expense',
    href: '/dashboard/transactions?new=1',
    icon: Plus,
  },
  {
    title: 'Transactions',
    subtitle: 'Browse your ledger',
    href: '/dashboard/transactions',
    icon: ArrowLeftRight,
  },
  {
    title: 'Accounts',
    subtitle: 'Balances and account details',
    href: '/dashboard/accounts',
    icon: Landmark,
  },
  {
    title: 'Reports',
    subtitle: 'Cash flow, net worth, and categories',
    href: '/dashboard/reports',
    icon: BarChart3,
  },
] as const;

export default function CommandPalette() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<SearchItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((value) => !value);
      }
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  useEffect(() => {
    if (query.trim().length < 2) {
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void fetch(`/api/search?q=${encodeURIComponent(query.trim())}`, {
        cache: 'no-store',
        signal: controller.signal,
      })
        .then((response) => (response.ok ? response.json() : { items: [] }))
        .then((result: { items?: SearchItem[] }) => setItems(result.items ?? []))
        .catch(() => undefined)
        .finally(() => setLoading(false));
    }, 220);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const go = (href: string) => {
    setOpen(false);
    setQuery('');
    router.push(href);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={styles.trigger}
        aria-label="Search NoorixFin"
      >
        <Search size={17} aria-hidden="true" />
        <span style={styles.triggerText}>Search</span>
        <kbd style={styles.kbd}>⌘K</kbd>
      </button>
      {open && (
        <div style={styles.backdrop} onMouseDown={() => setOpen(false)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Search NoorixFin"
            style={styles.dialog}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div style={styles.inputRow}>
              <Search size={20} color="#94a3b8" aria-hidden="true" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => {
                  const value = event.target.value;
                  setQuery(value);
                  if (value.trim().length < 2) {
                    setItems([]);
                    setLoading(false);
                  } else {
                    setLoading(true);
                  }
                }}
                placeholder="Search transactions, accounts, categories, tags…"
                aria-label="Search query"
                style={styles.input}
              />
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={styles.close}
                aria-label="Close search"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <div style={styles.results} aria-live="polite">
              <p style={styles.heading}>{query.trim().length >= 2 ? 'Results' : 'Quick actions'}</p>
              {loading && <p style={styles.message}>Searching…</p>}
              {!loading && query.trim().length >= 2 && items.length === 0 && (
                <p style={styles.message}>No matching records.</p>
              )}
              {!loading && query.trim().length >= 2
                ? items.map((item) => (
                    <button
                      key={`${item.kind}-${item.id}`}
                      type="button"
                      onClick={() => go(item.href)}
                      style={styles.result}
                    >
                      <span style={styles.kind}>{item.kind}</span>
                      <span style={styles.copy}>
                        <strong style={styles.title}>{item.title}</strong>
                        {item.subtitle && <small style={styles.subtitle}>{item.subtitle}</small>}
                      </span>
                      <span aria-hidden="true">→</span>
                    </button>
                  ))
                : QUICK_LINKS.map(({ title, subtitle, href, icon: Icon }) => (
                    <button key={href} type="button" onClick={() => go(href)} style={styles.result}>
                      <Icon size={17} color="#10b981" aria-hidden="true" />
                      <span style={styles.copy}>
                        <strong style={styles.title}>{title}</strong>
                        <small style={styles.subtitle}>{subtitle}</small>
                      </span>
                      <span aria-hidden="true">→</span>
                    </button>
                  ))}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  trigger: {
    position: 'fixed',
    top: 18,
    right: 68,
    zIndex: 30,
    height: 38,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '0 10px',
    borderRadius: 9,
    border: '1px solid #334155',
    background: '#0f172a',
    color: '#cbd5e1',
    cursor: 'pointer',
  },
  triggerText: { fontSize: 13 },
  kbd: {
    padding: '2px 5px',
    borderRadius: 4,
    background: '#1e293b',
    color: '#94a3b8',
    fontSize: 11,
  },
  backdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 100,
    background: 'rgba(2,6,23,.72)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    padding: '11vh 1rem 1rem',
  },
  dialog: {
    width: 'min(680px, 100%)',
    borderRadius: 14,
    border: '1px solid #334155',
    background: '#0f172a',
    boxShadow: '0 24px 80px rgba(0,0,0,.45)',
    overflow: 'hidden',
  },
  inputRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '14px 16px',
    borderBottom: '1px solid #1e293b',
  },
  input: {
    flex: 1,
    border: 0,
    outline: 0,
    background: 'transparent',
    color: '#f8fafc',
    fontSize: 16,
  },
  close: { border: 0, background: 'transparent', color: '#94a3b8', cursor: 'pointer', padding: 4 },
  results: { padding: 8, maxHeight: '58vh', overflowY: 'auto' },
  heading: {
    margin: '4px 8px 8px',
    color: '#64748b',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '.08em',
  },
  message: { margin: 0, padding: '22px 12px', color: '#94a3b8', textAlign: 'center' },
  result: {
    width: '100%',
    minHeight: 54,
    display: 'flex',
    alignItems: 'center',
    gap: 11,
    border: 0,
    borderRadius: 9,
    padding: '8px 10px',
    background: 'transparent',
    color: '#94a3b8',
    cursor: 'pointer',
    textAlign: 'left',
  },
  kind: {
    minWidth: 76,
    color: '#10b981',
    fontSize: 11,
    textTransform: 'uppercase',
    fontWeight: 700,
  },
  copy: { flex: 1, display: 'grid', gap: 2 },
  title: { color: '#f1f5f9', fontSize: 14, fontWeight: 600 },
  subtitle: { color: '#94a3b8', fontSize: 12 },
};
