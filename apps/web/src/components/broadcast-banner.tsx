'use client';

/**
 * Broadcast banner — the user-facing end of the operator's broadcast feature.
 *
 * Dismissal persists server-side (a `broadcast_receipts` row), not in
 * localStorage: a notice dismissed on a phone should stay dismissed on a laptop,
 * and localStorage would resurrect every notice on every new device.
 *
 * Optimistic on dismiss, deliberately: this is UI state, not a balance, so
 * DEC-012's "never optimistic" rule does not apply — that rule is about ledger
 * figures. Making the user watch a spinner to hide a banner would be silly.
 */
import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, ExternalLink } from 'lucide-react';
import type { Broadcast } from '../lib/session';
import { useLocale } from '../lib/i18n/locale-provider';
import { dismissBroadcast } from '../app/dashboard/broadcast-actions';

const TONES: Record<
  Broadcast['severity'],
  { bg: string; border: string; color: string; Icon: typeof Info }
> = {
  INFO: {
    bg: 'rgba(56,189,248,0.08)',
    border: 'rgba(56,189,248,0.28)',
    color: '#7dd3fc',
    Icon: Info,
  },
  SUCCESS: {
    bg: 'rgba(16,185,129,0.08)',
    border: 'rgba(16,185,129,0.28)',
    color: '#6ee7b7',
    Icon: CheckCircle2,
  },
  WARNING: {
    bg: 'rgba(245,158,11,0.09)',
    border: 'rgba(245,158,11,0.3)',
    color: '#fbbf24',
    Icon: AlertTriangle,
  },
  CRITICAL: {
    bg: 'rgba(239,68,68,0.09)',
    border: 'rgba(239,68,68,0.32)',
    color: '#fca5a5',
    Icon: AlertTriangle,
  },
};

export default function BroadcastBanner({
  broadcasts,
}: {
  broadcasts: Broadcast[];
}) {
  // Broadcasts are authored bilingually (operators must fill both fields), so
  // the banner picks the field matching the reader's language.
  const { locale, t } = useLocale();
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const visible = broadcasts.filter((broadcast) => !hidden.has(broadcast.id));
  if (visible.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.5rem' }}>
      {visible.map((broadcast) => {
        const tone = TONES[broadcast.severity] ?? TONES.INFO;
        const title = locale === 'bn' ? broadcast.title_bn : broadcast.title_en;
        const body = locale === 'bn' ? broadcast.body_bn : broadcast.body_en;
        const { Icon } = tone;

        return (
          <div
            key={broadcast.id}
            role="status"
            style={{
              display: 'flex',
              gap: '0.75rem',
              alignItems: 'flex-start',
              padding: '0.85rem 1rem',
              background: tone.bg,
              border: `1px solid ${tone.border}`,
              borderRadius: '0.75rem',
              color: tone.color,
            }}
          >
            <Icon size={17} style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>{title}</div>
              {body && (
                <div style={{ fontSize: '0.8125rem', opacity: 0.9, marginTop: 2, lineHeight: 1.5 }}>
                  {body}
                </div>
              )}
              {broadcast.link_url && (
                <a
                  href={broadcast.link_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    marginTop: 6,
                    fontSize: '0.75rem',
                    color: tone.color,
                    fontWeight: 600,
                  }}
                >
                  {t('dashboard.details')}
                  <ExternalLink size={12} />
                </a>
              )}
            </div>

            {broadcast.dismissible && (
              <button
                onClick={() => {
                  setHidden((current) => new Set(current).add(broadcast.id));
                  // Fire and forget: if the write fails the banner returns on
                  // the next load, which is the safe direction to fail for a
                  // notice the operator wanted people to read.
                  void dismissBroadcast(broadcast.id);
                }}
                aria-label={t('app.close')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: tone.color,
                  cursor: 'pointer',
                  padding: 2,
                  display: 'flex',
                  flexShrink: 0,
                  opacity: 0.7,
                }}
              >
                <X size={16} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
