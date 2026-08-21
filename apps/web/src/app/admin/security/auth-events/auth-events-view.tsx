'use client';

/**
 * Auth events view — paginated table of auth-related audit events.
 * Filters by platform; shows IP, user agent, action, platform.
 */
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { LogIn, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import type { AuthAuditEvent, Page } from '../../../../lib/admin-types';
import { Panel, EmptyState, ErrorState, T, s, formatTime } from '../../ui';
import { useLocale } from '../../../../lib/i18n/locale-provider';

const ACTION_COLOR: Record<string, string> = {
  USER_SIGNED_IN: T.ok,
  USER_SIGNED_UP: T.info,
  MFA_ENROLLED: T.ok,
  MFA_VERIFIED: T.ok,
  PASSWORD_RESET_REQUESTED: T.warn,
  EMAIL_CHANGED: T.warn,
  ACCOUNT_DELETED: T.error,
  ADMIN_USER_SUSPENDED: T.error,
  ADMIN_USER_REINSTATED: T.ok,
};

const PLATFORMS = ['', 'web', 'ios', 'android'] as const;

export default function AuthEventsView({
  data,
  error,
  platform,
  page,
}: {
  data: Page<AuthAuditEvent> | null;
  error: string | null;
  platform: string | undefined;
  page: number;
}) {
  const { t } = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function navigate(params: Record<string, string | undefined>) {
    const sp = new URLSearchParams();
    if (params.platform) sp.set('platform', params.platform);
    if (params.page) sp.set('page', params.page);
    startTransition(() => router.push(`?${sp.toString()}`));
  }

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const limit = data?.limit ?? 50;
  const hasNext = (page + 1) * limit < total;

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
            <LogIn
              size={22}
              style={{
                display: 'inline',
                marginRight: 8,
                verticalAlign: 'middle',
                color: T.accent,
              }}
            />
            {t('admin.security.authEvents')}
          </h1>
          <p style={s.subtitle}>
            Login, signup, MFA, and account change events with device context
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {/* Platform filter */}
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

      <Panel title={`Auth Events (${total.toLocaleString()})`} padded={false}>
        {items.length === 0 ? (
          <EmptyState text={t('admin.security.noAuthEvents')} />
        ) : (
          <>
            <div style={s.tableWrap}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th scope="col" style={s.th}>Action</th>
                    <th scope="col" style={s.th}>Actor</th>
                    <th scope="col" style={s.th}>{t('admin.security.platform')}</th>
                    <th scope="col" style={s.th}>IP</th>
                    <th scope="col" style={s.th}>User Agent</th>
                    <th scope="col" style={s.th}>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((ev: AuthAuditEvent) => (
                    <tr key={ev.id}>
                      <td style={s.td}>
                        <span
                          style={{
                            color: ACTION_COLOR[ev.action] ?? T.textDim,
                            fontWeight: 600,
                            fontSize: '0.8125rem',
                          }}
                        >
                          {ev.action.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td
                        style={{
                          ...s.td,
                          fontFamily: 'monospace',
                          fontSize: '0.75rem',
                          maxWidth: 120,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          color: T.textFaint,
                        }}
                      >
                        {ev.actor_id ? ev.actor_id.slice(0, 8) + '…' : '—'}
                      </td>
                      <td style={{ ...s.td, textTransform: 'capitalize', color: T.textDim }}>
                        {ev.platform ?? '—'}
                      </td>
                      <td
                        style={{
                          ...s.td,
                          fontFamily: 'monospace',
                          fontSize: '0.75rem',
                          color: T.textFaint,
                        }}
                      >
                        {ev.ip_address ?? '—'}
                      </td>
                      <td
                        style={{
                          ...s.td,
                          fontSize: '0.75rem',
                          maxWidth: 200,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          color: T.textFaint,
                        }}
                      >
                        {ev.user_agent ?? '—'}
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
                        {formatTime(ev.created_at)}
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
