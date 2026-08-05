/**
 * Workspaces Controller — Simplified (DEC-007)
 *
 * POST   /v1/workspaces  — create personal workspace
 * GET    /v1/workspaces  — list user's workspaces
 *
 * Invitation and member management endpoints removed (2-role system).
 */
import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiCreatedResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { WorkspacesService } from './workspaces.service';
import { CreateWorkspaceDto, WorkspaceResponseDto } from './dto/workspace.dto';
import { WorkspaceMemberGuard } from '../auth/guards/workspace-member.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('Workspaces')
@ApiBearerAuth('supabase-auth')
@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new personal workspace' })
  @ApiCreatedResponse({ type: WorkspaceResponseDto })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request & { accessToken: string },
    @Body() dto: CreateWorkspaceDto,
  ) {
    return this.workspacesService.createWorkspace(
      user.id,
      req.accessToken,
      dto,
    );
  }

  @Get()
  @ApiOperation({ summary: 'List user workspaces' })
  @ApiOkResponse({ type: [WorkspaceResponseDto] })
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request & { accessToken: string },
  ) {
    return this.workspacesService.listWorkspaces(user.id, req.accessToken);
  }

  @Get(':workspaceId/summary')
  @UseGuards(WorkspaceMemberGuard)
  @ApiOperation({
    summary:
      'Dashboard summary — net worth, month income/expense/net, prior month',
    description:
      'Single aggregated payload (DEC-011). Amounts are minor units. Percentage deltas are NOT ' +
      'returned: with a zero prior month a change is undefined rather than +100%, so the client ' +
      'decides how to render that.',
  })
  async summary(
    @Param('workspaceId') workspaceId: string,
    @Req() req: Request & { accessToken: string },
  ) {
    return this.workspacesService.getSummary(workspaceId, req.accessToken);
  }
}
