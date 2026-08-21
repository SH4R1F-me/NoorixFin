/**
 * Durable notification pipeline (§5).
 *
 * A notification row is the source of truth. Channel deliveries are pointers
 * to that row and may fail independently; an unavailable provider can never
 * erase the in-app copy. User reads use the caller's RLS-scoped client. Rule,
 * campaign, and provider work uses service_role with explicit user scoping.
 */
import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import type { Insertable, Json, Tables } from '@noorixfin/db-types';
import nodemailer, { type Transporter } from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import webPush, { type PushSubscription } from 'web-push';
import { SupabaseService } from '../supabase/supabase.service';
import { AuditService } from '../observability/audit.service';
import { SystemEventsService } from '../observability/system-events.service';
import {
  NOTIFICATION_CATEGORIES,
  type ComposeNotificationDto,
  type ListNotificationsDto,
  type NotificationCategory,
  type NotificationPreferenceDto,
  type NotificationRow,
  type NotificationSeverity,
  type NotificationTemplateDto,
  type UpdateNotificationPreferencesDto,
} from './dto/notification.dto';

export interface CreateNotificationInput {
  userId: string;
  workspaceId?: string | null;
  category: NotificationCategory;
  severity?: NotificationSeverity;
  titleEn: string;
  titleBn?: string;
  bodyEn: string;
  bodyBn?: string;
  actionUrl?: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  dedupeKey?: string;
  expiresAt?: string;
}

type Preference = Pick<
  Tables<'notification_preferences'>,
  'category' | 'in_app' | 'push' | 'email' | 'digest'
>;

const DEFAULTS: Record<NotificationCategory, Omit<Preference, 'category'>> = {
  security: { in_app: true, push: true, email: true, digest: 'NONE' },
  budget: { in_app: true, push: true, email: false, digest: 'NONE' },
  goal: { in_app: true, push: true, email: false, digest: 'NONE' },
  recurring: { in_app: true, push: true, email: false, digest: 'NONE' },
  transaction: { in_app: true, push: false, email: false, digest: 'NONE' },
  sync: { in_app: true, push: true, email: false, digest: 'NONE' },
  account: { in_app: true, push: false, email: true, digest: 'NONE' },
  system: { in_app: true, push: false, email: false, digest: 'NONE' },
  operator: { in_app: true, push: true, email: true, digest: 'NONE' },
};

const WORKER_INTERVAL_MS = 30_000;
const MAX_DELIVERY_ATTEMPTS = 5;
const DELIVERY_LEASE_SECONDS = 300;
const DELIVERY_TIMEOUT_MS = 30_000;

export function deliveryBackoffSeconds(attempts: number): number {
  return Math.min(30 * 2 ** Math.max(0, attempts - 1), 60 * 60);
}

