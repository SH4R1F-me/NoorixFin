'use client';

/**
 * Sessions & Devices view — gap S2.
 *
 * Lets a user see every device they are signed in on and revoke individual
 * sessions or sign out of everything else. Matches the emerald/slate palette
 * of the rest of the dashboard settings.
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Smartphone,
  Globe,
  Monitor,
  RefreshCw,
  ShieldOff,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import type { UserDevice } from './actions';
import { revokeMyDevice, revokeAllMyDevices } from './actions';

function PlatformIcon({ platform }: { platform: string }) {
  if (platform === 'ios' || platform === 'android') return <Smartphone size={16} />;
  if (platform === 'web') return <Globe size={16} />;
  return <Monitor size={16} />;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

const PLATFORM_COLOR: Record<string, string> = {
  web: '#38bdf8',
  ios: '#a3e635',
  android: '#10b981',
};

export default function SessionsView({ devices }: { devices: UserDevice[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [revoking, setRevoking] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  async function handleRevoke(deviceId: string) {
    setRevoking(deviceId);
    setNotice(null);
    const result = await revokeMyDevice(deviceId);
    setRevoking(null);
    setNotice({ ok: result.ok, text: result.ok ? 'Session revoked.' : result.message });
    if (result.ok) startTransition(() => router.refresh());
  }

  async function handleRevokeAll() {
    if (!confirm('Sign out of all devices? You will remain signed in here.')) return;
    setRevoking('all');
    setNotice(null);
    const result = await revokeAllMyDevices();
    setRevoking(null);
    setNotice({ ok: result.ok, text: result.ok ? 'All other sessions revoked.' : result.message });
    if (result.ok) startTransition(() => router.refresh());
  }

  return (
    <div>
      {/* Header */}
      <div style={s.hdr}>
        <h1 style={s.title}>Sessions & Devices</h1>
        <p style={s.sub}>
          Every device where you are currently signed in. Revoke any session you do not recognise.
        </p>
      </div>

      {notice && (
        <div style={notice.ok ? s.noticeOk : s.noticeBad} role="status">
          {notice.ok ? (
            <CheckCircle size={14} style={{ display: 'inline', marginRight: 6 }} />
          ) : (
            <AlertTriangle size={14} style={{ display: 'inline', marginRight: 6 }} />
          )}
          {notice.text}
        </div>
      )}

      {/* Actions bar */}
      <div
        style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem', gap: '0.5rem' }}
      >
        <button
          onClick={() => startTransition(() => router.refresh())}
          disabled={pending}
          style={s.ghostBtn}
        >
          <RefreshCw
            size={14}
            style={{ animation: pending ? 'spin 1s linear infinite' : 'none' }}
          />
          Refresh
        </button>
        {devices.length > 1 && (
          <button onClick={handleRevokeAll} disabled={revoking === 'all'} style={s.dangerBtn}>
            <ShieldOff size={14} />
            {revoking === 'all' ? 'Signing out…' : 'Sign out all other devices'}
          </button>
        )}
      </div>

      {/* Device list */}
      <div style={s.sections}>
        {devices.length === 0 ? (
          <div style={s.section}>
            <div
              style={{
                padding: '2rem',
                textAlign: 'center',
                color: '#8b9ab0',
                fontSize: '0.8125rem',
              }}
            >
              No active sessions found. This may mean your device tracking is not yet registered.
            </div>
          </div>
        ) : (
          devices.map((device) => (
            <div key={device.id} style={s.section}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  padding: '1.125rem 1.25rem',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem' }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: '0.625rem',
                      background: `${PLATFORM_COLOR[device.platform] ?? '#38bdf8'}18`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: PLATFORM_COLOR[device.platform] ?? '#38bdf8',
                      flexShrink: 0,
                    }}
                  >
                    <PlatformIcon platform={device.platform} />
                  </div>
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        marginBottom: 2,
                      }}
                    >
                      <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#f8fafc' }}>
                        {device.device_name ??
                          `${device.platform.charAt(0).toUpperCase() + device.platform.slice(1)} Device`}
                      </span>
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          textTransform: 'capitalize',
                          padding: '0.1rem 0.45rem',
                          background: `${PLATFORM_COLOR[device.platform] ?? '#38bdf8'}18`,
                          color: PLATFORM_COLOR[device.platform] ?? '#38bdf8',
                          borderRadius: 4,
                          fontWeight: 600,
                        }}
                      >
                        {device.platform}
                      </span>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '0.75rem',
                        fontSize: '0.75rem',
                        color: '#8b9ab0',
                      }}
                    >
                      {device.app_version && <span>v{device.app_version}</span>}
                      {device.os_version && <span>{device.os_version}</span>}
                      {device.last_ip && <span>{device.last_ip}</span>}
                      <span>Last active: {formatDate(device.last_seen_at)}</span>
                      <span>First seen: {formatDate(device.first_seen_at)}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleRevoke(device.id)}
                  disabled={revoking === device.id}
                  style={s.dangerBtn}
                >
                  <ShieldOff size={14} />
                  {revoking === device.id ? 'Revoking…' : 'Revoke session'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '1rem', maxWidth: 760 }}>
        Device tracking uses an opaque app-generated ID stored in your device — not an advertising
        ID or hardware serial. Revoking a session prevents it from making new requests but does not
        delete any financial data.
      </p>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  hdr: { marginBottom: '1.5rem' },
  title: { fontSize: '1.75rem', fontWeight: 800, color: '#f8fafc', margin: 0 },
  sub: { fontSize: '0.8125rem', color: '#8b9ab0', margin: 0, marginTop: 2 },
  sections: { display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: 760 },
  section: {
    background: 'rgba(30,41,59,0.4)',
    border: '1px solid #1e293b',
    borderRadius: '1rem',
    overflow: 'hidden',
  },
  ghostBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.45rem',
    padding: '0.5rem 0.9rem',
    background: 'transparent',
    border: '1px solid #334155',
    borderRadius: '0.5rem',
    color: '#94a3b8',
    fontSize: '0.8125rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  dangerBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 1rem',
    background: 'transparent',
    border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: '0.5rem',
    color: '#f87171',
    fontSize: '0.8125rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  },
  noticeOk: {
    marginBottom: '1rem',
    padding: '0.75rem 1rem',
    borderRadius: '0.6rem',
    background: 'rgba(16,185,129,0.1)',
    border: '1px solid rgba(16,185,129,0.3)',
    color: '#10b981',
    fontSize: '0.8125rem',
    maxWidth: 760,
  },
  noticeBad: {
    marginBottom: '1rem',
    padding: '0.75rem 1rem',
    borderRadius: '0.6rem',
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.3)',
    color: '#fca5a5',
    fontSize: '0.8125rem',
    maxWidth: 760,
  },
};
