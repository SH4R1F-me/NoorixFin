import type { Metadata } from 'next';
import { Code2, Heart, Scale } from 'lucide-react';
import { FadeUp, StaggerGrid, StaggerItem } from '../components/motion';
import { getServerT } from '../../../lib/i18n/locale';

export const metadata: Metadata = {
  title: 'Open Source',
  description: 'Why NoorixFin is 100% free and MIT licensed.',
};

function GithubIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

export default async function OpenSourcePage() {
  const t = await getServerT();

  return (
    <>
      <div className="m-page-hero">
        <FadeUp>
          <div className="m-eyebrow"><span className="m-eyebrow-dot" />{t('marketing.nav.openSource')}</div>
          <h1 className="m-h2">{t('marketing.openSourcePage.title')}</h1>
          <p className="m-lead" style={{ margin: '1rem auto 0', maxWidth: '740px' }}>
            {t('marketing.openSourcePage.subtitle')}
          </p>
        </FadeUp>
      </div>

      <section className="m-section" style={{ paddingTop: '1rem', maxWidth: '880px', margin: '0 auto' }}>
        <StaggerGrid className="m-grid-1">
          <StaggerItem>
            <div className="m-card" style={{ padding: '2.5rem', display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
              <div style={{ padding: '1.25rem', background: 'rgba(239,68,68,0.1)', borderRadius: '16px', flexShrink: 0 }}>
                <Heart size={32} style={{ color: '#ef4444' }} />
              </div>
              <div>
                <p style={{ color: 'var(--m-muted)', lineHeight: 1.85, fontSize: '1.1rem' }}>
                  {t('marketing.openSourcePage.content1')}
                </p>
              </div>
            </div>
          </StaggerItem>
          
          <StaggerItem>
            <div className="m-card" style={{ padding: '2.5rem', display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
              <div style={{ padding: '1.25rem', background: 'rgba(16,185,129,0.1)', borderRadius: '16px', flexShrink: 0 }}>
                <Code2 size={32} style={{ color: 'var(--m-green)' }} />
              </div>
              <div>
                <p style={{ color: 'var(--m-muted)', lineHeight: 1.85, fontSize: '1.1rem' }}>
                  {t('marketing.openSourcePage.content2')}
                </p>
              </div>
            </div>
          </StaggerItem>
          
          <StaggerItem>
            <div className="m-card" style={{ padding: '2.5rem', display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
              <div style={{ padding: '1.25rem', background: 'rgba(59,130,246,0.1)', borderRadius: '16px', flexShrink: 0 }}>
                <Scale size={32} style={{ color: '#3b82f6' }} />
              </div>
              <div>
                <p style={{ color: 'var(--m-muted)', lineHeight: 1.85, fontSize: '1.1rem' }}>
                  {t('marketing.openSourcePage.content3')}
                </p>
              </div>
            </div>
          </StaggerItem>
        </StaggerGrid>
      </section>

      <section className="m-section-full" style={{ background: 'rgba(10,15,30,0.8)', borderTop: '1px solid var(--m-border)', textAlign: 'center' }}>
        <div className="m-section-inner" style={{ maxWidth: '640px' }}>
          <FadeUp>
            <div style={{ margin: '0 auto 1.5rem', width: 48, height: 48, display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--m-text)' }}>
              <GithubIcon size={48} />
            </div>
            <h2 className="m-h2" style={{ marginBottom: '1rem' }}>Join the Repository</h2>
            <p className="m-lead" style={{ marginBottom: '2rem' }}>
              You can star the project, read the code, or fork it to build your own version.
            </p>
            <a href="https://github.com/SH4R1F-me/NoorixFin" target="_blank" rel="noopener noreferrer" className="m-btn-outline m-hero-btn-lg">
              View on GitHub
            </a>
          </FadeUp>
        </div>
      </section>
    </>
  );
}
