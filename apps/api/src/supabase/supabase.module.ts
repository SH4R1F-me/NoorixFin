/**
 * Supabase Module — Blueprint §7.3
 * Provides Supabase client instances for the API.
 * - User-context client: uses caller's Bearer token for RLS enforcement
 * - Service client: for admin/background operations only (restricted)
 */
import { Module, Global } from '@nestjs/common';
import { SupabaseService } from './supabase.service';

@Global()
@Module({
  providers: [SupabaseService],
  exports: [SupabaseService],
})
export class SupabaseModule {}
