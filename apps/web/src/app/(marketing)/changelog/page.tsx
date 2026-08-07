import type { Metadata } from 'next';
import { FadeUp } from '../components/motion';
import { getServerT, getServerRawObject } from '../../../lib/i18n/locale';

export const metadata: Metadata = {
  title: 'Changelog',
  description: 'What changed, what was fixed, and what was added in each version of NoorixFin.',
};

interface Release {
  version: string;
  date: string;
  tag: string;
  highlights: string[];
}

export default async function ChangelogPage() {
  const t = await getServerT();
  const releases = await getServerRawObject<Release[]>('marketing.changelogPage.releases');

  return (
    <>
      <div className="m-page-hero">
        <FadeUp>
          <div className="m-eyebrow"><span className="m-eyebrow-dot" />{t('marketing.footer.changelog')}</div>
          <h1 className="m-h2">{t('marketing.changelogPage.title')}</h1>
          <p className="m-lead" style={{ margin: '1rem auto 0' }}>
            {t('marketing.changelogPage.subtitle')}
          </p>
        </FadeUp>
      </div>

      <section className="m-section" style={{ paddingTop: '1rem' }}>
        {releases.map((rel) => (
          <FadeUp key={rel.version}>
            <div className="m-card" style={{ marginBottom: '2rem', borderColor: 'rgba(16,185,129,0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f8fafc' }}>{rel.version}</h2>
                <span style={{ padding: '0.25rem 0.75rem', background: 'var(--m-green-dim)', color: 'var(--m-green)', borderRadius: 6, fontSize: '0.8125rem', fontWeight: 600, border: '1px solid rgba(16,185,129,0.25)' }}>
                  {rel.tag}
                </span>
                <span style={{ fontSize: '0.875rem', color: 'var(--m-muted)', marginLeft: 'auto' }}>{rel.date}</span>
              </div>

              <ul style={{ listStyle: 'none', padding: 0 }}>
                {rel.highlights.map((h, i) => (
                  <li key={i} style={{ display: 'flex', gap: '0.75rem', padding: '0.35rem 0', fontSize: '0.9rem', color: 'var(--m-muted)', lineHeight: 1.5 }}>
                    <span style={{ color: 'var(--m-green)', flexShrink: 0, fontWeight: 700 }}>+</span>
                    {h}
                  </li>
                ))}
              </ul>
            </div>
          </FadeUp>
        ))}
      </section>
    </>
  );
}
