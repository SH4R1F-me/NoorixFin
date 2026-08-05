'use client';

/**
 * Dashboard segment boundary.
 *
 * Scoped to the segment on purpose: the sidebar, the broadcast banner and the
 * user menu live in `dashboard/layout.tsx`, which sits ABOVE this boundary and
 * therefore keeps rendering. A user whose transactions page fails still has
 * working navigation to their accounts, rather than a blank document.
 */
import { useEffect } from 'react';
import { ErrorState } from '../../components/error-state';

export default function DashboardError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error('[noorixfin] dashboard error', error);
  }, [error]);

  return <ErrorState kind="crash" onRetry={unstable_retry} digest={error.digest} />;
}
