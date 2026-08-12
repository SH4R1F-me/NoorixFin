'use client';

import { useState, useTransition } from 'react';
import { Check, ExternalLink, PackageOpen } from 'lucide-react';
import type { MobileRelease } from '../../../../lib/admin-types';
import { Panel, s } from '../../ui';
import { saveMobileRelease } from './actions';

export default function ReleasesView({ release }: { release: MobileRelease }) {
  const [draft, setDraft] = useState(release);
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const field = (key: keyof MobileRelease, label: string, type = 'text') => (
    <label style={styles.label}>
      {label}
      <input
        type={type}
        value={String(draft[key] ?? '')}
        onChange={(event) =>
          setDraft((current) => ({
            ...current,
            [key]:
              type === 'number'
                ? event.target.value
                  ? Number(event.target.value)
                  : null
                : event.target.value || null,
          }))
        }
        style={styles.input}
      />
    </label>
  );
  const status = (key: 'ios_status' | 'android_status', label: string) => (
    <label style={styles.label}>
      {label}
      <select
        value={draft[key]}
        onChange={(event) =>
          setDraft((current) => ({
            ...current,
            [key]: event.target.value as 'COMING_SOON' | 'LIVE',
          }))
        }
        style={styles.input}
      >
        <option value="COMING_SOON">Coming soon</option>
        <option value="LIVE">Live</option>
      </select>
    </label>
  );
  return (
    <div>
      <div style={s.pageHeader}>
        <h1 style={s.title}>Mobile releases</h1>
        <p style={s.subtitle}>
          Store listings, the verified APK, and the minimum supported version read by every client.
        </p>
      </div>
      {notice && (
        <div role="status" style={{ ...styles.notice, color: notice.ok ? '#34d399' : '#f87171' }}>
          {notice.text}
        </div>
      )}
      <Panel title="Release control" icon={<PackageOpen size={16} color="#f59e0b" />}>
        <div style={styles.grid}>
          {field('latest_version', 'Latest version')}
          {field('min_version', 'Minimum supported version')}
          {field('ios_url', 'App Store URL')}
          {status('ios_status', 'App Store status')}
          {field('android_url', 'Google Play URL')}
          {status('android_status', 'Google Play status')}
          {field('apk_url', 'Direct APK URL')}
          {field('apk_size_bytes', 'APK size in bytes', 'number')}
          {field('apk_sha256', 'APK SHA-256')}
          {field('release_notes_url', 'Release notes URL')}
          {field('released_at', 'Released at', 'datetime-local')}
          {field('ios_minimum', 'Minimum iOS')}
          {field('android_minimum', 'Minimum Android')}
        </div>
        <div style={styles.actions}>
          <a href="/download" target="_blank" style={s.btnGhost}>
            Preview download page <ExternalLink size={14} />
          </a>
          <button
            disabled={pending}
            style={s.btn}
            onClick={() =>
              startTransition(async () => {
                const result = await saveMobileRelease({
                  ...draft,
                  released_at: draft.released_at ? new Date(draft.released_at).toISOString() : null,
                });
                setNotice({
                  ok: result.ok,
                  text: result.ok ? 'Release configuration saved.' : result.message,
                });
              })
            }
          >
            <Check size={14} />
            {pending ? 'Saving…' : 'Save release'}
          </button>
        </div>
      </Panel>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '1rem',
  },
  label: { display: 'grid', gap: '.35rem', color: '#a09990', fontSize: '.75rem', fontWeight: 650 },
  input: {
    width: '100%',
    background: '#1c1917',
    color: '#fafaf9',
    border: '1px solid #3b342f',
    borderRadius: 7,
    padding: '.65rem .75rem',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '.75rem',
    flexWrap: 'wrap',
    marginTop: '1.5rem',
    paddingTop: '1rem',
    borderTop: '1px solid #292524',
  },
  notice: {
    marginBottom: '1rem',
    padding: '.75rem 1rem',
    border: '1px solid #3b342f',
    borderRadius: 7,
  },
};
