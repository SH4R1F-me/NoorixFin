/**
 * Error reporting for the mobile app (audit gap R1).
 *
 * A crash on a device is the hardest failure in this system to learn about:
 * there is no server log, the user is offline as often as not, and the person
 * who could tell you is the person least able to. Everything the sync engine
 * knows about a failure currently stays on the handset.
 *
 * `EXPO_PUBLIC_*` because Expo inlines only that prefix at build time — the
 * same reason the web app threads its release through `NEXT_PUBLIC_*`. Getting
 * this right is what lets a device crash and a server 500 from the same deploy
 * carry the same release string.
 *
 * No reporter is registered by default, so this is inert until someone wires
 * one up. What it does unconditionally is compute a stable fingerprint, which
 * is what makes "sync is broken for some users" answerable.
 */
import { captureError, resolveRelease } from '@noorixfin/observability';

export const MOBILE_RELEASE = resolveRelease('mobile', {
  APP_VERSION: process.env.EXPO_PUBLIC_APP_VERSION,
  APP_COMMIT: process.env.EXPO_PUBLIC_APP_COMMIT,
  NODE_ENV: process.env.NODE_ENV,
});

/**
 * Report a device-side failure and return its fingerprint.
 *
 * Deliberately takes no user data. On this app the interesting context is
 * *which stage of sync* failed, never what was being synced — the amounts and
 * payees in that payload are exactly what must not leave the device, and the
 * redaction layer would strip them anyway.
 */
export function reportMobileError(error: unknown, context: string): string {
  return captureError(error, {
    release: MOBILE_RELEASE,
    context,
  });
}
