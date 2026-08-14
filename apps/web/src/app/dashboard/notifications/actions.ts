'use server';

import { revalidatePath } from 'next/cache';
import type { ApiRuntimePath } from '@noorixfin/api-client';
import { apiFetch, ApiError } from '../../../lib/api-client';

export type NotificationCategory =
  | 'security'
  | 'budget'
  | 'goal'
  | 'recurring'
  | 'transaction'
  | 'sync'
  | 'account'
  | 'system'
  | 'operator';

export interface UserNotification {
  id: string;
  category: NotificationCategory;
  severity: 'INFO' | 'SUCCESS' | 'WARNING' | 'CRITICAL';
  title_en: string;
  title_bn: string | null;
  body_en: string;
  body_bn: string | null;
  action_url: string | null;
  read_at: string | null;
  archived_at: string | null;
  created_at: string;
}

export interface NotificationPage {
  items: UserNotification[];
  next_cursor: string | null;
  has_more: boolean;
}

export type ActionResult = { ok: true } | { ok: false; message: string };

export async function listNotifications(
  status: 'unread' | 'all' | 'archived' = 'all',
  category?: string,
): Promise<NotificationPage> {
  const query = new URLSearchParams({ status, limit: '100' });
  if (category) query.set('category', category);
  try {
    return await apiFetch<NotificationPage>(`/notifications?${query}`);
  } catch {
    return { items: [], next_cursor: null, has_more: false };
  }
}

async function mutate(
  path: ApiRuntimePath,
  method: 'POST' | 'DELETE' = 'POST',
): Promise<ActionResult> {
  try {
    await apiFetch<unknown>(path, { method });
    revalidatePath('/dashboard', 'layout');
    revalidatePath('/dashboard/notifications');
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof ApiError ? error.message : 'Could not update notification',
    };
  }
}

export async function markNotificationRead(id: string) {
  return mutate(`/notifications/${id}/read`);
}
export async function archiveNotification(id: string) {
  return mutate(`/notifications/${id}/archive`);
}
export async function deleteNotification(id: string) {
  return mutate(`/notifications/${id}`, 'DELETE');
}
export async function markAllNotificationsRead() {
  return mutate('/notifications/read-all');
}
