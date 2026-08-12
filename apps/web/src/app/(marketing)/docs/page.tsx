import type { Metadata } from 'next';
import Link from 'next/link';
import {
  BookOpen,
  Rocket,
  FolderKanban,
  Target,
  Server,
  Smartphone,
  ShieldCheck,
} from 'lucide-react';
import { FadeUp, StaggerGrid, StaggerItem, TiltCard } from '../components/motion';
import { getServerT } from '../../../lib/i18n/locale';

export const metadata: Metadata = {
  title: 'Documentation',
  description: 'Simple guides on how to use NoorixFin to take control of your money.',
};

export default async function DocsPage() {
  const t = await getServerT();

  const GUIDES = [
    {
      icon: Rocket,
      title: t('marketing.docsPage.gettingStarted.title'),
      desc: t('marketing.docsPage.gettingStarted.desc'),
    },
    {
      icon: FolderKanban,
      title: t('marketing.docsPage.accounts.title'),
      desc: t('marketing.docsPage.accounts.desc'),
    },
    {
      icon: Target,
      title: t('marketing.docsPage.goals.title'),
      desc: t('marketing.docsPage.goals.desc'),
    },
    {
      icon: Server,
      title: t('marketing.docsPage.selfHost.title'),
      desc: t('marketing.docsPage.selfHost.desc'),
    },
  ];

  return (
    <>
      <div className="m-page-hero">
        <FadeUp>
          <div className="m-eyebrow">
            <span className="m-eyebrow-dot" />
            {t('marketing.nav.docs')}
          </div>
          <h1 className="m-h2">{t('marketing.docsPage.title')}</h1>
          <p className="m-lead" style={{ margin: '1rem auto 0', maxWidth: '640px' }}>
            {t('marketing.docsPage.subtitle')}
          </p>
        </FadeUp>
      </div>

      <section className="m-section" style={{ paddingTop: '1rem' }}>
        <StaggerGrid className="m-grid-2">
          {GUIDES.map((g, i) => {
            const Icon = g.icon;
            return (
              <StaggerItem key={i}>
                <TiltCard>
                  <div
                    className="m-card m-card-3d"
                    style={{
                      height: '100%',
                      padding: '2rem',
                      display: 'flex',
                      gap: '1.25rem',
                      alignItems: 'flex-start',
                    }}
                  >
                    <div
                      style={{
                        padding: '1rem',
                        background: 'rgba(16,185,129,0.1)',
                        borderRadius: '16px',
                        flexShrink: 0,
                      }}
                    >
                      <Icon size={24} style={{ color: 'var(--m-green)' }} />
                    </div>
                    <div>
                      <h3 className="m-h3" style={{ marginBottom: '0.5rem', fontSize: '1.1rem' }}>
                        {g.title}
                      </h3>
                      <p style={{ color: 'var(--m-muted)', fontSize: '0.95rem', lineHeight: 1.6 }}>
                        {g.desc}
                      </p>
                    </div>
                  </div>
                </TiltCard>
              </StaggerItem>
            );
          })}
        </StaggerGrid>
      </section>

      <section className="m-section" id="mobile-install">
        <FadeUp>
          <div
            className="m-card"
            style={{
              padding: '2rem',
              display: 'grid',
              gridTemplateColumns: 'auto 1fr',
              gap: '1.25rem',
              alignItems: 'start',
            }}
          >
            <div className="m-card-icon">
              <Smartphone size={24} />
            </div>
            <div>
              <div className="m-eyebrow">Mobile installation</div>
              <h2 className="m-h2" style={{ fontSize: '1.8rem' }}>
                Take your workspace offline
              </h2>
              <p className="m-lead" style={{ margin: '.75rem 0 1.25rem' }}>
                Install from the App Store, Google Play, or the verified direct APK. After signing
                in, open Settings → Mobile app on the web and scan its one-time pairing code.
              </p>
              <div style={{ display: 'flex', gap: '.75rem', flexWrap: 'wrap' }}>
                <Link href="/download" className="m-btn-primary">
                  Download NoorixFin
                </Link>
                <Link href="/dashboard/settings/mobile" className="m-btn-outline">
                  <ShieldCheck size={16} /> Pair a workspace
                </Link>
              </div>
            </div>
          </div>
        </FadeUp>
      </section>

      <section
        className="m-section-full"
        style={{
          background: 'rgba(10,15,30,0.8)',
          borderTop: '1px solid var(--m-border)',
          textAlign: 'center',
        }}
      >
        <div className="m-section-inner" style={{ maxWidth: '640px' }}>
          <FadeUp>
            <BookOpen size={48} style={{ color: 'var(--m-green)', margin: '0 auto 1.5rem' }} />
            <h2 className="m-h2" style={{ marginBottom: '1rem' }}>
              Full API Documentation
            </h2>
            <p className="m-lead" style={{ marginBottom: '2rem' }}>
              Building an integration or self-hosting? Read our developer documentation on GitHub.
            </p>
            <a
              href="https://github.com/SH4R1F-me/NoorixFin"
              target="_blank"
              rel="noopener noreferrer"
              className="m-btn-outline m-hero-btn-lg"
            >
              Developer Docs
            </a>
          </FadeUp>
        </div>
      </section>
    </>
  );
}
