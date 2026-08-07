import type { Metadata } from 'next';
import { PenTool, Palette, Terminal, Sparkles } from 'lucide-react';
import { FadeUp, StaggerGrid, StaggerItem, TiltCard } from '../components/motion';
import { getServerT } from '../../../lib/i18n/locale';

export const metadata: Metadata = {
  title: 'Contribute',
  description: 'Help build the future of NoorixFin.',
};

export default async function ContributePage() {
  const t = await getServerT();

  const ROLES = [
    { icon: PenTool, title: t('marketing.contributePage.translators.title'), desc: t('marketing.contributePage.translators.desc') },
    { icon: Palette, title: t('marketing.contributePage.designers.title'), desc: t('marketing.contributePage.designers.desc') },
    { icon: Terminal, title: t('marketing.contributePage.developers.title'), desc: t('marketing.contributePage.developers.desc') },
  ];

  return (
    <>
      <div className="m-page-hero">
        <FadeUp>
          <div className="m-eyebrow"><span className="m-eyebrow-dot" />{t('marketing.footer.contribute')}</div>
          <h1 className="m-h2">{t('marketing.contributePage.title')}</h1>
          <p className="m-lead" style={{ margin: '1rem auto 0', maxWidth: '720px' }}>
            {t('marketing.contributePage.subtitle')}
          </p>
        </FadeUp>
      </div>

      <section className="m-section" style={{ paddingTop: '1rem' }}>
        <StaggerGrid className="m-grid-3">
          {ROLES.map((r, i) => {
            const Icon = r.icon;
            return (
              <StaggerItem key={i}>
                <TiltCard>
                  <div className="m-card m-card-3d" style={{ height: '100%', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', alignItems: 'center', textAlign: 'center' }}>
                    <div style={{ padding: '1rem', background: 'rgba(16,185,129,0.1)', borderRadius: '16px' }}>
                      <Icon size={32} style={{ color: 'var(--m-green)' }} />
                    </div>
                    <div>
                      <h3 className="m-h3" style={{ marginBottom: '0.75rem', fontSize: '1.2rem' }}>{r.title}</h3>
                      <p style={{ color: 'var(--m-muted)', fontSize: '1rem', lineHeight: 1.6 }}>{r.desc}</p>
                    </div>
                  </div>
                </TiltCard>
              </StaggerItem>
            );
          })}
        </StaggerGrid>
      </section>

      <section className="m-section-full" style={{ background: 'rgba(10,15,30,0.8)', borderTop: '1px solid var(--m-border)', textAlign: 'center' }}>
        <div className="m-section-inner" style={{ maxWidth: '640px' }}>
          <FadeUp>
            <Sparkles size={48} style={{ color: '#f59e0b', margin: '0 auto 1.5rem' }} />
            <h2 className="m-h2" style={{ marginBottom: '1rem' }}>Ready to start?</h2>
            <p className="m-lead" style={{ marginBottom: '2rem' }}>
              Read our friendly contribution guide on GitHub to see how you can help.
            </p>
            <a href="https://github.com/SH4R1F-me/NoorixFin/blob/main/CONTRIBUTING.md" target="_blank" rel="noopener noreferrer" className="m-btn-primary m-hero-btn-lg">
              {t('marketing.contributePage.button')}
            </a>
          </FadeUp>
        </div>
      </section>
    </>
  );
}
