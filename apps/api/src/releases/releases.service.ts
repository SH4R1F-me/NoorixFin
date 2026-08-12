import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export const MOBILE_RELEASE_KEYS = [
  'site.mobile.ios_url',
  'site.mobile.android_url',
  'site.mobile.apk_url',
  'site.mobile.apk_sha256',
  'site.mobile.latest_version',
  'site.mobile.min_version',
  'site.mobile.release_notes_url',
  'site.mobile.ios_status',
  'site.mobile.android_status',
  'site.mobile.apk_size_bytes',
  'site.mobile.released_at',
  'site.mobile.ios_minimum',
  'site.mobile.android_minimum',
] as const;

export type MobileRelease = {
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
};

@Injectable()
export class ReleasesService {
  constructor(private readonly supabase: SupabaseService) {}

  async getMobileRelease(): Promise<MobileRelease> {
    const { data, error } = await this.supabase
      .getServiceClient()
      .from('site_settings')
      .select('key, value')
      .in('key', [...MOBILE_RELEASE_KEYS]);
    if (error) {
      throw new ServiceUnavailableException({
        code: 'RELEASE_CONFIG_UNAVAILABLE',
        message: 'Mobile release configuration is unavailable',
      });
    }
    const values = Object.fromEntries(
      (data ?? []).map((row) => [row.key, row.value]),
    );
    const read = (name: string): string | null => {
      const value = values[`site.mobile.${name}`];
      return typeof value === 'string' && value.trim() ? value.trim() : null;
    };
    const size = Number(read('apk_size_bytes'));
    return {
      latest_version: read('latest_version') ?? '1.0.0',
      min_version: read('min_version') ?? '1.0.0',
      ios_url: read('ios_url'),
      android_url: read('android_url'),
      apk_url: read('apk_url'),
      apk_sha256: read('apk_sha256'),
      release_notes_url: read('release_notes_url'),
      ios_status: read('ios_status') === 'LIVE' ? 'LIVE' : 'COMING_SOON',
      android_status:
        read('android_status') === 'LIVE' ? 'LIVE' : 'COMING_SOON',
      apk_size_bytes: Number.isSafeInteger(size) && size > 0 ? size : null,
      released_at: read('released_at'),
      ios_minimum: read('ios_minimum') ?? '15.0',
      android_minimum: read('android_minimum') ?? '8.0',
    };
  }
}
