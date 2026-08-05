/**
 * Admin Controller — DEC-016
 *
 * Every route is behind SuperAdminGuard. That guard runs AFTER the global
 * SupabaseAuthGuard, so by the time it executes the JWT is already verified and
 * `req.user` is populated.
 *
 * Three independent layers protect this surface, and none is load-bearing alone:
 *   1. SuperAdminGuard        — API-level
 *   2. RLS + the RPCs' internal is_super_admin() checks — database-level
 *   3. notFound() in the web layout — the route does not appear to exist
 */
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Sse,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { Observable, concatMap, from, interval, startWith } from 'rxjs';
import { AdminService } from './admin.service';
import { SuperAdminGuard } from '../auth/guards/super-admin.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import {
  AdminUpdateUserDto,
  CreateBroadcastDto,
  ListAuditQueryDto,
  ListEventsQueryDto,
  ListUsersQueryDto,
  SuspendUserDto,
  UpdateBroadcastDto,
  UpdateSettingsDto,
} from './dto/admin.dto';

/**
 * Live-tail poll cadence.
 *
 * 3s, not a Supabase Realtime subscription: Free Tier caps concurrent Realtime
 * connections and messages (DEC-011), and this feed has at most a handful of
 * viewers who are all operators. One cheap indexed query every 3 seconds is the
 * right trade; a Realtime channel per operator is not.
 */
const STREAM_POLL_MS = 3000;

type AuthedRequest = Request & {
  user: AuthenticatedUser;
  accessToken: string;
};

