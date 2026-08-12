'use server';

import { revokeAllSessions as revokeAll, revokeSession as revokeOne } from '../../../../lib/admin';

export async function revokeSession(deviceId: string) {
  return revokeOne(deviceId);
}

export async function revokeAllSessions(userId: string) {
  return revokeAll(userId);
}
