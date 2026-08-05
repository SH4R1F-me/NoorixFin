'use server';

/**
 * Operator actions on user accounts.
 *
 * Every one goes through the NestJS API — which re-runs SuperAdminGuard and
 * writes an audit row — rather than touching Supabase from here. Nothing in this
 * file is a security decision; it is the transport between a form and an audited
 * endpoint.
 *
 * Results are returned as plain serialisable objects rather than thrown, so the
 * client can render an inline error without a redirect round trip (matching the
 * pattern in app/auth/actions.ts).
 */
import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '../../../lib/api-client';

export type ActionResult = { ok: true } | { ok: false; message: string };

async function run(fn: () => Promise<unknown>): Promise<ActionResult> {
  try {
    await fn();
    // The users table is server-rendered, so the new state only appears if the
    // route is revalidated — without this the operator sees a stale row and
    // reasonably concludes the action failed.
    revalidatePath('/admin/users');
    return { ok: true };
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, message: error.message };
    return { ok: false, message: 'Unexpected error contacting the API' };
  }
}

export async function suspendUser(
  userId: string,
  reason: string,
): Promise<ActionResult> {
  if (reason.trim().length < 3) {
    return { ok: false, message: 'A reason is required — it is recorded on the audit event.' };
  }
  return run(() =>
    apiFetch(`/admin/users/${userId}/suspend`, {
      method: 'POST',
      body: { reason: reason.trim() },
    }),
  );
}

export async function reinstateUser(userId: string): Promise<ActionResult> {
  return run(() => apiFetch(`/admin/users/${userId}/reinstate`, { method: 'POST' }));
}

export async function updateUserProfile(
  userId: string,
  fields: { display_name?: string; locale?: string; timezone?: string },
): Promise<ActionResult> {
  // Rebuilt field by field rather than forwarded wholesale: this is the third
  // place the allowlist is enforced (DTO and service being the other two), and
  // the one closest to the form, where an extra input would otherwise ride along.
  const payload: Record<string, string> = {};
  if (fields.display_name !== undefined) payload.display_name = fields.display_name;
  if (fields.locale !== undefined) payload.locale = fields.locale;
  if (fields.timezone !== undefined) payload.timezone = fields.timezone;

  if (Object.keys(payload).length === 0) {
    return { ok: false, message: 'Nothing to update.' };
  }

  return run(() =>
    apiFetch(`/admin/users/${userId}`, { method: 'PATCH', body: payload }),
  );
}

/**
 * Run the purge for accounts whose 30-day grace has expired.
 *
 * Irreversible, and there is no scheduler in this stack yet (DEC-017), so this
 * button is currently the only thing that executes deletions.
 */
export async function runPurge(): Promise<ActionResult> {
  return run(() => apiFetch('/admin/purge', { method: 'POST' }));
}
