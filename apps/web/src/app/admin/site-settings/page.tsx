/**
 * Admin Site Settings — server page.
 * Fetches current settings and donation options, renders client UI.
 */
import { ApiError, apiFetch } from '../../../lib/api-client';
import SiteSettingsClient from './site-settings-client';

export const metadata = {
  title: 'Site Settings | Admin',
};

export default async function SiteSettingsPage() {
  let result;
  try {
    result = await apiFetch('/admin/site-settings');
  } catch (error) {
    return (
      <div role="alert" style={{ padding: '1rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, color: '#f87171', fontSize: '0.875rem' }}>
        Could not load settings: {error instanceof ApiError ? error.message : 'Unknown error'}.
      </div>
    );
  }

  const settingsMap = Object.fromEntries(
    result.settings.map((row) => [row.key, row.value]),
  );

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.375rem', fontWeight: 700, color: '#fafaf9', marginBottom: '0.25rem' }}>
          Site Settings
        </h1>
        <p style={{ fontSize: '0.875rem', color: '#a09990' }}>
          Manage the site logo and donation page payment details. Changes are reflected immediately.
        </p>
      </div>

      <SiteSettingsClient
        currentLogoUrl={settingsMap['logo_url'] ?? null}
        donationOptions={result.donation_options}
      />
    </div>
  );
}
