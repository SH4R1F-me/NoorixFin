/**
 * WorkspaceContext — global state for the active workspace ID.
 *
 * Loaded from SecureStore on mount. If no workspace is stored the root layout
 * sends the user through the workspace-selection flow before the tabs appear.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import {
  getActiveWorkspaceId,
  setActiveWorkspaceId,
  clearActiveWorkspaceId,
  type WorkspaceSummary,
} from './workspace';

interface WorkspaceContextValue {
  /** null = not yet loaded; '' = loaded but none selected */
  workspaceId: string | null;
  workspaceName: string;
  isLoading: boolean;
  selectWorkspace: (ws: WorkspaceSummary) => Promise<void>;
  clearWorkspace: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue>({
  workspaceId: null,
  workspaceName: '',
  isLoading: true,
  selectWorkspace: async () => {},
  clearWorkspace: async () => {},
});

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [workspaceName, setWorkspaceName] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void getActiveWorkspaceId().then((id) => {
      setWorkspaceId(id ?? '');
      setIsLoading(false);
    });
  }, []);

  const selectWorkspace = useCallback(async (ws: WorkspaceSummary) => {
    await setActiveWorkspaceId(ws.id);
    setWorkspaceId(ws.id);
    setWorkspaceName(ws.name);
  }, []);

  const clearWorkspace = useCallback(async () => {
    await clearActiveWorkspaceId();
    setWorkspaceId('');
    setWorkspaceName('');
  }, []);

  return (
    <WorkspaceContext.Provider
      value={{ workspaceId, workspaceName, isLoading, selectWorkspace, clearWorkspace }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  return useContext(WorkspaceContext);
}
