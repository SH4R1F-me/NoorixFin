import type { Metadata } from 'next';
import { Server, ShieldCheck, Key, Shield } from 'lucide-react';
import { FadeUp, StaggerGrid, StaggerItem } from '../components/motion';
import { getServerT } from '../../../lib/i18n/locale';

export const metadata: Metadata = {
  title: 'Security & Privacy',
  description: 'How NoorixFin mathematically enforces your financial privacy.',
};

export default async function SecurityPage() {
  const t = await getServerT();

  const SECTIONS = [
    { icon: Key, title: t('marketing.securityPage.rls.title'), desc: t('marketing.securityPage.rls.desc') },
    { icon: ShieldCheck, title: t('marketing.securityPage.noTracking.title'), desc: t('marketing.securityPage.noTracking.desc') },
    { icon: Server, title: t('marketing.securityPage.encryption.title'), desc: t('marketing.securityPage.encryption.desc') },
  ];

  return (
    <>
      <div className="m-page-hero">
        <FadeUp>
          <div className="m-eyebrow"><span className="m-eyebrow-dot" />{t('marketing.nav.security')}</div>
          <h1 className="m-h2">{t('marketing.securityPage.title')}</h1>
          <p className="m-lead" style={{ margin: '1rem auto 0' }}>
            {t('marketing.securityPage.subtitle')}
          </p>
        </FadeUp>
      </div>

      <section className="m-section" style={{ paddingTop: '1rem', maxWidth: '880px', margin: '0 auto' }}>
        <StaggerGrid className="m-grid-1">
          {SECTIONS.map((s, i) => {
            const Icon = s.icon;
            return (
              <StaggerItem key={i}>
                <div className="m-card" style={{ padding: '2.5rem', display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
                  <div style={{ padding: '1.25rem', background: 'rgba(16,185,129,0.1)', borderRadius: '16px', flexShrink: 0 }}>
                    <Icon size={32} style={{ color: 'var(--m-green)' }} />
                  </div>
                  <div>
                    <h3 className="m-h3" style={{ fontSize: '1.4rem', marginBottom: '0.75rem' }}>{s.title}</h3>
                    <p style={{ color: 'var(--m-muted)', lineHeight: 1.8, fontSize: '1.05rem' }}>{s.desc}</p>
                  </div>
                </div>
              </StaggerItem>
            );
          })}
        </StaggerGrid>
      </section>
      
      <section className="m-section-full" style={{ background: 'rgba(10,15,30,0.8)', borderTop: '1px solid var(--m-border)', textAlign: 'center' }}>
        <div className="m-section-inner" style={{ maxWidth: '640px' }}>
          <FadeUp>
            <Shield size={48} style={{ color: 'var(--m-green)', margin: '0 auto 1.5rem' }} />
            <h2 className="m-h2" style={{ marginBottom: '1rem' }}>{t('marketing.securityPage.auditTitle')}</h2>
            <p className="m-lead" style={{ marginBottom: '2rem' }}>
              {t('marketing.securityPage.auditBody')}
            </p>
            <a href="https://github.com/SH4R1F-me/NoorixFin" target="_blank" rel="noopener noreferrer" className="m-btn-outline m-hero-btn-lg">
              {t('marketing.securityPage.auditCta')}
            </a>
          </FadeUp>
        </div>
      </section>
    </>
  );
}
