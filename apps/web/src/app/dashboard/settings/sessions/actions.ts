'use server';

/**
 * Sessions & Devices server actions — gap S2.
 *
 * List, revoke, and revoke-all go through the NestJS API (/v1/me/devices)
 * which enforces the RLS boundary: a user can only see and manage their own.
 */
import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '../../../../lib/api-client';

export type SessionsResult = { ok: true; message?: string } | { ok: false; message: string };

export interface UserDevice {
  id: string;
  device_id: string;
  platform: 'web' | 'ios' | 'android';
  device_name: string | null;
  os_version: string | null;
  app_version: string | null;
  last_seen_at: string;
  last_ip: string | null;
  first_seen_at: string;
  revoked_at: string | null;
}

export async function listMyDevices(): Promise<UserDevice[]> {
  try {
    return await apiFetch('/me/devices');
  } catch {
    return [];
  }
}

export async function revokeMyDevice(deviceId: string): Promise<SessionsResult> {
  try {
    await apiFetch(`/me/devices/${deviceId}`, { method: 'DELETE' });
    revalidatePath('/dashboard/settings/sessions');
    return { ok: true };
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, message: err.message };
    return { ok: false, message: 'Failed to revoke device' };
  }
}

export async function revokeAllMyDevices(currentDeviceId?: string): Promise<SessionsResult> {
  try {
    await apiFetch('/me/devices/revoke-all', {
      method: 'POST',
      body: { ...(currentDeviceId ? { currentDeviceId } : {}) },
    });
    revalidatePath('/dashboard/settings/sessions');
    return { ok: true };
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, message: err.message };
    return { ok: false, message: 'Failed to revoke all devices' };
  }
}
