'use server';

/**
 * Profile settings actions.
 *
 * Before this, the settings page was entirely `useState` — every control looked
 * functional and nothing was saved. These are the real writes.
 *
 * Preferences go through the NestJS API (DEC-005). Password and identity
 * operations live in app/auth/actions.ts because they act on the Supabase
 * session itself, not on application data.
 */
import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '../../../lib/api-client';

export type SettingsResult = { ok: true; message?: string } | { ok: false; message: string };

export interface PreferencesInput {
  display_name: string;
  locale: 'bn' | 'en';
  timezone: string;
  base_currency: string;
  week_starts_on: number;
  amount_privacy_default: boolean;
}

export async function savePreferences(input: PreferencesInput): Promise<SettingsResult> {
  try {
    await apiFetch('/me/preferences', {
      method: 'PATCH',
      body: {
        display_name: input.display_name,
        locale: input.locale,
        timezone: input.timezone,
        base_currency: input.base_currency,
        week_starts_on: input.week_starts_on,
        amount_privacy_default: input.amount_privacy_default,
      },
    });
    // The shell renders the display name and honours the locale, so the layout
    // has to re-render or the change appears not to have applied.
    revalidatePath('/dashboard', 'layout');
    return { ok: true, message: 'Preferences saved.' };
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, message: error.message };
    return { ok: false, message: 'Could not reach the API.' };
  }
}

/**
 * Request account deletion — starts the 30-day grace period (DEC-017).
 *
 * Nothing is deleted here. The account is banned and marked PENDING_DELETION;
 * data survives until the grace period expires and an operator runs the purge.
 * The API independently re-checks the typed email confirmation.
 */
export async function requestAccountDeletion(
  confirmEmail: string,
  reason: string,
): Promise<SettingsResult> {
  try {
    const result = await apiFetch(
      '/me/deletion-request',
      { method: 'POST', body: { confirm_email: confirmEmail, reason } },
    );
    return {
      ok: true,
      message: `Account scheduled for deletion on ${new Date(
        result.deletion_scheduled_for,
      ).toDateString()}. You will be signed out.`,
    };
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, message: error.message };
    return { ok: false, message: 'Could not reach the API.' };
  }
}
