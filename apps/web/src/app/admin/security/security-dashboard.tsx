'use client';

/**
 * Security dashboard — overview of auth events, active sessions, and anomalies.
 */
import { Shield, LogIn, Smartphone, AlertTriangle, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import type { AuthAuditEvent, Anomalies } from '../../../lib/admin-types';
import { Panel, EmptyState, ErrorState, T, s, formatTime } from '../ui';
import { useLocale } from '../../../lib/i18n/locale-provider';

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

export default function SecurityDashboard({
  recentAuth,
  totalSessions,
  anomalies,
  authError,
}: {
  recentAuth: AuthAuditEvent[];
  totalSessions: number;
  anomalies: Anomalies | null;
  authError: string | null;
}) {
  const { t } = useLocale();

  return (
    <div>
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={s.title}>
          <Shield
            size={22}
            style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle', color: T.accent }}
          />
          {t('admin.security.title')}
        </h1>
        <p style={s.subtitle}>{t('admin.security.subtitle')}</p>
      </div>

      {/* KPI tiles */}
      <div
        style={{
          ...s.grid,
          marginBottom: '1.5rem',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        }}
      >
        <Tile
          label="Active Sessions"
          value={totalSessions}
          tone={T.info}
          href="/admin/security/sessions"
          icon={<Smartphone size={16} />}
        />
        <Tile
          label="New Devices (24h)"
          value={anomalies?.new_devices.length ?? 0}
          tone={anomalies && anomalies.new_devices.length > 0 ? T.warn : T.ok}
          href="/admin/security/anomalies"
          icon={<AlertTriangle size={16} />}
        />
        <Tile
          label="Throttle Abusers (1h)"
          value={anomalies?.throttle_abusers.length ?? 0}
          tone={anomalies && anomalies.throttle_abusers.length > 0 ? T.error : T.ok}
          href="/admin/security/anomalies"
          icon={<AlertTriangle size={16} />}
        />
      </div>

      {authError && <ErrorState error={authError} />}

      {/* Quick nav cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '0.875rem',
          marginBottom: '1.5rem',
        }}
      >
        {[
          {
            href: '/admin/security/auth-events',
            label: t('admin.security.authEvents'),
            icon: <LogIn size={18} />,
          },
          {
            href: '/admin/security/sessions',
            label: t('admin.security.sessions'),
            icon: <Smartphone size={18} />,
          },
          {
            href: '/admin/security/anomalies',
            label: t('admin.security.anomalies'),
            icon: <AlertTriangle size={18} />,
          },
        ].map((item) => (
          <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
            <div
              style={{
                ...s.panel,
                padding: '1rem 1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                transition: 'border-color 0.15s',
              }}
            >
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', color: T.textDim }}
              >
                {item.icon}
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: T.text }}>
                  {item.label}
                </span>
              </div>
              <ChevronRight size={16} color={T.textFaint} />
            </div>
          </Link>
        ))}
      </div>

      {/* Recent auth events */}
      <Panel title={`Recent Auth Events (last 5)`} padded={false}>
        {recentAuth.length === 0 ? (
          <EmptyState text="No auth events yet." />
        ) : (
          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th scope="col" style={s.th}>Action</th>
                  <th scope="col" style={s.th}>Platform</th>
                  <th scope="col" style={s.th}>IP</th>
                  <th scope="col" style={s.th}>Time</th>
                </tr>
              </thead>
              <tbody>
                {recentAuth.map((ev) => (
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
                        fontFamily: 'monospace',
                        fontSize: '0.75rem',
                        color: T.textFaint,
                      }}
                    >
                      {formatTime(ev.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function Tile({
  label,
  value,
  tone,
  href,
  icon,
}: {
  label: string;
  value: number;
  tone: string;
  href: string;
  icon: React.ReactNode;
}) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <div style={{ ...s.panel, padding: '1.1rem 1.25rem', cursor: 'pointer' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: '0.6875rem',
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            color: T.textFaint,
            fontWeight: 600,
            marginBottom: 6,
          }}
        >
          <span style={{ color: tone }}>{icon}</span>
          {label}
        </div>
        <div style={{ fontSize: '1.75rem', fontWeight: 800, color: tone, lineHeight: 1 }}>
          {value}
        </div>
      </div>
    </Link>
  );
}
