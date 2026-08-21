'use client';

/**
 * Anomalies view — new device logins (last 24h) and throttle abusers (last 1h).
 */
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { AlertTriangle, RefreshCw, Smartphone, Zap } from 'lucide-react';
import type { Anomalies, AnomalyNewDevice, AnomalyThrottleAbuser } from '../../../../lib/admin-types';
import { Panel, EmptyState, ErrorState, T, s, formatTime } from '../../ui';
import { useLocale } from '../../../../lib/i18n/locale-provider';

export default function AnomaliesView({
  data,
  error,
}: {
  data: Anomalies | null;
  error: string | null;
}) {
  const { t } = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const newDevices = data?.new_devices ?? [];
  const throttleAbusers = data?.throttle_abusers ?? [];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={s.title}>
            <AlertTriangle size={22} style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle', color: T.warn }} />
            {t('admin.security.anomalies')}
          </h1>
          <p style={s.subtitle}>New device logins (24h) and rate-limit abusers (1h)</p>
        </div>
        <button onClick={() => startTransition(() => router.refresh())} disabled={pending} style={s.btnGhost}>
          <RefreshCw size={14} style={{ animation: pending ? 'spin 1s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      {/* Summary */}
      <div style={{ ...s.grid, marginBottom: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        <div style={{ ...s.panel, padding: '1rem 1.25rem', border: `1px solid ${newDevices.length > 0 ? T.warn : T.border}` }}>
          <div style={{ fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textFaint, fontWeight: 600 }}>{t('admin.security.newDevices')}</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: newDevices.length > 0 ? T.warn : T.ok, marginTop: 6 }}>{newDevices.length}</div>
          <div style={{ fontSize: '0.75rem', color: T.textFaint, marginTop: 2 }}>Last 24 hours</div>
        </div>
        <div style={{ ...s.panel, padding: '1rem 1.25rem', border: `1px solid ${throttleAbusers.length > 0 ? T.error : T.border}` }}>
          <div style={{ fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textFaint, fontWeight: 600 }}>{t('admin.security.throttleAbusers')}</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: throttleAbusers.length > 0 ? T.error : T.ok, marginTop: 6 }}>{throttleAbusers.length}</div>
          <div style={{ fontSize: '0.75rem', color: T.textFaint, marginTop: 2 }}>Last hour (≥5 hits)</div>
        </div>
      </div>

      {error && <ErrorState error={error} />}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {/* New devices */}
        <Panel title={`${t('admin.security.newDevices')} (24h)`} padded={false}>
          {newDevices.length === 0 ? (
            <EmptyState text="No new device logins in the last 24 hours." />
          ) : (
            <div style={s.tableWrap}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th scope="col" style={s.th}>{t('admin.security.platform')}</th>
                    <th scope="col" style={s.th}>{t('admin.security.deviceName')}</th>
                    <th scope="col" style={s.th}>IP</th>
                    <th scope="col" style={s.th}>{t('admin.security.firstSeen')}</th>
                  </tr>
                </thead>
                <tbody>
                  {newDevices.map((d: AnomalyNewDevice) => (
                    <tr key={d.id}>
                      <td style={{ ...s.td, textTransform: 'capitalize', color: T.textDim }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Smartphone size={12} />
                          {d.platform}
                        </span>
                      </td>
                      <td style={{ ...s.td, color: T.text }}>{d.device_name ?? '—'}</td>
                      <td style={{ ...s.td, fontFamily: 'monospace', fontSize: '0.75rem', color: T.textFaint }}>{d.last_ip ?? '—'}</td>
                      <td style={{ ...s.td, fontFamily: 'monospace', fontSize: '0.75rem', color: T.textFaint, whiteSpace: 'nowrap' }}>
                        {formatTime(d.first_seen_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        {/* Throttle abusers */}
        <Panel title={`${t('admin.security.throttleAbusers')} (1h)`} padded={false}>
          {throttleAbusers.length === 0 ? (
            <EmptyState text="No rate-limit abusers detected in the last hour." />
          ) : (
            <div style={s.tableWrap}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th scope="col" style={s.th}>Actor ID</th>
                    <th scope="col" style={{ ...s.th, textAlign: 'right' }}>{t('admin.security.hitCount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {throttleAbusers.map((abuser: AnomalyThrottleAbuser) => (
                    <tr key={abuser.actor_id}>
                      <td style={{ ...s.td, fontFamily: 'monospace', fontSize: '0.75rem', color: T.textFaint }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Zap size={12} color={T.error} />
                          {abuser.actor_id.slice(0, 16)}…
                        </span>
                      </td>
                      <td style={{ ...s.td, textAlign: 'right', fontWeight: 700, color: abuser.hit_count >= 20 ? T.error : T.warn }}>
                        {abuser.hit_count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
