import type { Metadata } from 'next';
import { Target, Flag, Users } from 'lucide-react';
import { FadeUp, StaggerGrid, StaggerItem } from '../components/motion';
import { getServerT } from '../../../lib/i18n/locale';

export const metadata: Metadata = {
  title: 'About Us',
  description: 'The story behind NoorixFin and our mission.',
};

export default async function AboutPage() {
  const t = await getServerT();

  return (
    <>
      <div className="m-page-hero">
        <FadeUp>
          <div className="m-eyebrow"><span className="m-eyebrow-dot" />{t('marketing.footer.about')}</div>
          <h1 className="m-h2">{t('marketing.aboutPage.title')}</h1>
          <p className="m-lead" style={{ margin: '1rem auto 0', maxWidth: '720px' }}>
            {t('marketing.aboutPage.subtitle')}
          </p>
        </FadeUp>
      </div>

      <section className="m-section" style={{ paddingTop: '1rem', maxWidth: '880px', margin: '0 auto' }}>
        <StaggerGrid className="m-grid-1">
          <StaggerItem>
            <div className="m-card" style={{ padding: '2.5rem', display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
              <div style={{ padding: '1.25rem', background: 'rgba(59,130,246,0.1)', borderRadius: '16px', flexShrink: 0 }}>
                <Target size={32} style={{ color: '#3b82f6' }} />
              </div>
              <div>
                <h3 className="m-h3" style={{ fontSize: '1.4rem', marginBottom: '0.75rem' }}>Our Story</h3>
                <p style={{ color: 'var(--m-muted)', lineHeight: 1.85, fontSize: '1.1rem' }}>
                  {t('marketing.aboutPage.story')}
                </p>
              </div>
            </div>
          </StaggerItem>

          <StaggerItem>
            <div className="m-card" style={{ padding: '2.5rem', display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
              <div style={{ padding: '1.25rem', background: 'rgba(16,185,129,0.1)', borderRadius: '16px', flexShrink: 0 }}>
                <Flag size={32} style={{ color: 'var(--m-green)' }} />
              </div>
              <div>
                <h3 className="m-h3" style={{ fontSize: '1.4rem', marginBottom: '0.75rem' }}>Our Promise</h3>
                <p style={{ color: 'var(--m-muted)', lineHeight: 1.85, fontSize: '1.1rem' }}>
                  {t('marketing.aboutPage.promise')}
                </p>
              </div>
            </div>
          </StaggerItem>
        </StaggerGrid>
      </section>

      <section className="m-section-full" style={{ background: 'rgba(10,15,30,0.8)', borderTop: '1px solid var(--m-border)', textAlign: 'center' }}>
        <div className="m-section-inner" style={{ maxWidth: '640px' }}>
          <FadeUp>
            <Users size={48} style={{ color: 'var(--m-text)', margin: '0 auto 1.5rem' }} />
            <h2 className="m-h2" style={{ marginBottom: '1rem' }}>Meet the Creator</h2>
            <p className="m-lead" style={{ marginBottom: '2rem' }}>
              NoorixFin was created by Sh4r1f, a developer passionate about privacy and financial literacy.
            </p>
            <a href="https://github.com/SH4R1F-me" target="_blank" rel="noopener noreferrer" className="m-btn-outline m-hero-btn-lg">
              Follow on GitHub
            </a>
          </FadeUp>
        </div>
      </section>
    </>
  );
}
