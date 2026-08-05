/**
 * Categories — server component (DEC-009, DEC-015).
 *
 * A category is "system-provided" iff it has a translation_key; its display
 * name is custom_name ?? the translated key. There is no `is_system` column and
 * no `name` column — that mismatch is what broke this module before DEC-015.
 */
import { getActiveWorkspace, getCategories, categoryLabel } from '../../../lib/workspace';
import { getServerT } from '../../../lib/i18n/locale';
import CategoriesView, { type CategoryItem } from './categories-view';

export default async function CategoriesPage() {
  const [workspace, t] = await Promise.all([getActiveWorkspace(), getServerT()]);
  if (!workspace) return <CategoriesView categories={[]} workspaceId="" />;

  const rows = await getCategories(workspace.id);

  const categories: CategoryItem[] = rows.map((c) => ({
    id: c.id,
    // The translator MUST be passed. Without it categoryLabel() falls back to
    // the raw key and users saw literal `cat.food_dining` in every dropdown.
    name: categoryLabel(c, t),
    kind: c.kind,
    icon: c.icon,
    color: c.color,
    isSystem: Boolean(c.translation_key),
  }));

  return <CategoriesView categories={categories} workspaceId={workspace.id} />;
}
