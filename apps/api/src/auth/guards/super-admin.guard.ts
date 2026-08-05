/**
 * SuperAdmin Guard — DEC-007
 *
 * Checks that the authenticated user has is_super_admin = true on their profile.
 * Used for admin-only endpoints (user management, system dashboard, etc.)
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

    return true;
  }
}
