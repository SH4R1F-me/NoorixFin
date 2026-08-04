/**
 * Workspaces Service — Simplified (DEC-007)
 *
 * Handles workspace CRUD only. No invitations or member management.
 * All workspaces are PERSONAL. Each user is OWNER of their workspace.
 */
import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateWorkspaceDto } from './dto/workspace.dto';
import { randomUUID } from 'crypto';

@Injectable()
export class WorkspacesService {
  private readonly logger = new Logger(WorkspacesService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Create a new PERSONAL workspace with the creator as OWNER.
   * Each user can only have one active personal workspace.
   */
  async createWorkspace(
    userId: string,
    accessToken: string,
    dto: CreateWorkspaceDto,
  ) {
    const client = this.supabaseService.getUserClient(accessToken);

    // Check user doesn't already have a personal workspace
    const { data: existing } = await client
      .from('workspaces')
      .select('id')
      .eq('created_by', userId)
      .eq('type', 'PERSONAL')
      .eq('status', 'ACTIVE')
      .limit(1);

    if (existing && existing.length > 0) {
      throw new ConflictException({
        code: 'PERSONAL_WORKSPACE_EXISTS',
        message: 'You already have a personal workspace',
      });
    }

    const workspaceId = randomUUID();

    // Create workspace (always PERSONAL)
    const { data: workspace, error: wsError } = await client
      .from('workspaces')
      .insert({
        id: workspaceId,
        type: 'PERSONAL',
        name: dto.name,
        base_currency: dto.base_currency || 'BDT',
        timezone: dto.timezone || 'Asia/Dhaka',
        created_by: userId,
        status: 'ACTIVE',
      })
      .select()
      .single();

    if (wsError) {
      this.logger.error(`Failed to create workspace: ${wsError.message}`);
      throw new BadRequestException('Failed to create workspace');
    }

    // Add creator as OWNER
    const { error: memberError } = await client
      .from('workspace_members')
      .insert({
        workspace_id: workspaceId,
        user_id: userId,
        role: 'OWNER',
        status: 'ACTIVE',
      });

    if (memberError) {
      this.logger.error(
        `Failed to add owner membership: ${memberError.message}`,
      );
      // Workspace created but membership failed — clean up
      await client.from('workspaces').delete().eq('id', workspaceId);
      throw new BadRequestException('Failed to create workspace membership');
    }

    return { ...workspace, role: 'OWNER' };
  }

  /**
   * List all workspaces the user is a member of.
   */
  async listWorkspaces(userId: string, accessToken: string) {
    const client = this.supabaseService.getUserClient(accessToken);

    const { data, error } = await client
      .from('workspace_members')
      .select(
        `
        role,
        status,
        workspaces:workspace_id (
          id,
          type,
          name,
          base_currency,
          timezone,
          created_by,
          status,
          created_at,
          updated_at
        )
      `,
      )
      .eq('user_id', userId)
      .eq('status', 'ACTIVE');

    if (error) {
      this.logger.error(`Failed to list workspaces: ${error.message}`);
      throw new BadRequestException('Failed to list workspaces');
    }

    // Flatten the join result
    return (data || [])
      .filter((d) => d.workspaces)
      .map((d) => {
        const ws = d.workspaces as unknown as Record<string, unknown>;
        return {
          ...ws,
          role: d.role,
        };
      });
  }
}
