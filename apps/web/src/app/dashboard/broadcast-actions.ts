'use server';

/**
 * Broadcast dismissal — records a `broadcast_receipts` row so the notice stays
 * dismissed across devices.
 *
 * Silent on failure by design: the caller fires this without awaiting, and the
 * banner has already hidden itself locally. If the write fails the notice
 * reappears on the next page load, which is the correct direction to fail for
 * something an operator wanted every user to read.
 */
import { apiFetch } from '../../lib/api-client';

export async function dismissBroadcast(broadcastId: string): Promise<void> {
  try {
    await apiFetch(`/me/broadcasts/${broadcastId}/dismiss`, { method: 'POST' });
  } catch {
    // Intentionally swallowed — see the note above.
  }
}
