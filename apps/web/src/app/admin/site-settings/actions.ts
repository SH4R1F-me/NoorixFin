'use server';

/**
 * Site Settings mutations cross the NestJS boundary. The web process never
 * receives a Supabase service-role key; authentication, AAL2, operator status,
 * validation, storage writes, and audit records are enforced by the API.
 */
import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { ApiError, apiFetch } from '../../../lib/api-client';
import type { PaymentMethod } from '../../../lib/site-settings';

type ActionResult = { ok: boolean; error?: string; url?: string };

function failure(error: unknown, fallback: string): ActionResult {
  return { ok: false, error: error instanceof ApiError ? error.message : fallback };
}

export async function uploadLogoAction(formData: FormData): Promise<ActionResult> {
  const file = formData.get('logo');
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: 'No file provided.' };
  if (file.size > 2 * 1024 * 1024) return { ok: false, error: 'Logo must be under 2 MB.' };

  try {
    const result = await apiFetch('/admin/site-settings/logo', {
      method: 'PUT',
      body: { content_base64: Buffer.from(await file.arrayBuffer()).toString('base64') },
      idempotencyKey: randomUUID(),
      timeoutMs: 20_000,
    });
    revalidatePath('/', 'layout');
    revalidatePath('/admin/site-settings');
    return { ok: true, url: result.url ?? undefined };
  } catch (error) {
    return failure(error, 'Upload failed.');
  }
}

export async function clearLogoAction(): Promise<ActionResult> {
  try {
    await apiFetch('/admin/site-settings/logo', {
      method: 'DELETE',
      idempotencyKey: randomUUID(),
    });
    revalidatePath('/', 'layout');
    revalidatePath('/admin/site-settings');
    return { ok: true };
  } catch (error) {
    return failure(error, 'Failed to clear logo.');
  }
}

export async function saveDonationOptionAction(
  type: 'development' | 'palestine',
  formData: FormData,
): Promise<ActionResult> {
  let paymentMethods: PaymentMethod[];
  try {
    paymentMethods = JSON.parse(String(formData.get('payment_methods') ?? '[]')) as PaymentMethod[];
  } catch {
    return { ok: false, error: 'Invalid payment methods.' };
  }

  try {
    await apiFetch(`/admin/site-settings/donations/${type}`, {
      method: 'PUT',
      body: {
        title: String(formData.get('title') ?? ''),
        subtitle: String(formData.get('subtitle') ?? ''),
        description: String(formData.get('description') ?? ''),
        payment_methods: paymentMethods,
      },
      idempotencyKey: randomUUID(),
    });
    revalidatePath('/support');
    revalidatePath('/admin/site-settings');
    return { ok: true };
  } catch (error) {
    return failure(error, 'Could not save donation settings.');
  }
}
