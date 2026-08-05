/**
 * SuperAdmin Guard — DEC-007, and the second-factor requirement of audit #18.
 *
 * Checks that the authenticated user has is_super_admin = true on their profile,
 * that the account is ACTIVE, and that the SESSION was established with a second
 * factor.
 *
 * ── WHY AAL AND NOT "DOES THIS USER HAVE MFA ENABLED" ────────────────────────
 * A profile column saying the operator has enrolled a factor would be satisfied
 * by a stolen password: the attacker signs in, the column still says true, and
 * the console opens. `aal` is a claim about how THIS session was established, so
 * it cannot be satisfied without the factor actually being presented. That
 * distinction is the entire control; a stored flag would be decoration.
 *
 * ── WHY THIS CANNOT LOCK ANYONE OUT ──────────────────────────────────────────
 * Enrolment lives at `/dashboard/settings`, which is NOT behind this guard, so
 * an operator with no factor can always sign in, enrol, step up, and return. The
 * refusal below names that path. An operator who loses their authenticator is
 * recovered the same way they were promoted — service-role SQL, see
 * supabase/setup/create_super_admin.sql.
 *
 * Usage:
 *   @UseGuards(SuperAdminGuard)
 */
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Request } from 'express';
import { SupabaseService } from '../../supabase/supabase.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  private readonly logger = new Logger(SuperAdminGuard.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user: AuthenticatedUser; accessToken: string }>();

    const user = request.user;
    if (!user) {
      throw new ForbiddenException({
        code: 'NOT_AUTHENTICATED',
        message: 'Authentication required',
      });
    }

    const client = this.supabaseService.getUserClient(request.accessToken);
    const { data: profile, error } = await client
      .from('profiles')
      .select('is_super_admin, status')
      .eq('id', user.id)
      .single();

    // Distinguish "you are not an operator" from "the lookup itself broke".
    // Collapsing the two tells a legitimate operator they lack privileges when
    // the real fault is a missing grant or an unreachable database — a message
    // that sends people hunting through RLS policies for a connectivity bug.
    if (error && error.code !== 'PGRST116') {
      this.logger.error(
        `Super-admin check could not be completed for ${user.id}: ` +
          `${error.code ?? 'no code'} ${error.message}`,
      );
      throw new ServiceUnavailableException({
        code: 'AUTHZ_CHECK_FAILED',
        message:
          'Could not verify administrator privileges. This is a server fault, ' +
          'not a problem with your account.',
      });
    }

    if (!profile?.is_super_admin) {
      throw new ForbiddenException({
        code: 'NOT_SUPER_ADMIN',
        message: 'This action requires super admin privileges',
      });
    }

    // A suspended or pending-deletion operator keeps the flag but loses the
    // privilege. Same query, so this costs nothing extra (DEC-011), and it
    // closes the window where a banned operator's still-valid access token
    // (up to jwt_expiry) would otherwise reach the console.
    if (profile.status !== 'ACTIVE') {
      throw new ForbiddenException({
        code: 'ACCOUNT_NOT_ACTIVE',
        message: `This account is ${String(profile.status).toLowerCase()} and cannot use the admin console`,
      });
    }

    // ── Second factor (audit #18) ────────────────────────────────────────────
    // Checked LAST, deliberately. Reaching this line means the caller really is
    // an active operator, so telling them what to do next reveals nothing they
    // do not already know — whereas ordering it first would let any signed-in
    // user learn that MFA gates an admin surface.
    //
    // A missing claim is treated as aal1 rather than as "unknown, allow": a
    // token from an Auth server that does not emit `aal` is exactly the case
    // where this must not silently pass.
    const aal = (request.user.claims as { aal?: unknown } | undefined)?.aal;
    if (aal !== 'aal2') {
      throw new ForbiddenException({
        code: 'MFA_REQUIRED',
        message:
          'The admin console requires a verified second factor for this ' +
          'session. Enrol or confirm your authenticator app in Settings → ' +
          'Security, then return here.',
      });
    }

    return true;
  }
}
