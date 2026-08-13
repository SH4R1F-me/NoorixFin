import { getActiveWorkspace, getTags } from '../../../lib/workspace';
import TagsView from './tags-view';

export default async function TagsPage() {
  const workspace = await getActiveWorkspace();
  if (!workspace) return <TagsView workspaceId="" tags={[]} />;
  const tags = await getTags(workspace.id);
  return <TagsView workspaceId={workspace.id} tags={tags} />;
}
