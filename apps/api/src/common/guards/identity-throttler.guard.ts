/**
 * Rate limiting keyed on the AUTHENTICATED USER, not the IP address.
 *
 * ── THE BUG THIS FIXES ───────────────────────────────────────────────────────
 * `ThrottlerGuard` tracks by `req.ip` by default. That was survivable while one
 * global budget of 10 req/s covered everything, because no realistic set of
 * users behind one address gets near it. Audit item 14 then introduced tiers,
 * and the tight ones broke the assumption: `ThrottleSensitive` allows THREE
 * requests per minute. Keyed on IP, that means
 *
 *   - two people in the same household or office share three deletion
 *     confirmations, three password changes and three data exports a minute
 *     between them;
 *   - behind any reverse proxy that does not set `X-Forwarded-For` correctly,
 *     EVERY user shares one bucket and the whole tier collapses to a global
 *     three-per-minute — which looks exactly like an outage;
 *   - the abuse case it exists to stop — one caller hammering one account — is
 *     unaffected by moving to a different IP.
 *
 * Measured before the fix: one user's export left a DIFFERENT user's export
 * 429ing from the same loopback address.
 *
 * ── WHY THE TOKEN IS VERIFIED HERE ───────────────────────────────────────────
 * The obvious shortcut is to decode the JWT without checking its signature — it
 * is only a cache key, after all. It is not: an unverified `sub` is
 * attacker-chosen, so anyone wanting an unlimited budget would mint a new one
 * per request and get a fresh bucket every time. That is strictly worse than
 * keying on IP, because it removes the limit instead of sharing it.
 *
 * Verification is local (DEC-011) — an in-process signature check against a
 * cached JWKS, no network call — so this costs microseconds and no quota. The
 * auth guard verifies the same token again a moment later; that second check is
 * the one that decides the request, and duplicating it is far cheaper than
 * making the throttler depend on guard ordering.
 *
 * Anything unverifiable (absent, malformed, expired, or forged token, and every
 * `@Public()` route) falls back to the IP. Public endpoints have no identity to
 * key on, and a request carrying a bad token is exactly the traffic that should
 * still be bounded by where it came from.
 */
import { Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  ThrottlerGuard,
  ThrottlerStorage,
  getOptionsToken,
  getStorageToken,
} from '@nestjs/throttler';
import type { ThrottlerModuleOptions } from '@nestjs/throttler';
import { JwtVerifierService } from '../../auth/jwt-verifier.service';

@Injectable()
export class IdentityThrottlerGuard extends ThrottlerGuard {
  constructor(
    @Inject(getOptionsToken()) options: ThrottlerModuleOptions,
    @Inject(getStorageToken()) storageService: ThrottlerStorage,
    reflector: Reflector,
    private readonly jwtVerifier: JwtVerifierService,
  ) {
    super(options, storageService, reflector);
  }

  protected getTracker(req: Record<string, unknown>): Promise<string> {
    const ip =
      (typeof req.ip === 'string' && req.ip) ||
      ((req.ips as string[] | undefined)?.[0] ?? 'unknown');

    const headers = req.headers as
      Record<string, string | undefined> | undefined;
    const [scheme, token] = (headers?.authorization ?? '').split(' ');

    if (scheme !== 'Bearer' || !token) {
      return Promise.resolve(`ip:${ip}`);
    }

    return this.jwtVerifier
      .verify(token)
      .then((claims) => (claims.sub ? `user:${claims.sub}` : `ip:${ip}`))
      .catch(() => `ip:${ip}`);
  }
}
