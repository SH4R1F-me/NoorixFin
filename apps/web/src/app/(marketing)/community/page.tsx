import type { Metadata } from 'next';
import { MessageSquare, Lightbulb, GitMerge, Users } from 'lucide-react';
import { FadeUp, StaggerGrid, StaggerItem, TiltCard } from '../components/motion';
import { getServerT } from '../../../lib/i18n/locale';

export const metadata: Metadata = {
  title: 'Community',
  description: 'Join thousands taking control of their finances with NoorixFin.',
};

export default async function CommunityPage() {
  const t = await getServerT();

  const SECTIONS = [
    { icon: MessageSquare, title: t('marketing.communityPage.discussions.title'), desc: t('marketing.communityPage.discussions.desc') },
    { icon: Lightbulb, title: t('marketing.communityPage.feedback.title'), desc: t('marketing.communityPage.feedback.desc') },
    { icon: GitMerge, title: t('marketing.communityPage.github.title'), desc: t('marketing.communityPage.github.desc') },
  ];

  return (
    <>
      <div className="m-page-hero">
        <FadeUp>
          <div className="m-eyebrow"><span className="m-eyebrow-dot" />{t('marketing.nav.community')}</div>
          <h1 className="m-h2">{t('marketing.communityPage.title')}</h1>
          <p className="m-lead" style={{ margin: '1rem auto 0', maxWidth: '640px' }}>
            {t('marketing.communityPage.subtitle')}
          </p>
        </FadeUp>
      </div>

      <section className="m-section" style={{ paddingTop: '1rem' }}>
        <StaggerGrid className="m-grid-3">
          {SECTIONS.map((s, i) => {
            const Icon = s.icon;
            return (
              <StaggerItem key={i}>
                <TiltCard>
                  <div className="m-card m-card-3d" style={{ height: '100%', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', alignItems: 'center', textAlign: 'center' }}>
                    <div style={{ padding: '1rem', background: 'rgba(59,130,246,0.1)', borderRadius: '16px' }}>
                      <Icon size={32} style={{ color: '#3b82f6' }} />
                    </div>
                    <div>
                      <h3 className="m-h3" style={{ marginBottom: '0.75rem', fontSize: '1.2rem' }}>{s.title}</h3>
                      <p style={{ color: 'var(--m-muted)', fontSize: '1rem', lineHeight: 1.6 }}>{s.desc}</p>
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
            <Users size={48} style={{ color: 'var(--m-text)', margin: '0 auto 1.5rem' }} />
            <h2 className="m-h2" style={{ marginBottom: '1rem' }}>Join the Discussion</h2>
            <p className="m-lead" style={{ marginBottom: '2rem' }}>
              Our community lives on GitHub Discussions. Come say hi!
            </p>
            <a href="https://github.com/SH4R1F-me/NoorixFin/discussions" target="_blank" rel="noopener noreferrer" className="m-btn-primary m-hero-btn-lg">
              Open Discussions
            </a>
          </FadeUp>
        </div>
      </section>
    </>
  );
}
