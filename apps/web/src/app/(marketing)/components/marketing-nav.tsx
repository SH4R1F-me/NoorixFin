/**
 * Marketing nav — server component.
 * Fetches logo + site name from DB, passes to client shell.
 */
import { getSiteSettings } from '../../../lib/site-settings';
import MarketingNavClient from './marketing-nav-client';
import { getServerT } from '../../../lib/i18n/locale';

export default async function MarketingNav() {
  const settings = await getSiteSettings();
  const t = await getServerT();

  const translations = {
    features: t('marketing.nav.features'),
    openSource: t('marketing.nav.openSource'),
    docs: t('marketing.nav.docs'),
    community: t('marketing.nav.community'),
    security: t('marketing.nav.security'),
    download: 'Get the app',
    donate: t('marketing.nav.donate'),
    launchApp: t('marketing.nav.launchApp'),
  };

  return (
    <MarketingNavClient
      logoUrl={settings.logo_url}
      siteName={settings.site_name}
      translations={translations}
    />
  );
}
