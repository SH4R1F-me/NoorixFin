/**
 * Supabase client for the mobile app — DEC-010.
 *
 * Session persists in Expo SecureStore, so the user logs in ONCE: on cold start
 * the client restores the refresh token from the keychain/keystore and silently
 * obtains a new access token.
 *
 * Note the contrast with web (DEC-009): there, httpOnly cookies mean the client
 * cannot hold a token at all. On device there is no XSS surface and SecureStore
 * is hardware-backed, so holding the token locally is the right trade — and it
 * is what makes offline-first possible, since an offline app must be able to
 * prove who it is without a server round trip.
 */
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { AppState } from 'react-native';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/**
 * SecureStore adapter.
 *
 * SecureStore rejects keys containing characters outside [A-Za-z0-9._-], and
 * supabase-js builds keys from the project URL — so the key is sanitised here
 * rather than silently failing to persist the session.
 */
const SecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(sanitize(key)),
  setItem: (key: string, value: string) =>
    SecureStore.setItemAsync(sanitize(key), value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(sanitize(key)),
};

function sanitize(key: string): string {
  return key.replace(/[^A-Za-z0-9._-]/g, '_');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: SecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    // No URL-based session detection on native — there is no address bar.
    detectSessionInUrl: false,
  },
});

/**
 * Refresh only while the app is in the foreground.
 *
 * A background timer firing refreshes on a device the user is not looking at
 * spends Supabase auth calls for nothing (DEC-011), and iOS will suspend the
 * timer unpredictably anyway. Call once from the root layout.
 */
export function startAuthAutoRefresh(): () => void {
  const subscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      void supabase.auth.startAutoRefresh();
    } else {
      void supabase.auth.stopAutoRefresh();
    }
  });

  if (AppState.currentState === 'active') {
    void supabase.auth.startAutoRefresh();
  }

  return () => {
    subscription.remove();
    void supabase.auth.stopAutoRefresh();
  };
}

/** Current access token, or null when signed out. */
export async function getAccessToken(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}
