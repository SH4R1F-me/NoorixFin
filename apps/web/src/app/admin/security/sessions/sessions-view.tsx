'use client';

/**
 * Sessions view — active user_devices rows; force-revoke individual sessions
 * or all sessions for a user.
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Smartphone, RefreshCw, ChevronLeft, ChevronRight, ShieldOff } from 'lucide-react';
import type { DeviceSession, Page } from '../../../../lib/admin-types';
import { revokeSession, revokeAllSessions } from './actions';
import { Panel, EmptyState, ErrorState, T, s, formatTime } from '../../ui';
import { useLocale } from '../../../../lib/i18n/locale-provider';

const PLATFORMS = ['', 'web', 'ios', 'android'] as const;

const PLATFORM_COLOR: Record<string, string> = {
  web: T.info,
  ios: '#a3e635',
  android: T.ok,
};

export default function SessionsView({
  data,
  error,
  platform,
  page,
}: {
  data: Page<DeviceSession> | null;
  error: string | null;
  platform: string | undefined;
  page: number;
}) {
  const { t } = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [revoking, setRevoking] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const limit = data?.limit ?? 50;
  const hasNext = (page + 1) * limit < total;

  function navigate(params: Record<string, string | undefined>) {
    const sp = new URLSearchParams();
    if (params.platform) sp.set('platform', params.platform);
    if (params.page) sp.set('page', params.page);
    startTransition(() => router.push(`?${sp.toString()}`));
  }

  async function handleRevoke(deviceId: string) {
    setRevoking(deviceId);
    setActionError(null);
    const result = await revokeSession(deviceId);
    setRevoking(null);
    if (!result.ok) {
      setActionError(result.error);
    } else {
      startTransition(() => router.refresh());
    }
  }

  async function handleRevokeAll(userId: string) {
    if (!confirm(t('admin.security.revokeConfirm'))) return;
    setRevoking(`all-${userId}`);
    setActionError(null);
    const result = await revokeAllSessions(userId);
    setRevoking(null);
    if (!result.ok) {
      setActionError(result.error);
    } else {
      startTransition(() => router.refresh());
    }
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: '1.75rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <h1 style={s.title}>
            <Smartphone
              size={22}
              style={{
                display: 'inline',
                marginRight: 8,
                verticalAlign: 'middle',
                color: T.accent,
              }}
            />
            {t('admin.security.sessions')}
          </h1>
          <p style={s.subtitle}>Active sessions platform-wide · {total.toLocaleString()} total</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'flex',
              background: 'rgba(255,255,255,0.05)',
              borderRadius: 8,
              padding: 2,
            }}
          >
            {PLATFORMS.map((p) => (
              <button
                key={p}
                onClick={() => navigate({ platform: p || undefined, page: '0' })}
                style={{
                  padding: '0.25rem 0.625rem',
                  fontSize: '0.75rem',
                  fontWeight: (platform ?? '') === p ? 700 : 400,
                  background: (platform ?? '') === p ? T.accent : 'transparent',
                  color: (platform ?? '') === p ? '#000' : T.textDim,
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  textTransform: 'capitalize',
                }}
              >
                {p || 'All'}
              </button>
            ))}
          </div>
          <button
            onClick={() => startTransition(() => router.refresh())}
            disabled={pending}
            style={s.btnGhost}
          >
            <RefreshCw
              size={14}
              style={{ animation: pending ? 'spin 1s linear infinite' : 'none' }}
            />
            Refresh
          </button>
        </div>
      </div>

      {error && <ErrorState error={error} />}
      {actionError && <ErrorState error={actionError} />}

      <Panel title={`${t('admin.security.sessions')} (${total.toLocaleString()})`} padded={false}>
        {items.length === 0 ? (
          <EmptyState text={t('admin.security.noSessions')} />
        ) : (
          <>
            <div style={s.tableWrap}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th scope="col" style={s.th}>{t('admin.security.platform')}</th>
                    <th scope="col" style={s.th}>User ID</th>
                    <th scope="col" style={s.th}>{t('admin.security.deviceName')}</th>
                    <th scope="col" style={s.th}>{t('admin.security.appVersion')}</th>
                    <th scope="col" style={s.th}>{t('admin.security.lastSeen')}</th>
                    <th scope="col" style={s.th}>{t('admin.security.firstSeen')}</th>
                    <th scope="col" style={s.th}>IP</th>
                    <th scope="col" style={{ ...s.th, textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((sess: DeviceSession) => (
                    <tr key={sess.id}>
                      <td style={s.td}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            color: PLATFORM_COLOR[sess.platform] ?? T.textDim,
                            fontWeight: 600,
                            fontSize: '0.8125rem',
                            textTransform: 'capitalize',
                          }}
                        >
                          <Smartphone size={12} />
                          {sess.platform}
                        </span>
                      </td>
                      <td
                        style={{
                          ...s.td,
                          fontFamily: 'monospace',
                          fontSize: '0.75rem',
                          color: T.textFaint,
                        }}
                      >
                        {sess.user_id.slice(0, 8)}…
                      </td>
                      <td style={{ ...s.td, color: T.text }}>{sess.device_name ?? '—'}</td>
                      <td
                        style={{
                          ...s.td,
                          fontFamily: 'monospace',
                          fontSize: '0.75rem',
                          color: T.textFaint,
                        }}
                      >
                        {sess.app_version ?? '—'}
                      </td>
                      <td
                        style={{
                          ...s.td,
                          fontFamily: 'monospace',
                          fontSize: '0.75rem',
                          color: T.textFaint,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {formatTime(sess.last_seen_at)}
                      </td>
                      <td
                        style={{
                          ...s.td,
                          fontFamily: 'monospace',
                          fontSize: '0.75rem',
                          color: T.textFaint,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {formatTime(sess.first_seen_at)}
                      </td>
                      <td
                        style={{
                          ...s.td,
                          fontFamily: 'monospace',
                          fontSize: '0.75rem',
                          color: T.textFaint,
                        }}
                      >
                        {sess.last_ip ?? '—'}
                      </td>
                      <td style={{ ...s.td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => handleRevoke(sess.id)}
                            disabled={revoking === sess.id}
                            style={s.btnDanger}
                            title={t('admin.security.revokeSession')}
                          >
                            <ShieldOff size={12} />
                            {revoking === sess.id ? '…' : t('admin.security.revokeSession')}
                          </button>
                          <button
                            onClick={() => handleRevokeAll(sess.user_id)}
                            disabled={revoking === `all-${sess.user_id}`}
                            style={{
                              ...s.btnDanger,
                              borderColor: 'rgba(251,191,36,0.4)',
                              color: T.warn,
                            }}
                            title={t('admin.security.revokeAll')}
                          >
                            {revoking === `all-${sess.user_id}`
                              ? '…'
                              : t('admin.security.revokeAll')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem 1.25rem',
                borderTop: `1px solid ${T.border}`,
              }}
            >
              <span style={{ fontSize: '0.8125rem', color: T.textFaint }}>
                {page * limit + 1}–{Math.min((page + 1) * limit, total)} of {total}
              </span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  disabled={page === 0 || pending}
                  onClick={() => navigate({ platform, page: String(page - 1) })}
                  style={s.btnGhost}
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  disabled={!hasNext || pending}
                  onClick={() => navigate({ platform, page: String(page + 1) })}
                  style={s.btnGhost}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </>
        )}
      </Panel>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
