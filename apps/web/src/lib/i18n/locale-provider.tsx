'use client';

/**
 * Client-side locale context (DEC-021).
 *
 * One provider, seeded server-side, consumed by every client component. This
 * replaces the five independent `useState` toggles that made "switch language"
 * mean five different things depending on which control you clicked.
 *
 * Switching does three things, in this order:
 *
 *   1. updates React state — the UI changes immediately, with no round trip;
 *   2. writes the `nf_locale` cookie — so the next SERVER render already knows,
 *      and the page does not flash the previous language on reload;
 *   3. persists to `profiles.locale` for signed-in users — so the choice follows
 *      them to another device, and so the sidebar toggle and Settings →
 *      Preferences can no longer disagree about what the language is.
 *
 * Step 3 is fire-and-forget: the language must not appear to "stick" only after
 * a network round trip, and a failed write leaves the cookie in place, so the
 * choice still survives a reload on this device.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';
import {
  createTranslator,
  languageNames,
  type SupportedLanguage,
  type Translator,
} from '@noorixfin/i18n';
import { persistLocale } from './actions';

export const LOCALE_COOKIE = 'nf_locale';
/** One year. The preference is not sensitive and should not expire on a whim. */
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

interface LocaleContextValue {
  locale: SupportedLanguage;
  setLocale: (next: SupportedLanguage) => void;
  toggleLocale: () => void;
  t: Translator;
  /** Name of the OTHER language, for a toggle's label. */
  otherLanguageName: string;
  isPending: boolean;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  initialLocale,
  isAuthenticated = false,
  children,
}: {
  initialLocale: SupportedLanguage;
  /** Only signed-in users have a `profiles` row to persist to. */
  isAuthenticated?: boolean;
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] = useState<SupportedLanguage>(initialLocale);
  const [isPending, startTransition] = useTransition();

  const setLocale = useCallback(
    (next: SupportedLanguage) => {
      if (next === locale) return;
      setLocaleState(next);

      // `SameSite=Lax` and no `Secure` on http: this is a display preference,
      // not a credential. It is deliberately NOT httpOnly — the client writes it
      // so the switch is instant, and the server only ever treats it as a hint
      // that the profile can override.
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;

      if (isAuthenticated) {
        startTransition(async () => {
          await persistLocale(next);
        });
      }
    },
    [locale, isAuthenticated],
  );

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale,
      toggleLocale: () => setLocale(locale === 'bn' ? 'en' : 'bn'),
      t: createTranslator(locale),
      otherLanguageName: languageNames[locale === 'bn' ? 'en' : 'bn'],
      isPending,
    }),
    [locale, setLocale, isPending],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

/**
 * Throws when used outside the provider rather than falling back to a default.
 *
 * A silent fallback is how half a UI ends up rendering in the wrong language
 * with nothing to indicate why — precisely the failure being fixed here.
 */
export function useLocale(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useLocale() must be used inside <LocaleProvider>');
  }
  return context;
}

/** Convenience for components that only need the translator. */
export function useT(): Translator {
  return useLocale().t;
}
