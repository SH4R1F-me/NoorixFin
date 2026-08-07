import type { Metadata } from 'next';
import { PieChart, Target, CreditCard, BarChart3, Shield, WifiOff } from 'lucide-react';
import { FadeUp, StaggerGrid, StaggerItem, TiltCard } from '../components/motion';
import { getServerT } from '../../../lib/i18n/locale';

export const metadata: Metadata = {
  title: 'Features',
  description: 'Explore the complete suite of personal finance tools in NoorixFin.',
};

export default async function FeaturesPage() {
  const t = await getServerT();

  const FEATURES = [
    { icon: PieChart,   title: t('marketing.featuresPage.items.budgeting.title'),    desc: t('marketing.featuresPage.items.budgeting.desc') },
    { icon: Target,     title: t('marketing.featuresPage.items.goals.title'),        desc: t('marketing.featuresPage.items.goals.desc') },
    { icon: CreditCard, title: t('marketing.featuresPage.items.multiAccount.title'), desc: t('marketing.featuresPage.items.multiAccount.desc') },
    { icon: BarChart3,  title: t('marketing.featuresPage.items.reports.title'),      desc: t('marketing.featuresPage.items.reports.desc') },
    { icon: Shield,     title: t('marketing.featuresPage.items.privacy.title'),      desc: t('marketing.featuresPage.items.privacy.desc') },
    { icon: WifiOff,    title: t('marketing.featuresPage.items.offline.title'),      desc: t('marketing.featuresPage.items.offline.desc') },
  ];

  return (
    <>
      <div className="m-page-hero">
        <FadeUp>
          <div className="m-eyebrow"><span className="m-eyebrow-dot" />{t('marketing.nav.features')}</div>
          <h1 className="m-h2">{t('marketing.featuresPage.title')}</h1>
          <p className="m-lead" style={{ margin: '1rem auto 0' }}>
            {t('marketing.featuresPage.subtitle')}
          </p>
        </FadeUp>
      </div>

      <section className="m-section" style={{ paddingTop: '1rem' }}>
        <StaggerGrid className="m-grid-2">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <StaggerItem key={f.title}>
                <TiltCard>
                  <div className="m-card m-card-3d" style={{ height: '100%', display: 'flex', gap: '1.25rem', padding: '2rem' }}>
                    <div style={{ padding: '1rem', background: 'rgba(16,185,129,0.1)', borderRadius: '16px', flexShrink: 0, height: 'fit-content' }}>
                      <Icon size={28} style={{ color: 'var(--m-green)' }} />
                    </div>
                    <div>
                      <h3 className="m-h3" style={{ marginBottom: '0.5rem' }}>{f.title}</h3>
                      <p style={{ fontSize: '0.95rem', color: 'var(--m-muted)', lineHeight: 1.6 }}>{f.desc}</p>
                    </div>
                  </div>
                </TiltCard>
              </StaggerItem>
            );
          })}
        </StaggerGrid>
      </section>
    </>
  );
}
