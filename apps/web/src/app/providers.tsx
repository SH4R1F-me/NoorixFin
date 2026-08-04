'use client';

/**
 * Client providers — DEC-012.
 *
 * `staleTime` is tuned per resource rather than globally, and that is also a
 * Free Tier lever (DEC-011): every avoided refetch is an avoided Supabase call.
 *
 * Note on mutations under DEC-009: httpOnly cookies mean the browser cannot
 * hold a token, so mutation functions call **Server Actions**, not `fetch`
 * against the API. Optimistic updates still work normally — the optimistic
 * write happens in the query cache, the action runs on the server.
 */
import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/** Per-resource cache policy. Reference data changes rarely; ledger data does not. */
export const STALE_TIME = {
  /** Accounts and categories: edited by hand, rarely. */
  reference: 5 * 60_000,
  /** Transaction lists: the user expects their own writes to appear promptly. */
  transactions: 30_000,
  /** Derived balances and reports: never optimistic, so a short window is safe. */
  reports: 60_000,
} as const;

export function Providers({ children }: { children: React.ReactNode }) {
  // Created in state so a re-render never discards the cache.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: STALE_TIME.transactions,
            refetchOnWindowFocus: true, // the correctness path (DEC-011)
            retry: 1,
          },
          mutations: {
            // Rollback is handled per-mutation in onError; a global retry would
            // re-fire a write the user may already have been told failed.
            retry: 0,
          },
        },
      }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
