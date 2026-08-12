'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '../../../../lib/api-client';
import type { MobileRelease } from '../../../../lib/admin-types';

export async function saveMobileRelease(payload: MobileRelease) {
  try {
    await apiFetch('/admin/releases/mobile', {
      method: 'PUT',
      body: payload,
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
