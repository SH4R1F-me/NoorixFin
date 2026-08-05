/**
 * Data export download — Blueprint §15.3, DATA-01.
 *
 * ── WHY A ROUTE HANDLER AND NOT A LINK TO THE API ────────────────────────────
 * Under DEC-009 the session cookie is httpOnly, so the browser cannot attach
 * `Authorization: Bearer`. A plain `<a href="http://api/v1/me/export">` would
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
import { apiFetch, ApiError } from '../../../../lib/api-client';
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
    const bundle = await apiFetch<unknown>('/me/export');
    const filename = `noorixfin-export-${new Date().toISOString().slice(0, 10)}.json`;

    return new NextResponse(JSON.stringify(bundle, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        // Never cached, anywhere. This response body is one user's entire
        // financial history; a shared cache holding it is the worst possible
        // place for it to live.
        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      },
    });
  } catch (error) {
    // The API is the only thing that can produce this file, so there is no
    // degraded version to fall back to — say so plainly rather than returning
    // an empty or partial export the user might keep and trust.
    const status = error instanceof ApiError ? error.status : 503;
    return NextResponse.json(
      {
        error: 'Could not build your export right now. Nothing was changed — please try again.',
      },
      { status: status === 401 ? 401 : 503 },
    );
  }
}
