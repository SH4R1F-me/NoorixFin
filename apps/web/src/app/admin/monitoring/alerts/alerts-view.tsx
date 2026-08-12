'use client';

/**
 * Alerts view — alert_state rows; firing alerts are highlighted; operators
 * can acknowledge (resolve) directly from this page.
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';
import type { AlertState } from '../../../../lib/admin';
import { acknowledgeAlert } from '../../../../lib/admin';
import { Panel, Badge, EmptyState, ErrorState, T, s, formatTime } from '../../ui';
import { useLocale } from '../../../../lib/i18n/locale-provider';

export default function AlertsView({
  alerts,
  error,
}: {
  alerts: AlertState[];
  error: string | null;
}) {
  const { t } = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [acking, setAcking] = useState<string | null>(null);
  const [ackError, setAckError] = useState<string | null>(null);

  const firing = alerts.filter((a) => a.is_firing);
  const resolved = alerts.filter((a) => !a.is_firing);

  async function handleAcknowledge(alertKey: string) {
    setAcking(alertKey);
    setAckError(null);
    const result = await acknowledgeAlert(alertKey);
    setAcking(null);
    if (!result.ok) {
      setAckError(result.error);
    } else {
      startTransition(() => router.refresh());
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={s.title}>
            <Bell size={22} style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle', color: firing.length > 0 ? T.error : T.accent }} />
            {t('admin.alerts.title')}
          </h1>
          <p style={s.subtitle}>{t('admin.alerts.subtitle')}</p>
        </div>
        <button onClick={() => startTransition(() => router.refresh())} disabled={pending} style={s.btnGhost}>
          <RefreshCw size={14} style={{ animation: pending ? 'spin 1s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      {/* Summary */}
      <div style={{ ...s.grid, marginBottom: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        <div style={{ ...s.panel, padding: '1rem 1.25rem', border: `1px solid ${firing.length > 0 ? T.error : T.border}` }}>
          <div style={{ fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textFaint, fontWeight: 600 }}>{t('admin.alerts.firing')}</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: firing.length > 0 ? T.error : T.ok, marginTop: 6 }}>{firing.length}</div>
        </div>
        <div style={{ ...s.panel, padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textFaint, fontWeight: 600 }}>{t('admin.alerts.resolved')}</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: T.ok, marginTop: 6 }}>{resolved.length}</div>
        </div>
        <div style={{ ...s.panel, padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textFaint, fontWeight: 600 }}>Total</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: T.text, marginTop: 6 }}>{alerts.length}</div>
        </div>
      </div>

      {error && <ErrorState error={error} />}
      {ackError && <ErrorState error={ackError} />}

      {alerts.length === 0 ? (
        <Panel title={t('admin.alerts.title')}>
          <EmptyState text={t('admin.alerts.noAlerts')} />
        </Panel>
      ) : (
        <Panel title={t('admin.alerts.title')} padded={false}>
          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>{t('admin.alerts.alertKey')}</th>
                  <th style={s.th}>Status</th>
                  <th style={s.th}>{t('admin.alerts.lastValue')}</th>
                  <th style={s.th}>{t('admin.alerts.lastFired')}</th>
                  <th style={s.th}>{t('admin.alerts.lastResolved')}</th>
                  <th style={s.th}>Action</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((alert) => (
                  <tr key={alert.alert_key} style={{ background: alert.is_firing ? 'rgba(248,113,113,0.05)' : 'transparent' }}>
                    <td style={{ ...s.td, color: T.text, fontWeight: 600, fontFamily: 'monospace', fontSize: '0.8125rem' }}>
                      {alert.alert_key}
                    </td>
                    <td style={s.td}>
                      {alert.is_firing ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: T.error, fontSize: '0.8125rem', fontWeight: 700 }}>
                          <AlertTriangle size={12} />
                          {t('admin.alerts.firing')}
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: T.ok, fontSize: '0.8125rem' }}>
                          <CheckCircle size={12} />
                          {t('admin.alerts.resolved')}
                        </span>
                      )}
                    </td>
                    <td style={{ ...s.td, fontFamily: 'monospace', color: T.textFaint }}>
                      {alert.last_value ?? '—'}
                    </td>
                    <td style={{ ...s.td, fontFamily: 'monospace', fontSize: '0.75rem', color: T.textFaint }}>
                      {formatTime(alert.last_fired_at)}
                    </td>
                    <td style={{ ...s.td, fontFamily: 'monospace', fontSize: '0.75rem', color: T.textFaint }}>
                      {formatTime(alert.last_resolved_at)}
                    </td>
                    <td style={s.td}>
                      {alert.is_firing && (
                        <button
                          onClick={() => handleAcknowledge(alert.alert_key)}
                          disabled={acking === alert.alert_key}
                          style={s.btnDanger}
                        >
                          {acking === alert.alert_key ? '…' : t('admin.alerts.acknowledge')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
