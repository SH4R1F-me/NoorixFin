'use client';

import { useMemo, useState, useTransition } from 'react';
import { Archive, Bell, CheckCheck, ExternalLink, Shield, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLocale } from '../../../lib/i18n/locale-provider';
import {
  archiveNotification,
  deleteNotification,
  markAllNotificationsRead,
  markNotificationRead,
  type UserNotification,
} from './actions';

const CATEGORY_LABEL: Record<string, string> = {
  security: 'Security',
  budget: 'Budgets',
  goal: 'Goals',
  recurring: 'Recurring',
  transaction: 'Transactions',
  sync: 'Sync',
  account: 'Account',
  system: 'System',
  operator: 'Operator',
};

const SEVERITY_COLOR: Record<string, string> = {
  INFO: '#38bdf8',
  SUCCESS: 'var(--color-success)',
  WARNING: 'var(--color-warning)',
  CRITICAL: 'var(--color-error)',
};

export default function NotificationsView({ initialItems }: { initialItems: UserNotification[] }) {
  const { locale } = useLocale();
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [filter, setFilter] = useState('all');
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const visible = useMemo(
    () => items.filter((item) => filter === 'all' || item.category === filter),
    [filter, items],
  );
  const unread = items.filter((item) => !item.read_at).length;

  function run(action: () => Promise<{ ok: boolean; message?: string }>, optimistic: () => void) {
    const previous = items;
    optimistic();
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setItems(previous);
        setMessage(result.message ?? 'Could not update notification');
      } else {
        router.refresh();
      }
    });
  }

  return (
    <section aria-labelledby="notifications-heading" style={s.page}>
      <div style={s.header}>
        <div>
          <div style={s.eyebrow}>
            <Bell size={14} /> INBOX
          </div>
          <h1 id="notifications-heading" style={s.title}>
            Notifications
          </h1>
          <p style={s.subtitle}>
            {unread
              ? `${unread} unread update${unread === 1 ? '' : 's'}`
              : 'You are all caught up.'}
          </p>
        </div>
        <button
          style={s.primaryButton}
          disabled={!unread || pending}
          onClick={() =>
            run(markAllNotificationsRead, () =>
              setItems((rows) =>
                rows.map((row) => ({ ...row, read_at: row.read_at ?? new Date().toISOString() })),
              ),
            )
          }
        >
          <CheckCheck size={16} /> Mark all read
        </button>
      </div>

      {message && (
        <div role="alert" style={s.error}>
          {message}
        </div>
      )}

      <div style={s.filters} role="group" aria-label="Filter notifications">
        {['all', ...Object.keys(CATEGORY_LABEL)].map((category) => (
          <button
            key={category}
            onClick={() => setFilter(category)}
            aria-pressed={filter === category}
            style={{ ...s.filter, ...(filter === category ? s.filterActive : {}) }}
          >
            {category === 'all' ? 'All' : CATEGORY_LABEL[category]}
          </button>
        ))}
      </div>

      <div style={s.list} aria-live="polite" aria-busy={pending}>
        {visible.length === 0 ? (
          <div style={s.empty}>
            <Bell size={28} color="var(--text-tertiary)" />
            <strong style={{ color: 'var(--text-primary)' }}>Nothing here</strong>
            <span>
              New updates will appear here and remain available even if push delivery fails.
            </span>
          </div>
        ) : (
          visible.map((item) => {
            const title = locale === 'bn' ? (item.title_bn ?? item.title_en) : item.title_en;
            const body = locale === 'bn' ? (item.body_bn ?? item.body_en) : item.body_en;
            return (
              <article key={item.id} style={{ ...s.card, ...(!item.read_at ? s.unreadCard : {}) }}>
                <div style={{ ...s.icon, color: SEVERITY_COLOR[item.severity] }}>
                  {item.category === 'security' ? <Shield size={18} /> : <Bell size={18} />}
                </div>
                <div style={s.content}>
                  <div style={s.meta}>
                    <span style={{ color: SEVERITY_COLOR[item.severity] }}>
                      {CATEGORY_LABEL[item.category] ?? item.category}
                    </span>
                    <span>·</span>
                    <time dateTime={item.created_at}>
                      {new Date(item.created_at).toLocaleString()}
                    </time>
                    {!item.read_at && <span style={s.dot} aria-label="Unread" />}
                  </div>
                  <h2 style={s.cardTitle}>{title}</h2>
                  <p style={s.body}>{body}</p>
                  <div style={s.actions}>
                    {!item.read_at && (
                      <button
                        style={s.action}
                        onClick={() =>
                          run(
                            () => markNotificationRead(item.id),
                            () =>
                              setItems((rows) =>
                                rows.map((row) =>
                                  row.id === item.id
                                    ? { ...row, read_at: new Date().toISOString() }
                                    : row,
                                ),
                              ),
                          )
                        }
                      >
                        <CheckCheck size={14} /> Mark read
                      </button>
                    )}
                    {item.action_url && (
                      <a style={s.action} href={item.action_url}>
                        <ExternalLink size={14} /> Open
                      </a>
                    )}
                    <button
                      style={s.action}
                      onClick={() =>
                        run(
                          () => archiveNotification(item.id),
                          () => setItems((rows) => rows.filter((row) => row.id !== item.id)),
                        )
                      }
                    >
                      <Archive size={14} /> Archive
                    </button>
                    <button
                      style={{ ...s.action, color: 'var(--color-error)' }}
                      onClick={() =>
                        run(
                          () => deleteNotification(item.id),
                          () => setItems((rows) => rows.filter((row) => row.id !== item.id)),
                        )
                      }
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { maxWidth: 920, margin: '0 auto' },
  header: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: '1rem',
    marginBottom: '1.5rem',
    flexWrap: 'wrap',
  },
  eyebrow: {
    color: 'var(--color-success)',
    fontSize: '0.7rem',
    fontWeight: 800,
    letterSpacing: '0.14em',
    display: 'flex',
    gap: 6,
    alignItems: 'center',
  },
  title: { margin: '0.35rem 0 0', color: 'var(--text-primary)', fontSize: '2rem', lineHeight: 1.1 },
  subtitle: { margin: '0.4rem 0 0', color: 'var(--text-secondary)', fontSize: '0.875rem' },
  primaryButton: {
    border: 0,
    borderRadius: '0.65rem',
    background: 'var(--color-primary-500)',
    color: 'var(--text-on-primary)',
    padding: '0.65rem 0.9rem',
    display: 'flex',
    gap: 7,
    alignItems: 'center',
    fontWeight: 700,
    cursor: 'pointer',
  },
  error: {
    padding: '0.75rem 1rem',
    border: '1px solid rgba(251,113,133,.35)',
    background: 'rgba(251,113,133,.08)',
    color: 'var(--color-error)',
    borderRadius: '0.75rem',
    marginBottom: '1rem',
  },
  filters: {
    display: 'flex',
    gap: '0.4rem',
    overflowX: 'auto',
    paddingBottom: '0.75rem',
    marginBottom: '0.5rem',
  },
  filter: {
    padding: '0.4rem 0.7rem',
    borderRadius: 999,
    border: '1px solid var(--border-primary)',
    background: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: '0.75rem',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
  },
  filterActive: {
    background: 'rgba(16,185,129,.12)',
    borderColor: 'rgba(16,185,129,.45)',
    color: 'var(--color-success)',
  },
  list: { display: 'grid', gap: '0.7rem' },
  card: {
    display: 'flex',
    gap: '0.9rem',
    padding: '1rem',
    border: '1px solid var(--border-primary)',
    background: 'var(--bg-input)',
    borderRadius: '0.9rem',
  },
  unreadCard: { borderColor: 'rgba(16,185,129,.38)', background: 'rgba(16,185,129,.045)' },
  icon: {
    width: 38,
    height: 38,
    borderRadius: '0.65rem',
    border: '1px solid currentColor',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  content: { minWidth: 0, flex: 1 },
  meta: {
    display: 'flex',
    gap: 6,
    alignItems: 'center',
    color: 'var(--text-tertiary)',
    fontSize: '0.7rem',
    flexWrap: 'wrap',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 99,
    background: 'var(--color-primary-500)',
    marginLeft: 'auto',
  },
  cardTitle: { color: 'var(--text-primary)', fontSize: '0.95rem', margin: '0.35rem 0 0' },
  body: {
    color: 'var(--text-tertiary)',
    fontSize: '0.82rem',
    lineHeight: 1.55,
    margin: '0.35rem 0 0.7rem',
  },
  actions: { display: 'flex', flexWrap: 'wrap', gap: '0.4rem' },
  action: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    border: 0,
    background: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: '0.72rem',
    padding: '0.25rem',
    cursor: 'pointer',
    textDecoration: 'none',
  },
  empty: {
    minHeight: 260,
    border: '1px dashed var(--border-primary)',
    borderRadius: '1rem',
    color: 'var(--text-tertiary)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.65rem',
    textAlign: 'center',
    padding: '2rem',
    fontSize: '0.82rem',
  },
};
