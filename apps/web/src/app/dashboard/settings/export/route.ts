/**
 * Data export download — Blueprint §15.3, DATA-01.
 *
 * ── WHY A ROUTE HANDLER AND NOT A LINK TO THE API ────────────────────────────
 * Under DEC-009 the session cookie is httpOnly, so the browser cannot attach
 * `Authorization: Bearer`. A plain link to the API artifact would
 * arrive unauthenticated and 401 — the same reason every other API call in this
 * app goes through a Server Component or Server Action.
 *
 * ── WHY NOT A SERVER ACTION ──────────────────────────────────────────────────
 * A Server Action returns a value to React; it cannot set `Content-Disposition`
 * or hand the browser a file. Doing it in JavaScript instead — fetch, build a
 * Blob, create an object URL — means a full copy of someone's finances sits in
 * page memory, the download dies if the tab closes, and it does not work at all
 * without JS. A route handler streams straight to the browser's downloader.
 */
import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { apiFetch, apiFetchRaw, ApiError } from '../../../../lib/api-client';
import { getCurrentUser } from '../../../../lib/supabase/server';

export async function GET() {
  // Defence in depth: proxy.ts already gated /dashboard/*, but this handler
  // returns a complete copy of a user's finances and should not depend on
  // something upstream having done its job.
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const artifact = await apiFetch('/me/exports', {
      method: 'POST',
      idempotencyKey: randomUUID(),
      timeoutMs: 120_000,
    });
    const download = await apiFetchRaw(`/me/exports/${artifact.id}/download`);
    return new NextResponse(download.body, {
      headers: {
        'Content-Type': download.headers.get('content-type') ?? 'application/x-ndjson',
        'Content-Disposition':
          download.headers.get('content-disposition') ??
          `attachment; filename="noorixfin-export-${new Date().toISOString().slice(0, 10)}.ndjson"`,
        ...(download.headers.get('content-length')
          ? { 'Content-Length': download.headers.get('content-length')! }
          : {}),
        ...(download.headers.get('content-digest')
          ? { 'Content-Digest': download.headers.get('content-digest')! }
          : {}),
        ...(download.headers.get('x-checksum-sha256')
          ? { 'X-Checksum-SHA256': download.headers.get('x-checksum-sha256')! }
          : {}),
        // Never cached, anywhere. This response body is one user's entire
        // financial history; a shared cache holding it is the worst possible
        // place for it to live.
        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      },
    });
  } catch (error) {
    // No degraded or partial export is returned: a file without a verified
    // READY artifact and digest would look trustworthy while being incomplete.
    const status = error instanceof ApiError ? error.status : 503;
    return NextResponse.json(
      {
        error: 'Could not build your export right now. Nothing was changed — please try again.',
      },
      { status: status === 401 ? 401 : 503 },
    );
  }
}
