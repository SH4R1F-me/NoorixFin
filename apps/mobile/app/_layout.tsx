/**
 * Root layout — DEC-010.
 *
 * Responsibilities:
 * 1. Open the local SQLite database.
 * 2. Start foreground-only token refresh.
 * 3. Gate on session → sign-in if none.
 * 4. Gate on workspace → workspace selection if none.
 * 5. Wrap with WorkspaceProvider and QueryClient.
 *
 * Sessions come from SecureStore: a returning user is already signed in before
 * the first frame — they log in once and the token refreshes in the foreground.
 */
import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';
import { supabase, startAuthAutoRefresh } from '../src/lib/supabase';
import { getDb } from '../src/db';
import { WorkspaceProvider, useWorkspace } from '../src/lib/WorkspaceContext';
import {
  registerDeviceAndExistingPushPermission,
  subscribeToNotificationLifecycle,
  subscribeToNotificationHints,
} from '../src/lib/notifications';
import ForcedUpgradeGate from '../src/components/ForcedUpgradeGate';

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

function NavigationGuard({ session }: { session: Session | null }) {
  const segments = useSegments();
  const router = useRouter();
  const { workspaceId, isLoading: wsLoading } = useWorkspace();

  useEffect(() => {
    if (wsLoading) return;

    const inAuthGroup = segments[0] === 'sign-in';
    const inWsSelect = segments[0] === 'workspace-select';
    const inPairing = segments[0] === 'pair';

    if (!session) {
      if (!inAuthGroup) router.replace('/sign-in');
      return;
    }

    // Session exists but no workspace chosen
    if (session && !workspaceId && !inWsSelect && !inAuthGroup && !inPairing) {
      router.replace('/workspace-select');
      return;
    }

    // All good — go to tabs
    if (session && workspaceId && (inAuthGroup || inWsSelect)) {
      router.replace('/(tabs)');
    }
  }, [session, workspaceId, wsLoading, segments, router]);

  return null;
}

function NotificationBridge({ session }: { session: Session | null }) {
  const { workspaceId } = useWorkspace();
  useEffect(() => {
    if (!session) return;
    void registerDeviceAndExistingPushPermission();
    const stopLifecycle = subscribeToNotificationLifecycle();
    const stopHints = workspaceId
      ? subscribeToNotificationHints(session.user.id, workspaceId)
      : () => undefined;
    return () => {
      stopLifecycle();
      stopHints();
    };
  }, [session, workspaceId]);
  return null;
}

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);

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

  if (!ready) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <WorkspaceProvider>
        <NavigationGuard session={session} />
        <NotificationBridge session={session} />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="sign-in" />
          <Stack.Screen name="workspace-select" />
          <Stack.Screen name="pair" />
          <Stack.Screen
            name="notifications"
            options={{ headerShown: true, title: 'Notifications' }}
          />
          <Stack.Screen name="add-transaction" options={{ presentation: 'modal' }} />
        </Stack>
        <ForcedUpgradeGate />
      </WorkspaceProvider>
    </QueryClientProvider>
  );
}
