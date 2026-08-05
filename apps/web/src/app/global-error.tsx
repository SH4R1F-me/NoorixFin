'use client';

/**
 * Last-resort boundary — catches failures in the ROOT LAYOUT itself.
 *
 * This file replaces the root layout when it renders, so it must supply its own
 * `<html>` and `<body>`, and it cannot rely on anything the layout provides:
 * no `<LocaleProvider>`, no `Providers`, and — because it renders its own
 * document — no `globals.css`. Every style below is therefore inline, and
 * `ErrorState` reads the locale from the cookie rather than from context
 * precisely so it still works here.
 *
 * Reaching this means the layout's own data fetching threw. That is the one
 * failure the segment boundaries cannot catch, because `error.tsx` does not
 * wrap the layout above it.
 */
import { useEffect } from 'react';
import { ErrorState } from '../components/error-state';

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error('[noorixfin] root layout error', error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          background: '#0f172a',
          color: '#f8fafc',
          fontFamily:
            'system-ui, -apple-system, "Segoe UI", "Noto Sans Bengali", sans-serif',
        }}
      >
        <title>NoorixFin</title>
        <ErrorState kind="crash" onRetry={unstable_retry} digest={error.digest} homeHref="/" />
      </body>
    </html>
  );
}
