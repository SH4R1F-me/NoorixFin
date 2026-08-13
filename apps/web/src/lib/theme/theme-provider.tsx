'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from 'react';
import { persistTheme } from './actions';
import { isThemePreference, THEME_COOKIE, type ThemePreference } from './preference';

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

type ThemeContextValue = {
  preference: ThemePreference;
  setPreference: (next: ThemePreference) => void;
  isPending: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(preference: ThemePreference) {
  if (preference === 'SYSTEM') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.dataset.theme = preference.toLowerCase();
  document.documentElement.style.colorScheme =
    preference === 'SYSTEM' ? 'light dark' : preference.toLowerCase();
}

export function ThemeProvider({
  initialPreference,
  children,
}: {
  initialPreference: ThemePreference;
  children: React.ReactNode;
}) {
  const [preference, setPreferenceState] = useState(initialPreference);
  const [seededFrom, setSeededFrom] = useState(initialPreference);
  const [isPending, startTransition] = useTransition();

  if (initialPreference !== seededFrom) {
    setSeededFrom(initialPreference);
    setPreferenceState(initialPreference);
  }

  useEffect(() => applyTheme(preference), [preference]);

  const setPreference = useCallback(
    (next: ThemePreference) => {
      if (!isThemePreference(next) || next === preference) return;
      setPreferenceState(next);
      applyTheme(next);
      document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
      // Root layouts are cached across client navigation. A provider first
      // rendered on /auth/login can therefore outlive sign-in, so a boolean
      // auth prop captured there is not a safe reason to skip this write. The
      // server action reads the current request session and harmlessly no-ops
      // when signed out.
      startTransition(async () => persistTheme(next));
    },
    [preference],
  );

  const value = useMemo(
    () => ({ preference, setPreference, isPending }),
    [preference, setPreference, isPending],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme() must be used inside <ThemeProvider>');
  return value;
}
