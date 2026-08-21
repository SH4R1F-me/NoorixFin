'use client';

import { useState, useTransition } from 'react';
import { FileText, Save, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { NotificationTemplate } from '../../../../lib/admin-types';
import {
  deleteNotificationTemplate,
  saveNotificationTemplate,
  type TemplatePayload,
} from '../actions';

const blank: TemplatePayload = {
  key: '',
  category: 'system',
  title_en: '',
  title_bn: '',
  body_en: '',
  body_bn: '',
  action_url: '',
};

export default function NotificationTemplatesView({
  templates,
}: {
  templates: NotificationTemplate[];
}) {
  const [form, setForm] = useState(blank);
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState('');
  const router = useRouter();
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    startTransition(async () => {
      const payload = Object.fromEntries(
        Object.entries(form).filter(([, value]) => value !== ''),
      ) as unknown as TemplatePayload;
      const result = await saveNotificationTemplate(payload);
      setNotice(result.ok ? 'Template saved.' : result.message);
      if (result.ok) {
        setForm(blank);
        router.refresh();
      }
    });
  };
  const remove = (id: string) =>
    startTransition(async () => {
      const result = await deleteNotificationTemplate(id);
      setNotice(result.ok ? 'Template deleted.' : result.message);
      if (result.ok) router.refresh();
    });

  return (
    <section style={s.page}>
      <div style={s.heading}>
        <FileText color="#f59e0b" />
        <div>
          <h1 style={s.title}>Notification templates</h1>
          <p style={s.help}>Reusable bilingual copy for consistent operator communications.</p>
        </div>
      </div>
      {notice && (
        <div role="status" style={s.notice}>
          {notice}
        </div>
      )}
      <form className="nf-notification-grid" onSubmit={submit} style={s.form}>
        <label style={s.label}>
          Key
          <input
            required
            pattern="[a-z0-9][a-z0-9-]{1,62}[a-z0-9]"
            value={form.key}
            onChange={(e) => setForm({ ...form, key: e.target.value })}
            style={s.input}
          />
        </label>
        <label style={s.label}>
          Category
          <select
            value={form.category}
            onChange={(e) =>
              setForm({ ...form, category: e.target.value as TemplatePayload['category'] })
            }
            style={s.input}
          >
            {[
              'security',
              'budget',
              'goal',
              'recurring',
              'transaction',
              'sync',
              'account',
              'system',
              'operator',
            ].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label style={s.label}>
          English title
          <input
            required
            value={form.title_en}
            onChange={(e) => setForm({ ...form, title_en: e.target.value })}
            style={s.input}
          />
        </label>
        <label style={s.label}>
          Bangla title
          <input
            value={form.title_bn}
            onChange={(e) => setForm({ ...form, title_bn: e.target.value })}
            style={s.input}
          />
        </label>
        <label style={{ ...s.label, gridColumn: '1/-1' }}>
          English body
          <textarea
            required
            rows={3}
            value={form.body_en}
            onChange={(e) => setForm({ ...form, body_en: e.target.value })}
            style={s.input}
          />
        </label>
        <label style={{ ...s.label, gridColumn: '1/-1' }}>
          Bangla body
          <textarea
            rows={3}
            value={form.body_bn}
            onChange={(e) => setForm({ ...form, body_bn: e.target.value })}
            style={s.input}
          />
        </label>
        <label style={{ ...s.label, gridColumn: '1/-1' }}>
          Action URL
          <input
            placeholder="/dashboard/..."
            value={form.action_url}
            onChange={(e) => setForm({ ...form, action_url: e.target.value })}
            style={s.input}
          />
        </label>
        <button disabled={pending} style={s.button}>
          <Save size={15} /> Save template
        </button>
      </form>
      <div style={s.list}>
        {templates.length === 0 ? (
          <div style={s.empty}>No templates yet.</div>
        ) : (
          templates.map((template) => (
            <article key={template.id} style={s.card}>
              <div>
                <strong style={{ color: '#f5f5f4' }}>{template.key}</strong>
                <span style={s.badge}>{template.category}</span>
                <div style={s.cardTitle}>{template.title_en}</div>
                <p style={s.help}>{template.body_en}</p>
              </div>
              <button
                aria-label={`Delete ${template.key}`}
                disabled={pending}
                onClick={() => remove(template.id)}
                style={s.delete}
              >
                <Trash2 size={15} />
              </button>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { maxWidth: 1000, margin: '0 auto' },
  heading: { display: 'flex', gap: 10, alignItems: 'center', marginBottom: '1rem' },
  title: { color: '#fafaf9', margin: 0 },
  help: { color: '#a8a29e', fontSize: '.75rem', lineHeight: 1.5, margin: '.25rem 0 0' },
  notice: { color: '#fbbf24', marginBottom: '.75rem' },
  form: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2,minmax(0,1fr))',
    gap: '.75rem',
    border: '1px solid #3b332b',
    background: '#1c1917',
    borderRadius: '1rem',
    padding: '1rem',
    marginBottom: '1rem',
  },
  label: { display: 'grid', gap: 5, color: '#a8a29e', fontSize: '.72rem' },
  input: {
    colorScheme: 'dark',
    background: '#0c0a09',
    color: '#f5f5f4',
    border: '1px solid #44403c',
    borderRadius: '.5rem',
    padding: '.58rem',
    font: 'inherit',
  },
  button: {
    justifySelf: 'start',
    display: 'flex',
    gap: 6,
    alignItems: 'center',
    border: 0,
    borderRadius: '.5rem',
    background: '#f59e0b',
    color: '#1c1917',
    fontWeight: 800,
    padding: '.6rem .8rem',
  },
  list: { display: 'grid', gap: '.6rem' },
  card: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '1rem',
    border: '1px solid #292524',
    borderRadius: '.75rem',
    padding: '.85rem',
    background: '#0c0a09',
  },
  cardTitle: { color: '#e7e5e4', marginTop: 8 },
  badge: {
    color: '#fbbf24',
    fontSize: '.65rem',
    marginLeft: 8,
    border: '1px solid #78350f',
    borderRadius: 99,
    padding: '2px 6px',
  },
  delete: {
    alignSelf: 'start',
    color: '#fb7185',
    border: '1px solid #7f1d1d',
    background: 'transparent',
    borderRadius: '.45rem',
    padding: '.45rem',
  },
  empty: {
    color: '#a8a29e',
    border: '1px dashed #44403c',
    padding: '2rem',
    textAlign: 'center',
    borderRadius: '.8rem',
  },
};
