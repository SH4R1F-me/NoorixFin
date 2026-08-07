import type { Metadata } from 'next';
import { Heart, Coffee, ShieldCheck } from 'lucide-react';
import { FadeUp, StaggerGrid, StaggerItem } from '../components/motion';
import { getServerT } from '../../../lib/i18n/locale';

export const metadata: Metadata = {
  title: 'Support Us',
  description: 'Keep NoorixFin free for everyone by supporting our server costs.',
};

export default async function SupportPage() {
  const t = await getServerT();

  return (
    <>
      <div className="m-page-hero">
        <FadeUp>
          <div className="m-eyebrow"><span className="m-eyebrow-dot" />{t('marketing.nav.donate')}</div>
          <h1 className="m-h2">{t('marketing.supportPage.title')}</h1>
          <p className="m-lead" style={{ margin: '1rem auto 0', maxWidth: '720px' }}>
            {t('marketing.supportPage.subtitle')}
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
                <h3 className="m-h3" style={{ fontSize: '1.4rem', marginBottom: '0.75rem' }}>
                  {t('marketing.supportPage.whyDonate.title')}
                </h3>
                <p style={{ color: 'var(--m-muted)', lineHeight: 1.8, fontSize: '1.05rem' }}>
                  {t('marketing.supportPage.whyDonate.desc')}
                </p>
              </div>
            </div>
          </StaggerItem>

          <StaggerItem>
            <div className="m-card" style={{ padding: '2.5rem', display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
              <div style={{ padding: '1.25rem', background: 'rgba(16,185,129,0.1)', borderRadius: '16px', flexShrink: 0 }}>
                <ShieldCheck size={32} style={{ color: 'var(--m-green)' }} />
              </div>
              <div>
                <h3 className="m-h3" style={{ fontSize: '1.4rem', marginBottom: '0.75rem' }}>
                  {t('marketing.supportPage.perks.title')}
                </h3>
                <p style={{ color: 'var(--m-muted)', lineHeight: 1.8, fontSize: '1.05rem' }}>
                  {t('marketing.supportPage.perks.desc')}
                </p>
              </div>
            </div>
          </StaggerItem>
        </StaggerGrid>
      </section>

      <section className="m-section-full" style={{ background: 'rgba(10,15,30,0.8)', borderTop: '1px solid var(--m-border)', textAlign: 'center' }}>
        <div className="m-section-inner" style={{ maxWidth: '640px' }}>
          <FadeUp>
            <Coffee size={48} style={{ color: '#f59e0b', margin: '0 auto 1.5rem' }} />
            <h2 className="m-h2" style={{ marginBottom: '1rem' }}>Buy us a coffee</h2>
            <p className="m-lead" style={{ marginBottom: '2rem' }}>
              Every little bit helps keep the servers running.
            </p>
            <a href="https://www.buymeacoffee.com/sh4r1f" target="_blank" rel="noopener noreferrer" className="m-btn-primary m-hero-btn-lg">
              {t('marketing.supportPage.button')}
            </a>
          </FadeUp>
        </div>
      </section>
    </>
  );
}
