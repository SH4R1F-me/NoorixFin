import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { WorkspaceMemberGuard } from '../auth/guards/workspace-member.guard';
import { ThrottleReport } from '../common/throttle';
import { SearchQueryDto } from './dto/search.dto';
import { SearchService } from './search.service';

type AuthedRequest = Request & { accessToken: string };

@ApiTags('Search')
@ApiBearerAuth('supabase-auth')
@Controller('workspaces/:workspaceId/search')
@UseGuards(WorkspaceMemberGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ThrottleReport()
  @ApiOperation({
    summary: 'Search the caller workspace across ledger and planning records',
  })
  search(
    @Param('workspaceId') workspaceId: string,
    @Req() req: AuthedRequest,
    @Query() query: SearchQueryDto,
  ) {
    return this.searchService.search(workspaceId, req.accessToken, query.q);
  }
}
