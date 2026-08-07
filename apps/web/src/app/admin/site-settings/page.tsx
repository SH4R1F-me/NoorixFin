/**
 * Admin Site Settings — server page.
 * Fetches current settings and donation options, renders client UI.
 */
import { adminGetAllSettings, adminGetDonationOptions } from '../../../lib/site-settings';
import SiteSettingsClient from './site-settings-client';

export const metadata = {
  title: 'Site Settings | Admin',
};

export default async function SiteSettingsPage() {
  const [settingsResult, donationOptions] = await Promise.all([
    adminGetAllSettings(),
    adminGetDonationOptions(),
  ]);

  const settingsMap = Object.fromEntries(
    (settingsResult.data ?? []).map((r: { key: string; value: string | null }) => [r.key, r.value]),
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

      {settingsResult.error ? (
        <div style={{ padding: '1rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, color: '#f87171', fontSize: '0.875rem' }}>
          Could not load settings: {settingsResult.error.message ?? 'Unknown error'}.<br />
          Ensure migration 00021 has been applied to your Supabase project.
        </div>
      ) : (
        <SiteSettingsClient
          currentLogoUrl={settingsMap['logo_url'] ?? null}
          donationOptions={donationOptions}
        />
      )}
    </div>
  );
}
