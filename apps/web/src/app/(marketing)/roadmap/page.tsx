import type { Metadata } from 'next';
import { Milestone } from 'lucide-react';
import { FadeUp, StaggerGrid, StaggerItem } from '../components/motion';
import { getServerT } from '../../../lib/i18n/locale';

export const metadata: Metadata = {
  title: 'Roadmap',
  description: 'See what is coming next in NoorixFin.',
};

export default async function RoadmapPage() {
  const t = await getServerT();

  return (
    <>
      <div className="m-page-hero">
        <FadeUp>
          <div className="m-eyebrow"><span className="m-eyebrow-dot" />{t('marketing.footer.roadmap')}</div>
          <h1 className="m-h2">{t('marketing.roadmapPage.title')}</h1>
          <p className="m-lead" style={{ margin: '1rem auto 0' }}>
            {t('marketing.roadmapPage.subtitle')}
          </p>
        </FadeUp>
      </div>

      <section className="m-section" style={{ paddingTop: '1rem' }}>
        <StaggerGrid className="m-grid-1">
          <StaggerItem>
            <div className="m-card" style={{ padding: '2rem', display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
              <Milestone size={32} style={{ color: 'var(--m-green)' }} />
              <div>
                <h3 className="m-h3" style={{ marginBottom: '0.25rem' }}>{t('marketing.roadmapPage.items.comingSoon')}</h3>
                <p style={{ color: 'var(--m-muted)' }}>{t('marketing.roadmapPage.items.comingSoonDesc')}</p>
              </div>
            </div>
          </StaggerItem>
        </StaggerGrid>
      </section>
    </>
  );
}
