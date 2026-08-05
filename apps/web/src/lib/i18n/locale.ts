import 'server-only';

/**
 * Server-side locale resolution — the single source of truth (DEC-021).
 *
 * Before this, five components each held a private `useState` locale. Toggling
 * the sidebar changed the sidebar and nothing else, and a reload silently
 * discarded the choice. Every consumer now resolves through here.
 *
 * Resolution order, and why:
 *
 *   1. `profiles.locale` — the user's SAVED preference. It is the source of
 *      truth because it follows them across devices, and because Settings →
 *      Preferences already writes it. Anything else would let the sidebar and
 *      the settings page disagree, which is the bug this replaces.
 *   2. the `nf_locale` cookie — for signed-out visitors (landing, login), who
 *      have no profile, and to render the correct language on the FIRST paint
 *      after a switch rather than flashing the old one.
 *   3. `defaultLocale` ('bn') — matches the database default for the column.
 *
 * The cookie is a mirror, never the authority: when both exist the profile wins,
 * so a stale cookie on a shared machine cannot override the signed-in user's
 * preference.
 */
import { cookies } from 'next/headers';
import { cache } from 'react';
import {
  createTranslator,
  defaultLocale,
  isSupportedLocale,
  type SupportedLanguage,
  type Translator,
} from '@noorixfin/i18n';
import { getSessionContext } from '../session';

/** Name of the mirror cookie. Read by the server, written by the client. */
export const LOCALE_COOKIE = 'nf_locale';

/**
 * Wrapped in `cache()` so the layout, the page, and every nested server
 * component in one render share a single resolution — and a single `/me` call.
 */
export const getLocale = cache(async (): Promise<SupportedLanguage> => {
  const { profile } = await getSessionContext();
  if (profile && isSupportedLocale(profile.locale)) return profile.locale;

  const store = await cookies();
  const fromCookie = store.get(LOCALE_COOKIE)?.value;
  if (isSupportedLocale(fromCookie)) return fromCookie;

  return defaultLocale;
});

/**
 * A translator for server components.
 *
 * Server components cannot use React context, so they cannot read the client
 * provider — they call this instead. Both paths resolve the same locale and the
 * same catalog, so a string rendered on the server and one rendered on the
 * client can never disagree.
 */
export async function getServerT(): Promise<Translator> {
  return createTranslator(await getLocale());
}
