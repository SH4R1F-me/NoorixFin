'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '../../../../lib/api-client';

export type Category =
  | 'security'
  | 'budget'
  | 'goal'
  | 'recurring'
  | 'transaction'
  | 'sync'
  | 'account'
  | 'system'
  | 'operator';

export interface Preference {
  category: Category;
  in_app: boolean;
  push: boolean;
  email: boolean;
  digest: 'NONE' | 'DAILY' | 'WEEKLY';
}

export interface PreferencesPayload {
  preferences: Preference[];
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  quiet_hours_tz: string | null;
}

export async function getNotificationPreferences(): Promise<PreferencesPayload | null> {
  try {
    return await apiFetch('/me/notification-preferences');
  } catch {
    return null;
  }
}

export async function saveNotificationPreferences(payload: PreferencesPayload) {
  try {
    await apiFetch('/me/notification-preferences', { method: 'PUT', body: payload });
    revalidatePath('/dashboard/settings/notifications');
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      message:
        error instanceof ApiError ? error.message : 'Could not save notification preferences',
    };
  }
}

export async function registerWebPushDevice(input: { deviceId: string; subscription: string }) {
  try {
    const device = await apiFetch('/me/devices', {
      method: 'POST',
      body: {
        deviceId: input.deviceId,
        deviceName: 'Web browser',
        pushToken: input.subscription,
        pushProvider: 'webpush',
      },
    });
    return { ok: true as const, deviceRowId: device.id };
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof ApiError ? error.message : 'Could not register Web Push',
    };
  }
}

export async function revokeWebPushDevice(deviceRowId: string) {
  try {
    await apiFetch(`/me/devices/${deviceRowId}`, { method: 'DELETE' });
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof ApiError ? error.message : 'Could not unregister Web Push',
    };
  }
}
