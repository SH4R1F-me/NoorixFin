/**
 * Supabase Service — Blueprint §7.3
 *
 * Two client types:
 * 1. getUserClient(token) — RLS-enforced client with caller's JWT
 * 2. getServiceClient() — admin operations only (never in regular user requests)
 *
 * service_role key never goes to client bundles, logs, or analytics (§7.3).
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);
  private readonly supabaseUrl: string;
  private readonly supabaseAnonKey: string;
  private readonly supabaseServiceKey: string;

  constructor(private readonly configService: ConfigService) {
    this.supabaseUrl = this.configService.getOrThrow<string>('SUPABASE_URL');
    this.supabaseAnonKey =
      this.configService.getOrThrow<string>('SUPABASE_ANON_KEY');
    this.supabaseServiceKey =
      this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY') || '';
  }

  /**
   * Create a request-scoped Supabase client using the caller's JWT.
   * This client operates under the caller's RLS policies.
   * Blueprint §7.3: "Regular request-এ NestJS request-scoped Supabase client"
   */
  getUserClient(accessToken: string): SupabaseClient {
    return createClient(this.supabaseUrl, this.supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });
  }

  /**
   * Service-role client — for admin/background operations ONLY.
   * Blueprint §7.3: "service_role browser/mobile bundle, public environment variable,
   * logs বা analytics-এ কখনও যাবে না"
   *
   * Do NOT use this in regular user request handlers.
   */
  getServiceClient(): SupabaseClient {
    if (!this.supabaseServiceKey) {
      this.logger.error('SUPABASE_SERVICE_ROLE_KEY not configured');
      throw new Error('Service client not available');
    }

    return createClient(this.supabaseUrl, this.supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });
  }

  /** Get the Supabase project URL */
  getSupabaseUrl(): string {
    return this.supabaseUrl;
  }

  /** Get the JWKS URL for JWT verification */
  getJwksUrl(): string {
    return `${this.supabaseUrl}/auth/v1/.well-known/jwks.json`;
  }

  /** Get the JWT secret for local development */
  getJwtSecret(): string {
    return this.configService.get<string>('SUPABASE_JWT_SECRET') || '';
  }
}
