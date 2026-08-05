'use client';

/**
 * Auth boundary.
 *
 * Home is `/auth/login`, not the dashboard: whoever is looking at this is by
 * definition not signed in yet, so offering "go to dashboard" would just bounce
 * them through the proxy back to login.
 */
import { useEffect } from 'react';
import { ErrorState } from '../../components/error-state';

export default function AuthError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error('[noorixfin] auth error', error);
  }, [error]);

  return (
    <ErrorState
      kind="crash"
      onRetry={unstable_retry}
      digest={error.digest}
      homeHref="/auth/login"
    />
  );
}
