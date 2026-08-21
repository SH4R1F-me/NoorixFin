/**
 * Account Controller — DEC-017
 *
 * Shares the `me` prefix with ProfilesController; Nest permits that as long as
 * the paths do not collide, and it keeps the user-facing surface at one URL
 * namespace (`/v1/me/...`).
 */
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import type { Response } from 'express';
import { AccountService } from './account.service';
import { ExportService } from './export.service';
import {
  RequestDeletionDto,
  DeletionScheduledResponseDto,
  AccountStatusResponseDto,
  BroadcastResponseDto,
  DismissedResponseDto,
  PublicSettingsResponseDto,
  DataExportArtifactResponseDto,
  DataExportDeletedResponseDto,
} from './dto/account.dto';
import { ThrottleSensitive } from '../common/throttle';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { Idempotent } from '../common/decorators/idempotent.decorator';

type AuthedRequest = Request & { accessToken: string };

@ApiTags('Account')
@ApiBearerAuth('supabase-auth')
@Controller('me')
export class AccountController {
  constructor(
    private readonly accountService: AccountService,
    private readonly exportService: ExportService,
  ) {}

  @Post('exports')
  @ThrottleSensitive()
  @Idempotent()
  @ApiCreatedResponse({ type: DataExportArtifactResponseDto })
  @ApiOperation({
    summary: 'Create a bounded, expiring NDJSON export artifact',
  })
  requestExport(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: AuthedRequest,
  ) {
    return this.exportService.createArtifact(user.id, req.accessToken);
  }

  @Get('exports/:id/download')
  @ThrottleSensitive()
  @ApiProduces('application/x-ndjson')
  @ApiOkResponse({
    description:
      'Chunk-streamed NDJSON with Content-Digest and expiry metadata.',
    schema: { type: 'string', format: 'binary' },
  })
  downloadExport(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    return this.exportService.streamArtifact(user.id, id, res);
  }

  @Get('exports/:id')
  @ThrottleSensitive()
  @ApiOkResponse({ type: DataExportArtifactResponseDto })
  getExport(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.exportService.getArtifact(user.id, id);
  }

  @Delete('exports/:id')
  @ThrottleSensitive()
  @Idempotent()
  @ApiOkResponse({ type: DataExportDeletedResponseDto })
  deleteExport(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.exportService.deleteArtifact(user.id, id);
  }

  @Post('deletion-request')
  @ApiCreatedResponse({ type: DeletionScheduledResponseDto })
  @ThrottleSensitive()
  @ApiOperation({
    summary: 'Schedule this account for deletion after a 30-day grace period',
    description:
      'Nothing is deleted now. The account is banned and marked ' +
      'PENDING_DELETION; data is removed only when the grace period expires ' +
      'and the purge runs. Reversible by an operator until then (DEC-017).',
  })
  requestDeletion(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: AuthedRequest,
    @Body() dto: RequestDeletionDto,
  ) {
    return this.accountService.requestDeletion(
      user.id,
      user.email,
      dto.confirm_email,
      dto.reason,
      req.accessToken,
    );
  }

  @Delete('deletion-request')
  @ApiOkResponse({ type: AccountStatusResponseDto })
  @ThrottleSensitive()
  @ApiOperation({
    summary: 'Cancel a pending deletion',
    description:
      'Not reachable by the requesting user in practice: requesting deletion ' +
      'bans the account, so their session is dead. Cancellation is an operator ' +
      'action via POST /v1/admin/users/:id/reinstate. This route exists for ' +
      'the case where the ban failed but the marking succeeded.',
  })
  cancelDeletion(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: AuthedRequest,
  ) {
    return this.accountService.cancelDeletion(user.id, req.accessToken);
  }

  @Get('broadcasts')
  @ApiOperation({ summary: 'Live broadcasts this user has not dismissed' })
  @ApiOkResponse({
    description: 'Bilingual broadcast payloads',
    type: [BroadcastResponseDto],
  })
  listBroadcasts(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: AuthedRequest,
  ) {
    return this.accountService.listMyBroadcasts(user.id, req.accessToken);
  }

  @Post('broadcasts/:broadcastId/dismiss')
  @ApiCreatedResponse({ type: DismissedResponseDto })
  @ApiOperation({ summary: 'Dismiss a broadcast for this user' })
  dismissBroadcast(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: AuthedRequest,
    @Param('broadcastId', ParseUUIDPipe) broadcastId: string,
  ) {
    return this.accountService.dismissBroadcast(
      user.id,
      broadcastId,
      req.accessToken,
    );
  }
}

@ApiTags('Account')
@ApiBearerAuth('supabase-auth')
@Controller('settings')
export class PublicSettingsController {
  constructor(private readonly accountService: AccountService) {}

  @Get('public')
  @ApiOkResponse({ type: PublicSettingsResponseDto })
  @ApiOperation({
    summary: 'Global settings any signed-in user may read',
    description:
      'Maintenance mode, whether signups are open, app version, donation link, ' +
      'support address. Private operator settings are excluded by RLS.',
  })
  getPublicSettings(@Req() req: AuthedRequest) {
    return this.accountService.getPublicSettings(req.accessToken);
  }
}
