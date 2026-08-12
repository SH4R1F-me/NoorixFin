import { getDb } from '../db';
import { apiFetch } from '../lib/api';
import { randomUUID } from 'expo-crypto';
import { enqueue } from '../sync/queue';

export interface NotificationRow {
  id: string;
  category: string;
  severity: string;
  title_en: string;
  title_bn: string | null;
  body_en: string;
  body_bn: string | null;
  action_url: string | null;
  read_at: string | null;
  created_at: string;
}

export async function listLocalNotifications(): Promise<NotificationRow[]> {
  const db = await getDb();
  return db.getAllAsync<NotificationRow>(
    `SELECT id, category, severity, title_en, title_bn, body_en, body_bn,
            action_url, read_at, created_at
       FROM notifications
      WHERE archived_at IS NULL AND deleted_at IS NULL
        AND (expires_at IS NULL OR expires_at > datetime('now'))
      ORDER BY created_at DESC
      LIMIT 100`,
  );
}

export async function countLocalUnreadNotifications(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM notifications WHERE read_at IS NULL AND archived_at IS NULL AND deleted_at IS NULL',
  );
  return row?.count ?? 0;
}

export async function markNotificationRead(id: string, workspaceId: string): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.runAsync('UPDATE notifications SET read_at = ?, updated_at = ? WHERE id = ?', [
    now,
    now,
    id,
  ]);
  try {
    await apiFetch(`/notifications/${id}/read`, { method: 'POST' });
  } catch {
    await enqueue(randomUUID(), workspaceId, 'READ_NOTIFICATION', { notification_id: id });
  }
}

export async function markAllNotificationsRead(workspaceId: string): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.runAsync('UPDATE notifications SET read_at = ?, updated_at = ? WHERE read_at IS NULL', [
    now,
    now,
  ]);
  try {
    await apiFetch('/notifications/read-all', { method: 'POST' });
  } catch {
    await enqueue(randomUUID(), workspaceId, 'READ_ALL_NOTIFICATIONS', {});
  }
}
