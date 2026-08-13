'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Check, Hash, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { TagRow } from '../../../lib/workspace';
import { useLocale } from '../../../lib/i18n/locale-provider';
import { createTag, deleteTag, renameTag } from '../ledger-actions';
import { EmptyState, field } from '../planning-ui';

export default function TagsView({ workspaceId, tags }: { workspaceId: string; tags: TagRow[] }) {
  const { t } = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  function mutate(run: () => Promise<{ ok: boolean; message?: string }>, success: string) {
    setNotice(null);
    startTransition(async () => {
      const result = await run();
      setNotice({ ok: result.ok, text: result.ok ? success : (result.message ?? 'Failed') });
      if (result.ok) router.refresh();
    });
  }

  function submit() {
    mutate(async () => {
      const result = await createTag(workspaceId, name);
      if (result.ok) setName('');
      return result;
    }, t('tags.created'));
  }

  function saveRename(tagId: string) {
    mutate(async () => {
      const result = await renameTag(workspaceId, tagId, editingName);
      if (result.ok) setEditingId(null);
      return result;
    }, t('tags.renamed'));
  }

  return (
    <main>
      <header style={styles.header}>
        <div>
          <div style={styles.eyebrow}>
            <Hash size={15} aria-hidden="true" />
            {t('tags.organize')}
          </div>
          <h1 style={styles.title}>{t('transactions.tags')}</h1>
          <p style={styles.subtitle}>{t('tags.subtitle')}</p>
        </div>
      </header>

      <form
        style={styles.createForm}
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <label htmlFor="new-tag" style={field.label}>
          {t('tags.newTag')}
        </label>
        <div style={styles.createRow}>
          <input
            id="new-tag"
            value={name}
            maxLength={40}
            onChange={(event) => setName(event.target.value)}
            placeholder={t('transactions.tagsPlaceholder')}
            style={field.input}
          />
          <button type="submit" disabled={pending || !workspaceId} style={field.primary}>
            <Plus size={15} aria-hidden="true" /> {t('app.add')}
          </button>
        </div>
      </form>

      {notice && (
        <p
          role="status"
          style={{ color: notice.ok ? 'var(--color-success)' : 'var(--color-error)' }}
        >
          {notice.text}
        </p>
      )}

      {tags.length === 0 ? (
        <EmptyState
          icon={<Hash size={26} aria-hidden="true" />}
          title={t('tags.noTags')}
          body={t('tags.noTagsBody')}
        />
      ) : (
        <ul style={styles.list}>
          {tags.map((tag) => (
            <li key={tag.id} style={styles.row}>
              {editingId === tag.id ? (
                <input
                  aria-label={`${t('tags.rename')}: ${tag.name}`}
                  value={editingName}
                  maxLength={40}
                  onChange={(event) => setEditingName(event.target.value)}
                  style={{ ...field.input, flex: 1 }}
                />
              ) : (
                <Link href={`/dashboard/transactions?tag=${tag.id}`} style={styles.tagLink}>
                  #{tag.name}
                </Link>
              )}
              <span style={styles.usage}>
                {t('tags.usageCount').replace('{{count}}', String(tag.usage_count))}
              </span>
              {editingId === tag.id ? (
                <>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => saveRename(tag.id)}
                    style={field.ghost}
                    aria-label={`${t('app.save')}: ${tag.name}`}
                  >
                    <Check size={15} aria-hidden="true" />
                  </button>
                  <button type="button" onClick={() => setEditingId(null)} style={field.ghost}>
                    <X size={15} aria-hidden="true" /> {t('app.cancel')}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(tag.id);
                    setEditingName(tag.name);
                  }}
                  style={field.ghost}
                  aria-label={`${t('tags.rename')}: ${tag.name}`}
                >
                  <Pencil size={14} aria-hidden="true" />
                </button>
              )}
              <button
                type="button"
                disabled={pending}
                onClick={() => mutate(() => deleteTag(workspaceId, tag.id), t('tags.deleted'))}
                style={field.ghost}
                aria-label={`${t('app.delete')}: ${tag.name}. ${t('tags.deleteNote')}`}
                title={t('tags.deleteNote')}
              >
                <Trash2 size={14} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  header: { marginBottom: '1.5rem' },
  eyebrow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    color: 'var(--color-transfer)',
    fontSize: '0.75rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  title: { margin: '0.35rem 0', color: 'var(--text-primary)', fontSize: '2rem' },
  subtitle: { margin: 0, color: 'var(--text-secondary)', lineHeight: 1.55 },
  createForm: {
    maxWidth: 620,
    padding: '1rem',
    background: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: '0.85rem',
    marginBottom: '1rem',
  },
  createRow: { display: 'flex', gap: '0.65rem', marginTop: '0.4rem', alignItems: 'center' },
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'grid',
    gap: '0.55rem',
    maxWidth: 760,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
    padding: '0.75rem 0.9rem',
    background: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: '0.75rem',
  },
  tagLink: { flex: 1, color: 'var(--color-primary-600)', fontWeight: 700, textDecoration: 'none' },
  usage: { color: 'var(--text-tertiary)', fontSize: '0.78rem', whiteSpace: 'nowrap' },
};
