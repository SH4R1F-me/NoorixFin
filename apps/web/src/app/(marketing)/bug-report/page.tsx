import type { Metadata } from 'next';
import { Bug, Search, CheckCircle2 } from 'lucide-react';
import { FadeUp, StaggerGrid, StaggerItem } from '../components/motion';
import { getServerT } from '../../../lib/i18n/locale';

export const metadata: Metadata = {
  title: 'Report a Bug',
  description: 'Help us improve NoorixFin by reporting issues you find.',
};

export default async function BugReportPage() {
  const t = await getServerT();

  return (
    <>
      <div className="m-page-hero">
        <FadeUp>
          <div className="m-eyebrow"><span className="m-eyebrow-dot" />{t('marketing.footer.reportBug')}</div>
          <h1 className="m-h2">{t('marketing.bugReportPage.title')}</h1>
          <p className="m-lead" style={{ margin: '1rem auto 0', maxWidth: '720px' }}>
            {t('marketing.bugReportPage.subtitle')}
          </p>
        </FadeUp>
      </div>

      <section className="m-section" style={{ paddingTop: '1rem', maxWidth: '880px', margin: '0 auto' }}>
        <StaggerGrid className="m-grid-1">
          <StaggerItem>
            <div className="m-card" style={{ padding: '2.5rem', display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
              <div style={{ padding: '1.25rem', background: 'rgba(245,158,11,0.1)', borderRadius: '16px', flexShrink: 0 }}>
                <Search size={32} style={{ color: '#fbbf24' }} />
              </div>
              <div>
                <h3 className="m-h3" style={{ fontSize: '1.4rem', marginBottom: '0.75rem' }}>
                  {t('marketing.bugReportPage.whatIsBug')}
                </h3>
                <p style={{ color: 'var(--m-muted)', lineHeight: 1.85, fontSize: '1.1rem' }}>
                  {t('marketing.bugReportPage.whatIsBugDesc')}
                </p>
              </div>
            </div>
          </StaggerItem>

          <StaggerItem>
            <div className="m-card" style={{ padding: '2.5rem', display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
              <div style={{ padding: '1.25rem', background: 'rgba(59,130,246,0.1)', borderRadius: '16px', flexShrink: 0 }}>
                <CheckCircle2 size={32} style={{ color: '#3b82f6' }} />
              </div>
              <div>
                <h3 className="m-h3" style={{ fontSize: '1.4rem', marginBottom: '0.75rem' }}>
                  {t('marketing.bugReportPage.howToReport')}
                </h3>
                <p style={{ color: 'var(--m-muted)', lineHeight: 1.85, fontSize: '1.1rem' }}>
                  {t('marketing.bugReportPage.howToReportDesc')}
                </p>
              </div>
            </div>
          </StaggerItem>
        </StaggerGrid>
      </section>

      <section className="m-section-full" style={{ background: 'rgba(10,15,30,0.8)', borderTop: '1px solid var(--m-border)', textAlign: 'center' }}>
        <div className="m-section-inner" style={{ maxWidth: '640px' }}>
          <FadeUp>
            <Bug size={48} style={{ color: '#ef4444', margin: '0 auto 1.5rem' }} />
            <h2 className="m-h2" style={{ marginBottom: '1rem' }}>Ready to report?</h2>
            <p className="m-lead" style={{ marginBottom: '2rem' }}>
              Our developer team reads every single report submitted on GitHub.
            </p>
            <a href="https://github.com/SH4R1F-me/NoorixFin/issues/new" target="_blank" rel="noopener noreferrer" className="m-btn-primary m-hero-btn-lg">
              {t('marketing.bugReportPage.button')}
            </a>
          </FadeUp>
        </div>
      </section>
    </>
  );
}
