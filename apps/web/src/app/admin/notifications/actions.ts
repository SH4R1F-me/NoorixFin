'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '../../../lib/api-client';

export interface ComposePayload {
  audience: 'ALL' | 'OPERATORS';
  category: 'system' | 'operator';
  severity: 'INFO' | 'SUCCESS' | 'WARNING' | 'CRITICAL';
  title_en: string;
  title_bn?: string;
  body_en: string;
  body_bn?: string;
  action_url?: string;
  scheduled_for?: string;
  expires_at?: string;
}

export async function composeNotification(payload: ComposePayload) {
  try {
    const normalized = {
      ...payload,
      ...(payload.scheduled_for
        ? { scheduled_for: new Date(payload.scheduled_for).toISOString() }
        : {}),
      ...(payload.expires_at ? { expires_at: new Date(payload.expires_at).toISOString() } : {}),
    };
    await apiFetch('/admin/notifications', {
      method: 'POST',
      body: normalized,
      idempotencyKey: randomUUID(),
    });
    revalidatePath('/admin/notifications');
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof ApiError ? error.message : 'Could not compose notification',
    };
  }
}

export interface TemplatePayload {
  key: string;
  category:
    | 'security'
    | 'budget'
    | 'goal'
    | 'recurring'
    | 'transaction'
    | 'sync'
    | 'account'
    | 'system'
    | 'operator';
  title_en: string;
  title_bn?: string;
  body_en: string;
  body_bn?: string;
  action_url?: string;
}

export async function saveNotificationTemplate(payload: TemplatePayload) {
  try {
    await apiFetch('/admin/notifications/templates', {
      method: 'POST',
      body: payload,
      idempotencyKey: randomUUID(),
    });
    revalidatePath('/admin/notifications/templates');
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof ApiError ? error.message : 'Could not save template',
    };
  }
}

export async function deleteNotificationTemplate(id: string) {
  try {
    await apiFetch(`/admin/notifications/templates/${id}`, {
      method: 'DELETE',
      idempotencyKey: randomUUID(),
    });
    revalidatePath('/admin/notifications/templates');
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof ApiError ? error.message : 'Could not delete template',
    };
  }
}
