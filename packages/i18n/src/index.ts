/**
 * @noorixfin/i18n — shared locale catalogs and the translator both apps use.
 *
 * ── WHY NOT i18next AT RUNTIME ───────────────────────────────────────────────
 * The web app is server-component-heavy: the dashboard, settings and admin pages
 * build user-facing strings during SSR, where React hooks — and therefore
 * `useTranslation()` — are unavailable. And the source of truth for a user's
 * language is `profiles.locale` in the database, not the browser, so i18next's
 * LanguageDetector would actively fight the stored preference.
 *
 * `translate()` below is a plain function: it works identically in a server
 * component, a client component, a server action, and React Native. The i18next
 * `resources` export is retained for the mobile app, which may still want the
 * react-i18next bindings.
 */

import enCommon from '../locales/en/common.json';
import bnCommon from '../locales/bn/common.json';
import enErrors from '../locales/en/errors.json';
import bnErrors from '../locales/bn/errors.json';

export const defaultNS = 'common';
export const fallbackLng = 'en';
export const supportedLngs = ['en', 'bn'] as const;
export type SupportedLanguage = (typeof supportedLngs)[number];

/** The app's default. Matches `profiles.locale`'s database default. */
export const defaultLocale: SupportedLanguage = 'bn';

export const resources = {
  en: { common: enCommon, errors: enErrors },
  bn: { common: bnCommon, errors: bnErrors },
} as const;

export const languageNames: Record<SupportedLanguage, string> = {
  en: 'English',
  bn: 'বাংলা',
};

// ─── Key typing ──────────────────────────────────────────────────────────────
//
// Derives the union of valid dotted paths from the ENGLISH catalog, so a typo
// like `t('nav.dashbord')` is a compile error rather than a string that renders
// as itself. English is the reference because `fallbackLng` is English — a key
// that exists only in Bangla would silently render its own name for half the
// users.

type Leaves<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string
    ? `${Prefix}${K}`
    : Leaves<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

export type CommonKey = Leaves<typeof enCommon>;
export type ErrorKey = Leaves<typeof enErrors>;
export type TranslationKey = CommonKey | ErrorKey;

/** Values substituted into `{{placeholders}}`. */
export type TranslationVars = Record<string, string | number>;

function lookup(catalog: unknown, path: string): string | undefined {
  const value = path
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === 'object'
          ? (node as Record<string, unknown>)[part]
          : undefined,
      catalog,
    );
  return typeof value === 'string' ? value : undefined;
}

function interpolate(template: string, vars?: TranslationVars): string {
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole,
  );
}

/**
 * Resolve a key in the given locale.
 *
 * Resolution order: requested locale → English → the key itself. Returning the
 * key is deliberate: a missing translation shows up as `nav.dashboard` in the
 * UI, which is obvious in review and in a screenshot. Returning an empty string
 * would hide the gap, and the app has already shipped one bug of exactly that
 * shape (raw `cat.food_dining` keys reaching users because a translator was
 * never passed).
 */
export function translate(
  locale: SupportedLanguage,
  key: TranslationKey | (string & {}),
  vars?: TranslationVars,
): string {
  const bundle = resources[locale] ?? resources[fallbackLng];

  const hit =
    lookup(bundle.common, key) ??
    lookup(bundle.errors, key) ??
    lookup(resources[fallbackLng].common, key) ??
    lookup(resources[fallbackLng].errors, key);

  return hit === undefined ? key : interpolate(hit, vars);
}

/** A bound translator, so components call `t('nav.dashboard')`. */
export type Translator = (
  key: TranslationKey | (string & {}),
  vars?: TranslationVars,
) => string;

export function createTranslator(locale: SupportedLanguage): Translator {
  return (key, vars) => translate(locale, key, vars);
}

export function isSupportedLocale(value: unknown): value is SupportedLanguage {
  return (
    typeof value === 'string' &&
    (supportedLngs as readonly string[]).includes(value)
  );
}

/**
 * The BCP-47 tag to hand `Intl` for a locale.
 *
 * Bangla resolves to `bn-BD`, which gives Bengali digits and the South Asian
 * lakh/crore grouping a Bangladeshi reader expects — `১,২৫,৪৮০.০০` rather than
 * `125,480.00`. This is why formatting must follow the active language instead
 * of the hardcoded `'en-BD'` the dashboard used to pass.
 */
export const intlLocale: Record<SupportedLanguage, string> = {
  en: 'en-BD',
  bn: 'bn-BD',
};

export { enCommon, bnCommon, enErrors, bnErrors };
