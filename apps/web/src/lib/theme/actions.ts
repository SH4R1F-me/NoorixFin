'use server';

import { apiFetch } from '../api-client';
import { isThemePreference, type ThemePreference } from './preference';

/** Persist appearance without making a failed network write undo the local choice. */
export async function persistTheme(preference: ThemePreference): Promise<void> {
  if (!isThemePreference(preference)) return;
  try {
    await apiFetch('/me/preferences', {
      method: 'PATCH',
      body: { theme_preference: preference },
    });
  } catch {
    // Keep the current page usable. The profile remains authoritative on the
    // next signed-in load, so a failed write never pretends it was persisted.
  }
}
