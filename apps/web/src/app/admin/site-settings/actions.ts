'use server';

/**
 * Admin Site Settings — Server Actions
 *
 * These run server-side only. Because an exported Server Action is a mutation
 * endpoint in its own right, every action repeats the complete operator gate
 * before the service-role client is constructed. The surrounding layout is a
 * usability gate, never an authorization boundary.
 */

import { createServerClient } from '@supabase/ssr';
import { revalidatePath } from 'next/cache';
import { getSessionContext } from '../../../lib/session';
import { getMfaState } from '../../../lib/supabase/server';
import { evaluateSiteSettingsAuthorization } from './authorization';

type ActionResult = { ok: boolean; error?: string };

async function authorizeMutation(): Promise<
  { ok: true; actorId: string } | { ok: false; error: string }
> {
  const [{ profile, isSuperAdmin }, mfa] = await Promise.all([getSessionContext(), getMfaState()]);

  const decision = evaluateSiteSettingsAuthorization({
    authenticated: Boolean(profile),
    isSuperAdmin,
    status: profile?.status ?? null,
    aal2: mfa.stepped,
  });
  if (!decision.allowed) return { ok: false, error: decision.error };
  if (!profile) return { ok: false, error: 'Authentication required.' };
  return { ok: true, actorId: profile.id };
}

function serviceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  );
}

async function writeAudit(
  actorId: string,
  action: string,
  resourceType: string,
  metadata: Record<string, unknown> = {},
): Promise<boolean> {
  const { error } = await serviceClient().from('audit_events').insert({
    actor_id: actorId,
    action,
    resource_type: resourceType,
    metadata,
  });
  return !error;
}

function detectImage(
  bytes: Uint8Array,
): { extension: 'png' | 'jpg' | 'webp'; contentType: string } | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return { extension: 'png', contentType: 'image/png' };
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { extension: 'jpg', contentType: 'image/jpeg' };
  }
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  ) {
    return { extension: 'webp', contentType: 'image/webp' };
  }
  return null;
}

// ── Logo Upload ──────────────────────────────────────────────────────────────

export async function uploadLogoAction(
  formData: FormData,
): Promise<{ ok: boolean; error?: string; url?: string }> {
  const authorization = await authorizeMutation();
  if (!authorization.ok) return authorization;

  const file = formData.get('logo') as File | null;
  if (!file || file.size === 0) return { ok: false, error: 'No file provided.' };
  if (file.size > 2 * 1024 * 1024) return { ok: false, error: 'Logo must be under 2 MB.' };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const image = detectImage(bytes);
  if (!image) {
    return { ok: false, error: 'Unsupported image content. Use PNG, JPG, or WebP.' };
  }

  const db = serviceClient();
  const path = `logos/site-logo.${image.extension}`;

  const { error: uploadError } = await db.storage
    .from('site-assets')
    .upload(path, bytes, { contentType: image.contentType, upsert: true });

  if (uploadError) return { ok: false, error: uploadError.message };

  const { data: urlData } = db.storage.from('site-assets').getPublicUrl(path);
  const url = urlData.publicUrl + `?v=${Date.now()}`; // bust cache

  // Persist URL without timestamp for storage; add timestamp per-request on the frontend
  const cleanUrl = urlData.publicUrl;
  const { error: settingError } = await db
    .from('site_settings')
    .upsert({ key: 'logo_url', value: cleanUrl, updated_at: new Date().toISOString() });
  if (settingError) return { ok: false, error: settingError.message };

  const audited = await writeAudit(
    authorization.actorId,
    'ADMIN_SITE_LOGO_UPDATED',
    'site_settings',
    { content_type: image.contentType },
  );
  if (!audited)
    return { ok: false, error: 'Logo changed, but the audit record could not be written.' };

  revalidatePath('/', 'layout');
  return { ok: true, url };
}

export async function clearLogoAction(): Promise<{ ok: boolean; error?: string }> {
  const authorization = await authorizeMutation();
  if (!authorization.ok) return authorization;

  const db = serviceClient();
  const { error } = await db
    .from('site_settings')
    .update({ value: null, updated_at: new Date().toISOString() })
    .eq('key', 'logo_url');
  if (error) return { ok: false, error: error.message };
  const audited = await writeAudit(
    authorization.actorId,
    'ADMIN_SITE_LOGO_CLEARED',
    'site_settings',
  );
  if (!audited)
    return { ok: false, error: 'Logo cleared, but the audit record could not be written.' };
  revalidatePath('/', 'layout');
  return { ok: true };
}

// ── Donation Option ──────────────────────────────────────────────────────────

export async function saveDonationOptionAction(
  type: 'development' | 'palestine',
  formData: FormData,
): Promise<ActionResult> {
  const authorization = await authorizeMutation();
  if (!authorization.ok) return authorization;

  const title = String(formData.get('title') ?? '').trim();
  const subtitle = String(formData.get('subtitle') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  if (!title || title.length > 120 || subtitle.length > 240 || description.length > 2_000) {
    return { ok: false, error: 'Donation content is missing or exceeds the allowed length.' };
  }

  // payment_methods comes as a JSON string from a hidden textarea
  let paymentMethods: unknown = [];
  try {
    paymentMethods = JSON.parse((formData.get('payment_methods') as string) || '[]');
  } catch {
    return { ok: false, error: 'Invalid payment methods JSON.' };
  }

  if (!Array.isArray(paymentMethods) || paymentMethods.length > 10) {
    return { ok: false, error: 'Payment methods must be a list of at most 10 items.' };
  }
  for (const method of paymentMethods) {
    if (!method || typeof method !== 'object') {
      return { ok: false, error: 'Invalid payment method.' };
    }
    const value = method as Record<string, unknown>;
    if (!['paypal', 'bkash', 'bank', 'link'].includes(String(value.method))) {
      return { ok: false, error: 'Unsupported payment method.' };
    }
    if (
      typeof value.label !== 'string' ||
      value.label.trim().length === 0 ||
      value.label.length > 80
    ) {
      return { ok: false, error: 'Every payment method needs a valid label.' };
    }
    if (value.url) {
      try {
        const url = new URL(String(value.url));
        if (url.protocol !== 'https:') throw new Error('unsafe protocol');
      } catch {
        return { ok: false, error: 'Payment links must use HTTPS.' };
      }
    }
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
  const audited = await writeAudit(
    authorization.actorId,
    'ADMIN_DONATION_OPTION_UPDATED',
    'donation_option',
    { type },
  );
  if (!audited) {
    return {
      ok: false,
      error: 'Donation option changed, but the audit record could not be written.',
    };
  }
  revalidatePath('/support');
  return { ok: true };
}
