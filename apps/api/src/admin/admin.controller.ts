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
 *
 * ── @Idempotent() (audit item 16) ────────────────────────────────────────────
 * Every mutation here honours an `Idempotency-Key` header. Two levels:
 *
 *   `@Idempotent()`                  — replay-safe if a key is sent.
 *   `@Idempotent({ required: true })` — refuses without one.
 *
 * Only broadcast CREATION is required, because it is the only route where a
 * retry produces a second thing: the same platform-wide message delivered
 * twice, with two audit entries that make it look deliberate. The rest set a
 * field to a value, so a replay was already harmless — a key there buys a
 * clean audit trail rather than correctness, and demanding one would be
 * ceremony. See idempotency.interceptor.ts.
 */
import {
  Body,
  Controller,
  Delete,
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
import { ThrottleAdminWrite } from '../common/throttle';
import { TracingService } from '../observability/tracing.service';
import { EnableTracingDto } from './dto/admin.dto';
import { SuperAdminGuard } from '../auth/guards/super-admin.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Idempotent } from '../common/decorators/idempotent.decorator';
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
  UpdateMobileReleaseDto,
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
  constructor(
    private readonly adminService: AdminService,
    private readonly tracing: TracingService,
  ) {}

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

  // ─── Operations (audit items 8, 15) ───────────────────────

  @Get('jobs')
  @ApiOperation({
    summary: 'Scheduled jobs and their last run outcome',
    description:
      'A scheduler nobody can inspect is a scheduler nobody trusts. The case ' +
      'that matters is FAILURE: a purge that has been erroring for a week looks ' +
      'exactly like a purge with nothing to do unless the run log is visible.',
  })
  scheduledJobs(@Req() req: AuthedRequest) {
    return this.adminService.getScheduledJobs(req.accessToken);
  }

  @Get('tracing')
  @ApiOperation({
    summary: 'Whether the request-trace window is open, and until when',
  })
  tracingStatus() {
    return this.tracing.status();
  }

  @Post('tracing')
  @Idempotent()
  @ThrottleAdminWrite()
  @ApiOperation({
    summary: 'Open a time-boxed request-trace window',
    description:
      "Records EVERY request to system_events so one user's request can be " +
      'followed end to end. Expires on its own — a trace that must be switched ' +
      'off by hand becomes a permanent activity log of every user, which ' +
      'DEC-016 does not permit an operator to keep.',
  })
  enableTracing(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: EnableTracingDto,
  ) {
    return this.tracing.enable(dto.minutes ?? 15, user.id);
  }

  @Delete('tracing')
  @ThrottleAdminWrite()
  @ApiOperation({ summary: 'Close the trace window early' })
  async disableTracing(@CurrentUser() user: AuthenticatedUser) {
    await this.tracing.disable(user.id);
    return { active: false, until: null };
  }

  @Post('events/prune')
  @Idempotent()
  @ThrottleAdminWrite()
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
  @ThrottleAdminWrite()
  @Idempotent()
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
  @ThrottleAdminWrite()
  @Idempotent()
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
  @ThrottleAdminWrite()
  @Idempotent()
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
  @ThrottleAdminWrite()
  @Idempotent()
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
  @ThrottleAdminWrite()
  @Idempotent()
  @ApiOperation({ summary: 'Update one or more known settings' })
  updateSettings(
    @Req() req: AuthedRequest,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateSettingsDto,
  ) {
    return this.adminService.updateSettings(req.accessToken, user.id, dto);
  }

  @Get('releases')
  @ApiOperation({ summary: 'Current operator-managed mobile release' })
  getReleases() {
    return this.adminService.getMobileRelease();
  }

  @Put('releases/mobile')
  @ThrottleAdminWrite()
  @Idempotent()
  @ApiOperation({
    summary: 'Update mobile store links and supported-version floor',
  })
  updateMobileRelease(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateMobileReleaseDto,
  ) {
    return this.adminService.updateMobileRelease(user.id, dto);
  }

  // ─── Broadcasts ───────────────────────────────────────────

  @Get('broadcasts')
  @ApiOperation({ summary: 'All broadcasts with aggregate delivery stats' })
  listBroadcasts(@Req() req: AuthedRequest) {
    return this.adminService.listBroadcasts(req.accessToken);
  }

  @Post('broadcasts')
  @ThrottleAdminWrite()
  @Idempotent({ required: true })
  @ApiOperation({ summary: 'Compose a broadcast (always created as DRAFT)' })
  createBroadcast(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateBroadcastDto,
  ) {
    return this.adminService.createBroadcast(user.id, dto);
  }

  @Patch('broadcasts/:broadcastId')
  @ThrottleAdminWrite()
  @Idempotent()
  @ApiOperation({ summary: 'Edit a broadcast' })
  updateBroadcast(
    @CurrentUser() user: AuthenticatedUser,
    @Param('broadcastId', ParseUUIDPipe) broadcastId: string,
    @Body() dto: UpdateBroadcastDto,
  ) {
    return this.adminService.updateBroadcast(user.id, broadcastId, dto);
  }

  @Post('broadcasts/:broadcastId/publish')
  @ThrottleAdminWrite()
  @Idempotent()
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
  @ThrottleAdminWrite()
  @Idempotent()
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

  // ─── Phase 2: Performance ──────────────────────────────────

  @Get('metrics/performance')
  @ApiOperation({
    summary:
      'p50/p95/p99 latency, error rate, request volume from system_events',
  })
  getPerformanceMetrics(
    @Req() req: AuthedRequest,
    @Query('window') windowRaw?: string,
  ) {
    const window = Number.parseInt(windowRaw ?? '1', 10);
    const hours =
      Number.isFinite(window) && window > 0 && window <= 168 ? window : 1;
    return this.adminService.getPerformanceMetrics(req.accessToken, hours);
  }

  // ─── Phase 2: Alerts ──────────────────────────────────────

  @Get('alerts')
  @ApiOperation({ summary: 'Current state of all alert rules' })
  getAlerts(@Req() req: AuthedRequest) {
    return this.adminService.getAlerts(req.accessToken);
  }

  @Post('alerts/:alertKey/acknowledge')
  @ThrottleAdminWrite()
  @Idempotent()
  @ApiOperation({ summary: 'Acknowledge (resolve) a firing alert' })
  acknowledgeAlert(
    @CurrentUser() user: AuthenticatedUser,
    @Param('alertKey') alertKey: string,
  ) {
    return this.adminService.acknowledgeAlert(user.id, alertKey);
  }

  // ─── Phase 2: Security ────────────────────────────────────

  @Get('security/auth-events')
  @ApiOperation({
    summary: 'Auth-related audit events (logins, MFA, suspensions)',
  })
  getAuthEvents(
    @Req() req: AuthedRequest,
    @Query('limit') limitRaw?: string,
    @Query('offset') offsetRaw?: string,
    @Query('platform') platform?: string,
  ) {
    return this.adminService.getAuthEvents(req.accessToken, {
      limit: limitRaw ? Number(limitRaw) : undefined,
      offset: offsetRaw ? Number(offsetRaw) : undefined,
      platform,
    });
  }

  @Get('security/sessions')
  @ApiOperation({
    summary: 'All active (non-revoked) device sessions platform-wide',
  })
  getActiveSessions(
    @Req() req: AuthedRequest,
    @Query('limit') limitRaw?: string,
    @Query('offset') offsetRaw?: string,
    @Query('platform') platform?: string,
  ) {
    return this.adminService.getActiveSessions(req.accessToken, {
      limit: limitRaw ? Number(limitRaw) : undefined,
      offset: offsetRaw ? Number(offsetRaw) : undefined,
      platform,
    });
  }

  @Post('security/sessions/:deviceId/revoke')
  @ThrottleAdminWrite()
  @Idempotent()
  @ApiOperation({ summary: 'Force-revoke a single device session' })
  revokeSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('deviceId', ParseUUIDPipe) deviceId: string,
  ) {
    return this.adminService.revokeSession(user.id, deviceId);
  }

  @Post('security/sessions/revoke-all/:userId')
  @ThrottleAdminWrite()
  @Idempotent()
  @ApiOperation({ summary: 'Force-revoke all sessions for a given user' })
  revokeAllUserSessions(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.adminService.revokeAllUserSessions(user.id, userId);
  }

  @Get('security/anomalies')
  @ApiOperation({
    summary: 'Heuristic security signals: new devices, throttle abusers',
  })
  getAnomalies(@Req() req: AuthedRequest) {
    return this.adminService.getAnomalies(req.accessToken);
  }

  // ─── Phase 2: Correlated trace view ───────────────────────

  @Get('events/trace/:requestId')
  @ApiOperation({
    summary: 'All system_events for a single X-Request-ID (correlated trace)',
  })
  getEventTrace(
    @Req() req: AuthedRequest,
    @Param('requestId') requestId: string,
  ) {
    return this.adminService.getEventsByRequestId(req.accessToken, requestId);
  }
}
