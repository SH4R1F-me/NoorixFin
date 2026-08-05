'use server';

/**
 * Broadcast composition and lifecycle.
 *
 * Compose and publish are separate calls on purpose: the API always creates a
 * broadcast as DRAFT, and publishing is its own audited action. "Write a message"
 * and "send it to every user on the platform" should never be the same click.
 */
import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '../../../lib/api-client';

export type ActionResult = { ok: true } | { ok: false; message: string };

export interface BroadcastInput {
  title_en: string;
  title_bn: string;
  body_en: string;
  body_bn: string;
  severity: string;
  audience: string;
  link_url?: string;
  expires_at?: string;
}

async function run(fn: () => Promise<unknown>): Promise<ActionResult> {
  try {
    await fn();
    revalidatePath('/admin/broadcasts');
    // A published broadcast renders in the user shell — revalidate that too, or
    // the operator publishes and sees nothing change when they switch back.
    revalidatePath('/dashboard');
    return { ok: true };
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, message: error.message };
    return { ok: false, message: 'Unexpected error contacting the API' };
  }
}

export async function createBroadcast(input: BroadcastInput): Promise<ActionResult> {
  if (!input.title_en.trim() || !input.title_bn.trim()) {
    // Enforced here as well as by the API: the app is bilingual, and a broadcast
    // in one language is unreadable to half the users it reaches.
    return { ok: false, message: 'Both the English and Bangla titles are required.' };
  }

  return run(() =>
    apiFetch('/admin/broadcasts', {
      method: 'POST',
      body: {
        title_en: input.title_en.trim(),
        title_bn: input.title_bn.trim(),
        body_en: input.body_en.trim(),
        body_bn: input.body_bn.trim(),
        severity: input.severity,
        audience: input.audience,
        ...(input.link_url?.trim() ? { link_url: input.link_url.trim() } : {}),
        ...(input.expires_at ? { expires_at: new Date(input.expires_at).toISOString() } : {}),
      },
    }),
  );
}

export async function publishBroadcast(id: string): Promise<ActionResult> {
  return run(() => apiFetch(`/admin/broadcasts/${id}/publish`, { method: 'POST' }));
}

export async function archiveBroadcast(id: string): Promise<ActionResult> {
  return run(() => apiFetch(`/admin/broadcasts/${id}/archive`, { method: 'POST' }));
}
