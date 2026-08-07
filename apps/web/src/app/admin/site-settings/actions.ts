'use server';

/**
 * Admin Site Settings — Server Actions
 *
 * These run server-side only. They use the service-role Supabase client
 * so they can bypass RLS (admin-only operations). The route is already
 * protected by the existing admin auth guard (DEC-007: SUPER_ADMIN only).
 */

import { createServerClient } from '@supabase/ssr';
import { revalidatePath } from 'next/cache';

function serviceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  );
}

// ── Logo Upload ──────────────────────────────────────────────────────────────

export async function uploadLogoAction(formData: FormData): Promise<{ ok: boolean; error?: string; url?: string }> {
  const file = formData.get('logo') as File | null;
  if (!file || file.size === 0) return { ok: false, error: 'No file provided.' };
  if (file.size > 2 * 1024 * 1024) return { ok: false, error: 'Logo must be under 2 MB.' };

  const ext = file.name.split('.').pop()?.toLowerCase();
  if (!['png', 'jpg', 'jpeg', 'svg', 'webp'].includes(ext ?? ''))
    return { ok: false, error: 'Unsupported file type. Use PNG, JPG, SVG, or WebP.' };

  const db = serviceClient();
  const path = `logos/site-logo.${ext}`;

  const bytes = await file.arrayBuffer();
  const { error: uploadError } = await db.storage
    .from('site-assets')
    .upload(path, bytes, { contentType: file.type, upsert: true });

  if (uploadError) return { ok: false, error: uploadError.message };

  const { data: urlData } = db.storage.from('site-assets').getPublicUrl(path);
  const url = urlData.publicUrl + `?v=${Date.now()}`; // bust cache

  // Persist URL without timestamp for storage; add timestamp per-request on the frontend
  const cleanUrl = urlData.publicUrl;
  await db.from('site_settings').upsert({ key: 'logo_url', value: cleanUrl, updated_at: new Date().toISOString() });

  revalidatePath('/', 'layout');
  return { ok: true, url };
}

export async function clearLogoAction(): Promise<{ ok: boolean; error?: string }> {
  const db = serviceClient();
  const { error } = await db
    .from('site_settings')
    .update({ value: null, updated_at: new Date().toISOString() })
    .eq('key', 'logo_url');
  if (error) return { ok: false, error: error.message };
  revalidatePath('/', 'layout');
  return { ok: true };
}

// ── Donation Option ──────────────────────────────────────────────────────────

export async function saveDonationOptionAction(
  type: 'development' | 'palestine',
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const title = formData.get('title') as string;
  const subtitle = formData.get('subtitle') as string;
  const description = formData.get('description') as string;

  // payment_methods comes as a JSON string from a hidden textarea
  let paymentMethods: unknown = [];
  try {
    paymentMethods = JSON.parse((formData.get('payment_methods') as string) || '[]');
  } catch {
    return { ok: false, error: 'Invalid payment methods JSON.' };
  }

  const db = serviceClient();
  const { error } = await db
    .from('donation_options')
    .update({
      title,
      subtitle,
      description,
      payment_methods: paymentMethods,
      updated_at: new Date().toISOString(),
    })
    .eq('type', type);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/support');
  return { ok: true };
}
