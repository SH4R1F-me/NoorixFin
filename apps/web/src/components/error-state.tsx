'use client';

/**
 * The one branded failure surface — used by every `error.tsx` and `not-found.tsx`.
 *
 * Before this, the app had ZERO error boundaries. A failure anywhere rendered
 * Next's own framework error page: English-only, unbranded, and offering the
 * user nothing to do about it. On a finance product that page is actively
 * alarming, because "something broke" reads as "something broke with my money".
 *
 * So the copy here leads with what is true and reassuring — the data is in the
 * ledger, the render failed — and always offers two exits: retry, and go
 * somewhere that works.
 *
 * ── Why it does not use `useLocale()` ────────────────────────────────────────
 * `global-error.tsx` REPLACES the root layout, so `<LocaleProvider>` does not
 * exist when it renders. A hook would throw inside the very component whose job
 * is to survive a throw. `translate()` from the catalog package is a plain
 * function with no React dependency, so this component reads the locale itself
 * and works in both positions.
 */
import { useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, LayoutDashboard, PlugZap, SearchX } from 'lucide-react';
import {
  defaultLocale,
  isSupportedLocale,
  translate,
  type SupportedLanguage,
} from '@noorixfin/i18n';

/**
 * The cookie is an external store, so read it with the hook meant for external
 * stores.
 *
 * The obvious alternative — `useState(default)` plus an effect that corrects it
 * — works but is a cascading render, and React now flags it
 * (`react-hooks/set-state-in-effect`). Reading `document.cookie` during render
 * instead would hydrate mismatched, because the server has no `document`.
 *
 * `useSyncExternalStore` is built for exactly this shape: `getServerSnapshot`
 * supplies the default during SSR and hydration, `getSnapshot` reads the real
 * cookie afterwards, and React reconciles the two without a mismatch warning
 * and without an extra state update.
 */
const subscribe = () => () => {
  // Nothing to unsubscribe from: the preference cookie cannot change while an
  // error page is on screen — the app that would change it is the thing that
  // just failed.
};

function readCookieLocale(): SupportedLanguage {
  const match = /(?:^|;\s*)nf_locale=([^;]*)/.exec(document.cookie);
  const value = match?.[1];
  return isSupportedLocale(value) ? value : defaultLocale;
}

function useCookieLocale(): SupportedLanguage {
  return useSyncExternalStore(subscribe, readCookieLocale, () => defaultLocale);
}

export type ErrorKind = 'crash' | 'offline' | 'notFound';

const PRESENTATION: Record<
  ErrorKind,
  { icon: ReactNode; tint: string; titleKey: string; bodyKey: string }
> = {
  crash: {
    icon: <AlertTriangle size={30} />,
    tint: '#f59e0b',
    titleKey: 'app.couldNotLoad',
    bodyKey: 'app.couldNotLoadBody',
  },
  offline: {
    icon: <PlugZap size={30} />,
    tint: '#38bdf8',
    titleKey: 'app.offline',
    bodyKey: 'app.offlineBody',
  },
  notFound: {
    icon: <SearchX size={30} />,
    tint: '#94a3b8',
    titleKey: 'app.notFound',
    bodyKey: 'app.notFoundBody',
  },
};

export function ErrorState({
  kind = 'crash',
  onRetry,
  homeHref = '/dashboard',
  digest,
}: {
  kind?: ErrorKind;
  /** Omitted by `not-found`, where retrying the same URL cannot help. */
  onRetry?: () => void;
  homeHref?: string;
  /**
   * Next's hash of the server-side error. Surfaced because it is the only
   * handle a user can quote to support that maps to a real server log line —
   * production error messages are deliberately redacted.
   */
  digest?: string;
}) {
  const locale = useCookieLocale();
  const t = (key: string) => translate(locale, key);
  const { icon, tint, titleKey, bodyKey } = PRESENTATION[kind];

  return (
    <div style={styles.wrap} role="alert">
      <div style={styles.card}>
        <div style={{ ...styles.iconWrap, background: `${tint}1a`, color: tint }}>{icon}</div>

        <h1 style={styles.title}>{t(titleKey)}</h1>
        <p style={styles.body}>{t(bodyKey)}</p>

        <div style={styles.actions}>
          {onRetry && (
            <button type="button" onClick={onRetry} style={styles.primary}>
              <RefreshCw size={16} aria-hidden="true" />
              {t('app.tryAgain')}
            </button>
          )}
          <a href={homeHref} style={styles.secondary}>
            <LayoutDashboard size={16} aria-hidden="true" />
            {t('app.goToDashboard')}
          </a>
        </div>

        {digest && <p style={styles.digest}>Reference: {digest}</p>}
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '60vh',
    padding: '2rem 1rem',
  },
  card: {
    background: 'rgba(30,41,59,0.4)',
    border: '1px solid #1e293b',
    borderRadius: '1rem',
    padding: '2.5rem 2rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    maxWidth: 480,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: '1rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '1.25rem',
  },
  title: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#f8fafc',
    margin: 0,
  },
  body: {
    fontSize: '0.875rem',
    color: '#94a3b8',
    marginTop: '0.6rem',
    lineHeight: 1.65,
  },
  actions: {
    display: 'flex',
    gap: '0.75rem',
    marginTop: '1.75rem',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  primary: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.625rem 1.25rem',
    background: 'linear-gradient(135deg, #059669, #10b981)',
    color: 'white',
    border: 'none',
    borderRadius: '0.75rem',
    fontSize: '0.875rem',
    fontWeight: 600,
    fontFamily: 'inherit',
    cursor: 'pointer',
  },
  secondary: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.625rem 1.25rem',
    background: 'transparent',
    color: '#94a3b8',
    border: '1px solid #334155',
    borderRadius: '0.75rem',
    fontSize: '0.875rem',
    fontWeight: 600,
    textDecoration: 'none',
  },
  digest: {
    marginTop: '1.25rem',
    fontSize: '0.6875rem',
    color: '#475569',
    fontFamily: 'ui-monospace, monospace',
  },
};
