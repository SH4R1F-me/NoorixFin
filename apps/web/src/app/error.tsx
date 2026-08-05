'use client';

/**
 * Root segment boundary — catches anything below the root layout.
 *
 * Next 16.2 replaced `reset` with `unstable_retry`. The difference matters
 * here: `reset()` only clears the boundary's state and re-renders the same
 * (still-broken) tree, whereas `unstable_retry()` re-fetches the segment. For a
 * server-render failure — which is what almost every failure in this app is,
 * because the data fetching happens server-side — only the re-fetch can
 * actually succeed the second time.
 */
import { useEffect } from 'react';
import { ErrorState } from '../components/error-state';

export default function RootError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    // The server already recorded this in `system_events`; this is the client
    // half, so a browser-only failure is not invisible.
    console.error('[noorixfin] unhandled error', error);
  }, [error]);

  return (
    <ErrorState kind="crash" onRetry={unstable_retry} digest={error.digest} homeHref="/" />
  );
}
