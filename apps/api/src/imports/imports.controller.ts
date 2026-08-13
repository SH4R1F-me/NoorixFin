import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { WorkspaceMemberGuard } from '../auth/guards/workspace-member.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ThrottleSensitive } from '../common/throttle';
import { CreateImportDto } from './dto/import.dto';
import { ImportsService } from './imports.service';
import { WorkspaceExportService } from './workspace-export.service';

type AuthedRequest = Request & { accessToken: string };

@ApiTags('Data portability')
@ApiBearerAuth('supabase-auth')
@Controller('workspaces/:workspaceId')
@UseGuards(WorkspaceMemberGuard)
export class ImportsController {
  constructor(
    private readonly imports: ImportsService,
    private readonly exports: WorkspaceExportService,
  ) {}

  @Get('import')
  @ApiOperation({ summary: 'List recent staged import jobs' })
  list(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: AuthedRequest,
  ) {
    return this.imports.list(workspaceId, user.id, req.accessToken);
  }

  @Post('import')
  @ThrottleSensitive()
  @ApiOperation({
    summary: 'Parse, stage, and post a CSV, OFX, or QIF statement',
  })
  create(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: AuthedRequest,
    @Body() dto: CreateImportDto,
  ) {
    return this.imports.create(workspaceId, user.id, req.accessToken, dto);
  }

  @Get('import/:jobId')
  get(
    @Param('workspaceId') workspaceId: string,
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: AuthedRequest,
  ) {
    return this.imports.get(workspaceId, jobId, user.id, req.accessToken);
  }

  @Get('export')
  @ThrottleSensitive()
  @ApiProduces('text/csv', 'application/pdf')
  @ApiOperation({ summary: 'Download the workspace ledger as CSV or PDF' })
  async export(
    @Param('workspaceId') workspaceId: string,
    @Query('format') format = 'csv',
    @Req() req: AuthedRequest,
    @Res() res: Response,
  ) {
    const normalizedFormat = format.toLowerCase();
    if (!['csv', 'pdf'].includes(normalizedFormat)) {
      throw new BadRequestException({
        code: 'INVALID_EXPORT_FORMAT',
        message: 'Export format must be csv or pdf',
      });
    }
    const date = new Date().toISOString().slice(0, 10);
    if (normalizedFormat === 'pdf') {
      res
        .type('application/pdf')
        .attachment(`noorixfin-${date}.pdf`)
        .send(await this.exports.pdf(workspaceId, req.accessToken));
      return;
    }
    res
      .type('text/csv; charset=utf-8')
      .attachment(`noorixfin-${date}.csv`)
      .send(await this.exports.csv(workspaceId, req.accessToken));
  }
}
