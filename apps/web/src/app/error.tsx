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
import { useEffect, useMemo } from 'react';
import { ErrorState } from '../components/error-state';
import { clientFingerprint, reportClientError } from '../lib/observability';

export default function RootError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  // Derived during render, not stored in state: it is a pure function of
  // `error`, and setting state from an effect would cost a second render for
  // a value already knowable in the first.
  const fingerprint = useMemo(() => clientFingerprint(error, 'root-boundary'), [error]);

  useEffect(() => {
    // The server already recorded this in `system_events`; this is the client
    // half, so a browser-only failure is not invisible.
    console.error('[noorixfin] unhandled error', error);
    reportClientError(error, 'root-boundary');
  }, [error]);

  // Prefer the fingerprint over Next's digest when showing the user an id:
  // a digest is unique per build, so the same bug gets a new one every deploy
  // and support cannot match today's report to last week's. The fingerprint
  // is stable across builds and shared by everyone hitting the same bug.
  return (
    <ErrorState
      kind="crash"
      onRetry={unstable_retry}
      digest={fingerprint}
      homeHref="/"
    />
  );
}
