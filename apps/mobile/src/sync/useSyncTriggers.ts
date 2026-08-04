/**
 * Sync triggers — DEC-010, DEC-011.
 *
 * Fires a sync on: app foreground, network regained, and mount. Realtime hints
 * are a fourth trigger and slot in here once W5's Realtime work lands.
 *
 * Deliberately NOT polling on a timer: a background poll spends Supabase quota
 * on a device nobody is looking at (DEC-011), and these three events cover every
 * moment the user could actually observe staleness.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { addNetworkStateListener, getNetworkStateAsync } from 'expo-network';
import { sync, type SyncState, type SyncOutcome } from './engine';
import { countPending } from './queue';

export function useSyncTriggers(workspaceId: string | null) {
  const [state, setState] = useState<SyncState>('IDLE');
  const [pending, setPending] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);
  const wasConnected = useRef(true);

  const runSync = useCallback(async () => {
    if (!workspaceId) return;
    setState('SYNCING');
    let outcome: SyncOutcome;
    try {
      outcome = await sync(workspaceId);
    } catch (error) {
      setState('ERROR');
      setLastError(error instanceof Error ? error.message : String(error));
      return;
    }
    setState(outcome.state);
    setLastError(outcome.error ?? null);
    setPending(await countPending(workspaceId));
  }, [workspaceId]);

  // Mount + foreground
  useEffect(() => {
    if (!workspaceId) return;
    void runSync();

    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void runSync();
    });
    return () => subscription.remove();
  }, [workspaceId, runSync]);

  // Network regained — only on the false→true edge, not every event.
  useEffect(() => {
    if (!workspaceId) return;

    void getNetworkStateAsync().then((s) => {
      wasConnected.current = Boolean(s.isConnected && s.isInternetReachable);
    });

    const subscription = addNetworkStateListener(({ isConnected, isInternetReachable }) => {
      const connected = Boolean(isConnected && isInternetReachable);
      if (connected && !wasConnected.current) void runSync();
      if (!connected) setState('OFFLINE');
      wasConnected.current = connected;
    });

    return () => subscription.remove();
  }, [workspaceId, runSync]);

  return { state, pending, lastError, syncNow: runSync };
}
