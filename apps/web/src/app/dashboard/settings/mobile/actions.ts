'use server';

import { apiFetch, ApiError } from '../../../../lib/api-client';

export async function createMobilePairing(workspaceId: string) {
  try {
    const data = await apiFetch<{ token: string; expires_at: string }>('/me/devices/pairing', {
      method: 'POST',
      body: { workspaceId },
    });
    return { ok: true as const, ...data };
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof ApiError ? error.message : 'Could not create pairing code',
    };
  }
}