@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationsService.name);
  private timer?: NodeJS.Timeout;
  private workerRunning = false;
  private readonly workerId = randomUUID();
  private smtpTransport?: Transporter<
    SMTPTransport.SentMessageInfo,
    SMTPTransport.Options
  >;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    private readonly events: SystemEventsService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.runWorker(), WORKER_INTERVAL_MS);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Create the durable row, apply preferences/quiet hours, and fan out. */
  async create(
    input: CreateNotificationInput,
  ): Promise<NotificationRow | null> {
    const client = this.supabase.getServiceClient();
    const [{ data: prefRows }, { data: profile }, { data: devices }] =
      await Promise.all([
        client
          .from('notification_preferences')
          .select('category, in_app, push, email, digest')
          .eq('user_id', input.userId)
          .eq('category', input.category),
        client
          .from('profiles')
          .select('quiet_hours_start, quiet_hours_end, quiet_hours_tz')
          .eq('id', input.userId)
          .maybeSingle(),
        client
          .from('user_devices')
          .select('id, push_token, push_provider')
          .eq('user_id', input.userId)
          .is('revoked_at', null)
          .not('push_token', 'is', null),
      ]);

    const pref = this.resolvePreference(input.category, prefRows?.[0]);
    const severity = input.severity ?? 'INFO';
    const quiet = severity !== 'CRITICAL' && isInQuietHours(profile ?? null);
    const digesting = pref.digest !== 'NONE' && severity !== 'CRITICAL';

    const payload = {
      user_id: input.userId,
      workspace_id: input.workspaceId ?? null,
      category: input.category,
      severity,
      title_en: input.titleEn,
      title_bn: input.titleBn ?? null,
      body_en: input.bodyEn,
      body_bn: input.bodyBn ?? null,
      action_url: input.actionUrl ?? null,
      resource_type: input.resourceType ?? null,
      resource_id: input.resourceId ?? null,
      metadata: (input.metadata ?? {}) as Json,
      dedupe_key: input.dedupeKey ?? null,
      expires_at: input.expiresAt ?? null,
      // Disabled in-app categories still retain a durable pointer for push and
      // email, but do not appear in the default notification-centre query.
      archived_at: pref.in_app ? null : new Date().toISOString(),
    };

    const { data, error } = await client
      .from('notifications')
      .insert(payload)
      .select()
      .single();

    if (error?.code === '23505' && input.dedupeKey) {
      const { data: existing } = await client
        .from('notifications')
        .select('*')
        .eq('user_id', input.userId)
        .eq('dedupe_key', input.dedupeKey)
        .maybeSingle();
      return existing;
    }
    if (error || !data) {
      this.logger.error(
        `Failed to create notification: ${error?.message ?? 'no row returned'}`,
      );
      return null;
    }

    const suppressed = quiet || digesting;
    const now = new Date().toISOString();
    const deliveries: Array<Insertable<'notification_deliveries'>> = [
      {
        notification_id: data.id,
        channel: 'in_app',
        status: pref.in_app ? 'SENT' : 'SUPPRESSED',
        sent_at: pref.in_app ? now : null,
        error: pref.in_app ? null : 'Disabled by user preference',
      },
    ];

    for (const device of devices ?? []) {
      if (!device.push_token || !device.push_provider) continue;
      const channel = device.push_provider === 'webpush' ? 'webpush' : 'push';
      deliveries.push({
        notification_id: data.id,
        device_id: device.id,
        channel,
        status: pref.push && !suppressed ? 'PENDING' : 'SUPPRESSED',
        error: suppressionReason(pref.push, quiet, digesting),
      });
    }

    if (pref.email || input.category === 'security') {
      deliveries.push({
        notification_id: data.id,
        channel: 'email',
        status: !suppressed ? 'PENDING' : 'SUPPRESSED',
        error: suppressionReason(true, quiet, digesting),
      });
    }

    const { error: deliveryError } = await client
      .from('notification_deliveries')
      .insert(deliveries);
    if (deliveryError) {
      this.logger.warn(
        `Notification ${data.id} created without complete delivery rows: ${deliveryError.message}`,
      );
    }

    return data;
  }

  async list(accessToken: string, opts: ListNotificationsDto) {
    const client = this.supabase.getUserClient(accessToken);
    const limit = opts.limit ?? 20;
    let query = client
      .from('notifications')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit + 1);

    if (opts.status === 'unread') {
      query = query.is('read_at', null).is('archived_at', null);
    } else if (opts.status === 'archived') {
      query = query.not('archived_at', 'is', null);
    } else {
      query = query.is('archived_at', null);
    }
    if (opts.category) query = query.eq('category', opts.category);
    if (opts.cursor) {
      const cursor = decodeCursor(opts.cursor);
      if (cursor) query = query.lt('created_at', cursor);
    }

    const { data, error } = await query;
    if (error) throw error;
    const items = data ?? [];
    const hasMore = items.length > limit;
    if (hasMore) items.pop();
    return {
      items,
      next_cursor:
        hasMore && items.length
          ? Buffer.from(items[items.length - 1].created_at).toString(
              'base64url',
            )
          : null,
      has_more: hasMore,
    };
  }

  async unreadCount(accessToken: string): Promise<number> {
    const { count, error } = await this.supabase
      .getUserClient(accessToken)
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .is('read_at', null)
      .is('archived_at', null)
      .is('deleted_at', null);
    if (error) throw error;
    return count ?? 0;
  }

  async markRead(accessToken: string, notificationId?: string): Promise<void> {
    let query = this.supabase
      .getUserClient(accessToken)
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .is('read_at', null)
      .is('deleted_at', null);
    if (notificationId) query = query.eq('id', notificationId);
    const { error } = await query;
    if (error) throw error;
  }

  async archive(accessToken: string, notificationId: string): Promise<void> {
    const { error } = await this.supabase
      .getUserClient(accessToken)
      .from('notifications')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', notificationId)
      .is('deleted_at', null);
    if (error) throw error;
  }

  async delete(accessToken: string, notificationId: string): Promise<void> {
    const { error } = await this.supabase
      .getUserClient(accessToken)
      .from('notifications')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', notificationId);
    if (error) throw error;
  }

  async getPreferences(accessToken: string, userId: string) {
    const client = this.supabase.getUserClient(accessToken);
    const [{ data, error }, { data: profile, error: profileError }] =
      await Promise.all([
        client
          .from('notification_preferences')
          .select('category, in_app, push, email, digest')
          .order('category'),
        client
          .from('profiles')
          .select('quiet_hours_start, quiet_hours_end, quiet_hours_tz')
          .eq('id', userId)
          .single(),
      ]);
    if (error) throw error;
    if (profileError) throw profileError;
    const stored = new Map((data ?? []).map((row) => [row.category, row]));
    return {
      preferences: NOTIFICATION_CATEGORIES.map((category) =>
        this.resolvePreference(category, stored.get(category)),
      ),
      quiet_hours_start: profile.quiet_hours_start?.slice(0, 5) ?? null,
      quiet_hours_end: profile.quiet_hours_end?.slice(0, 5) ?? null,
      quiet_hours_tz: profile.quiet_hours_tz,
    };
  }

  async updatePreferences(
    accessToken: string,
    userId: string,
    dto: UpdateNotificationPreferencesDto,
  ): Promise<void> {
    const client = this.supabase.getUserClient(accessToken);
    const byCategory = new Map(
      dto.preferences.map((pref) => [pref.category, pref]),
    );
    const rows = NOTIFICATION_CATEGORIES.map((category) => {
      const supplied = byCategory.get(category);
      const value =
        supplied ??
        ({ category, ...DEFAULTS[category] } as NotificationPreferenceDto);
      // Security notices are a safety control, not marketing preferences.
      if (category === 'security') {
        return {
          user_id: userId,
          category,
          in_app: true,
          push: true,
          email: true,
          digest: 'NONE',
        };
      }
      return { user_id: userId, ...value };
    });
    const [{ error }, { error: profileError }] = await Promise.all([
      client
        .from('notification_preferences')
        .upsert(rows, { onConflict: 'user_id,category' }),
      client
        .from('profiles')
        .update({
          quiet_hours_start: dto.quiet_hours_start ?? null,
          quiet_hours_end: dto.quiet_hours_end ?? null,
          quiet_hours_tz: dto.quiet_hours_tz ?? null,
        })
        .eq('id', userId),
    ]);
    if (error) throw error;
    if (profileError) throw profileError;
  }

  async composeCampaign(actorId: string, dto: ComposeNotificationDto) {
    const client = this.supabase.getServiceClient();
    const { data, error } = await client
      .from('notification_campaigns')
      .insert({
        created_by: actorId,
        audience: dto.audience,
        category: dto.category,
        severity: dto.severity,
        title_en: dto.title_en,
        title_bn: dto.title_bn ?? null,
        body_en: dto.body_en,
        body_bn: dto.body_bn ?? null,
        action_url: dto.action_url ?? null,
        scheduled_for: dto.scheduled_for ?? new Date().toISOString(),
        expires_at: dto.expires_at ?? null,
        status: 'SCHEDULED',
      })
      .select()
      .single();
    if (error) throw error;
    await this.audit.write({
      actorId,
      action: 'ADMIN_NOTIFICATION_COMPOSED',
      resourceType: 'notification_campaign',
      resourceId: data.id,
      metadata: {
        audience: dto.audience,
        category: dto.category,
        scheduled_for: data.scheduled_for,
      },
    });
    // Dispatch immediately when the schedule is due; future campaigns are
    // picked up by the same bounded worker that drains channel deliveries.
    if (new Date(data.scheduled_for).getTime() <= Date.now()) {
      await this.dispatchCampaign(data.id);
      const { data: sent } = await client
        .from('notification_campaigns')
        .select('*')
        .eq('id', data.id)
        .single();
      return sent;
    }
    return data;
  }

  async listCampaigns() {
    const { data, error } = await this.supabase
      .getServiceClient()
      .from('notification_campaigns')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;
    return data ?? [];
  }

  async getCampaignDeliveries(campaignId: string) {
    const client = this.supabase.getServiceClient();
    const { data: notifications, error } = await client
      .from('notifications')
      .select('id')
      .contains('metadata', { campaign_id: campaignId });
    if (error) throw error;
    const ids = (notifications ?? []).map((row) => row.id);
    if (!ids.length)
      return { campaign_id: campaignId, total: 0, by_channel: {} };
    const { data: deliveries, error: deliveryError } = await client
      .from('notification_deliveries')
      .select('channel, status')
      .in('notification_id', ids);
    if (deliveryError) throw deliveryError;
    const byChannel: Record<string, Record<string, number>> = {};
    for (const row of deliveries ?? []) {
      byChannel[row.channel] ??= {};
      byChannel[row.channel][row.status] =
        (byChannel[row.channel][row.status] ?? 0) + 1;
    }
    return {
      campaign_id: campaignId,
      total: ids.length,
      by_channel: byChannel,
    };
  }

  async listTemplates() {
    const { data, error } = await this.supabase
      .getServiceClient()
      .from('notification_templates')
      .select('*')
      .order('key');
    if (error) throw error;
    return data ?? [];
  }

  async saveTemplate(actorId: string, dto: NotificationTemplateDto) {
    const { data, error } = await this.supabase
      .getServiceClient()
      .from('notification_templates')
      .upsert(
        {
          ...dto,
          title_bn: dto.title_bn ?? null,
          body_bn: dto.body_bn ?? null,
          action_url: dto.action_url ?? null,
          created_by: actorId,
        },
        { onConflict: 'key' },
      )
      .select()
      .single();
    if (error) throw error;
    await this.audit.write({
      actorId,
      action: 'ADMIN_NOTIFICATION_TEMPLATE_SAVED',
      resourceType: 'notification_template',
      resourceId: data.id,
      metadata: { key: data.key, category: data.category },
    });
    return data;
  }

  async deleteTemplate(actorId: string, id: string) {
    const { data, error } = await this.supabase
      .getServiceClient()
      .from('notification_templates')
      .delete()
      .eq('id', id)
      .select('id, key')
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new NotFoundException('Notification template not found');
    await this.audit.write({
      actorId,
      action: 'ADMIN_NOTIFICATION_TEMPLATE_DELETED',
      resourceType: 'notification_template',
      resourceId: id,
      metadata: { key: data.key },
    });
  }

  /** Migrate an existing published broadcast into the durable pipeline. */
  async notifyBroadcast(broadcast: {
    id: string;
    audience: string;
    severity: string;
    title_en: string;
    title_bn: string;
    body_en: string | null;
    body_bn: string | null;
    link_url: string | null;
    expires_at: string | null;
  }) {
    const client = this.supabase.getServiceClient();
    let profiles = client.from('profiles').select('id').eq('status', 'ACTIVE');
    if (broadcast.audience === 'SUPER_ADMINS')
      profiles = profiles.eq('is_super_admin', true);
    const { data, error } = await profiles;
    if (error) throw error;
    await mapBatches(data ?? [], 25, (profile) =>
      this.create({
        userId: profile.id,
        category: broadcast.audience === 'SUPER_ADMINS' ? 'operator' : 'system',
        severity: broadcast.severity as NotificationSeverity,
        titleEn: broadcast.title_en,
        titleBn: broadcast.title_bn,
        bodyEn: broadcast.body_en ?? broadcast.title_en,
        bodyBn: broadcast.body_bn ?? broadcast.title_bn,
        actionUrl: broadcast.link_url ?? undefined,
        resourceType: 'broadcast',
        resourceId: broadcast.id,
        dedupeKey: `broadcast:${broadcast.id}`,
        expiresAt: broadcast.expires_at ?? undefined,
      }),
    );
  }

  async notifyOperators(
    input: Omit<CreateNotificationInput, 'userId' | 'category'>,
  ) {
    const { data, error } = await this.supabase
      .getServiceClient()
      .from('profiles')
      .select('id')
      .eq('is_super_admin', true)
      .eq('status', 'ACTIVE');
    if (error) throw error;
    await mapBatches(data ?? [], 25, (operator) =>
      this.create({ ...input, userId: operator.id, category: 'operator' }),
    );
  }

  /** Evaluate source-driven budget and goal milestones after a ledger write. */
  async evaluateFinancialRules(
    accessToken: string,
    userId: string,
    workspaceId: string,
  ): Promise<void> {
    const client = this.supabase.getUserClient(accessToken);
    const [{ data: budget }, { data: goals }] = await Promise.all([
      client.rpc('budget_status', { p_workspace_id: workspaceId }),
      client.rpc('goals_overview', { p_workspace_id: workspaceId }),
    ]);

    const budgetData = asRecord(budget);
    for (const lineValue of asArray(budgetData?.lines)) {
      const line = asRecord(lineValue);
      if (!line) continue;
      const planned = Number(line.planned_minor ?? 0);
      const spent = Number(line.spent_minor ?? 0);
      if (planned <= 0 || spent < planned * 0.5) continue;
      const configured = Number(line.alert_threshold_pct ?? 80);
      const percent = Math.floor((spent / planned) * 100);
      const threshold =
        percent >= 100
          ? 100
          : percent >= Math.max(80, configured)
            ? Math.max(80, configured)
            : 50;
      const lineName = typeof line.name === 'string' ? line.name : 'A category';
      await this.create({
        userId,
        workspaceId,
        category: 'budget',
        severity: threshold >= 100 ? 'WARNING' : 'INFO',
        titleEn:
          threshold >= 100
            ? 'Budget limit reached'
            : `Budget is ${threshold}% used`,
        titleBn:
          threshold >= 100
            ? 'বাজেট সীমা পূর্ণ হয়েছে'
            : `বাজেটের ${threshold}% ব্যবহৃত হয়েছে`,
        bodyEn: `${lineName} has used ${percent}% of its current budget.`,
        bodyBn: `${lineName} বর্তমান বাজেটের ${percent}% ব্যবহার করেছে।`,
        actionUrl: '/dashboard/budgets',
        resourceType: 'budget_line',
        resourceId: String(line.line_id),
        dedupeKey: `budget:${String(line.line_id)}:${String(budgetData?.period_start)}:${threshold}`,
      });
    }

    const goalData = asRecord(goals);
    for (const goalValue of asArray(goalData?.goals)) {
      const goal = asRecord(goalValue);
      if (!goal) continue;
      const target = Number(goal.target_minor ?? 0);
      const current = Number(goal.current_minor ?? 0);
      if (target <= 0 || current < target * 0.25) continue;
      const percent = Math.floor((current / target) * 100);
      const milestone =
        percent >= 100 ? 100 : percent >= 75 ? 75 : percent >= 50 ? 50 : 25;
      const goalName = typeof goal.name === 'string' ? goal.name : 'Your goal';
      await this.create({
        userId,
        workspaceId,
        category: 'goal',
        severity: milestone === 100 ? 'SUCCESS' : 'INFO',
        titleEn:
          milestone === 100
            ? 'Savings goal reached'
            : `Savings goal reached ${milestone}%`,
        titleBn:
          milestone === 100
            ? 'সঞ্চয়ের লক্ষ্য পূরণ হয়েছে'
            : `সঞ্চয়ের লক্ষ্য ${milestone}% পূরণ হয়েছে`,
        bodyEn: `${goalName} is now ${percent}% funded.`,
        bodyBn: `${goalName} এখন ${percent}% অর্থায়িত।`,
        actionUrl: '/dashboard/goals',
        resourceType: 'savings_goal',
        resourceId: String(goal.id),
        dedupeKey: `goal:${String(goal.id)}:${milestone}`,
      });
    }
  }

  private resolvePreference(
    category: NotificationCategory,
    stored?: Partial<Preference>,
  ): Preference {
    const defaults = DEFAULTS[category];
    if (category === 'security') return { category, ...defaults };
    return {
      category,
      in_app: stored?.in_app ?? defaults.in_app,
      push: stored?.push ?? defaults.push,
      email: stored?.email ?? defaults.email,
      digest: stored?.digest ?? defaults.digest,
    };
  }

  private async runWorker() {
    if (this.workerRunning) return;
    this.workerRunning = true;
    try {
      await this.dispatchDueCampaigns();
      await this.routeFiringAlerts();
      await this.routeUpcomingRecurringEvents();
      await this.releaseQuietHourDeliveries();
      await this.processPendingDeliveries();
      await this.processExpoReceipts();
    } catch (error) {
      const detail =
        error instanceof Error
          ? error.message
          : error && typeof error === 'object'
            ? JSON.stringify(error)
            : String(error);
      this.logger.warn(`Notification worker failed: ${detail}`);
    } finally {
      this.workerRunning = false;
    }
  }

  private async dispatchDueCampaigns() {
    const { data, error } = await this.supabase
      .getServiceClient()
      .from('notification_campaigns')
      .select('id')
      .eq('status', 'SCHEDULED')
      .lte('scheduled_for', new Date().toISOString())
      .limit(10);
    if (error) throw error;
    for (const row of data ?? []) await this.dispatchCampaign(row.id);
  }

  private async dispatchCampaign(id: string) {
    const client = this.supabase.getServiceClient();
    const { data: campaign, error: claimError } = await client
      .from('notification_campaigns')
      .update({ status: 'PROCESSING', error: null })
      .eq('id', id)
      .eq('status', 'SCHEDULED')
      .select()
      .maybeSingle();
    if (claimError) throw claimError;
    if (!campaign) return;

    try {
      let profiles = client
        .from('profiles')
        .select('id')
        .eq('status', 'ACTIVE');
      if (campaign.audience === 'OPERATORS')
        profiles = profiles.eq('is_super_admin', true);
      const { data, error } = await profiles;
      if (error) throw error;
      await mapBatches(data ?? [], 25, (profile) =>
        this.create({
          userId: profile.id,
          category: campaign.category as NotificationCategory,
          severity: campaign.severity as NotificationSeverity,
          titleEn: campaign.title_en,
          titleBn: campaign.title_bn ?? undefined,
          bodyEn: campaign.body_en,
          bodyBn: campaign.body_bn ?? undefined,
          actionUrl: campaign.action_url ?? undefined,
          metadata: { campaign_id: campaign.id },
          dedupeKey: `campaign:${campaign.id}`,
          expiresAt: campaign.expires_at ?? undefined,
        }),
      );
      await client
        .from('notification_campaigns')
        .update({ status: 'SENT', recipient_count: data?.length ?? 0 })
        .eq('id', id);
      this.events.record({
        level: 'INFO',
        eventCode: 'NOTIFICATION_CAMPAIGN_SENT',
        message: `Notification campaign delivered to ${data?.length ?? 0} recipient(s)`,
        actorId: campaign.created_by ?? undefined,
        metadata: { campaign_id: id, audience: campaign.audience },
      });
    } catch (error) {
      await client
        .from('notification_campaigns')
        .update({
          status: 'FAILED',
          error: error instanceof Error ? error.message : String(error),
        })
        .eq('id', id);
      throw error;
    }
  }

  private async routeFiringAlerts() {
    const client = this.supabase.getServiceClient();
    const [{ data: alerts, error }, { data: operators, error: operatorError }] =
      await Promise.all([
        client
          .from('alert_state')
          .select('alert_key, last_fired_at')
          .eq('is_firing', true),
        client
          .from('profiles')
          .select('id')
          .eq('is_super_admin', true)
          .eq('status', 'ACTIVE'),
      ]);
    if (error) throw error;
    if (operatorError) throw operatorError;
    for (const alert of alerts ?? []) {
      await mapBatches(operators ?? [], 25, (operator) =>
        this.create({
          userId: operator.id,
          category: 'operator',
          severity: 'CRITICAL',
          titleEn: 'Operator alert firing',
          titleBn: 'অপারেটর সতর্কতা সক্রিয়',
          bodyEn: `${alert.alert_key} requires attention.`,
          bodyBn: `${alert.alert_key} মনোযোগ প্রয়োজন।`,
          actionUrl: '/admin/monitoring/alerts',
          resourceType: 'alert_state',
          metadata: { alert_key: alert.alert_key },
          dedupeKey: `alert:${alert.alert_key}:${alert.last_fired_at ?? 'active'}`,
        }),
      );
    }
  }

  private async routeUpcomingRecurringEvents() {
    const client = this.supabase.getServiceClient();
    const today = new Date().toISOString().slice(0, 10);
    const through = new Date(Date.now() + 3 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const { data: events, error } = await client
      .from('calendar_events')
      .select('id, workspace_id, title, local_date, recurring_rule_id')
      .eq('status', 'UPCOMING')
      .not('recurring_rule_id', 'is', null)
      .gte('local_date', today)
      .lte('local_date', through)
      .limit(200);
    if (error) throw error;
    for (const event of events ?? []) {
      const { data: members, error: memberError } = await client
        .from('workspace_members')
        .select('user_id')
        .eq('workspace_id', event.workspace_id)
        .eq('status', 'ACTIVE');
      if (memberError) throw memberError;
      await mapBatches(members ?? [], 25, (member) =>
        this.create({
          userId: member.user_id,
          workspaceId: event.workspace_id,
          category: 'recurring',
          severity: 'INFO',
          titleEn: 'Recurring item coming up',
          titleBn: 'পুনরাবৃত্ত আইটেম সামনে আসছে',
          bodyEn: `${event.title} is due on ${event.local_date}.`,
          bodyBn: `${event.title} ${event.local_date} তারিখে নির্ধারিত।`,
          actionUrl: '/dashboard/calendar',
          resourceType: 'calendar_event',
          resourceId: event.id,
          dedupeKey: `recurring-upcoming:${event.id}:${event.local_date}`,
        }),
      );
    }
  }

  private async releaseQuietHourDeliveries() {
    const client = this.supabase.getServiceClient();
    const { data, error } = await client
      .from('notification_deliveries')
      .select('id, notification_id, notifications!inner(user_id)')
      .eq('status', 'SUPPRESSED')
      .eq('error', 'Suppressed during quiet hours')
      .limit(100);
    if (error) throw error;
    for (const delivery of data ?? []) {
      const joined = delivery.notifications;
      const { data: profile, error: profileError } = await client
        .from('profiles')
        .select('quiet_hours_start, quiet_hours_end, quiet_hours_tz')
        .eq('id', joined.user_id)
        .single();
      if (profileError) throw profileError;
      if (!isInQuietHours(profile)) {
        await client
          .from('notification_deliveries')
          .update({
            status: 'PENDING',
            error: null,
            next_attempt_at: new Date().toISOString(),
            lease_owner: null,
            lease_expires_at: null,
          })
          .eq('id', delivery.id);
      }
    }
  }

  private async processPendingDeliveries() {
    const client = this.supabase.getServiceClient();
    const { data, error } = await client.rpc('claim_notification_deliveries', {
      p_worker_id: this.workerId,
      p_batch_size: 50,
      p_lease_seconds: DELIVERY_LEASE_SECONDS,
    });
    if (error) throw error;
    for (const delivery of data ?? []) {
      await this.deliver(delivery);
    }
  }

  private async deliver(
    delivery: Pick<
      Tables<'notification_deliveries'>,
      'id' | 'notification_id' | 'device_id' | 'channel' | 'attempts'
    >,
  ) {
    const client = this.supabase.getServiceClient();
    const { data: notification, error } = await client
      .from('notifications')
      .select('id, user_id, title_en, body_en, action_url, category')
      .eq('id', delivery.notification_id)
      .single();
    if (error) throw error;

    try {
      let providerId: string | null = null;
      if (delivery.channel === 'push') {
        const { data: device, error: deviceError } = await client
          .from('user_devices')
          .select('push_token, push_provider')
          .eq('id', delivery.device_id!)
          .is('revoked_at', null)
          .single();
        if (deviceError) throw deviceError;
        if (device.push_provider !== 'expo' || !device.push_token) {
          throw new Error('Unsupported or missing mobile push provider');
        }
        providerId = await sendExpoPush(device.push_token, notification);
      } else if (delivery.channel === 'email') {
        const { data: authUser, error: userError } =
          await client.auth.admin.getUserById(notification.user_id);
        if (userError || !authUser.user.email)
          throw userError ?? new Error('Recipient email missing');
        providerId = await this.sendEmail(authUser.user.email, notification);
      } else if (delivery.channel === 'webpush') {
        const { data: device, error: deviceError } = await client
          .from('user_devices')
          .select('push_token')
          .eq('id', delivery.device_id!)
          .is('revoked_at', null)
          .single();
        if (deviceError || !device.push_token)
          throw deviceError ?? new Error('Web Push subscription missing');
        providerId = await this.sendWebPush(
          JSON.parse(device.push_token) as PushSubscription,
          notification,
        );
      }
      await client
        .from('notification_deliveries')
        .update({
          status: 'SENT',
          attempts: delivery.attempts + 1,
          provider_id: providerId,
          sent_at: new Date().toISOString(),
          error: null,
          lease_owner: null,
          lease_expires_at: null,
        })
        .eq('id', delivery.id)
        .eq('lease_owner', this.workerId);
    } catch (cause) {
      const attempts = delivery.attempts + 1;
      const failed = attempts >= MAX_DELIVERY_ATTEMPTS;
      const now = new Date();
      const nextAttempt = new Date(
        now.getTime() + deliveryBackoffSeconds(attempts) * 1000,
      );
      await client
        .from('notification_deliveries')
        .update({
          status: failed ? 'FAILED' : 'PENDING',
          attempts,
          error:
            cause instanceof Error
              ? cause.message.slice(0, 1000)
              : String(cause).slice(0, 1000),
          next_attempt_at: nextAttempt.toISOString(),
          lease_owner: null,
          lease_expires_at: null,
          dead_lettered_at: failed ? now.toISOString() : null,
        })
        .eq('id', delivery.id)
        .eq('lease_owner', this.workerId);
    }
  }

  private async sendEmail(
    to: string,
    notification: Pick<
      Tables<'notifications'>,
      'id' | 'title_en' | 'body_en' | 'action_url'
    >,
  ): Promise<string> {
    this.smtpTransport ??= nodemailer.createTransport({
      host: this.config.get<string>('SMTP_HOST') ?? '127.0.0.1',
      port: Number(this.config.get<string>('SMTP_PORT') ?? 54325),
      secure: this.config.get<string>('SMTP_SECURE') === 'true',
      ...(this.config.get<string>('SMTP_USER')
        ? {
            auth: {
              user: this.config.get<string>('SMTP_USER'),
              pass: this.config.get<string>('SMTP_PASSWORD'),
            },
          }
        : {}),
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: DELIVERY_TIMEOUT_MS,
    });
    const baseUrl =
      this.config.get<string>('WEB_URL') ?? 'http://localhost:3000';
    const action = notification.action_url
      ? new URL(notification.action_url, baseUrl).toString()
      : `${baseUrl}/dashboard/notifications`;
    const result = await this.smtpTransport.sendMail({
      from:
        this.config.get<string>('NOTIFICATION_EMAIL_FROM') ??
        'NoorixFin <notifications@localhost>',
      to,
      subject: notification.title_en,
      text: `${notification.body_en}\n\nOpen NoorixFin: ${action}`,
      html: `<h2>${escapeHtml(notification.title_en)}</h2><p>${escapeHtml(notification.body_en)}</p><p><a href="${escapeHtml(action)}">Open NoorixFin</a></p>`,
      headers: { 'X-NoorixFin-Notification-ID': notification.id },
    });
    return result.messageId;
  }

  private async sendWebPush(
    subscription: PushSubscription,
    notification: Pick<
      Tables<'notifications'>,
      'id' | 'title_en' | 'body_en' | 'action_url' | 'category'
    >,
  ): Promise<string | null> {
    const publicKey = this.config.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = this.config.get<string>('VAPID_PRIVATE_KEY');
    if (!publicKey || !privateKey)
      throw new Error('VAPID keys are not configured');
    webPush.setVapidDetails(
      this.config.get<string>('VAPID_SUBJECT') ??
        'mailto:security@noorixfin.local',
      publicKey,
      privateKey,
    );
    const response = await webPush.sendNotification(
      subscription,
      JSON.stringify({
        notificationId: notification.id,
        title: notification.title_en,
        body: notification.body_en,
        actionUrl: notification.action_url ?? '/dashboard/notifications',
        category: notification.category,
      }),
      {
        TTL: 86_400,
        urgency: notification.category === 'security' ? 'high' : 'normal',
        timeout: DELIVERY_TIMEOUT_MS,
      },
    );
    return response.headers.location ?? null;
  }

  private async processExpoReceipts() {
    const client = this.supabase.getServiceClient();
    const { data, error } = await client
      .from('notification_deliveries')
      .select('id, provider_id')
      .eq('channel', 'push')
      .eq('status', 'SENT')
      .not('provider_id', 'is', null)
      .limit(100);
    if (error) throw error;
    if (!data?.length) return;
    const response = await fetch(
      'https://exp.host/--/api/v2/push/getReceipts',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ ids: data.map((row) => row.provider_id) }),
        signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
      },
    );
    if (!response.ok) return;
    const body = (await response.json()) as {
      data?: Record<string, { status: string; message?: string }>;
    };
    for (const row of data) {
      const receipt = row.provider_id
        ? body.data?.[row.provider_id]
        : undefined;
      if (!receipt) continue;
      await client
        .from('notification_deliveries')
        .update({
          status: receipt.status === 'ok' ? 'DELIVERED' : 'FAILED',
          error:
            receipt.status === 'ok'
              ? null
              : (receipt.message ?? 'Expo delivery failed'),
        })
        .eq('id', row.id);
    }
  }
}

