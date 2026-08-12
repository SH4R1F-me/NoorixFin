import Constants from 'expo-constants';
import { Platform } from 'react-native';

export interface MobileRelease {
  latest_version: string;
  min_version: string;
  ios_url: string | null;
  android_url: string | null;
  apk_url: string | null;
}

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';

export async function fetchMobileRelease(): Promise<MobileRelease | null> {
  try {
    const response = await fetch(`${API_URL}/v1/releases/mobile`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return null;
    return (await response.json()) as MobileRelease;
  } catch {
    return null;
  }
}

export function compareVersions(left: string, right: string): number {
  const parse = (value: string) =>
    value
      .split('-')[0]
      .split('.')
      .map((part) => Number(part) || 0);
  const a = parse(left);
  const b = parse(right);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const delta = (a[index] ?? 0) - (b[index] ?? 0);
    if (delta !== 0) return delta;
  }
  return 0;
}

export function currentVersion() {
  return Constants.expoConfig?.version ?? '0.0.0';
}

export function releaseDownloadUrl(release: MobileRelease) {
  if (Platform.OS === 'ios') return release.ios_url;
  return release.android_url ?? release.apk_url;
}
