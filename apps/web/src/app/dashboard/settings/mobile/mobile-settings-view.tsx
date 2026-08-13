'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';
import { Download, Link2, Loader2, ShieldCheck, Smartphone } from 'lucide-react';
import type { MobileRelease } from '../../../../lib/releases';
import type { UserDevice } from '../sessions/actions';
import { createMobilePairing } from './actions';

export default function MobileSettingsView({
  workspaceId,
  workspaceName,
  release,
  devices,
}: {
  workspaceId: string;
  workspaceName: string;
  release: MobileRelease;
  devices: UserDevice[];
}) {
  const [qr, setQr] = useState<string | null>(null);
  const [expires, setExpires] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  function pair() {
    startTransition(async () => {
      setMessage(null);
      const result = await createMobilePairing(workspaceId);
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      const value = `noorixfin://pair?token=${encodeURIComponent(result.token)}`;
      setQr(await QRCode.toDataURL(value, { width: 240, margin: 2, errorCorrectionLevel: 'M' }));
      setExpires(result.expires_at);
    });
  }
  return (
    <div style={styles.page}>
      <header>
        <h1 style={styles.title}>Mobile app</h1>
        <p style={styles.sub}>
          Install NoorixFin and securely pair this workspace after signing in on your phone.
        </p>
      </header>
      <section style={styles.card}>
        <div style={styles.cardHead}>
          <Link2 size={18} color="var(--color-success)" />
          <div>
            <h2 style={styles.h2}>Pair {workspaceName || 'your workspace'}</h2>
            <p style={styles.sub}>
              The one-time code expires after ten minutes and only works for this account.
            </p>
          </div>
        </div>
        {qr ? (
          <div style={styles.qrWrap}>
            {/* One-time data URL generated locally; image optimisation cannot add value. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qr}
              alt="One-time QR code for pairing the NoorixFin mobile app"
              width={240}
              height={240}
            />
            <p style={styles.sub}>Expires {new Date(expires!).toLocaleTimeString()}</p>
            <button style={styles.ghost} onClick={pair} disabled={pending}>
              Replace code
            </button>
          </div>
        ) : (
          <button style={styles.primary} onClick={pair} disabled={pending || !workspaceId}>
            {pending ? <Loader2 size={16} /> : <Smartphone size={16} />}
            {pending ? 'Generating…' : 'Generate pairing QR'}
          </button>
        )}
        {message && (
          <p role="alert" style={styles.error}>
            {message}
          </p>
        )}
      </section>
      <section style={styles.card}>
        <div style={styles.cardHead}>
          <Download size={18} color="#38bdf8" />
          <div>
            <h2 style={styles.h2}>Download</h2>
            <p style={styles.sub}>
              Current release v{release.latest_version} · iOS {release.ios_minimum}+ · Android{' '}
              {release.android_minimum}+
            </p>
          </div>
        </div>
        <div style={styles.actions}>
          <Link href="/download" style={styles.primary}>
            Download options
          </Link>
          {release.apk_url && (
            <a href={release.apk_url} style={styles.ghost}>
              Direct APK
            </a>
          )}
        </div>
      </section>
      <section style={styles.card}>
        <div style={styles.cardHead}>
          <ShieldCheck size={18} color="#a78bfa" />
          <div>
            <h2 style={styles.h2}>Connected devices</h2>
            <p style={styles.sub}>
              {devices.length} active device{devices.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>
        <Link href="/dashboard/settings/sessions" style={styles.ghost}>
          Manage sessions
        </Link>
      </section>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 860 },
  title: { fontSize: '1.65rem', color: 'var(--text-primary)', marginBottom: '.35rem' },
  sub: { color: 'var(--text-tertiary)', fontSize: '.82rem', lineHeight: 1.6 },
  card: {
    marginTop: '1.25rem',
    padding: '1.25rem',
    background: '#111827',
    border: '1px solid var(--border-primary)',
    borderRadius: 12,
  },
  cardHead: { display: 'flex', alignItems: 'flex-start', gap: '.75rem', marginBottom: '1rem' },
  h2: { color: 'var(--text-primary)', fontSize: '1rem', marginBottom: '.25rem' },
  qrWrap: { textAlign: 'center', padding: '1rem' },
  primary: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '.45rem',
    background: 'var(--color-primary-500)',
    color: 'var(--text-on-primary)',
    border: 0,
    padding: '.65rem 1rem',
    borderRadius: 8,
    fontWeight: 700,
    textDecoration: 'none',
    cursor: 'pointer',
  },
  ghost: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '.45rem',
    background: 'transparent',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-primary)',
    padding: '.6rem .9rem',
    borderRadius: 8,
    textDecoration: 'none',
    cursor: 'pointer',
  },
  actions: { display: 'flex', gap: '.75rem', flexWrap: 'wrap' },
  error: { color: 'var(--color-error)', marginTop: '.75rem' },
};
