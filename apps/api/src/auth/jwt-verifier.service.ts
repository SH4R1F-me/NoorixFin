/**
 * JWT Verifier — Blueprint §7.2, DEC-011
 *
 * Verifies Supabase access tokens **locally**, replacing the previous
 * `supabase.auth.getUser()` call in the auth guard.
 *
 * Why this matters on Free Tier: `getUser()` is a network round trip to the
 * Supabase Auth server on *every authenticated request*. That was the single
 * largest avoidable source of API calls in the system — every list, every
 * detail view, every write paid for it. Local verification makes it zero.
 *
 * ── Accepted trade-off ───────────────────────────────────────────────────────
 * Local verification proves the token was issued by Supabase and has not
 * expired. It does NOT prove the user still exists or has not been banned since
 * issuance, because it never asks the Auth server. A deleted or banned user's
 * access token therefore remains usable until it expires.
 *
 * The exposure window is one access-token TTL (Supabase default: 1 hour;
 * shorten it in project settings if that is too long for this product).
 * `signOut({ scope: 'global' })` revokes refresh tokens immediately, so the
 * session cannot be extended past that window. This is the standard stateless
 * JWT trade and is why the window should be kept short rather than eliminated.
 * If ambient revocation ever becomes a hard requirement, the fix is a short
 * deny-list checked here — not a return to per-request getUser().
 */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createRemoteJWKSet,
  jwtVerify,
  type JWTPayload,
  type JWTVerifyGetKey,
} from 'jose';
import { SupabaseService } from '../supabase/supabase.service';

export interface SupabaseJwtClaims extends JWTPayload {
  sub: string;
  email?: string;
  role?: string;
  session_id?: string;
}

@Injectable()
export class JwtVerifierService implements OnModuleInit {
  private readonly logger = new Logger(JwtVerifierService.name);

  /** Remote JWKS for asymmetric (ES256/RS256) projects. jose caches keys in
   *  memory and only refetches when it sees an unknown `kid`, with a cooldown —
   *  so this is not a per-request fetch. */
  private jwks?: JWTVerifyGetKey;

  /** Shared secret for legacy HS256 projects. */
  private hmacSecret?: Uint8Array;

  private issuer!: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService,
  ) {}

  onModuleInit() {
    this.issuer = `${this.supabaseService.getSupabaseUrl()}/auth/v1`;

    const secret = this.configService.get<string>('SUPABASE_JWT_SECRET');
    if (secret) {
      this.hmacSecret = new TextEncoder().encode(secret);
    }

    this.jwks = createRemoteJWKSet(new URL(this.supabaseService.getJwksUrl()));

    if (!secret) {
      this.logger.log('JWT verification: JWKS only (asymmetric keys)');
    } else {
      this.logger.log('JWT verification: JWKS with HS256 fallback');
    }
  }

  /**
   * Verify a Supabase access token and return its claims.
   * Throws if the signature, issuer, audience, or expiry is invalid.
   */
  async verify(token: string): Promise<SupabaseJwtClaims> {
    // Supabase projects issue either asymmetric (JWKS) or legacy HS256 tokens.
    // Try JWKS first; fall back to the shared secret only if one is configured.
    try {
      const { payload } = await jwtVerify(token, this.jwks!, {
        issuer: this.issuer,
        audience: 'authenticated',
      });
      return payload as SupabaseJwtClaims;
    } catch (jwksError) {
      if (!this.hmacSecret) throw jwksError;

      const { payload } = await jwtVerify(token, this.hmacSecret, {
        issuer: this.issuer,
        audience: 'authenticated',
      });
      return payload as SupabaseJwtClaims;
    }
  }
}
