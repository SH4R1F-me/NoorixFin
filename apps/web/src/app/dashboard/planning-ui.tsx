'use client';

/**
 * Shared pieces for the four planning screens.
 *
 * Extracted because budgets, calendar, goals and reports all need the same
 * three things — a header, a progress bar, and an honest empty state — and four
 * copies would have drifted, which is how the dashboard ended up with three
 * different "coming soon" treatments.
 *
 * ── ACCESSIBILITY (§5.5, WCAG 2.2 AA) ────────────────────────────────────────
 * Blueprint §5.5: "Color alone দিয়ে income/expense/status বোঝানো যাবে না."
 * Every status here therefore carries an icon and a word as well as a colour,
 * and every progress bar is a real `role="progressbar"` with its value in
 * `aria-valuenow` and a text label — a coloured `<div>` conveys nothing to a
 * screen reader.
 */
import type { CSSProperties, ReactNode } from 'react';
import { formatAmount, getCurrency } from '@noorixfin/money';
import { intlLocale, type SupportedLanguage } from '@noorixfin/i18n';

/** Format minor units in the reader's language — Bengali digits and lakh/crore grouping in bn. */
export function money(minor: number, currency: string, locale: SupportedLanguage): string {
  return `${getCurrency(currency).symbol}${formatAmount(Math.abs(minor), currency, intlLocale[locale])}`;
}

/**
 * Format a plain number in the reader's language.
 *
 * Amounts already went through `formatAmount`, but COUNTS and PERCENTAGES were
 * still being interpolated raw — so a Bangla page read "2 দিন আগে" and
 * "৳৮০০.০০", mixing Latin and Bengali digits in the same sentence. §4.6 of the
 * audit raised this for amounts; the same argument applies to every number a
 * user reads.
 */
export function num(
  value: number,
  locale: SupportedLanguage,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(intlLocale[locale], options).format(value);
}

/** A percentage, one decimal place, in the reader's digits. */
export function percent(value: number, locale: SupportedLanguage, digits = 1): string {
  return `${num(value, locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}%`;
}

/**
 * A category's display name.
 *
 * User-supplied wins; otherwise translate the key (DEC-015). Passing the
 * translator is not optional here — omitting it is what leaked raw
 * `cat.food_dining` strings to users, so this signature requires it.
 */
export function labelFor(
  category: { translation_key?: string | null; custom_name?: string | null },
  t: (key: string) => string,
): string {
  if (category.custom_name) return category.custom_name;
  if (!category.translation_key) return t('app.none');
  return t(category.translation_key);
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header style={ui.header}>
      <div>
        <h1 style={ui.title}>{title}</h1>
        {subtitle && <p style={ui.subtitle}>{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div style={ui.empty}>
      <div style={ui.emptyIcon}>{icon}</div>
      <h2 style={ui.emptyTitle}>{title}</h2>
      <p style={ui.emptyBody}>{body}</p>
      {action && <div style={{ marginTop: '1.25rem' }}>{action}</div>}
    </div>
  );
}

/**
 * A progress bar that means something without sight and without colour.
 *
 * `label` is what a screen reader announces; the visible percentage is
 * `aria-hidden` so the value is not read twice. Bars cap their WIDTH at 100%
 * while reporting the true value — a 140%-spent budget must not paint outside
 * its track, but it must not claim to be at 100% either.
 */
export function ProgressBar({
  value,
  max,
  label,
  tone = 'good',
}: {
  value: number;
  max: number;
  label: string;
  tone?: 'good' | 'warn' | 'over' | 'neutral';
}) {
  const percent = max > 0 ? (value / max) * 100 : 0;
  const colour = TONE[tone];

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      style={ui.track}
    >
      <div
        aria-hidden="true"
        style={{
          ...ui.fill,
          width: `${Math.min(Math.max(percent, 0), 100)}%`,
          background: colour,
        }}
      />
    </div>
  );
}

const TONE = {
  good: 'linear-gradient(90deg,#059669,#10b981)',
  warn: 'linear-gradient(90deg,#d97706,#f59e0b)',
  over: 'linear-gradient(90deg,#dc2626,#ef4444)',
  neutral: 'linear-gradient(90deg,#475569,#64748b)',
} as const;

/** Shared field styles so the four forms look like one product. */
export const field: Record<string, CSSProperties> = {
  group: { display: 'flex', flexDirection: 'column', gap: '0.375rem' },
  label: {
    fontSize: '0.75rem',
    fontWeight: 500,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  input: {
    padding: '0.625rem 0.75rem',
    background: 'rgba(15,23,42,0.6)',
    border: '1px solid #334155',
    borderRadius: '0.5rem',
    color: '#f8fafc',
    fontSize: '0.875rem',
    fontFamily: 'inherit',
    outline: 'none',
    width: '100%',
  },
  primary: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.625rem 1.25rem',
    background: 'linear-gradient(135deg,#059669,#10b981)',
    border: 'none',
    borderRadius: '0.75rem',
    color: 'white',
    fontWeight: 600,
    fontSize: '0.875rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
    boxShadow: '0 4px 12px rgba(16,185,129,0.3)',
  },
  ghost: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.375rem',
    padding: '0.4rem 0.75rem',
    background: 'rgba(30,41,59,0.6)',
    border: '1px solid #334155',
    borderRadius: '0.5rem',
    color: '#94a3b8',
    fontSize: '0.8125rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  card: {
    background: 'rgba(30,41,59,0.4)',
    border: '1px solid #1e293b',
    borderRadius: '1rem',
    padding: '1.25rem',
  },
  panel: {
    background: 'rgba(30,41,59,0.6)',
    border: '1px solid #334155',
    borderRadius: '1rem',
    padding: '1.5rem',
    marginBottom: '1.5rem',
  },
  error: { color: '#fca5a5', fontSize: '0.8125rem', margin: '0.75rem 0 0' },
  meta: { fontSize: '0.75rem', color: '#64748b' },
};

const ui: Record<string, CSSProperties> = {
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '1.5rem',
    flexWrap: 'wrap',
    gap: '1rem',
  },
  title: { fontSize: '1.75rem', fontWeight: 800, color: '#f8fafc', margin: 0, letterSpacing: '-0.02em' },
  subtitle: { fontSize: '0.8125rem', color: '#64748b', margin: '4px 0 0', maxWidth: 620, lineHeight: 1.5 },
  empty: {
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
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: '1rem',
    background: 'rgba(16,185,129,0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '1.25rem',
  },
  emptyTitle: { fontSize: '1.125rem', fontWeight: 700, color: '#f8fafc', margin: 0 },
  emptyBody: {
    fontSize: '0.875rem',
    color: '#94a3b8',
    marginTop: '0.5rem',
    lineHeight: 1.6,
    maxWidth: 420,
  },
  track: {
    height: 8,
    background: '#334155',
    borderRadius: 4,
    overflow: 'hidden',
    width: '100%',
  },
  fill: { height: '100%', borderRadius: 4, transition: 'width 600ms ease-out' },
};
