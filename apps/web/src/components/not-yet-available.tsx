'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useLocale } from '../lib/i18n/locale-provider';

/**
 * Honest placeholder for a navigable-but-unbuilt feature.
 *
 * Deliberately NOT a mock dashboard. Every fake chart in this codebase has cost
 * real debugging time — a screen that looks finished but shows invented numbers
 * is worse than one that says plainly it is not ready, especially in a finance
 * product where a user might act on what they see.
 *
 * The sidebar keeps these entries because the information architecture is part
 * of the design (Blueprint §5.1); the page states what is missing and why.
 */
export function NotYetAvailable({
  titleKey,
  icon,
  summary,
  planned,
  blockedBy,
}: {
  /** Catalog key for the feature name — the same key the sidebar uses. */
  titleKey: string;
  icon: ReactNode;
  summary: string;
  planned: string[];
  blockedBy: string;
}) {
  const { t } = useLocale();
  return (
    <div>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>{t(titleKey)}</h1>
          <p style={styles.subtitle}>{t('app.comingSoon')}</p>
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.iconWrap}>{icon}</div>

        <h2 style={styles.cardTitle}>Not available yet</h2>
        <p style={styles.summary}>{summary}</p>

        <div style={styles.plannedBox}>
          <p style={styles.plannedLabel}>Planned for this screen</p>
          <ul style={styles.list}>
            {planned.map((item) => (
              <li key={item} style={styles.listItem}>
                <span style={styles.bullet} />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p style={styles.blocked}>{blockedBy}</p>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  header: { marginBottom: '1.5rem' },
  title: { fontSize: '1.75rem', fontWeight: 800, color: '#f8fafc', margin: 0, letterSpacing: '-0.02em' },
  subtitle: { fontSize: '0.8125rem', color: '#8b9ab0', margin: 0, marginTop: 2 },
  card: {
    background: 'rgba(30,41,59,0.4)',
    border: '1px solid #1e293b',
    borderRadius: '1rem',
    padding: '2.5rem 2rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    maxWidth: 560,
    margin: '0 auto',
  },
  iconWrap: {
    width: 64, height: 64, borderRadius: '1rem',
    background: 'rgba(16,185,129,0.1)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginBottom: '1.25rem',
  },
  cardTitle: { fontSize: '1.125rem', fontWeight: 700, color: '#f8fafc', margin: 0 },
  summary: { fontSize: '0.875rem', color: '#94a3b8', marginTop: '0.5rem', lineHeight: 1.6, maxWidth: 420 },
  plannedBox: {
    marginTop: '1.75rem', width: '100%', textAlign: 'left',
    background: 'rgba(15,23,42,0.5)', border: '1px solid #1e293b',
    borderRadius: '0.75rem', padding: '1rem 1.25rem',
  },
  plannedLabel: {
    fontSize: '0.6875rem', fontWeight: 600, color: '#8b9ab0',
    textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0, marginBottom: '0.75rem',
  },
  list: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  listItem: { display: 'flex', alignItems: 'center', gap: '0.625rem', fontSize: '0.8125rem', color: '#cbd5e1' },
  bullet: { width: 5, height: 5, borderRadius: '50%', background: '#10b981', flexShrink: 0 },
  blocked: { fontSize: '0.75rem', color: '#8b9ab0', marginTop: '1.25rem', fontStyle: 'italic' },
};
