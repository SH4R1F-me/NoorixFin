/**
 * Categories repository — DEC-010.
 */
import { getDb } from '../db';

export interface CategoryRow {
  id: string;
  workspace_id: string | null;
  kind: 'INCOME' | 'EXPENSE';
  parent_id: string | null;
  translation_key: string | null;
  custom_name: string | null;
  icon: string | null;
  color: string | null;
  sort_order: number;
}

export async function listCategories(
  workspaceId: string,
  kind?: 'INCOME' | 'EXPENSE',
): Promise<CategoryRow[]> {
  const db = await getDb();
  const where = kind
    ? `AND (c.workspace_id = ? OR c.workspace_id IS NULL) AND c.kind = ?`
    : `AND (c.workspace_id = ? OR c.workspace_id IS NULL)`;
  const params = kind ? [workspaceId, kind] : [workspaceId];

  return db.getAllAsync<CategoryRow>(
    `SELECT id, workspace_id, kind, parent_id, translation_key,
            custom_name, icon, color, sort_order
     FROM categories c
     WHERE c.archived_at IS NULL ${where}
     ORDER BY c.sort_order, c.custom_name, c.translation_key`,
    params,
  );
}
