import { getSettings } from '../../../lib/admin';
import { ErrorState, s } from '../ui';
import SettingsView from './settings-view';

export default async function AdminSettingsPage() {
  const settings = await getSettings();

  if (!settings.ok) {
    return (
      <div>
        <div style={s.pageHeader}>
          <h1 style={s.title}>Global Settings</h1>
        </div>
        <ErrorState error={settings.error} />
      </div>
    );
  }

  return <SettingsView settings={settings.data} />;
}
