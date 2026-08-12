/**
 * Workspace selection persistence — DEC-010.
 *
 * Replaces the hardcoded EXPO_PUBLIC_DEV_WORKSPACE_ID env var (Finding A).
 * The selected workspace is stored in SecureStore so it survives app restarts
 * without a network round-trip. On first launch (no stored selection) the app
 * fetches the user's workspaces and lets them pick.
 *
 * There is deliberately no environment-variable fallback. A build that can
 * silently select a developer's workspace is not a build that can be handed to
 * a real user; first launch always goes through the selection screen.
 */
import * as SecureStore from 'expo-secure-store';
import { apiFetch } from './api';

const WORKSPACE_KEY = 'noorixfin.active_workspace_id';

/** Workspace summary returned by GET /v1/workspaces */
export interface WorkspaceSummary {
  id: string;
  name: string;
  base_currency: string;
  created_at: string;
}

/** Returns the persisted workspace ID or null. */
export async function getActiveWorkspaceId(): Promise<string | null> {
  try {
    const stored = await SecureStore.getItemAsync(WORKSPACE_KEY);
    if (stored) return stored;
    return null;
  } catch {
    return null;
  }
}

/** Persist the chosen workspace ID across app restarts. */
export async function setActiveWorkspaceId(id: string): Promise<void> {
  await SecureStore.setItemAsync(WORKSPACE_KEY, id);
}

/** Clear the persisted workspace (used on sign-out). */
export async function clearActiveWorkspaceId(): Promise<void> {
  await SecureStore.deleteItemAsync(WORKSPACE_KEY);
}

/** Fetch the workspaces this user is a member of. */
export async function fetchWorkspaces(): Promise<WorkspaceSummary[]> {
  const result = await apiFetch<{ items: WorkspaceSummary[] }>(
    '/workspaces',
  );
  return result.items;
}
