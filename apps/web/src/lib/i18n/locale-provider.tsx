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

  // ── Re-seeding when the server's answer changes ────────────────────────────
  //
  // `useState(initialLocale)` reads the prop ONCE. This provider lives in the
  // root layout, which React keeps mounted across client-side navigations — so
  // the state it captured on the first render survives them.
  //
  // That produced a visible bug: the sign-in page renders with no session, so
  // the server resolves the default 'bn' and seeds the provider with it. Signing
  // in navigates to /dashboard client-side; the server re-renders the layout and
  // sends `initialLocale='en'` from the user's saved preference, `<html lang>`
  // updates — and the provider keeps 'bn'. The user's whole UI was in the wrong
  // language, disagreeing with its own `lang` attribute, until a hard reload.
  //
  // Comparing against the last SEEDED value rather than against `locale` is what
  // makes this safe. After a local toggle, a server render still carrying the
  // pre-toggle profile value has `initialLocale === seededFrom`, so it does not
  // fire and cannot stamp on the choice the user just made.
  const [seededFrom, setSeededFrom] = useState<SupportedLanguage>(initialLocale);
  if (initialLocale !== seededFrom) {
    setSeededFrom(initialLocale);
    setLocaleState(initialLocale);
  }

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
