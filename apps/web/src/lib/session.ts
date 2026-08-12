import 'server-only';

/**
 * Session context — the one place the app answers "who is this, and are they an
 * operator?" (DEC-007, DEC-016).
 *
 * Wrapped in React's `cache()` so the dashboard layout, the admin layout and any
 * page in the same render all share a single `/me` round trip. Without it, every
 * component that needs the role would cost another API call on every navigation
 * — which on Free Tier is exactly the kind of avoidable traffic DEC-011 exists
 * to prevent.
 *
 * `is_super_admin` is read from the API, never from a cookie or client state: it
 * decides whether the System Admin switch renders, and a value the browser can
 * influence is not an authorization input.
 */
import { cache } from 'react';
import { apiFetch, ApiError } from './api-client';

export interface SessionProfile {
  id: string;
  display_name: string;
  avatar_path: string | null;
  locale: 'bn' | 'en';
  timezone: string;
  base_currency: string;
  week_starts_on: number;
  amount_privacy_default: boolean;
  onboarding_status: string;
  is_super_admin: boolean;
  status: 'ACTIVE' | 'SUSPENDED' | 'PENDING_DELETION';
  deletion_scheduled_for: string | null;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface SessionContext {
  profile: SessionProfile | null;
  isSuperAdmin: boolean;
  /**
   * False when the API could not be contacted at all.
   *
   * Distinct from `profile === null`, which also covers "the API answered, but
   * this request was not authorised". The shell needs the difference: an
   * unreachable API means every panel on the page is empty for a reason the
   * user did not cause, and showing empty states with no explanation would read
   * as "your data is gone" on a finance product. `false` drives the degraded
   * banner; it never affects authorization.
   */
  apiReachable: boolean;
}

export const getSessionContext = cache(async (): Promise<SessionContext> => {
  try {
    const profile = await apiFetch<SessionProfile>('/me');
    return {
      profile,
      // Defensive coercion: an API that ever returned a truthy string here must
      // not be able to turn into an operator by accident.
      isSuperAdmin: profile.is_super_admin === true,
      apiReachable: true,
    };
  } catch (error) {
    // The shell must still render for a signed-in user when the API is down —
    // they see their dashboard chrome and empty states, not a crash. Failing
    // closed on the role is the important half: no API, no admin switch.
    //
    // Since apiFetch normalises connection refusals and timeouts into
    // ApiError('API_UNREACHABLE'), this branch now genuinely catches every
    // failure. It used to re-throw the raw TypeError a refused connection
    // produced, and because this function runs in dashboard/layout.tsx that
    // single unhandled throw 500'd every dashboard route (audit finding C).
    if (error instanceof ApiError) {
      return { profile: null, isSuperAdmin: false, apiReachable: !error.isUnreachable };
    }
    throw error;
  }
});

/** Public app settings (maintenance banner, donation link, version). */
export interface PublicSettings {
  maintenance_mode?: { enabled: boolean; message_en: string; message_bn: string };
  signups_enabled?: { enabled: boolean };
  app_version?: { value: string };
  donation_url?: { value: string };
  support_email?: { value: string };
}

export const getPublicSettings = cache(async (): Promise<PublicSettings> => {
  try {
    return await apiFetch<PublicSettings>('/settings/public');
  } catch {
    // Settings are decoration on the shell. A failure here must never be the
    // reason a user cannot see their own finances.
    return {};
  }
});

export interface Broadcast {
  id: string;
  severity: 'INFO' | 'SUCCESS' | 'WARNING' | 'CRITICAL';
  title_en: string;
  title_bn: string;
  body_en: string;
  body_bn: string;
  link_url: string | null;
  dismissible: boolean;
  publish_at: string | null;
  expires_at: string | null;
}

export const getMyBroadcasts = cache(async (): Promise<Broadcast[]> => {
  try {
    return await apiFetch<Broadcast[]>('/me/broadcasts');
  } catch {
    return [];
  }
});

export const getUnreadNotificationCount = cache(async (): Promise<number> => {
  try {
    const result = await apiFetch<{ count: number }>('/notifications/unread-count');
    return Number.isFinite(result.count) ? result.count : 0;
  } catch {
    return 0;
  }
});