@ApiTags('Admin')
@ApiBearerAuth('supabase-auth')
@UseGuards(SuperAdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ─── Overview ─────────────────────────────────────────────

  @Get('overview')
  @ApiOperation({ summary: 'Platform-wide counts, uptime and DB latency' })
  overview(@Req() req: AuthedRequest) {
    return this.adminService.getOverview(req.accessToken);
  }

  @Get('health')
  @ApiOperation({
    summary: 'Deep health check — probes Postgres, Auth and Storage',
    description:
      'Unlike GET /v1/health, which reports that the process is up, this one ' +
      'actually reaches each dependency and reports per-check latency.',
  })
  health(@Req() req: AuthedRequest) {
    return this.adminService.getHealth(req.accessToken);
  }

  // ─── System events ────────────────────────────────────────

  @Get('events')
  @ApiOperation({ summary: 'Paginated operational event log' })
  listEvents(@Req() req: AuthedRequest, @Query() query: ListEventsQueryDto) {
    return this.adminService.listEvents(req.accessToken, query);
  }

  /**
   * Server-sent live tail.
   *
   * `concatMap` rather than `mergeMap`: if one poll is slower than the interval,
   * the next must wait rather than overlap. Overlapping polls would emit events
   * out of order and let a slow database multiply its own load.
   */
  @Sse('events/stream')
  @ApiOperation({ summary: 'Live event feed (SSE)' })
  streamEvents(
    @Req() req: AuthedRequest,
    @Query('afterId') afterIdRaw?: string,
  ): Observable<{ data: string }> {
    let cursor = Number.parseInt(afterIdRaw ?? '0', 10);
    if (!Number.isFinite(cursor) || cursor < 0) cursor = 0;

    return interval(STREAM_POLL_MS).pipe(
      startWith(0),
      concatMap(() =>
        from(
          this.adminService
            .pollEvents(req.accessToken, cursor)
            .then((events) => {
              if (events.length > 0) {
                cursor = Number(events[events.length - 1].id);
              }
              // An empty frame is still sent: it is the heartbeat that keeps the
              // connection open through proxies and tells the UI the feed is live
              // rather than stalled.
              return { data: JSON.stringify({ events, cursor }) };
            }),
        ),
      ),
    );
  }

  @Post('events/prune')
  @ApiOperation({ summary: 'Drop events past the retention window' })
  pruneEvents(
    @Req() req: AuthedRequest,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.adminService.pruneEvents(req.accessToken, user.id);
  }

  // ─── Audit trail ──────────────────────────────────────────

  @Get('audit')
  @ApiOperation({ summary: 'Global audit trail' })
  listAudit(@Req() req: AuthedRequest, @Query() query: ListAuditQueryDto) {
    return this.adminService.listAudit(req.accessToken, query);
  }

  // ─── Users ────────────────────────────────────────────────

  @Get('users')
  @ApiOperation({
    summary: 'User metadata list',
    description:
      'Platform metadata and activity COUNTS only. This endpoint cannot return ' +
      'a balance, amount, payee or note — operators have no access to any ' +
      "user's financial rows (DEC-002 #12, DEC-007).",
  })
  @ApiOkResponse({ description: 'Metadata and counts; never financial data' })
  listUsers(@Req() req: AuthedRequest, @Query() query: ListUsersQueryDto) {
    return this.adminService.listUsers(req.accessToken, query);
  }

  @Get('users/:userId')
  @ApiOperation({ summary: 'Single user metadata' })
  getUser(
    @Req() req: AuthedRequest,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.adminService.getUser(req.accessToken, userId);
  }

  @Patch('users/:userId')
  @ApiOperation({
    summary: 'Update the operator-editable subset of a profile',
    description:
      'Allowlist: display_name, locale, timezone. is_super_admin is deliberately ' +
      'not editable here — promotion is a service-role SQL operation (DEC-013).',
  })
  updateUser(
    @Req() req: AuthedRequest,
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: AdminUpdateUserDto,
  ) {
    return this.adminService.updateUser(req.accessToken, user.id, userId, dto);
  }

  @Post('users/:userId/suspend')
  @ApiOperation({ summary: 'Suspend an account (Auth ban + status)' })
  suspendUser(
    @Req() req: AuthedRequest,
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: SuspendUserDto,
  ) {
    return this.adminService.suspendUser(
      req.accessToken,
      user.id,
      userId,
      dto.reason,
    );
  }

  @Post('users/:userId/reinstate')
  @ApiOperation({
    summary: 'Lift a suspension, and cancel any pending deletion',
  })
  reinstateUser(
    @Req() req: AuthedRequest,
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.adminService.reinstateUser(req.accessToken, user.id, userId);
  }

  @Post('purge')
  @ApiOperation({
    summary: 'Run the deletion purge for expired grace periods',
    description:
      'Irreversible. Removes application data in FK dependency order, then the ' +
      'auth user. Only touches accounts whose 30-day grace has already expired.',
  })
  runPurge(@CurrentUser() user: AuthenticatedUser) {
    return this.adminService.runPurge(user.id);
  }

  // ─── Settings ─────────────────────────────────────────────

  @Get('settings')
  @ApiOperation({ summary: 'All global settings, public and private' })
  listSettings(@Req() req: AuthedRequest) {
    return this.adminService.listSettings(req.accessToken);
  }

  @Put('settings')
  @ApiOperation({ summary: 'Update one or more known settings' })
  updateSettings(
    @Req() req: AuthedRequest,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateSettingsDto,
  ) {
    return this.adminService.updateSettings(req.accessToken, user.id, dto);
  }

  // ─── Broadcasts ───────────────────────────────────────────

  @Get('broadcasts')
  @ApiOperation({ summary: 'All broadcasts with aggregate delivery stats' })
  listBroadcasts(@Req() req: AuthedRequest) {
    return this.adminService.listBroadcasts(req.accessToken);
  }

  @Post('broadcasts')
  @ApiOperation({ summary: 'Compose a broadcast (always created as DRAFT)' })
  createBroadcast(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateBroadcastDto,
  ) {
    return this.adminService.createBroadcast(user.id, dto);
  }

  @Patch('broadcasts/:broadcastId')
  @ApiOperation({ summary: 'Edit a broadcast' })
  updateBroadcast(
    @CurrentUser() user: AuthenticatedUser,
    @Param('broadcastId', ParseUUIDPipe) broadcastId: string,
    @Body() dto: UpdateBroadcastDto,
  ) {
    return this.adminService.updateBroadcast(user.id, broadcastId, dto);
  }

  @Post('broadcasts/:broadcastId/publish')
  @ApiOperation({ summary: 'Publish — makes it visible to its audience' })
  publishBroadcast(
    @CurrentUser() user: AuthenticatedUser,
    @Param('broadcastId', ParseUUIDPipe) broadcastId: string,
  ) {
    return this.adminService.setBroadcastStatus(
      user.id,
      broadcastId,
      'PUBLISHED',
    );
  }

  @Post('broadcasts/:broadcastId/archive')
  @ApiOperation({ summary: 'Archive — withdraws it from every user' })
  archiveBroadcast(
    @CurrentUser() user: AuthenticatedUser,
    @Param('broadcastId', ParseUUIDPipe) broadcastId: string,
  ) {
    return this.adminService.setBroadcastStatus(
      user.id,
      broadcastId,
      'ARCHIVED',
    );
  }
}
