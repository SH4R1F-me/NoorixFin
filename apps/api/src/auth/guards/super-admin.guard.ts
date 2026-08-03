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
} from '@nestjs/common';
import { Request } from 'express';
import { SupabaseService } from '../../supabase/supabase.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  private readonly logger = new Logger(SuperAdminGuard.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<
      Request & { user: AuthenticatedUser; accessToken: string }
    >();

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
      .select('is_super_admin')
      .eq('id', user.id)
      .single();

    if (error || !profile?.is_super_admin) {
      throw new ForbiddenException({
        code: 'NOT_SUPER_ADMIN',
        message: 'This action requires super admin privileges',
      });
    }

    return true;
  }
}
