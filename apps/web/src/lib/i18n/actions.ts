'use server';

/**
 * Persist a language choice to the user's profile.
 *
 * The cookie written by the provider makes the switch survive a reload on this
 * device; this makes it follow the user to any device, and keeps the sidebar
 * toggle and Settings → Preferences describing the same stored value.
 *
 * Deliberately silent on failure. The language has already changed on screen and
 * in the cookie, so a failed write degrades to "preference is device-local"
 * rather than throwing an error at someone who just clicked a language toggle.
 */
import { isSupportedLocale, type SupportedLanguage } from '@noorixfin/i18n';
import { apiFetch } from '../api-client';

export async function persistLocale(locale: SupportedLanguage): Promise<void> {
  if (!isSupportedLocale(locale)) return;

  try {
    await apiFetch('/me/preferences', {
      method: 'PATCH',
      body: { locale },
    });
  } catch {
    // See the note above — the choice is already applied client-side.
  }
}
