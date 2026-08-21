/**
 * Sync Controller — DEC-010, DEC-011
 *
 * GET /v1/workspaces/:workspaceId/sync?cursor=<opaque>&limit=<n>
 *
 * One round trip returns every change across the workspace. This is the mobile
 * app's pull path; Supabase Realtime only tells the client *that* something
 * changed, never what (payload-free hints keep financial data off the Realtime
 * transport and egress down).
 */
import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiParam,
} from '@nestjs/swagger';
import { Request } from 'express';
import { SyncService } from './sync.service';
import { SyncQueryDto, SyncResponseDto } from './dto/sync.dto';
import { WorkspaceMemberGuard } from '../auth/guards/workspace-member.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('Sync')
@ApiBearerAuth('supabase-auth')
@Controller()
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Get('workspaces/:workspaceId/sync')
  @UseGuards(WorkspaceMemberGuard)
  @ApiOperation({
    summary: 'Delta sync — all rows changed since the given cursor',
    description:
      'Omit `cursor` for a full initial pull. The versioned cursor tracks an ' +
      'independent (updated_at, stable primary key) position for every source, ' +
      'so arbitrarily large same-timestamp batches drain without gaps or loops.',
  })
  @ApiParam({ name: 'workspaceId', type: 'string' })
  @ApiOkResponse({ type: SyncResponseDto })
  async delta(
    @Param('workspaceId') workspaceId: string,
    @Req() req: Request & { accessToken: string },
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: SyncQueryDto,
  ) {
    try {
      return await this.syncService.getDelta(
        workspaceId,
        req.accessToken,
        query,
      );
    } catch (error) {
      await this.syncService.reportFailure(user.id, workspaceId, error);
      throw error;
    }
  }
}
