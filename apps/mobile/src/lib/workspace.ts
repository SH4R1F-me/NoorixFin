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
const WORKSPACE_SUMMARY_KEY = 'noorixfin.active_workspace_summary';

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

/** Restore both identity and display metadata for an offline cold start. */
export async function getActiveWorkspace(): Promise<WorkspaceSummary | null> {
  try {
    const stored = await SecureStore.getItemAsync(WORKSPACE_SUMMARY_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as Partial<WorkspaceSummary>;
    if (
      typeof parsed.id !== 'string' ||
      typeof parsed.name !== 'string' ||
      typeof parsed.base_currency !== 'string'
    ) {
      return null;
    }
    return {
      id: parsed.id,
      name: parsed.name,
      base_currency: parsed.base_currency,
      created_at: typeof parsed.created_at === 'string' ? parsed.created_at : '',
    };
  } catch {
    return null;
  }
}

/** Persist the chosen workspace ID across app restarts. */
export async function setActiveWorkspace(workspace: WorkspaceSummary): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(WORKSPACE_KEY, workspace.id),
    SecureStore.setItemAsync(WORKSPACE_SUMMARY_KEY, JSON.stringify(workspace)),
  ]);
}

/** Clear the persisted workspace (used on sign-out). */
export async function clearActiveWorkspaceId(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(WORKSPACE_KEY),
    SecureStore.deleteItemAsync(WORKSPACE_SUMMARY_KEY),
  ]);
}

/** Fetch the workspaces this user is a member of. */
export async function fetchWorkspaces(): Promise<WorkspaceSummary[]> {
  return apiFetch('/workspaces');
}
