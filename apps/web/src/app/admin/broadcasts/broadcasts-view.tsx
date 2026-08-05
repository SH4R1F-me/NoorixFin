'use client';

/**
 * Broadcast composer and list.
 *
 * This is the "trigger system update notifications and broadcast messages"
 * surface. Composing produces a DRAFT; publishing is a separate, confirmed
 * action, because it is the one control in this console that reaches every user
 * at once.
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Archive, Loader2, Megaphone, Send } from 'lucide-react';
import type { AdminBroadcast } from '../../../lib/admin';
import { Badge, EmptyState, Panel, T, formatTime, s } from '../ui';
import { archiveBroadcast, createBroadcast, publishBroadcast } from './actions';

const SEVERITIES = ['INFO', 'SUCCESS', 'WARNING', 'CRITICAL'] as const;

const SEVERITY_COLOR: Record<string, string> = {
  INFO: T.info,
  SUCCESS: T.ok,
  WARNING: T.warn,
  CRITICAL: T.error,
};

const STATUS_COLOR: Record<string, string> = {
  DRAFT: T.textFaint,
  PUBLISHED: T.ok,
  ARCHIVED: T.textDim,
};

const EMPTY = {
  title_en: '',
  title_bn: '',
  body_en: '',
  body_bn: '',
  severity: 'INFO',
  audience: 'ALL',
  link_url: '',
  expires_at: '',
};

export default function BroadcastsView({ broadcasts }: { broadcasts: AdminBroadcast[] }) {
  const [form, setForm] = useState(EMPTY);
  /**
   * One key per COMPOSED MESSAGE, minted here and reset only when the form
   * clears after a successful save.
   *
   * This is the whole reason the API's replay protection does anything. A key
   * generated server-side would be new on every submission, so two clicks would
   * be two keys and two identical broadcasts to every user on the platform.
   * Because it lives with the draft, every attempt at THIS message — a double
   * click, a retry, a resend after a timeout the browser wrongly read as a
   * failure — carries the same key and collapses to one row.
   *
   * `useState` with an initialiser function, not a plain value: the plain form
   * would call randomUUID on every render.
   */
  const [draftKey, setDraftKey] = useState(() => crypto.randomUUID());
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function act(fn: () => Promise<{ ok: boolean; message?: string }>, success: string) {
    setMessage(null);
    startTransition(async () => {
      const result = await fn();
      setMessage(
        result.ok ? { ok: true, text: success } : { ok: false, text: result.message ?? 'Failed' },
      );
      if (result.ok) router.refresh();
    });
  }

  return (
    <div>
      <div style={s.pageHeader}>
        <h1 style={s.title}>Broadcasts</h1>
        <p style={s.subtitle}>
          System notices shown in every user&apos;s dashboard. Bilingual by requirement — both
          languages are mandatory.
        </p>
      </div>

      {message && (
        <div
          style={{
            marginBottom: '1rem',
            padding: '0.75rem 1rem',
            borderRadius: '0.6rem',
            fontSize: '0.8125rem',
            background: message.ok ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
            border: `1px solid ${message.ok ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
            color: message.ok ? T.ok : T.error,
          }}
        >
          {message.text}
        </div>
      )}

      <Panel title="Compose" icon={<Megaphone size={16} color={T.accent} />}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          <label style={label}>
            Title (English)
            <input
              value={form.title_en}
              onChange={(event) => setForm({ ...form, title_en: event.target.value })}
              placeholder="Scheduled maintenance"
              style={{ ...s.input, width: '100%' }}
            />
          </label>
          <label style={label}>
            শিরোনাম (বাংলা)
            <input
              value={form.title_bn}
              onChange={(event) => setForm({ ...form, title_bn: event.target.value })}
              placeholder="নির্ধারিত রক্ষণাবেক্ষণ"
              style={{ ...s.input, width: '100%' }}
            />
          </label>
          <label style={label}>
            Body (English)
            <textarea
              value={form.body_en}
              onChange={(event) => setForm({ ...form, body_en: event.target.value })}
              rows={3}
              style={{ ...s.input, width: '100%', resize: 'vertical' }}
            />
          </label>
          <label style={label}>
            বিবরণ (বাংলা)
            <textarea
              value={form.body_bn}
              onChange={(event) => setForm({ ...form, body_bn: event.target.value })}
              rows={3}
              style={{ ...s.input, width: '100%', resize: 'vertical' }}
            />
          </label>
          <label style={label}>
            Severity
            <select
              value={form.severity}
              onChange={(event) => setForm({ ...form, severity: event.target.value })}
              style={{ ...s.input, width: '100%' }}
            >
              {SEVERITIES.map((severity) => (
                <option key={severity} value={severity}>
                  {severity}
                </option>
              ))}
            </select>
          </label>
          <label style={label}>
            Audience
            <select
              value={form.audience}
              onChange={(event) => setForm({ ...form, audience: event.target.value })}
              style={{ ...s.input, width: '100%' }}
            >
              <option value="ALL">All users</option>
              <option value="SUPER_ADMINS">Operators only</option>
            </select>
          </label>
          <label style={label}>
            Link (optional)
            <input
              value={form.link_url}
              onChange={(event) => setForm({ ...form, link_url: event.target.value })}
              placeholder="https://…"
              style={{ ...s.input, width: '100%' }}
            />
          </label>
          <label style={label}>
            Expires (optional)
            <input
              type="datetime-local"
              value={form.expires_at}
              onChange={(event) => setForm({ ...form, expires_at: event.target.value })}
              style={{ ...s.input, width: '100%' }}
            />
          </label>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
          <span style={{ color: T.textFaint, fontSize: '0.75rem' }}>
            Saved as a draft — nobody sees it until you publish.
          </span>
          <button
            onClick={() =>
              act(async () => {
                const result = await createBroadcast(form, draftKey);
                if (result.ok) {
                  setForm(EMPTY);
                  // A NEW draft is a new intent, so it gets a new key. Reusing
                  // this one would make the next broadcast a replay of the last
                  // and return its response without writing anything.
                  setDraftKey(crypto.randomUUID());
                }
                return result;
              }, 'Draft saved.')
            }
            disabled={pending}
            style={s.btn}
          >
            {pending ? <Loader2 size={14} /> : <Megaphone size={14} />}
            Save draft
          </button>
        </div>
      </Panel>

      <div style={{ marginTop: '1.5rem' }}>
        <Panel title="All broadcasts" icon={<Megaphone size={16} color={T.accent} />} padded={false}>
          {broadcasts.length === 0 ? (
            <EmptyState text="No broadcasts yet." />
          ) : (
            <div style={s.tableWrap}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>Title</th>
                    <th style={s.th}>Severity</th>
                    <th style={s.th}>Status</th>
                    <th style={s.th}>Audience</th>
                    <th style={s.th}>Published</th>
                    <th style={s.th}>Expires</th>
                    <th style={s.th}>Seen / Dismissed</th>
                    <th style={s.th}></th>
                  </tr>
                </thead>
                <tbody>
                  {broadcasts.map((broadcast) => (
                    <tr key={broadcast.id}>
                      <td style={s.td}>
                        <div style={{ color: T.text, fontWeight: 500 }}>{broadcast.title_en}</div>
                        <div style={{ color: T.textFaint, fontSize: '0.75rem' }}>
                          {broadcast.title_bn}
                        </div>
                      </td>
                      <td style={s.td}>
                        <Badge
                          text={broadcast.severity}
                          color={SEVERITY_COLOR[broadcast.severity] ?? T.textDim}
                        />
                      </td>
                      <td style={s.td}>
                        <Badge
                          text={broadcast.status}
                          color={STATUS_COLOR[broadcast.status] ?? T.textDim}
                        />
                      </td>
                      <td style={{ ...s.td, ...s.mono }}>{broadcast.audience}</td>
                      <td style={{ ...s.td, ...s.mono, whiteSpace: 'nowrap' }}>
                        {formatTime(broadcast.publish_at)}
                      </td>
                      <td style={{ ...s.td, ...s.mono, whiteSpace: 'nowrap' }}>
                        {formatTime(broadcast.expires_at)}
                      </td>
                      <td style={{ ...s.td, ...s.mono }}>
                        {broadcast.stats.seen} / {broadcast.stats.dismissed}
                      </td>
                      <td style={s.td}>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          {broadcast.status !== 'PUBLISHED' && (
                            <button
                              onClick={() => {
                                if (
                                  !confirm(
                                    `Publish "${broadcast.title_en}"?\n\nIt will appear in the dashboard of ${
                                      broadcast.audience === 'ALL' ? 'every user' : 'every operator'
                                    }.`,
                                  )
                                )
                                  return;
                                act(() => publishBroadcast(broadcast.id), 'Published.');
                              }}
                              disabled={pending}
                              style={s.btnGhost}
                            >
                              <Send size={12} />
                              Publish
                            </button>
                          )}
                          {broadcast.status !== 'ARCHIVED' && (
                            <button
                              onClick={() => act(() => archiveBroadcast(broadcast.id), 'Archived.')}
                              disabled={pending}
                              style={s.btnGhost}
                            >
                              <Archive size={12} />
                              Archive
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

const label: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.3rem',
  fontSize: '0.75rem',
  color: T.textDim,
};