function decodeCursor(cursor: string): string | null {
  try {
    const value = Buffer.from(cursor, 'base64url').toString('utf8');
    return Number.isNaN(Date.parse(value)) ? null : value;
  } catch {
    return null;
  }
}

function suppressionReason(
  enabled: boolean,
  quiet: boolean,
  digesting: boolean,
): string | null {
  if (!enabled) return 'Disabled by user preference';
  if (digesting) return 'Deferred to digest';
  if (quiet) return 'Suppressed during quiet hours';
  return null;
}

function isInQuietHours(
  profile: {
    quiet_hours_start: string | null;
    quiet_hours_end: string | null;
    quiet_hours_tz: string | null;
  } | null,
): boolean {
  if (!profile?.quiet_hours_start || !profile.quiet_hours_end) return false;
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: profile.quiet_hours_tz ?? 'UTC',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date());
    const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
    const minute = Number(
      parts.find((part) => part.type === 'minute')?.value ?? 0,
    );
    const now = hour * 60 + minute;
    const start = toMinutes(profile.quiet_hours_start);
    const end = toMinutes(profile.quiet_hours_end);
    return start <= end ? now >= start && now < end : now >= start || now < end;
  } catch {
    return false;
  }
}

function toMinutes(value: string): number {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}

async function sendExpoPush(
  token: string,
  notification: Pick<
    Tables<'notifications'>,
    'id' | 'title_en' | 'body_en' | 'action_url' | 'category'
  >,
): Promise<string | null> {
  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      to: token,
      title: notification.title_en,
      body: notification.body_en,
      data: {
        notificationId: notification.id,
        actionUrl: notification.action_url,
      },
      channelId: notification.category,
      sound: 'default',
    }),
    signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
  });
  if (!response.ok)
    throw new Error(`Expo Push returned HTTP ${response.status}`);
  const payload = (await response.json()) as {
    data?: { status?: string; id?: string; message?: string };
  };
  if (payload.data?.status === 'error')
    throw new Error(payload.data.message ?? 'Expo Push rejected message');
  return payload.data?.id ?? null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[char]!,
  );
}

async function mapBatches<T>(
  rows: T[],
  size: number,
  work: (row: T) => Promise<unknown>,
): Promise<void> {
  for (let index = 0; index < rows.length; index += size) {
    await Promise.all(rows.slice(index, index + size).map(work));
  }
}
