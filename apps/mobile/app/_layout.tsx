/**
 * Root layout — DEC-010.
 *
 * Opens the local database, starts foreground-only token refresh, and gates on
 * the session. The session comes from SecureStore, so a returning user is
 * already signed in before the first frame — they log in once (DEC-010).
 */
import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';
import { supabase, startAuthAutoRefresh } from '../src/lib/supabase';
import { getDb } from '../src/db';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Reads come from SQLite, so refetching is cheap and rarely needed.
      // Freshness is driven by the sync engine, not by query invalidation.
      staleTime: 30_000,
      retry: false,
    },
  },
});

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    let active = true;

    void (async () => {
      await getDb();
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      setSession(data.session);
      setReady(true);
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));

    const stopRefresh = startAuthAutoRefresh();

    return () => {
      active = false;
      subscription.unsubscribe();
      stopRefresh();
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const inAuthGroup = segments[0] === 'sign-in';
    if (!session && !inAuthGroup) router.replace('/sign-in');
    if (session && inAuthGroup) router.replace('/');
  }, [ready, session, segments, router]);

  if (!ready) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <Stack screenOptions={{ headerShown: false }} />
    </QueryClientProvider>
  );
}
