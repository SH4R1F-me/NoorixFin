/**
 * WorkspaceContext — global state for the active workspace ID.
 *
 * Loaded from SecureStore on mount. If no workspace is stored the root layout
 * sends the user through the workspace-selection flow before the tabs appear.
 */
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  getActiveWorkspace,
  getActiveWorkspaceId,
  setActiveWorkspace,
  clearActiveWorkspaceId,
  type WorkspaceSummary,
} from './workspace';

interface WorkspaceContextValue {
  /** null = not yet loaded; '' = loaded but none selected */
  workspaceId: string | null;
  workspaceName: string;
  workspaceCurrency: string;
  isLoading: boolean;
  selectWorkspace: (ws: WorkspaceSummary) => Promise<void>;
  clearWorkspace: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue>({
  workspaceId: null,
  workspaceName: '',
  workspaceCurrency: 'BDT',
  isLoading: true,
  selectWorkspace: async () => {},
  clearWorkspace: async () => {},
});

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [workspaceName, setWorkspaceName] = useState('');
  const [workspaceCurrency, setWorkspaceCurrency] = useState('BDT');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void Promise.all([getActiveWorkspace(), getActiveWorkspaceId()]).then(
      ([workspace, legacyId]) => {
        setWorkspaceId(workspace?.id ?? legacyId ?? '');
        setWorkspaceName(workspace?.name ?? '');
        setWorkspaceCurrency(workspace?.base_currency ?? 'BDT');
        setIsLoading(false);
      },
    );
  }, []);

  const selectWorkspace = useCallback(async (ws: WorkspaceSummary) => {
    await setActiveWorkspace(ws);
    setWorkspaceId(ws.id);
    setWorkspaceName(ws.name);
    setWorkspaceCurrency(ws.base_currency);
  }, []);

  const clearWorkspace = useCallback(async () => {
    await clearActiveWorkspaceId();
    setWorkspaceId('');
    setWorkspaceName('');
    setWorkspaceCurrency('BDT');
  }, []);

  return (
    <WorkspaceContext.Provider
      value={{
        workspaceId,
        workspaceName,
        workspaceCurrency,
        isLoading,
        selectWorkspace,
        clearWorkspace,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  return useContext(WorkspaceContext);
}
