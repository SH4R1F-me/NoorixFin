/**
 * Categories — server component (DEC-009, DEC-015).
 *
 * A category is "system-provided" iff it has a translation_key; its display
 * name is custom_name ?? the translated key. There is no `is_system` column and
 * no `name` column — that mismatch is what broke this module before DEC-015.
 */
import { getActiveWorkspace, getCategories, categoryLabel } from '../../../lib/workspace';
import CategoriesView, { type CategoryItem } from './categories-view';

export default async function CategoriesPage() {
  const workspace = await getActiveWorkspace();
  if (!workspace) return <CategoriesView categories={[]} />;

  const rows = await getCategories(workspace.id);

  const categories: CategoryItem[] = rows.map((c) => ({
    id: c.id,
    // Translation happens client-side in the full i18n pass; the key is a
    // readable fallback rather than a blank cell.
    name: categoryLabel(c),
    kind: c.kind,
    icon: c.icon,
    color: c.color,
    isSystem: Boolean(c.translation_key),
  }));

  return <CategoriesView categories={categories} />;
}
