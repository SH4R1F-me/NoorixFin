import Link from 'next/link';
import { Wallet, Heart } from 'lucide-react';
import { getServerT } from '../../../lib/i18n/locale';
import { getSiteSettings } from '../../../lib/site-settings';

function GithubIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

export default async function MarketingFooter() {
  // The nav already renders `site_name` from the database, so a renamed
  // instance showed the new name in the header and "NoorixFin" in the footer.
  const [t, settings] = await Promise.all([getServerT(), getSiteSettings()]);
  const year = new Date().getFullYear();

  const LINKS = {
    [t('marketing.footer.product')]: [
      { href: '/features', label: t('marketing.nav.features') },
      { href: '/open-source', label: t('marketing.nav.openSource') },
      { href: '/security', label: t('marketing.nav.security') },
      { href: '/roadmap', label: t('marketing.footer.roadmap') },
      { href: '/changelog', label: t('marketing.footer.changelog') },
    ],
    [t('marketing.footer.community')]: [
      { href: '/community', label: t('marketing.nav.community') },
      { href: '/docs', label: t('marketing.nav.docs') },
      { href: '/faq', label: t('marketing.footer.faq') },
      { href: '/contact', label: t('marketing.footer.contact') },
    ],
    [t('marketing.footer.support')]: [
      { href: '/support', label: t('marketing.nav.donate') },
      { href: '/bug-report', label: t('marketing.footer.reportBug') },
      { href: '/contribute', label: t('marketing.footer.contribute') },
      { href: '/about', label: t('marketing.footer.about') },
    ],
    Download: [
      { href: '/download', label: 'iOS' },
      { href: '/download', label: 'Android' },
      { href: '/download', label: 'Direct APK' },
      { href: '/changelog', label: 'Release notes' },
      { href: '/download#requirements', label: 'System requirements' },
    ],
  };

  return (
    <footer className="m-footer">
      <div className="m-footer-inner">
        <div className="m-footer-top">
          {/* Brand */}
          <div>
            <div
              className="m-nav-logo"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.625rem',
                marginBottom: '0.75rem',
              }}
            >
              <div className="m-nav-logo-icon">
                <Wallet size={18} color="white" />
              </div>
              <span className="m-nav-logo-text">{settings.site_name}</span>
            </div>
            <p className="m-footer-brand-text">{t('marketing.footer.brandDesc')}</p>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
              <a
                href="https://github.com/SH4R1F-me/NoorixFin"
                target="_blank"
                rel="noopener noreferrer"
                className="m-footer-link"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                aria-label="GitHub"
              >
                <GithubIcon size={20} />
              </a>
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(LINKS).map(([col, links]) => (
            <div key={col}>
              <div className="m-footer-col-title">{col}</div>
              {links.map((l) => (
                <Link key={`${l.href}-${l.label}`} href={l.href} className="m-footer-link">
                  {l.label}
                </Link>
              ))}
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="m-footer-bottom">
          <p className="m-footer-copy">
            © {year} {settings.site_name}. {t('marketing.footer.builtWith')}{' '}
            <Heart
              size={12}
              style={{ display: 'inline', color: '#f87171', verticalAlign: 'middle' }}
            />{' '}
            {t('marketing.footer.inBangladesh')}
          </p>
          <div className="m-footer-badges">
            <span className="m-footer-badge m-footer-badge-green">
              {t('marketing.footer.license')}
            </span>
            <span className="m-footer-badge m-footer-badge-gray">
              {t('marketing.footer.freeForever')}
            </span>
            <span className="m-footer-badge m-footer-badge-gray">
              {t('marketing.footer.noTracking')}
            </span>
            <span className="m-footer-badge m-footer-badge-gray">{t('marketing.footer.wcag')}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
