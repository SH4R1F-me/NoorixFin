'use client';

import { useSyncExternalStore } from 'react';
import { Apple, Download, Smartphone } from 'lucide-react';
import type { MobileRelease } from '../../../lib/releases';

type Platform = 'ios' | 'android' | 'desktop';

function StoreLink({
  href,
  live,
  platform,
  emphasised,
}: {
  href: string | null;
  live: boolean;
  platform: 'ios' | 'android' | 'apk';
  emphasised: boolean;
}) {
  const content =
    platform === 'ios' ? 'App Store' : platform === 'android' ? 'Google Play' : 'Direct APK';
  const Icon = platform === 'ios' ? Apple : platform === 'android' ? Smartphone : Download;
  if (!live || !href) {
    return (
      <span className="m-store-link m-store-link--disabled" aria-label={`${content} coming soon`}>
        <Icon size={20} aria-hidden="true" />
        <span>
          <small>Coming soon</small>
          {content}
        </span>
      </span>
    );
  }
  return (
    <a
      href={href}
      className={`m-store-link ${emphasised ? 'm-store-link--primary' : ''}`}
      aria-label={
        platform === 'ios'
          ? 'Download NoorixFin on the App Store'
          : platform === 'android'
            ? 'Get NoorixFin on Google Play'
            : 'Download the NoorixFin APK'
      }
    >
      <Icon size={20} aria-hidden="true" />
      <span>
        <small>{platform === 'apk' ? 'Download' : 'Get it on'}</small>
        {content}
      </span>
    </a>
  );
}

export default function PlatformLinks({ release }: { release: MobileRelease }) {
  const detectPlatform = (): Platform => {
    const source = navigator.userAgent.toLowerCase();
    return /iphone|ipad|ipod/.test(source) ? 'ios' : /android/.test(source) ? 'android' : 'desktop';
  };
  const platform = useSyncExternalStore(
    () => () => undefined,
    detectPlatform,
    () => 'desktop',
  );
  return (
    <div className="m-store-links">
      <StoreLink
        href={release.ios_url}
        live={release.ios_status === 'LIVE'}
        platform="ios"
        emphasised={platform === 'ios'}
      />
      <StoreLink
        href={release.android_url}
        live={release.android_status === 'LIVE'}
        platform="android"
        emphasised={platform === 'android'}
      />
      <StoreLink
        href={release.apk_url}
        live={Boolean(release.apk_url)}
        platform="apk"
        emphasised={platform === 'desktop'}
      />
    </div>
  );
}
