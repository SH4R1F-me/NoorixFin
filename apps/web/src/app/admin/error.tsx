'use client';

/**
 * Operator console boundary.
 *
 * Sends the operator back to `/admin` rather than `/dashboard`: they were doing
 * platform work, and bouncing them into their personal finances mid-incident is
 * the wrong place to land. It also keeps the two halves of the dual-role design
 * (DEC-016) visibly separate even when something breaks.
 */
import { useEffect } from 'react';
import { ErrorState } from '../../components/error-state';

export default function AdminError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error('[noorixfin] admin error', error);
  }, [error]);

  return (
    <ErrorState kind="crash" onRetry={unstable_retry} digest={error.digest} homeHref="/admin" />
  );
}
