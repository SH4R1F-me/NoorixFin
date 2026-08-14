/**
 * SSE proxy for the live event feed (DEC-009, DEC-016).
 *
 * WHY THIS FILE EXISTS: the browser holds no access token — sessions live in
 * httpOnly cookies, deliberately, so an XSS cannot become account takeover. An
 * `EventSource` in the client therefore cannot set `Authorization: Bearer`, and
 * cannot talk to the NestJS SSE endpoint directly. This route runs on the
 * server, reads the session from the cookie, and pipes the upstream stream
 * through with the token attached.
 *
 * AUTHORIZATION: this is a data endpoint, and layouts do not protect route
 * handlers — so it does its own check. It forwards the CALLER's own token, so a
 * non-operator gets the API's 403 rather than someone else's data; the explicit
 * check below just turns that into a clean stream error instead of a dangling
 * connection.
 */
import { createClient } from '../../../../lib/supabase/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

export async function GET(request: Request) {
  const supabase = await createClient();

  // getUser() is signature-verified; getSession() below is only used to lift the
  // raw token for forwarding, never as the authorization decision itself.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return new Response('Unauthorized', { status: 401 });
  }

  const afterId = new URL(request.url).searchParams.get('afterId') ?? '0';

  let upstream: Response;
  try {
    upstream = await fetch(
      `${API_URL}/v1/admin/events/stream?afterId=${encodeURIComponent(afterId)}`,
      {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          Accept: 'text/event-stream',
        },
        // Propagate client disconnect upstream. Without this, closing the tab
        // leaves NestJS polling the database every 3 seconds for a reader that
        // no longer exists — on Free Tier that is a real cost (DEC-011).
        signal: request.signal,
        cache: 'no-store',
      },
    );
  } catch {
    return new Response('Upstream unavailable', { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    // Surface the API's own verdict — 403 here means "not an operator".
    return new Response(`Upstream error ${upstream.status}`, {
      status: upstream.status === 403 ? 403 : 502,
    });
  }

  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Tells nginx and friends not to buffer, which would defeat the point of
      // a live feed by delivering events in batches minutes apart.
      'X-Accel-Buffering': 'no',
    },
  });
}
