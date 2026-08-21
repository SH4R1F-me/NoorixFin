'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '../../../../lib/api-client';
import type { MobileRelease } from '../../../../lib/admin-types';

export async function saveMobileRelease(payload: MobileRelease) {
  try {
    await apiFetch('/admin/releases/mobile', {
      method: 'PUT',
      body: {
        latest_version: payload.latest_version,
        min_version: payload.min_version,
        ios_status: payload.ios_status,
        android_status: payload.android_status,
        ios_minimum: payload.ios_minimum,
        android_minimum: payload.android_minimum,
        ...(payload.ios_url ? { ios_url: payload.ios_url } : {}),
        ...(payload.android_url ? { android_url: payload.android_url } : {}),
        ...(payload.apk_url ? { apk_url: payload.apk_url } : {}),
        ...(payload.apk_sha256 ? { apk_sha256: payload.apk_sha256 } : {}),
        ...(payload.release_notes_url ? { release_notes_url: payload.release_notes_url } : {}),
        ...(payload.apk_size_bytes ? { apk_size_bytes: payload.apk_size_bytes } : {}),
        ...(payload.released_at ? { released_at: payload.released_at } : {}),
      },
      idempotencyKey: randomUUID(),
    });
    revalidatePath('/admin/config/releases');
    revalidatePath('/download');
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof ApiError ? error.message : 'Could not update release',
    };
  }
}
