'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Wallet, Menu, X, ExternalLink } from 'lucide-react';
import { useLocale } from '../../../lib/i18n/locale-provider';

function GithubIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

// Nav links are built dynamically now.

export default function MarketingNavClient({
  logoUrl,
  siteName,
  translations,
}: {
  logoUrl: string | null;
  siteName: string;
  translations: {
    features: string;
    openSource: string;
    docs: string;
    community: string;
    security: string;
    donate: string;
    launchApp: string;
  };
}) {
  const NAV_LINKS = [
    { href: '/features',   label: translations.features },
    { href: '/open-source',label: translations.openSource },
    { href: '/docs',       label: translations.docs },
    { href: '/community',  label: translations.community },
    { href: '/security',   label: translations.security },
    { href: '/support',    label: translations.donate },
  ];
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const { locale, toggleLocale, otherLanguageName } = useLocale();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close the mobile menu on route change.
  //
  // Adjusted during render rather than in an effect: setState inside an effect
  // body triggers a cascading second render (and trips
  // react-hooks/set-state-in-effect, which CI treats as an error). Comparing
  // against the last SEEN pathname is the same idiom locale-provider.tsx uses
  // for re-seeding, and it cannot fight a user who just tapped the hamburger —
  // on a same-route toggle `pathname === lastPathname`, so this does not fire.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setMobileOpen(false);
  }

  return (
    <>
      <nav className={`m-nav ${scrolled ? 'm-nav--scrolled' : ''}`}>
        <div className="m-nav-inner">
          {/* Logo */}
          <Link href="/" className="m-nav-logo">
            {logoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={logoUrl} alt={siteName} className="m-nav-logo-img" />
            ) : (
              <div className="m-nav-logo-icon">
                <Wallet size={18} color="white" />
              </div>
            )}
            <span className="m-nav-logo-text">{siteName}</span>
          </Link>

          {/* Desktop links */}
          <div className="m-nav-links">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`m-nav-link ${pathname === l.href || pathname.startsWith(l.href + '/') ? 'm-nav-link--active' : ''}`}
              >
                {l.label}
              </Link>
            ))}
          </div>

          {/* Desktop actions */}
          <div className="m-nav-actions">
            <button
              onClick={toggleLocale}
              className="m-lang-btn"
              aria-label={`Switch to ${otherLanguageName}`}
              title={`Switch to ${otherLanguageName}`}
            >
              <span className="m-lang-btn-flag" aria-hidden="true">
                {locale === 'bn' ? '🇬🇧' : '🇧🇩'}
              </span>
              {otherLanguageName}
            </button>
            <a
              href="https://github.com/SH4R1F-me/NoorixFin"
              target="_blank"
              rel="noopener noreferrer"
              className="m-btn-ghost"
              style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}
            >
                            <GithubIcon size={16} />
              GitHub
            </a>
            <Link href="/auth/login" className="m-btn-primary">
              {translations.launchApp} <ExternalLink size={14} />
            </Link>
          </div>

          {/* Hamburger */}
          <button
            className="m-nav-hamburger"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            aria-controls="m-nav-mobile"
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      <div
        id="m-nav-mobile"
        className={`m-nav-mobile ${mobileOpen ? 'm-nav-mobile--open' : ''}`}
      >
        {NAV_LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="m-nav-link">{l.label}</Link>
        ))}
        <div style={{ display: 'flex', gap: '0.75rem', padding: '1rem 1rem 0.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={toggleLocale}
            className="m-lang-btn"
            style={{ flexGrow: 1, justifyContent: 'center' }}
            aria-label={`Switch to ${otherLanguageName}`}
          >
            <span aria-hidden="true">{locale === 'bn' ? '🇬🇧' : '🇧🇩'}</span>
            {otherLanguageName}
          </button>
          <a
            href="https://github.com/SH4R1F-me/NoorixFin"
            target="_blank"
            rel="noopener noreferrer"
            className="m-btn-outline"
          >
                          <GithubIcon size={16} /> GitHub
          </a>
          <Link href="/auth/login" className="m-btn-primary">{translations.launchApp}</Link>
        </div>
      </div>
    </>
  );
}
