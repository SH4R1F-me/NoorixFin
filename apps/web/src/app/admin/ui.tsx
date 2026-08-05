/**
 * Shared presentation for the operator console.
 *
 * No hooks and no event handlers, so these compose into both server and client
 * components. Keeping the amber operator palette in one place is what stops the
 * six admin pages from drifting into six slightly different designs.
 */
import type { CSSProperties, ReactNode } from 'react';

export const T = {
  bg: '#1c1917',
  panel: 'rgba(41, 37, 36, 0.45)',
  border: '#292524',
  borderSoft: 'rgba(41, 37, 36, 0.7)',
  text: '#fafaf9',
  textDim: '#a8a29e',
  textFaint: '#78716c',
  accent: '#f59e0b',
  accentSoft: 'rgba(245, 158, 11, 0.12)',
  ok: '#10b981',
  warn: '#f59e0b',
  error: '#ef4444',
  info: '#38bdf8',
} as const;

export const LEVEL_COLOR: Record<string, string> = {
  DEBUG: T.textFaint,
  INFO: T.info,
  WARN: T.warn,
  ERROR: T.error,
  FATAL: '#f43f5e',
};

export const STATUS_COLOR: Record<string, string> = {
  ACTIVE: T.ok,
  SUSPENDED: T.warn,
  PENDING_DELETION: T.error,
};

export const s: Record<string, CSSProperties> = {
  pageHeader: { marginBottom: '1.75rem' },
  title: { fontSize: '1.6rem', fontWeight: 800, color: T.text, margin: 0, letterSpacing: '-0.02em' },
  subtitle: { fontSize: '0.8125rem', color: T.textFaint, margin: '4px 0 0' },

  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem' },

  panel: {
    background: T.panel,
    border: `1px solid ${T.border}`,
    borderRadius: '1rem',
    overflow: 'hidden',
  },
  panelHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.75rem',
    padding: '0.875rem 1.25rem',
    borderBottom: `1px solid ${T.border}`,
  },
  panelTitle: {
    fontSize: '0.9375rem',
    fontWeight: 700,
    color: T.text,
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  panelBody: { padding: '1.25rem' },

  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' },
  th: {
    textAlign: 'left',
    padding: '0.625rem 1rem',
    color: T.textFaint,
    fontWeight: 600,
    fontSize: '0.6875rem',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    borderBottom: `1px solid ${T.border}`,
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '0.625rem 1rem',
    color: T.textDim,
    borderBottom: `1px solid ${T.borderSoft}`,
    verticalAlign: 'top',
  },
  // Wide tables scroll inside their own container so the page body never does.
  tableWrap: { overflowX: 'auto', width: '100%' },

  input: {
    padding: '0.5rem 0.75rem',
    background: 'rgba(12,10,9,0.6)',
    border: `1px solid #44403c`,
    borderRadius: '0.5rem',
    color: T.text,
    fontSize: '0.8125rem',
    fontFamily: 'inherit',
    outline: 'none',
  },
  btn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0.5rem 0.9rem',
    background: 'linear-gradient(135deg, #d97706, #f59e0b)',
    border: 'none',
    borderRadius: '0.5rem',
    color: '#0c0a09',
    fontWeight: 700,
    fontSize: '0.8125rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  btnGhost: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0.4rem 0.75rem',
    background: 'transparent',
    border: `1px solid #44403c`,
    borderRadius: '0.5rem',
    color: T.textDim,
    fontSize: '0.75rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  btnDanger: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0.4rem 0.75rem',
    background: 'transparent',
    border: '1px solid rgba(239,68,68,0.35)',
    borderRadius: '0.5rem',
    color: T.error,
    fontSize: '0.75rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  mono: {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: '0.75rem',
  },
};

export function StatTile({
  label,
  value,
  hint,
  tone = T.accent,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: string;
}) {
  return (
    <div style={{ ...s.panel, padding: '1.1rem 1.25rem' }}>
      <div
        style={{
          fontSize: '0.6875rem',
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          color: T.textFaint,
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: '1.75rem', fontWeight: 800, color: tone, marginTop: 6, lineHeight: 1.1 }}>
        {value}
      </div>
      {hint && <div style={{ fontSize: '0.75rem', color: T.textFaint, marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

export function Panel({
  title,
  icon,
  actions,
  children,
  padded = true,
}: {
  title: string;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  padded?: boolean;
}) {
  return (
    <div style={s.panel}>
      <div style={s.panelHeader}>
        <span style={s.panelTitle}>
          {icon}
          {title}
        </span>
        {actions}
      </div>
      <div style={padded ? s.panelBody : undefined}>{children}</div>
    </div>
  );
}

export function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '0.15rem 0.5rem',
        borderRadius: '0.375rem',
        background: `${color}1f`,
        color,
        fontSize: '0.6875rem',
        fontWeight: 700,
        letterSpacing: '0.04em',
        whiteSpace: 'nowrap',
      }}
    >
      {text}
    </span>
  );
}

/**
 * "Could not load" must never render as "nothing here". On a monitoring console
 * an empty error log and an unreachable error log mean opposite things.
 */
export function ErrorState({ error }: { error: string }) {
  return (
    <div
      style={{
        padding: '1.25rem',
        border: '1px solid rgba(239,68,68,0.3)',
        background: 'rgba(239,68,68,0.06)',
        borderRadius: '0.75rem',
        color: T.error,
        fontSize: '0.8125rem',
      }}
    >
      <strong>Could not load this panel.</strong>
      <div style={{ ...s.mono, marginTop: 6, color: '#fca5a5' }}>{error}</div>
    </div>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ padding: '2rem', textAlign: 'center', color: T.textFaint, fontSize: '0.8125rem' }}>
      {text}
    </div>
  );
}

/** Compact absolute timestamp — operators correlate across systems, so no "3 minutes ago". */
export function formatTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toISOString().replace('T', ' ').slice(0, 19) + 'Z';
}

export function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
