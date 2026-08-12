import { getActiveWorkspace } from '../../../../lib/workspace';
import { getMobileRelease } from '../../../../lib/releases';
import { listMyDevices } from '../sessions/actions';
import MobileSettingsView from './mobile-settings-view';

export default async function MobileSettingsPage() {
  const [workspace, release, devices] = await Promise.all([
    getActiveWorkspace(),
    getMobileRelease(),
    listMyDevices(),
  ]);
  return (
    <MobileSettingsView
      workspaceId={workspace?.id ?? ''}
      workspaceName={workspace?.name ?? ''}
      release={release}
      devices={devices}
    />
  );
}
