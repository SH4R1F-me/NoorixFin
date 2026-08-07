import type { Metadata } from 'next';
import { FadeUp } from '../components/motion';
import { getServerT, getServerRawObject } from '../../../lib/i18n/locale';
import FaqClient from './faq-client';
import type { FaqItem } from './faq-client';

export const metadata: Metadata = {
  title: 'FAQ',
  description: 'Frequently asked questions about NoorixFin.',
};

export default async function FaqPage() {
  const t = await getServerT();
  const faqItems = await getServerRawObject<FaqItem[]>('marketing.faqPage.items');

  return (
    <>
      <div className="m-page-hero">
        <FadeUp>
          <div className="m-eyebrow"><span className="m-eyebrow-dot" />FAQ</div>
          <h1 className="m-h2">{t('marketing.faqPage.title')}</h1>
          <p className="m-lead" style={{ margin: '1rem auto 0' }}>
            {t('marketing.faqPage.subtitle')}
          </p>
        </FadeUp>
      </div>

      <section className="m-section" style={{ paddingTop: '1rem' }}>
        <FaqClient items={faqItems} />
      </section>
    </>
  );
}
