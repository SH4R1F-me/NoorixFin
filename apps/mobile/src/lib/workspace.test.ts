import { secureStore } from '../__tests__/mocks/expo-native';

jest.mock('./api', () => ({ apiFetch: jest.fn() }));

import { apiFetch } from './api';
import {
  clearActiveWorkspaceId,
  fetchWorkspaces,
  getActiveWorkspace,
  getActiveWorkspaceId,
  setActiveWorkspace,
  type WorkspaceSummary,
} from './workspace';

const mockFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;

const workspace: WorkspaceSummary = {
  id: '11111111-1111-1111-1111-111111111111',
  name: 'Household',
  base_currency: 'SAR',
  created_at: '2026-08-14T00:00:00.000Z',
};

beforeEach(() => {
  secureStore.clear();
  mockFetch.mockReset();
});

it('accepts the API bare-array workspace response used on first launch', async () => {
  mockFetch.mockResolvedValue([workspace] as never);

  await expect(fetchWorkspaces()).resolves.toEqual([workspace]);
  expect(mockFetch).toHaveBeenCalledWith('/workspaces');
});

it('restores workspace identity, name, and currency on a cold start', async () => {
  await setActiveWorkspace(workspace);

  await expect(getActiveWorkspaceId()).resolves.toBe(workspace.id);
  await expect(getActiveWorkspace()).resolves.toEqual(workspace);

  await clearActiveWorkspaceId();
  await expect(getActiveWorkspaceId()).resolves.toBeNull();
  await expect(getActiveWorkspace()).resolves.toBeNull();
});
