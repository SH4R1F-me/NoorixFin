/**
 * Account Service — DEC-017
 *
 * The user-facing half of the account lifecycle: requesting deletion, cancelling
 * it, and reading the broadcasts addressed to them.
 *
 * Password changes are deliberately NOT here. They are a session operation on
 * the Supabase Auth server, and the web app performs them through its
 * cookie-bound `@supabase/ssr` client (`auth.updateUser`), which is the
 * supported path and the only one that honours `secure_password_change`. Routing
 * them through this API would mean handling a plaintext password in a second
 * service for no benefit.
 */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AuditService } from '../observability/audit.service';
import { SystemEventsService } from '../observability/system-events.service';
import { NotificationsService } from '../notifications/notifications.service';

/** DEC-017: how long data survives a deletion request. */
export const DELETION_GRACE_DAYS = 30;

@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly audit: AuditService,
    private readonly systemEvents: SystemEventsService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Schedule the account for deletion after a 30-day grace period.
   *
   * Nothing is deleted here. The account is banned (so it cannot be used or
   * signed into), marked PENDING_DELETION, and given a deadline. Every row the
   * user owns is untouched until `purge_expired_deletions()` runs after the
   * deadline — which is what makes this recoverable, by the user signing back in
   * after an operator reinstates them, or by an operator directly.
   *
   * A finance app that irreversibly destroys years of records on one click is
   * not one people should trust with years of records.
   */
  async requestDeletion(
    userId: string,
    email: string,
    confirmEmail: string,
    reason: string,
    accessToken: string,
  ) {
    // Typed confirmation. Case-insensitive because email addresses are, but
    // otherwise exact — this is the deliberate friction.
    if (confirmEmail.trim().toLowerCase() !== email.trim().toLowerCase()) {
      throw new BadRequestException({
        code: 'CONFIRMATION_MISMATCH',
        message:
          'The confirmation address does not match the signed-in account',
      });
    }

    const userClient = this.supabaseService.getUserClient(accessToken);
    const { data: profile } = await userClient
      .from('profiles')
      .select('status, is_super_admin')
      .eq('id', userId)
      .single();

    if (profile?.status === 'PENDING_DELETION') {
      throw new BadRequestException({
        code: 'ALREADY_PENDING',
        message: 'This account is already scheduled for deletion',
      });
    }

    // An operator deleting themselves through the normal settings page could
    // leave the platform with no administrator and no UI path to appoint one.
    if (profile?.is_super_admin) {
      const client = this.supabaseService.getServiceClient();
      const { count } = await client
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('is_super_admin', true)
        .eq('status', 'ACTIVE');
      if ((count ?? 0) <= 1) {
        throw new ForbiddenException({
          code: 'LAST_SUPER_ADMIN',
          message:
            'You are the last active operator. Appoint another super admin before deleting this account.',
        });
      }
    }

    const scheduledFor = new Date(
      Date.now() + DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000,
    );

    const client = this.supabaseService.getServiceClient();

    const { error } = await client
      .from('profiles')
      .update({
        status: 'PENDING_DELETION',
        deletion_requested_at: new Date().toISOString(),
        deletion_scheduled_for: scheduledFor.toISOString(),
      })
      .eq('id', userId);

    if (error) {
      throw new BadRequestException({
        code: 'DELETION_REQUEST_FAILED',
        message: error.message,
      });
    }

    // Ban AFTER the row is marked. If the ban succeeded and the update failed we
    // would have an account nobody can sign into and nothing scheduled to clean
    // it up — a silent lockout with no record of why.
    const { error: banError } = await client.auth.admin.updateUserById(userId, {
      ban_duration: '876000h',
    });
    if (banError) {
      this.logger.error(
        `Marked ${userId} PENDING_DELETION but the auth ban failed: ${banError.message}`,
      );
    }

    await this.audit.write({
      actorId: userId,
      action: 'ACCOUNT_DELETION_REQUESTED',
      resourceType: 'profile',
      resourceId: userId,
      metadata: {
        reason,
        scheduled_for: scheduledFor.toISOString(),
        grace_days: DELETION_GRACE_DAYS,
      },
    });
    this.systemEvents.record({
      level: 'INFO',
      eventCode: 'ACCOUNT_DELETION_REQUESTED',
      message: `Account scheduled for deletion in ${DELETION_GRACE_DAYS} days`,
      actorId: userId,
    });
    await this.notifications.create({
      userId,
      category: 'account',
      severity: 'WARNING',
      titleEn: 'Account deletion scheduled',
      titleBn: 'অ্যাকাউন্ট মুছে ফেলার সময় নির্ধারিত হয়েছে',
      bodyEn: `Your account is scheduled for deletion on ${scheduledFor.toISOString().slice(0, 10)}.`,
      bodyBn: `আপনার অ্যাকাউন্ট ${scheduledFor.toISOString().slice(0, 10)} তারিখে মুছে ফেলার জন্য নির্ধারিত।`,
      actionUrl: '/dashboard/settings',
      dedupeKey: `deletion-scheduled:${scheduledFor.toISOString()}`,
    });

    return {
      status: 'PENDING_DELETION',
      deletion_scheduled_for: scheduledFor.toISOString(),
      grace_days: DELETION_GRACE_DAYS,
    };
  }

  /**
   * Cancel a pending deletion.
   *
   * Rarely reachable by the user themselves — requesting deletion bans the
   * account, so the session dies at the next token refresh. It exists for the
   * window before that, and for the partial-failure case where the profile was
   * marked but the ban did not apply. The operator path
   * (POST /v1/admin/users/:id/reinstate) is the primary one.
   */
  async cancelDeletion(userId: string, accessToken: string) {
    const userClient = this.supabaseService.getUserClient(accessToken);
    const { data: profile } = await userClient
      .from('profiles')
      .select('status')
      .eq('id', userId)
      .single();

    if (profile?.status !== 'PENDING_DELETION') {
      throw new BadRequestException({
        code: 'NOT_PENDING',
        message: 'This account is not scheduled for deletion',
      });
    }

    const client = this.supabaseService.getServiceClient();
    const { error } = await client
      .from('profiles')
      .update({
        status: 'ACTIVE',
        deletion_requested_at: null,
        deletion_scheduled_for: null,
      })
      .eq('id', userId);

    if (error) {
      throw new BadRequestException({
        code: 'CANCEL_FAILED',
        message: error.message,
      });
    }

    const { error: banError } = await client.auth.admin.updateUserById(userId, {
      ban_duration: 'none',
    });
    if (banError) {
      this.logger.error(
        `Cancelled deletion for ${userId} but failed to lift the ban: ${banError.message}`,
      );
    }

    await this.audit.write({
      actorId: userId,
      action: 'ACCOUNT_DELETION_CANCELLED',
      resourceType: 'profile',
      resourceId: userId,
    });
    await this.notifications.create({
      userId,
      category: 'account',
      severity: 'SUCCESS',
      titleEn: 'Account deletion cancelled',
      titleBn: 'অ্যাকাউন্ট মুছে ফেলা বাতিল হয়েছে',
      bodyEn: 'Your NoorixFin account will remain active.',
      bodyBn: 'আপনার NoorixFin অ্যাকাউন্ট সক্রিয় থাকবে।',
      actionUrl: '/dashboard/settings',
      dedupeKey: `deletion-cancelled:${new Date().toISOString()}`,
    });

    return { status: 'ACTIVE' };
  }

  // ─── Broadcasts ───────────────────────────────────────────────────────────

  /**
   * Live broadcasts this user has not dismissed.
   *
   * The visibility rule (published, inside its window, right audience) is
   * enforced by RLS, not by this method — so a bug here can hide a broadcast but
   * cannot leak a draft.
   */
  async listMyBroadcasts(userId: string, accessToken: string) {
    const client = this.supabaseService.getUserClient(accessToken);

    const [{ data: broadcasts, error }, { data: receipts }] = await Promise.all(
      [
        client
          .from('broadcasts')
          .select(
            'id, severity, title_en, title_bn, body_en, body_bn, link_url, dismissible, publish_at, expires_at',
          )
          .order('publish_at', { ascending: false })
          .limit(20),
        client
          .from('broadcast_receipts')
          .select('broadcast_id, dismissed_at')
          .eq('user_id', userId),
      ],
    );

    if (error) {
      throw new BadRequestException({
        code: 'BROADCASTS_UNAVAILABLE',
        message: error.message,
      });
    }

    const dismissed = new Set(
      (
        (receipts ?? []) as Array<{
          broadcast_id: string;
          dismissed_at: string | null;
        }>
      )
        .filter((receipt) => receipt.dismissed_at !== null)
        .map((receipt) => receipt.broadcast_id),
    );

    return (broadcasts ?? []).filter(
      (broadcast) => !dismissed.has(broadcast.id),
    );
  }

  async dismissBroadcast(
    userId: string,
    broadcastId: string,
    accessToken: string,
  ) {
    const client = this.supabaseService.getUserClient(accessToken);

    const { error } = await client.from('broadcast_receipts').upsert(
      {
        broadcast_id: broadcastId,
        user_id: userId,
        dismissed_at: new Date().toISOString(),
      },
      { onConflict: 'broadcast_id,user_id' },
    );

    if (error) {
      throw new BadRequestException({
        code: 'DISMISS_FAILED',
        message: error.message,
      });
    }

    return { dismissed: true };
  }

  // ─── Public settings ──────────────────────────────────────────────────────

  /**
   * The settings any signed-in user may read.
   *
   * `is_public` is enforced by RLS; this reshapes the rows into a flat map so a
   * caller cannot accidentally render an internal key it was never given.
   */
  async getPublicSettings(accessToken: string) {
    const client = this.supabaseService.getUserClient(accessToken);
    const { data, error } = await client
      .from('app_settings')
      .select('key, value')
      .eq('is_public', true);

    if (error) {
      // A settings read failing must not break the app shell that calls it.
      this.logger.warn(`Public settings unavailable: ${error.message}`);
      return {};
    }

    const settings: Record<string, unknown> = {};
    for (const row of (data ?? []) as Array<{ key: string; value: unknown }>) {
      settings[row.key] = row.value;
    }
    return settings;
  }
}
