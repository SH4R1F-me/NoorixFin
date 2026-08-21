import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckCircle2, Lock, RefreshCw, WifiOff } from 'lucide-react';
import { getMobileRelease } from '../../../lib/releases';
import InstallQrCode from './qr-code';
import PlatformLinks from './platform-links';

export const metadata: Metadata = {
  title: 'Download the NoorixFin mobile app',
  description: 'Install NoorixFin for iOS or Android, or verify and download the direct APK.',
};

function bytes(value: number | null) {
  return value ? `${(value / 1024 / 1024).toFixed(1)} MB` : 'Size published with release';
}

export default async function DownloadPage() {
  const release = await getMobileRelease();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const installUrl = `${siteUrl.replace(/\/$/, '')}/download`;
  return (
    <div>
      <section className="m-section m-download-hero">
        <div className="m-download-copy">
          <div className="m-eyebrow">
            <span className="m-eyebrow-dot" />
            NoorixFin mobile
          </div>
          <h1 className="m-h1" style={{ textAlign: 'left' }}>
            Your finances, ready when you are.
          </h1>
          <p className="m-lead">
            A transparent preview of offline-first money management, secure sessions, and reliable
            synchronization. Store links appear only after a verified release is published.
          </p>
          <PlatformLinks release={release} />
          <p className="m-download-trust">
            <CheckCircle2 size={16} /> Free · open source · no advertising
          </p>
        </div>
        <div className="m-phone-mock" aria-label="NoorixFin mobile dashboard preview">
          <div className="m-phone-speaker" />
          <div className="m-phone-balance">
            This month<small>Private by default</small>
          </div>
          <div className="m-phone-chart">
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className="m-phone-row">
            <b>Groceries</b>
            <span>Synced</span>
          </div>
          <div className="m-phone-row">
            <b>Savings goal</b>
            <span>75%</span>
          </div>
        </div>
      </section>
      <section className="m-section-full m-download-qr-section">
        <div className="m-section-inner m-download-qr">
          <div className="m-qr-card">
            <InstallQrCode
              value={installUrl}
              label="QR code linking to the NoorixFin download page"
            />
          </div>
          <div>
            <div className="m-eyebrow">Desktop ready</div>
            <h2 className="m-h2">Scan to install</h2>
            <p className="m-lead">
              Point your phone camera at the code. If scanning is unavailable, open:
            </p>
            <a href={installUrl} className="m-visible-url">
              {installUrl}
            </a>
          </div>
        </div>
      </section>
      <section className="m-section">
        <div className="m-feature-strip">
          {[
            [WifiOff, 'Works offline'],
            [Lock, 'Secure sessions'],
            [RefreshCw, 'Reliable sync'],
            [CheckCircle2, 'Open source'],
          ].map(([Icon, label]) => {
            const FeatureIcon = Icon as typeof WifiOff;
            return (
              <div key={String(label)}>
                <FeatureIcon size={22} />
                <strong>{String(label)}</strong>
              </div>
            );
          })}
        </div>
        <div className="m-release-card">
          <div>
            <div className="m-eyebrow">Current release</div>
            <h2 className="m-h2">NoorixFin v{release.latest_version}</h2>
            <p>
              {bytes(release.apk_size_bytes)}
              {release.released_at
                ? ` · released ${new Date(release.released_at).toLocaleDateString()}`
                : ''}
            </p>
          </div>
          <div className="m-release-actions">
            {release.release_notes_url && (
              <Link className="m-btn-outline" href={release.release_notes_url}>
                Release notes
              </Link>
            )}
            <Link className="m-btn-ghost" href="/changelog">
              All releases
            </Link>
          </div>
          {release.apk_sha256 && (
            <div className="m-checksum">
              <span>SHA-256</span>
              <code>{release.apk_sha256}</code>
            </div>
          )}
        </div>
        <div className="m-requirements" id="requirements">
          <h2 className="m-h3">System requirements</h2>
          <p>
            iOS {release.ios_minimum}+ · Android {release.android_minimum}+
          </p>
          <h2 className="m-h3">Installing the APK safely</h2>
          <p>
            Only use the HTTPS link above. Compare the downloaded file’s SHA-256 with the published
            fingerprint before allowing installation from an unknown source. Prefer the Play
            Store—and F-Droid once listed—for automatic signature verification and updates.
          </p>
        </div>
      </section>
    </div>
  );
}
