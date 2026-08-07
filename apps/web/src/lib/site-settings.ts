/**
 * lib/site-settings.ts
 *
 * Server-side helpers for reading site_settings and donation_options.
 * These are used by marketing pages (unauthenticated) via the anon Supabase client,
 * and by admin pages via the service-role client.
 *
 * Never imported in client components — this is server-only.
 */
import 'server-only';
import { createServerClient } from '@supabase/ssr';

// ── Anon client (public marketing pages) ─────────────────────────────────────
// Uses the anon key; RLS policy "Public read" allows this.
function createAnonClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  );
}

// ── Service-role client (admin panel actions) ─────────────────────────────────
function createServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SiteSettings {
  logo_url: string | null;
  site_name: string;
}

export interface PaymentMethod {
  method: 'paypal' | 'bkash' | 'bank' | 'link';
  label: string;
  account?: string;
  url?: string;
  note?: string;
}

export interface DonationOption {
  id: string;
  type: 'development' | 'palestine';
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  color_from: string;
  color_to: string;
  is_active: boolean;
  display_order: number;
  payment_methods: PaymentMethod[];
}

// ── Public read helpers ───────────────────────────────────────────────────────

/** Read site_settings for marketing pages (anon). Cached per-request. */
export async function getSiteSettings(): Promise<SiteSettings> {
  try {
    const db = createAnonClient();
    const { data } = await db.from('site_settings').select('key, value');
    const map = Object.fromEntries((data ?? []).map((r: { key: string; value: string | null }) => [r.key, r.value]));
    return {
      logo_url: map['logo_url'] ?? null,
      site_name: map['site_name'] ?? 'NoorixFin',
    };
  } catch {
    return { logo_url: null, site_name: 'NoorixFin' };
  }
}

/** Read active donation_options ordered for the /support page (anon). */
export async function getDonationOptions(): Promise<DonationOption[]> {
  try {
    const db = createAnonClient();
    const { data } = await db
      .from('donation_options')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });
    return (data ?? []) as DonationOption[];
  } catch {
    return [];
  }
}

// ── Admin read/write helpers (service_role) ───────────────────────────────────

/** Read all site_settings rows for admin UI. */
export async function adminGetAllSettings() {
  const db = createServiceClient();
  const { data, error } = await db
    .from('site_settings')
    .select('key, value, label, description, updated_at');
  return { data, error };
}

/** Upsert a single site_setting key. */
export async function adminSetSetting(
  key: string,
  value: string | null,
  updatedBy: string,
) {
  const db = createServiceClient();
  return db
    .from('site_settings')
    .upsert({ key, value, updated_at: new Date().toISOString(), updated_by: updatedBy })
    .eq('key', key);
}

/** Read all donation_options for admin UI. */
export async function adminGetDonationOptions(): Promise<DonationOption[]> {
  const db = createServiceClient();
  const { data } = await db
    .from('donation_options')
    .select('*')
    .order('display_order', { ascending: true });
  return (data ?? []) as DonationOption[];
}

/** Update a donation_option by type. */
export async function adminUpdateDonationOption(
  type: 'development' | 'palestine',
  updates: Partial<Omit<DonationOption, 'id' | 'type' | 'created_at'>>,
) {
  const db = createServiceClient();
  return db
    .from('donation_options')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('type', type);
}
