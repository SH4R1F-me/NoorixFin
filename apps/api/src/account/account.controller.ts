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
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { AccountService } from './account.service';
import { RequestDeletionDto } from './dto/account.dto';
import { ThrottleSensitive } from '../common/throttle';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';

type AuthedRequest = Request & { accessToken: string };

@ApiTags('Account')
@ApiBearerAuth('supabase-auth')
@Controller('me')
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Post('deletion-request')
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
  @ApiOkResponse({ description: 'Bilingual broadcast payloads' })
  listBroadcasts(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: AuthedRequest,
  ) {
    return this.accountService.listMyBroadcasts(user.id, req.accessToken);
  }

  @Post('broadcasts/:broadcastId/dismiss')
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
