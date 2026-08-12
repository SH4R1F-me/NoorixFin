import { createClient, getCurrentUser } from '../../../lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response('Unauthorized', { status: 401 });
  const supabase = await createClient();
  const encoder = new TextEncoder();
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let channel: ReturnType<typeof supabase.channel> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode('retry: 5000\n\n'));
      heartbeat = setInterval(() => controller.enqueue(encoder.encode(': keepalive\n\n')), 25_000);
      channel = supabase
        .channel(`notification-hints:${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notification_hints',
            filter: `user_id=eq.${user.id}`,
          },
          () => controller.enqueue(encoder.encode('event: hint\ndata: {}\n\n')),
        )
        .subscribe();
      request.signal.addEventListener(
        'abort',
        () => {
          if (heartbeat) clearInterval(heartbeat);
          if (channel) void supabase.removeChannel(channel);
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        },
        { once: true },
      );
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
      if (channel) void supabase.removeChannel(channel);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
