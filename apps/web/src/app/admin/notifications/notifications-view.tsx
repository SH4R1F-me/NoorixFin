'use client';

import { useState, useTransition } from 'react';
import { BellRing, CalendarClock, Send, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { NotificationCampaign } from '../../../lib/admin-types';
import { composeNotification, type ComposePayload } from './actions';

const initial: ComposePayload = {
  audience: 'ALL',
  category: 'system',
  severity: 'INFO',
  title_en: '',
  title_bn: '',
  body_en: '',
  body_bn: '',
  action_url: '',
};

export default function AdminNotificationsView({
  campaigns,
}: {
  campaigns: NotificationCampaign[];
}) {
  const [form, setForm] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const router = useRouter();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setNotice(null);
    startTransition(async () => {
      const payload = Object.fromEntries(
        Object.entries(form).filter(([, value]) => value !== ''),
      ) as unknown as ComposePayload;
      const result = await composeNotification(payload);
      if (result.ok) {
        setNotice({
          ok: true,
          text: form.scheduled_for ? 'Campaign scheduled.' : 'Notification sent.',
        });
        setForm(initial);
        router.refresh();
      } else setNotice({ ok: false, text: result.message });
    });
  }

  return (
    <section style={s.page} aria-labelledby="admin-notifications-heading">
      <div style={s.header}>
        <div>
          <div style={s.eyebrow}>
            <BellRing size={14} /> COMMUNICATIONS
          </div>
          <h1 id="admin-notifications-heading" style={s.title}>
            Notifications
          </h1>
          <p style={s.subtitle}>
            Compose durable, bilingual messages and inspect campaign delivery.
          </p>
        </div>
        <div style={s.metric}>
          <Send size={16} />
          <strong>{campaigns.reduce((sum, row) => sum + row.recipient_count, 0)}</strong>
          <span>recipients</span>
        </div>
      </div>

      <form onSubmit={submit} style={s.composer}>
        <div style={s.composerTitle}>
          <Send size={17} color="#fbbf24" />
          <div>
            <strong>Compose campaign</strong>
            <div style={s.help}>
              The durable in-app row is created first; channel delivery remains best-effort.
            </div>
          </div>
        </div>
        <div className="nf-notification-grid" style={s.grid}>
          <label style={s.label}>
            Audience
            <select
              value={form.audience}
              onChange={(e) =>
                setForm({
                  ...form,
                  audience: e.target.value as ComposePayload['audience'],
                  category: e.target.value === 'OPERATORS' ? 'operator' : 'system',
                })
              }
              style={s.input}
            >
              <option value="ALL">All active users</option>
              <option value="OPERATORS">Operators</option>
            </select>
          </label>
          <label style={s.label}>
            Severity
            <select
              value={form.severity}
              onChange={(e) =>
                setForm({ ...form, severity: e.target.value as ComposePayload['severity'] })
              }
              style={s.input}
            >
              {['INFO', 'SUCCESS', 'WARNING', 'CRITICAL'].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label style={s.label}>
            Schedule (optional)
            <input
              type="datetime-local"
              value={form.scheduled_for ?? ''}
              onChange={(e) => setForm({ ...form, scheduled_for: e.target.value })}
              style={s.input}
            />
          </label>
          <label style={s.label}>
            Expiry (optional)
            <input
              type="datetime-local"
              value={form.expires_at ?? ''}
              onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
              style={s.input}
            />
          </label>
          <label style={s.label}>
            English title
            <input
              required
              maxLength={200}
              value={form.title_en}
              onChange={(e) => setForm({ ...form, title_en: e.target.value })}
              style={s.input}
            />
          </label>
          <label style={s.label}>
            Bangla title
            <input
              maxLength={200}
              value={form.title_bn}
              onChange={(e) => setForm({ ...form, title_bn: e.target.value })}
              style={s.input}
            />
          </label>
          <label style={{ ...s.label, gridColumn: '1 / -1' }}>
            English body
            <textarea
              required
              maxLength={4000}
              rows={3}
              value={form.body_en}
              onChange={(e) => setForm({ ...form, body_en: e.target.value })}
              style={s.input}
            />
          </label>
          <label style={{ ...s.label, gridColumn: '1 / -1' }}>
            Bangla body
            <textarea
              maxLength={4000}
              rows={3}
              value={form.body_bn}
              onChange={(e) => setForm({ ...form, body_bn: e.target.value })}
              style={s.input}
            />
          </label>
          <label style={{ ...s.label, gridColumn: '1 / -1' }}>
            Action URL
            <input
              placeholder="/dashboard/..."
              value={form.action_url}
              onChange={(e) => setForm({ ...form, action_url: e.target.value })}
              style={s.input}
            />
          </label>
        </div>
        <div style={s.footer}>
          {notice && (
            <span role="status" style={{ color: notice.ok ? '#6ee7b7' : '#fda4af' }}>
              {notice.text}
            </span>
          )}
          <button disabled={pending} style={s.submit}>
            <Send size={15} />
            {pending ? 'Sending…' : form.scheduled_for ? 'Schedule campaign' : 'Send now'}
          </button>
        </div>
      </form>

      <div style={s.listHeader}>
        <div>
          <h2 style={s.h2}>Campaign history</h2>
          <p style={s.help}>
            Recipient totals are metadata only; operators never see user notification bodies.
          </p>
        </div>
      </div>
      <div style={s.list}>
        {campaigns.length === 0 ? (
          <div style={s.empty}>No notification campaigns yet.</div>
        ) : (
          campaigns.map((campaign) => (
            <article key={campaign.id} style={s.card}>
              <div style={s.cardTop}>
                <span
                  style={{
                    ...s.status,
                    color:
                      campaign.status === 'FAILED'
                        ? '#fb7185'
                        : campaign.status === 'SENT'
                          ? '#34d399'
                          : '#fbbf24',
                  }}
                >
                  {campaign.status}
                </span>
                <span style={s.severity}>{campaign.severity}</span>
                <time style={s.time}>{new Date(campaign.scheduled_for).toLocaleString()}</time>
              </div>
              <h3 style={s.cardTitle}>{campaign.title_en}</h3>
              {campaign.title_bn && <div style={s.bn}>{campaign.title_bn}</div>}
              <p style={s.body}>{campaign.body_en}</p>
              <div style={s.cardFoot}>
                <span>
                  <Users size={13} /> {campaign.recipient_count} recipients
                </span>
                <span>
                  <CalendarClock size={13} /> {campaign.audience}
                </span>
                <a
                  href={`/admin/notifications/delivery?campaign=${campaign.id}`}
                  style={{ color: '#fbbf24' }}
                >
                  Delivery details
                </a>
                {campaign.error && <span style={{ color: '#fb7185' }}>{campaign.error}</span>}
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { maxWidth: 1050, margin: '0 auto' },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: '1rem',
    flexWrap: 'wrap',
    marginBottom: '1rem',
  },
  eyebrow: {
    color: '#fbbf24',
    display: 'flex',
    gap: 6,
    alignItems: 'center',
    fontSize: '.68rem',
    fontWeight: 800,
    letterSpacing: '.14em',
  },
  title: { color: '#fafaf9', fontSize: '1.9rem', margin: '.3rem 0 0' },
  subtitle: { color: '#a09990', fontSize: '.8rem', margin: '.3rem 0 0' },
  metric: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    color: '#fbbf24',
    border: '1px solid rgba(245,158,11,.25)',
    background: 'rgba(245,158,11,.07)',
    padding: '.65rem .8rem',
    borderRadius: '.7rem',
    fontSize: '.75rem',
  },
  composer: {
    border: '1px solid #3b332b',
    background: 'rgba(28,25,23,.72)',
    borderRadius: '1rem',
    padding: '1rem',
    marginBottom: '1.5rem',
  },
  composerTitle: {
    color: '#fafaf9',
    display: 'flex',
    gap: '.65rem',
    alignItems: 'flex-start',
    marginBottom: '1rem',
  },
  help: { color: '#8f867d', fontSize: '.72rem', marginTop: 3 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '.75rem' },
  label: { display: 'grid', gap: 5, color: '#a09990', fontSize: '.72rem' },
  input: {
    colorScheme: 'dark',
    width: '100%',
    boxSizing: 'border-box',
    background: '#0c0a09',
    color: '#e7e5e4',
    border: '1px solid #44403c',
    borderRadius: '.5rem',
    padding: '.58rem .65rem',
    font: 'inherit',
  },
  footer: {
    minHeight: 42,
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: '1rem',
    marginTop: '.85rem',
    fontSize: '.78rem',
  },
  submit: {
    border: 0,
    borderRadius: '.55rem',
    background: '#f59e0b',
    color: '#1c1917',
    fontWeight: 800,
    padding: '.6rem .8rem',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    cursor: 'pointer',
  },
  listHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: '.75rem' },
  h2: { color: '#e7e5e4', fontSize: '1rem', margin: 0 },
  list: { display: 'grid', gap: '.65rem' },
  empty: {
    border: '1px dashed #44403c',
    borderRadius: '.8rem',
    padding: '2rem',
    color: '#78716c',
    textAlign: 'center',
  },
  card: {
    border: '1px solid #292524',
    borderRadius: '.8rem',
    padding: '.9rem 1rem',
    background: 'rgba(12,10,9,.52)',
  },
  cardTop: { display: 'flex', gap: 8, alignItems: 'center' },
  status: { fontSize: '.65rem', fontWeight: 800 },
  severity: {
    fontSize: '.63rem',
    color: '#a8a29e',
    border: '1px solid #44403c',
    padding: '2px 5px',
    borderRadius: 4,
  },
  time: { marginLeft: 'auto', color: '#78716c', fontSize: '.68rem' },
  cardTitle: { color: '#f5f5f4', margin: '.55rem 0 0', fontSize: '.9rem' },
  bn: { color: '#d6d3d1', fontSize: '.8rem', marginTop: 3 },
  body: { color: '#a8a29e', fontSize: '.76rem', lineHeight: 1.5, margin: '.45rem 0' },
  cardFoot: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '1rem',
    color: '#78716c',
    fontSize: '.68rem',
  },
};
