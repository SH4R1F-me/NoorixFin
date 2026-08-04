/**
 * Workspace Membership Guard — Simplified (DEC-007)
 *
 * Verifies the authenticated user is an active member of the workspace
 * referenced in the route parameter `:workspaceId`.
 * With the simplified 2-role system, all workspace members are OWNER.
 *
 * SUPER_ADMIN does NOT bypass this guard. Platform operators get metadata
 * access through dedicated admin endpoints behind SuperAdminGuard — never
 * ambient access to a user's ledger (DEC-002 #12, DEC-007, DEC-013).
 *
 * Usage:
 *   @UseGuards(WorkspaceMemberGuard)           // active member of :workspaceId only
 */
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Request } from 'express';
import { SupabaseService } from '../../supabase/supabase.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

/** Simplified role — all members are OWNER (DEC-007) */
export type WorkspaceRole = 'OWNER';

export interface WorkspaceMembership {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  status: string;
}

@Injectable()
export class WorkspaceMemberGuard implements CanActivate {
  private readonly logger = new Logger(WorkspaceMemberGuard.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<
      Request & {
        user: AuthenticatedUser;
        accessToken: string;
        workspace?: WorkspaceMembership;
      }
    >();

    // Express 5 types route params as `string | string[]` (wildcard segments can
    // repeat). Workspace ids are always single-valued, so collapse to the first.
    const rawWorkspaceId = request.params.workspaceId ?? request.params.id;
    const workspaceId = Array.isArray(rawWorkspaceId)
      ? rawWorkspaceId[0]
      : rawWorkspaceId;

    if (!workspaceId) {
      throw new NotFoundException({
        code: 'WORKSPACE_NOT_FOUND',
        message: 'Workspace ID is required',
      });
    }

    const user = request.user;
    if (!user) {
      throw new ForbiddenException({
        code: 'NOT_AUTHENTICATED',
        message: 'Authentication required',
      });
    }

    // NOTE: there is deliberately no SUPER_ADMIN bypass here. Membership is the
    // only way through this guard. Removing the bypass also removes a `profiles`
    // lookup that previously ran on every workspace-scoped request (DEC-011).
    const client = this.supabaseService.getUserClient(request.accessToken);
    const { data: membership, error } = await client
      .from('workspace_members')
      .select('workspace_id, user_id, role, status')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .eq('status', 'ACTIVE')
      .single();

    if (error || !membership) {
      throw new ForbiddenException({
        code: 'NOT_WORKSPACE_MEMBER',
        message: 'You are not an active member of this workspace',
      });
    }

    // Attach membership to request for use in controllers
    request.workspace = {
      workspaceId: membership.workspace_id,
      userId: membership.user_id,
      role: membership.role as WorkspaceRole,
      status: membership.status,
    };

    return true;
  }
}
