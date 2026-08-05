'use server';

/**
 * Global settings mutations. The API rejects unknown keys, so a typo here fails
 * loudly rather than quietly creating a setting nothing reads.
 */
import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '../../../lib/api-client';

export type ActionResult = { ok: true } | { ok: false; message: string };

export async function saveSettings(
  settings: Array<{ key: string; value: Record<string, unknown> }>,
): Promise<ActionResult> {
  try {
    await apiFetch('/admin/settings', { method: 'PUT', body: { settings } });
    revalidatePath('/admin/settings');
    // Maintenance mode and the donation link are rendered in the user shell, so
    // that tree has to be revalidated too or the change appears not to apply.
    revalidatePath('/dashboard');
    return { ok: true };
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, message: error.message };
    return { ok: false, message: 'Unexpected error contacting the API' };
  }
}

export async function pruneEvents(): Promise<ActionResult> {
  try {
    await apiFetch('/admin/events/prune', { method: 'POST' });
    revalidatePath('/admin/monitoring');
    return { ok: true };
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, message: error.message };
    return { ok: false, message: 'Unexpected error contacting the API' };
  }
}
