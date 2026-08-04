/**
 * Supabase client for browser-side usage.
 *
 * ⚠️ THIS CLIENT CANNOT SEE THE SESSION.
 *
 * Since DEC-009 the session lives in httpOnly cookies, which JavaScript cannot
 * read by design — that is what stops an XSS from stealing a token. Anything
 * calling `createClient().auth.*` here behaves as an anonymous user.
 *
 * For auth, use the server actions in `app/auth/actions.ts`.
 * For authenticated data access, use `lib/api-client.ts` from a Server
 * Component or Server Action.
 *
 * Currently unused. Kept because W5 (Realtime invalidation hints) will need a
 * browser client — and will first have to solve how to authenticate a Realtime
 * subscription without a JS-readable token. Options to weigh then: mint a
 * short-lived token server-side and hand it to the client, subscribe on the
 * server and relay over SSE, or subscribe anonymously and rely on RLS.
 */
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
