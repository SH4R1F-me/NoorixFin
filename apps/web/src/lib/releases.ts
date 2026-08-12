import 'server-only';

export interface MobileRelease {
  latest_version: string;
  min_version: string;
  ios_url: string | null;
  android_url: string | null;
  apk_url: string | null;
  apk_sha256: string | null;
  release_notes_url: string | null;
  ios_status: 'COMING_SOON' | 'LIVE';
  android_status: 'COMING_SOON' | 'LIVE';
  apk_size_bytes: number | null;
  released_at: string | null;
  ios_minimum: string;
  android_minimum: string;
}

export const FALLBACK_MOBILE_RELEASE: MobileRelease = {
  latest_version: '1.0.0', min_version: '1.0.0', ios_url: null, android_url: null,
  apk_url: null, apk_sha256: null, release_notes_url: '/changelog',
  ios_status: 'COMING_SOON', android_status: 'COMING_SOON', apk_size_bytes: null,
  released_at: null, ios_minimum: '15.0', android_minimum: '8.0',
};

export async function getMobileRelease(): Promise<MobileRelease> {
  const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  try {
    const response = await fetch(`${api}/v1/releases/mobile`, {
      next: { revalidate: 300 }, signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return FALLBACK_MOBILE_RELEASE;
    return (await response.json()) as MobileRelease;
  } catch {
    return FALLBACK_MOBILE_RELEASE;
  }
}

