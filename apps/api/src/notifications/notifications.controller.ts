import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { NotificationsService } from './notifications.service';
import {
  ComposeNotificationDto,
  ListNotificationsDto,
  NotificationTemplateDto,
  UpdateNotificationPreferencesDto,
} from './dto/notification.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { SuperAdminGuard } from '../auth/guards/super-admin.guard';
import { Idempotent } from '../common/decorators/idempotent.decorator';
import { ThrottleAdminWrite } from '../common/throttle';

type AuthedRequest = Request & { accessToken: string };

@ApiTags('Notifications')
@ApiBearerAuth('supabase-auth')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: "List the current user's notifications" })
  list(@Req() req: AuthedRequest, @Query() query: ListNotificationsDto) {
    return this.notifications.list(req.accessToken, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Unread notification badge count' })
  async unreadCount(@Req() req: AuthedRequest) {
    return { count: await this.notifications.unreadCount(req.accessToken) };
  }

  @Post('read-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark every notification as read' })
  async markAllRead(@Req() req: AuthedRequest) {
    await this.notifications.markRead(req.accessToken);
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark one notification as read' })
  async markRead(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.notifications.markRead(req.accessToken, id);
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Archive one notification' })
  async archive(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.notifications.archive(req.accessToken, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete one notification' })
  async delete(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.notifications.delete(req.accessToken, id);
  }
}

@ApiTags('Notifications')
@ApiBearerAuth('supabase-auth')
@Controller('me/notification-preferences')
export class NotificationPreferencesController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get channel preferences and quiet hours' })
  get(@Req() req: AuthedRequest, @CurrentUser() user: AuthenticatedUser) {
    return this.notifications.getPreferences(req.accessToken, user.id);
  }

  @Put()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Update channel preferences and quiet hours' })
  async update(
    @Req() req: AuthedRequest,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateNotificationPreferencesDto,
  ) {
    await this.notifications.updatePreferences(req.accessToken, user.id, dto);
  }
}

@ApiTags('Admin Notifications')
@ApiBearerAuth('supabase-auth')
@UseGuards(SuperAdminGuard)
@Controller('admin/notifications')
export class AdminNotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'List operator-authored notification campaigns' })
  listCampaigns() {
    return this.notifications.listCampaigns();
  }

  @Post()
  @ThrottleAdminWrite()
  @Idempotent({ required: true })
  @ApiOperation({
    summary: 'Compose, target, and optionally schedule a campaign',
  })
  compose(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ComposeNotificationDto,
  ) {
    return this.notifications.composeCampaign(user.id, dto);
  }

  @Get('templates')
  @ApiOperation({ summary: 'List reusable notification templates' })
  templates() {
    return this.notifications.listTemplates();
  }

  @Post('templates')
  @ThrottleAdminWrite()
  @Idempotent({ required: true })
  @ApiOperation({ summary: 'Create or update a notification template by key' })
  saveTemplate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: NotificationTemplateDto,
  ) {
    return this.notifications.saveTemplate(user.id, dto);
  }

  @Delete('templates/:id')
  @ThrottleAdminWrite()
  @Idempotent()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a notification template' })
  async deleteTemplate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.notifications.deleteTemplate(user.id, id);
  }

  @Get(':id/deliveries')
  @ApiOperation({ summary: 'Aggregate per-channel delivery outcomes' })
  deliveries(@Param('id', ParseUUIDPipe) id: string) {
    return this.notifications.getCampaignDeliveries(id);
  }
}
