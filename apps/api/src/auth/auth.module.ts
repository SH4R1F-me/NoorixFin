/**
 * Auth Module — Blueprint §7.2
 * Local JWT verification (DEC-011) and authentication guard.
 */
import { Module } from '@nestjs/common';
import { SupabaseAuthGuard } from './guards/supabase-auth.guard';
import { JwtVerifierService } from './jwt-verifier.service';

@Module({
  providers: [JwtVerifierService, SupabaseAuthGuard],
  exports: [JwtVerifierService, SupabaseAuthGuard],
})
export class AuthModule {}
