import type { Metadata } from 'next';
import { MessageSquare, ShieldAlert } from 'lucide-react';
import { FadeUp, StaggerGrid, StaggerItem } from '../components/motion';
import { getServerT } from '../../../lib/i18n/locale';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Get in touch with the NoorixFin project.',
};

export default async function ContactPage() {
  const t = await getServerT();

  return (
    <>
      <div className="m-page-hero">
        <FadeUp>
          <div className="m-eyebrow"><span className="m-eyebrow-dot" />{t('marketing.nav.contact')}</div>
          <h1 className="m-h2">{t('marketing.contactPage.title')}</h1>
          <p className="m-lead" style={{ margin: '1rem auto 0' }}>
            {t('marketing.contactPage.subtitle')}
          </p>
        </FadeUp>
      </div>

      <section className="m-section" style={{ paddingTop: '1rem' }}>
        <StaggerGrid className="m-grid-2">
          <StaggerItem>
            <div className="m-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', height: '100%' }}>
              <MessageSquare size={32} style={{ color: 'var(--m-green)', marginBottom: '1.5rem' }} />
              <h3 className="m-h3" style={{ marginBottom: '0.5rem' }}>{t('marketing.contactPage.support')}</h3>
              <p style={{ color: 'var(--m-muted)', marginBottom: '2rem', flexGrow: 1 }}>{t('marketing.contactPage.supportDesc')}</p>
              <a href="https://github.com/SH4R1F-me/NoorixFin/discussions" target="_blank" rel="noopener noreferrer" className="m-btn-primary">
                {t('marketing.footer.discussions')}
              </a>
            </div>
          </StaggerItem>
          
          <StaggerItem>
            <div className="m-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', height: '100%', borderColor: 'rgba(239,68,68,0.2)' }}>
              <ShieldAlert size={32} style={{ color: '#ef4444', marginBottom: '1.5rem' }} />
              <h3 className="m-h3" style={{ marginBottom: '0.5rem' }}>{t('marketing.contactPage.security')}</h3>
              <p style={{ color: 'var(--m-muted)', marginBottom: '2rem', flexGrow: 1 }}>{t('marketing.contactPage.securityDesc')}</p>
              <a href="https://github.com/SH4R1F-me/NoorixFin/security/advisories/new" target="_blank" rel="noopener noreferrer" className="m-btn-outline">
                Report Vulnerability
              </a>
            </div>
          </StaggerItem>
        </StaggerGrid>
      </section>
    </>
  );
}
