/**
 * Admin Service — DEC-016
 *
 * Every read path here is metadata. There is no method on this class that can
 * return a monetary amount, a payee, or a transaction note, and adding one would
 * violate DEC-002 #12 / DEC-007 regardless of how the endpoint is guarded.
 *
 * Two client choices, and the reason for each:
 *
 *   getUserClient(token)  — for READS. The admin RPCs and the RLS policies on
 *                           system_events / audit_events are gated on
 *                           `is_super_admin()`, which resolves `auth.uid()` from
 *                           the caller's JWT. Reading with the service role would
 *                           bypass that gate and make the database-level check
 *                           decorative: the API guard would become the only
 *                           thing standing between a bug and every row.
 *
 *   getServiceClient()    — for WRITES and Auth Admin calls. Settings,
 *                           broadcasts and account status have no INSERT/UPDATE
 *                           policy for `authenticated` by design (00013), and
 *                           banning a user is an Auth-server operation.
 */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';
import type { Json, Updatable } from '@noorixfin/db-types';
import { AuditService } from '../observability/audit.service';
import { SystemEventsService } from '../observability/system-events.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  AdminUpdateUserDto,
  CreateBroadcastDto,
  ListAuditQueryDto,
  ListEventsQueryDto,
  ListUsersQueryDto,
  UpdateBroadcastDto,
  UpdateSettingsDto,
  UpdateMobileReleaseDto,
  UpdateDonationOptionDto,
} from './dto/admin.dto';
import {
  MOBILE_RELEASE_KEYS,
  ReleasesService,
} from '../releases/releases.service';

/**
 * A ban long enough to be permanent in practice, short enough that GoTrue
 * accepts it. Suspension is reversible — reinstating sets this to 'none'.
 */
const SUSPEND_BAN_DURATION = '876000h'; // ~100 years

/** Grace period before a deletion request becomes irreversible (DEC-017). */
export const DELETION_GRACE_DAYS = 30;

export interface Paginated<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Drop the window function's `total_count` from a user row.
 *
 * It is the page total repeated on every row; left in place it reads as a
 * per-user figure. Written as an explicit delete rather than a destructure so
 * there is no unused binding for the linter to flag.
 */
function stripTotalCount(
  row: Record<string, unknown>,
): Record<string, unknown> {
  const copy = { ...row };
  delete copy.total_count;
  return copy;
}

/**
 * Copy `value` onto `target[key]` when it is defined.
 *
 * Exists purely to satisfy correlated-union assignment: `for (const key of
 * KEYS) target[key] = source[key]` is sound but unprovable to the compiler,
 * and the alternative is widening the target back to `Record<string, unknown>`
 * — which is exactly the looseness that let a misspelled column write nothing
 * and still return 200.
 */
function assignIfDefined<T, K extends keyof T>(
  target: T,
  key: K,
  value: T[K] | undefined,
): void {
  if (value !== undefined) target[key] = value;
}

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);
  private readonly startedAt = Date.now();

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly audit: AuditService,
    private readonly systemEvents: SystemEventsService,
    private readonly notifications: NotificationsService,
    private readonly releases: ReleasesService,
  ) {}

  // ─── Overview & health ────────────────────────────────────────────────────

  async getOverview(accessToken: string) {
    const client = this.supabaseService.getUserClient(accessToken);

    const dbStart = Date.now();
    const { data, error } = await client.rpc('admin_platform_stats');
    const dbLatencyMs = Date.now() - dbStart;

    // A 42501 here is the RPC's own super-admin gate firing. The guard should
    // have caught that first; if we are here the two disagree, which translate()
    // surfaces as a 403 — distinct from a missing-grant 42501, which it does not.
    if (error) throw this.translate(error);

    return {
      ...(data as Record<string, unknown>),
      api: {
        uptime_seconds: Math.floor((Date.now() - this.startedAt) / 1000),
        db_latency_ms: dbLatencyMs,
        version: process.env.npm_package_version ?? '0.1.0',
        node_env: process.env.NODE_ENV ?? 'development',
        // Buffered-but-unwritten telemetry. Persistently non-zero means the
        // flush is failing and the monitoring feed is lying by omission.
        telemetry_pending: this.systemEvents.pending,
      },
    };
  }

  /**
   * Deep health check — actually touches each dependency rather than reporting
   * "ok" because the process is running. A health endpoint that cannot fail is
   * not a health endpoint.
   */
  async getHealth(accessToken: string) {
    const client = this.supabaseService.getUserClient(accessToken);

    const [database, auth, storage] = await Promise.all([
      this.probe('database', async () => {
        const { error } = await client
          .from('app_settings')
          .select('key')
          .limit(1);
        if (error) throw new Error(error.message);
      }),
      this.probe('auth', async () => {
        const response = await fetch(
          `${this.supabaseService.getSupabaseUrl()}/auth/v1/health`,
          {
            headers: this.supabaseService.getGatewayHeaders(),
            signal: AbortSignal.timeout(5000),
          },
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
      }),
      this.probe('storage', async () => {
        const response = await fetch(
          `${this.supabaseService.getSupabaseUrl()}/storage/v1/version`,
          {
            headers: this.supabaseService.getGatewayHeaders(),
            signal: AbortSignal.timeout(5000),
          },
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
      }),
    ]);

    const checks = [database, auth, storage];
    return {
      status: checks.every((c) => c.ok) ? 'healthy' : 'degraded',
      checks,
      checked_at: new Date().toISOString(),
    };
  }

  private async probe(name: string, fn: () => Promise<void>) {
    const started = Date.now();
    try {
      await fn();
      return { name, ok: true, latency_ms: Date.now() - started, error: null };
    } catch (error) {
      return {
        name,
        ok: false,
        latency_ms: Date.now() - started,
        error: error instanceof Error ? error.message : 'unknown error',
      };
    }
  }

  // ─── System events ────────────────────────────────────────────────────────

  async listEvents(
    accessToken: string,
    query: ListEventsQueryDto,
  ): Promise<Paginated<Record<string, unknown>>> {
    const client = this.supabaseService.getUserClient(accessToken);
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;

    let builder = client
      .from('system_events')
      .select('*', { count: 'exact' })
      .order('id', { ascending: false });

    if (query.level) builder = builder.eq('level', query.level);
    if (query.source) builder = builder.eq('source', query.source);
    if (query.since) builder = builder.gte('created_at', query.since);
    if (query.afterId !== undefined) builder = builder.gt('id', query.afterId);
    if (query.q) {
      // Escape PostgREST's `or` list separators before interpolation, or a
      // comma in the search box becomes a second filter expression.
      const term = query.q.replace(/[,()]/g, ' ');
      builder = builder.or(
        `message.ilike.%${term}%,event_code.ilike.%${term}%`,
      );
    }

    const { data, error, count } = await builder.range(
      offset,
      offset + limit - 1,
    );

    if (error) throw this.translate(error);

    return {
      items: data ?? [],
      total: count ?? 0,
      limit,
      offset,
    };
  }

  /** Newest-first slice used by the live tail; returns ascending for append. */
  async pollEvents(accessToken: string, afterId: number) {
    const page = await this.listEvents(accessToken, { afterId, limit: 100 });
    return page.items.slice().reverse();
  }

  async pruneEvents(accessToken: string, actorId: string) {
    const client = this.supabaseService.getServiceClient();
    const { data, error } = await client.rpc('prune_system_events');
    if (error) throw this.translate(error);

    await this.audit.write({
      actorId,
      action: 'SYSTEM_EVENTS_PRUNED',
      resourceType: 'system_events',
      metadata: { deleted: data },
    });

    return { deleted: data ?? 0 };
  }

  /**
   * Scheduled jobs and their last outcome — audit item 8.
   *
   * Read-only and NOT audited: listing jobs changes nothing, and writing an
   * audit row for every console refresh would bury the entries that record
   * actual operator actions.
   */
  async getScheduledJobs(accessToken: string) {
    void accessToken; // service role: cron.job is owned by postgres
    const client = this.supabaseService.getServiceClient();
    const { data, error } = await client.rpc('admin_scheduled_jobs');
    if (error) throw this.translate(error);
    return data;
  }

  // ─── Audit trail ──────────────────────────────────────────────────────────

  async listAudit(
    accessToken: string,
    query: ListAuditQueryDto,
  ): Promise<Paginated<Record<string, unknown>>> {
    const client = this.supabaseService.getUserClient(accessToken);
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;

    let builder = client
      .from('audit_events')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (query.action) builder = builder.eq('action', query.action);
    if (query.resourceType)
      builder = builder.eq('resource_type', query.resourceType);
    if (query.actorId) builder = builder.eq('actor_id', query.actorId);

    const { data, error, count } = await builder.range(
      offset,
      offset + limit - 1,
    );
    if (error) throw this.translate(error);

    return {
      items: data ?? [],
      total: count ?? 0,
      limit,
      offset,
    };
  }

  // ─── User management ──────────────────────────────────────────────────────

  async listUsers(accessToken: string, query: ListUsersQueryDto) {
    const client = this.supabaseService.getUserClient(accessToken);
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;

    const { data, error } = await client.rpc('admin_user_overview', {
      // Omitted rather than sent as null: these params carry DEFAULT NULL in
      // SQL, and there is only one signature, so there is no overload to
      // disambiguate (unlike category_report, where the nulls are load-bearing).
      ...(query.search ? { p_search: query.search } : {}),
      ...(query.status ? { p_status: query.status } : {}),
      p_limit: limit,
      p_offset: offset,
    });

    if (error) throw this.translate(error);

    const rows = (data ?? []) as Array<Record<string, unknown>>;
    return {
      items: rows.map(stripTotalCount),
      total: rows.length > 0 ? Number(rows[0].total_count) : 0,
      limit,
      offset,
    };
  }

  async getUser(accessToken: string, userId: string) {
    const client = this.supabaseService.getUserClient(accessToken);
    const { data, error } = await client.rpc('admin_user_overview', {
      p_limit: 200,
      p_offset: 0,
    });
    if (error) throw this.translate(error);

    const rows = (data ?? []) as Array<Record<string, unknown>>;
    const match = rows.find((row) => row.user_id === userId);
    if (!match) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'No such user',
      });
    }
    return stripTotalCount(match);
  }

  /**
   * Update the operator-editable subset of a profile.
   *
   * The DTO is the allowlist and ValidationPipe rejects anything outside it, but
   * the payload is rebuilt field by field here anyway. Two independent
   * enforcement points, because "the pipe will catch it" is exactly the
   * assumption that breaks when someone reconfigures the pipe.
   */
  async updateUser(
    accessToken: string,
    actorId: string,
    userId: string,
    dto: AdminUpdateUserDto,
  ) {
    const payload: Updatable<'profiles'> = {};
    if (dto.display_name !== undefined) payload.display_name = dto.display_name;
    if (dto.locale !== undefined) payload.locale = dto.locale;
    if (dto.timezone !== undefined) payload.timezone = dto.timezone;

    if (Object.keys(payload).length === 0) {
      throw new BadRequestException({
        code: 'NO_CHANGES',
        message: 'No editable fields supplied',
      });
    }

    const client = this.supabaseService.getServiceClient();
    const { error } = await client
      .from('profiles')
      .update(payload)
      .eq('id', userId);
    if (error) throw this.translate(error);

    await this.audit.write({
      actorId,
      action: 'ADMIN_USER_UPDATED',
      resourceType: 'profile',
      resourceId: userId,
      metadata: { fields: Object.keys(payload) },
    });

    return this.getUser(accessToken, userId);
  }

  /**
   * Suspend an account.
   *
   * Enforcement is Supabase Auth's `banned_until`, not the `profiles.status`
   * column: the auth server then refuses to issue or refresh tokens, so no
   * per-request database check is needed on the hot path (DEC-011).
   *
   * HONEST LIMITATION: an access token already in the user's hands stays valid
   * until it expires (jwt_expiry, 1 hour by default) because the API verifies
   * JWTs locally and does not consult the auth server per request (DEC-011).
   * Refresh is blocked immediately, so the ceiling on continued access is one
   * token lifetime. Reducing that means reducing jwt_expiry, which is a
   * deliberate cost trade, not a bug to fix here.
   */
  async suspendUser(
    accessToken: string,
    actorId: string,
    userId: string,
    reason: string,
  ) {
    if (userId === actorId) {
      throw new BadRequestException({
        code: 'CANNOT_SUSPEND_SELF',
        message: 'You cannot suspend your own operator account',
      });
    }

    const client = this.supabaseService.getServiceClient();
    await this.assertNotLastSuperAdmin(client, userId, 'suspend');

    const { error: banError } = await client.auth.admin.updateUserById(userId, {
      ban_duration: SUSPEND_BAN_DURATION,
    });
    if (banError) {
      throw new BadRequestException({
        code: 'SUSPEND_FAILED',
        message: banError.message,
      });
    }

    const { error } = await client
      .from('profiles')
      .update({
        status: 'SUSPENDED',
        suspended_at: new Date().toISOString(),
        suspended_reason: reason,
      })
      .eq('id', userId);
    if (error) throw this.translate(error);

    await this.audit.write({
      actorId,
      action: 'ADMIN_USER_SUSPENDED',
      resourceType: 'profile',
      resourceId: userId,
      metadata: { reason },
    });
    this.systemEvents.record({
      level: 'WARN',
      eventCode: 'USER_SUSPENDED',
      message: `Account ${userId} suspended`,
      actorId,
      metadata: { reason },
    });
    await this.notifications.create({
      userId,
      category: 'security',
      severity: 'CRITICAL',
      titleEn: 'Your NoorixFin account was suspended',
      titleBn: 'আপনার NoorixFin অ্যাকাউন্ট স্থগিত করা হয়েছে',
      bodyEn:
        'An operator suspended your account. Contact support if you believe this is a mistake.',
      bodyBn:
        'একজন অপারেটর আপনার অ্যাকাউন্ট স্থগিত করেছেন। এটি ভুল হলে সহায়তার সাথে যোগাযোগ করুন।',
      actionUrl: '/dashboard/settings',
      dedupeKey: `account-suspended:${userId}:${new Date().toISOString()}`,
    });

    return this.getUser(accessToken, userId);
  }

  async reinstateUser(accessToken: string, actorId: string, userId: string) {
    const client = this.supabaseService.getServiceClient();

    const { error: banError } = await client.auth.admin.updateUserById(userId, {
      ban_duration: 'none',
    });
    if (banError) {
      throw new BadRequestException({
        code: 'REINSTATE_FAILED',
        message: banError.message,
      });
    }

    const { error } = await client
      .from('profiles')
      .update({
        status: 'ACTIVE',
        suspended_at: null,
        suspended_reason: null,
        // Reinstating also cancels a pending deletion — the account is being
        // put back into service, and leaving a purge scheduled would delete it
        // out from under the operator who just restored it.
        deletion_requested_at: null,
        deletion_scheduled_for: null,
      })
      .eq('id', userId);
    if (error) throw this.translate(error);

    await this.audit.write({
      actorId,
      action: 'ADMIN_USER_REINSTATED',
      resourceType: 'profile',
      resourceId: userId,
    });

    return this.getUser(accessToken, userId);
  }

  /**
   * Run the purge for every account whose 30-day grace has expired.
   *
   * Two steps, in this order: the SQL function removes application data in
   * foreign-key dependency order, then the auth user is removed through the
   * Admin API. Reversing them would strand orphaned ledger rows behind a
   * RESTRICT constraint with no owner to attribute them to.
   */
  async runPurge(actorId: string) {
    const client = this.supabaseService.getServiceClient();

    const { data, error } = await client.rpc('purge_expired_deletions', {
      p_limit: 50,
    });
    if (error) throw this.translate(error);

    const purged = ((data ?? []) as Array<{ user_id: string }>).map(
      (row) => row.user_id,
    );

    const failures: string[] = [];
    for (const userId of purged) {
      const { error: deleteError } = await client.auth.admin.deleteUser(userId);
      if (deleteError) {
        // Application data is already gone; the auth shell remains. Surface it
        // rather than reporting a clean purge.
        failures.push(userId);
        this.logger.error(
          `Purged data for ${userId} but failed to delete the auth user: ${deleteError.message}`,
        );
      }
    }

    await this.audit.write({
      actorId,
      action: 'ADMIN_PURGE_RUN',
      resourceType: 'profile',
      metadata: { purged_count: purged.length, auth_delete_failures: failures },
    });

    return { purged: purged.length, auth_delete_failures: failures };
  }

  /**
   * Refuse to suspend the only remaining operator.
   *
   * Locking every administrator out of the platform is not recoverable from the
   * UI — it needs psql and the bootstrap script. Cheap check, expensive mistake.
   */
  private async assertNotLastSuperAdmin(
    client: SupabaseClient,
    userId: string,
    action: string,
  ) {
    const { data: target } = await client
      .from('profiles')
      .select('is_super_admin')
      .eq('id', userId)
      .single();

    if (!target?.is_super_admin) return;

    const { count } = await client
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('is_super_admin', true)
      .eq('status', 'ACTIVE');

    if ((count ?? 0) <= 1) {
      throw new BadRequestException({
        code: 'LAST_SUPER_ADMIN',
        message: `Cannot ${action} the last active super admin — the platform would have no operator`,
      });
    }
  }

  // ─── Global settings ──────────────────────────────────────────────────────

  async listSettings(accessToken: string) {
    const client = this.supabaseService.getUserClient(accessToken);
    const { data, error } = await client
      .from('app_settings')
      .select('*')
      .order('key');
    if (error) throw this.translate(error);
    return data ?? [];
  }

  async updateSettings(
    accessToken: string,
    actorId: string,
    dto: UpdateSettingsDto,
  ) {
    const client = this.supabaseService.getServiceClient();

    // Only keys that already exist may be written. Settings are declared by
    // migration, so an unknown key is a typo or an injection attempt — never a
    // new feature arriving through the console.
    const { data: existing, error: readError } = await client
      .from('app_settings')
      .select('key');
    if (readError) throw this.translate(readError);

    const known = new Set((existing ?? []).map((row) => row.key));
    const unknown = dto.settings.filter((s) => !known.has(s.key));
    if (unknown.length > 0) {
      throw new BadRequestException({
        code: 'UNKNOWN_SETTING',
        message: `Unknown setting key(s): ${unknown.map((s) => s.key).join(', ')}`,
      });
    }

    for (const setting of dto.settings) {
      const { error } = await client
        .from('app_settings')
        .update({
          // `app_settings.value` is jsonb. The DTO types it as a plain object,
          // which is a subset of Json but not structurally assignable to it.
          value: setting.value as Json,
          updated_by: actorId,
          updated_at: new Date().toISOString(),
        })
        .eq('key', setting.key);
      if (error) throw this.translate(error);
    }

    await this.audit.write({
      actorId,
      action: 'ADMIN_SETTINGS_UPDATED',
      resourceType: 'app_settings',
      metadata: { keys: dto.settings.map((s) => s.key) },
    });

    return this.listSettings(accessToken);
  }

  async getSiteSettings() {
    const client = this.supabaseService.getServiceClient();
    const [settings, donations] = await Promise.all([
      client
        .from('site_settings')
        .select('key, value, label, description, updated_at')
        .order('key'),
      client
        .from('donation_options')
        .select('*')
        .order('display_order', { ascending: true }),
    ]);
    if (settings.error) throw this.translate(settings.error);
    if (donations.error) throw this.translate(donations.error);
    return {
      settings: settings.data ?? [],
      donation_options: donations.data ?? [],
    };
  }

  async updateSiteLogo(actorId: string, encoded: string) {
    let bytes: Buffer;
    try {
      bytes = Buffer.from(encoded, 'base64');
    } catch {
      throw new BadRequestException({
        code: 'INVALID_LOGO',
        message: 'Logo is not valid base64.',
      });
    }
    if (bytes.length === 0 || bytes.length > 2 * 1024 * 1024) {
      throw new BadRequestException({
        code: 'INVALID_LOGO',
        message: 'Logo must be under 2 MB.',
      });
    }
    const image = this.detectSiteLogo(bytes);
    if (!image) {
      throw new BadRequestException({
        code: 'INVALID_LOGO',
        message: 'Unsupported image content. Use PNG, JPG, or WebP.',
      });
    }

    const client = this.supabaseService.getServiceClient();
    const path = `logos/site-logo.${image.extension}`;
    const { error: uploadError } = await client.storage
      .from('site-assets')
      .upload(path, bytes, { contentType: image.contentType, upsert: true });
    if (uploadError) throw this.translate(uploadError);
    const { data } = client.storage.from('site-assets').getPublicUrl(path);
    const { error: settingError } = await client.from('site_settings').upsert({
      key: 'logo_url',
      value: data.publicUrl,
      updated_by: actorId,
      updated_at: new Date().toISOString(),
    });
    if (settingError) throw this.translate(settingError);
    await this.audit.write({
      actorId,
      action: 'ADMIN_SITE_LOGO_UPDATED',
      resourceType: 'site_settings',
      metadata: { content_type: image.contentType },
    });
    return { url: `${data.publicUrl}?v=${Date.now()}` };
  }

  async clearSiteLogo(actorId: string) {
    const client = this.supabaseService.getServiceClient();
    const { error } = await client.from('site_settings').upsert({
      key: 'logo_url',
      value: null,
      updated_by: actorId,
      updated_at: new Date().toISOString(),
    });
    if (error) throw this.translate(error);
    const { error: removeError } = await client.storage
      .from('site-assets')
      .remove([
        'logos/site-logo.png',
        'logos/site-logo.jpg',
        'logos/site-logo.webp',
      ]);
    if (removeError)
      this.logger.warn(
        `Could not remove old site logo objects: ${removeError.message}`,
      );
    await this.audit.write({
      actorId,
      action: 'ADMIN_SITE_LOGO_CLEARED',
      resourceType: 'site_settings',
    });
    return { url: null };
  }

  async updateDonationOption(
    actorId: string,
    type: string,
    dto: UpdateDonationOptionDto,
  ) {
    if (type !== 'development' && type !== 'palestine') {
      throw new BadRequestException({
        code: 'INVALID_DONATION_TYPE',
        message: 'Unknown donation option.',
      });
    }
    for (const method of dto.payment_methods) {
      const destination =
        method.method === 'link' || method.method === 'paypal'
          ? method.url
          : method.account;
      if (!destination) {
        throw new BadRequestException({
          code: 'INVALID_PAYMENT_METHOD',
          message: `${method.label} needs an account number or HTTPS URL.`,
        });
      }
    }
    const client = this.supabaseService.getServiceClient();
    const { data, error } = await client
      .from('donation_options')
      .update({
        title: dto.title.trim(),
        subtitle: dto.subtitle.trim(),
        description: dto.description.trim(),
        payment_methods: dto.payment_methods as unknown as Json,
        updated_at: new Date().toISOString(),
      })
      .eq('type', type)
      .select('*')
      .single();
    if (error) throw this.translate(error);
    await this.audit.write({
      actorId,
      action: 'ADMIN_DONATION_OPTION_UPDATED',
      resourceType: 'donation_option',
      resourceId: data.id,
      metadata: { type },
    });
    return data;
  }

  private detectSiteLogo(
    bytes: Uint8Array,
  ): { extension: 'png' | 'jpg' | 'webp'; contentType: string } | null {
    if (
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    )
      return { extension: 'png', contentType: 'image/png' };
    if (
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff
    )
      return { extension: 'jpg', contentType: 'image/jpeg' };
    if (
      bytes.length >= 12 &&
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50
    )
      return { extension: 'webp', contentType: 'image/webp' };
    return null;
  }

  getMobileRelease() {
    return this.releases.getMobileRelease();
  }

  async updateMobileRelease(actorId: string, dto: UpdateMobileReleaseDto) {
    const toSafeUrl = (
      value: string | undefined,
      field: string,
    ): string | null => {
      const clean = value?.trim();
      if (!clean) return null;
      if (clean.startsWith('/') && !clean.startsWith('//')) return clean;
      try {
        const url = new URL(clean);
        if (url.protocol === 'https:') return clean;
      } catch {
        // Normalised below.
      }
      throw new BadRequestException({
        code: 'INVALID_RELEASE_URL',
        message: `${field} must be an HTTPS URL${field === 'release_notes_url' ? ' or a safe relative path' : ''}`,
      });
    };

    const values: Record<string, string | null> = {
      'site.mobile.latest_version': dto.latest_version,
      'site.mobile.min_version': dto.min_version,
      'site.mobile.ios_url': toSafeUrl(dto.ios_url, 'ios_url'),
      'site.mobile.android_url': toSafeUrl(dto.android_url, 'android_url'),
      'site.mobile.apk_url': toSafeUrl(dto.apk_url, 'apk_url'),
      'site.mobile.apk_sha256': dto.apk_sha256?.toLowerCase() || null,
      'site.mobile.release_notes_url': toSafeUrl(
        dto.release_notes_url,
        'release_notes_url',
      ),
      'site.mobile.ios_status': dto.ios_status,
      'site.mobile.android_status': dto.android_status,
      'site.mobile.apk_size_bytes': dto.apk_size_bytes
        ? String(dto.apk_size_bytes)
        : null,
      'site.mobile.released_at': dto.released_at ?? null,
      'site.mobile.ios_minimum': dto.ios_minimum,
      'site.mobile.android_minimum': dto.android_minimum,
    };
    const client = this.supabaseService.getServiceClient();
    const rows = MOBILE_RELEASE_KEYS.map((key) => ({
      key,
      value: values[key],
      updated_by: actorId,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await client
      .from('site_settings')
      .upsert(rows, { onConflict: 'key' });
    if (error) throw this.translate(error);
    await this.audit.write({
      actorId,
      action: 'ADMIN_MOBILE_RELEASE_UPDATED',
      resourceType: 'mobile_release',
      metadata: {
        latest_version: dto.latest_version,
        min_version: dto.min_version,
      },
    });
    return this.releases.getMobileRelease();
  }

  // ─── Broadcasts ───────────────────────────────────────────────────────────

  async listBroadcasts(accessToken: string) {
    const client = this.supabaseService.getUserClient(accessToken);
    const { data, error } = await client
      .from('broadcasts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw this.translate(error);

    // Delivery stats: how many users dismissed each broadcast. Aggregate only —
    // WHO read WHAT is behaviour tracking the console has no need for.
    const service = this.supabaseService.getServiceClient();
    const { data: receipts } = await service
      .from('broadcast_receipts')
      .select('broadcast_id, dismissed_at');

    const counts = new Map<string, { seen: number; dismissed: number }>();
    for (const receipt of (receipts ?? []) as Array<{
      broadcast_id: string;
      dismissed_at: string | null;
    }>) {
      const entry = counts.get(receipt.broadcast_id) ?? {
        seen: 0,
        dismissed: 0,
      };
      entry.seen += 1;
      if (receipt.dismissed_at) entry.dismissed += 1;
      counts.set(receipt.broadcast_id, entry);
    }

    return (data ?? []).map((broadcast) => ({
      ...broadcast,
      stats: counts.get(broadcast.id) ?? { seen: 0, dismissed: 0 },
    }));
  }

  async createBroadcast(
    actorId: string,
    dto: CreateBroadcastDto,
  ): Promise<Record<string, unknown>> {
    const client = this.supabaseService.getServiceClient();
    const { data, error } = await client
      .from('broadcasts')
      .insert({
        title_en: dto.title_en,
        title_bn: dto.title_bn,
        body_en: dto.body_en ?? '',
        body_bn: dto.body_bn ?? '',
        severity: dto.severity ?? 'INFO',
        audience: dto.audience ?? 'ALL',
        link_url: dto.link_url ?? null,
        dismissible: dto.dismissible ?? true,
        publish_at: dto.publish_at ?? null,
        expires_at: dto.expires_at ?? null,
        // Always created as a DRAFT. Publishing is a separate, audited action so
        // that "compose" and "send to every user" can never be the same click.
        status: 'DRAFT',
        created_by: actorId,
      })
      .select()
      .single();
    if (error) throw this.translate(error);

    await this.audit.write({
      actorId,
      action: 'ADMIN_BROADCAST_CREATED',
      resourceType: 'broadcast',
      resourceId: data.id,
      metadata: { severity: data.severity },
    });

    return data;
  }

  async updateBroadcast(
    actorId: string,
    broadcastId: string,
    dto: UpdateBroadcastDto,
  ) {
    const client = this.supabaseService.getServiceClient();
    const payload: Updatable<'broadcasts'> = {};
    for (const key of [
      'title_en',
      'title_bn',
      'body_en',
      'body_bn',
      'severity',
      'audience',
      'link_url',
      'dismissible',
      'publish_at',
      'expires_at',
    ] as const) {
      // A generic helper rather than a direct assignment: TypeScript cannot
      // correlate `payload[key]` with `dto[key]` when `key` is a union, even
      // though every pairing is sound. This proves it once instead of
      // casting the payload back to `Record<string, unknown>` and losing the
      // column checking that motivated typing it at all.
      assignIfDefined(payload, key, dto[key]);
    }

    if (Object.keys(payload).length === 0) {
      throw new BadRequestException({
        code: 'NO_CHANGES',
        message: 'No fields supplied',
      });
    }

    const { data, error } = await client
      .from('broadcasts')
      .update(payload)
      .eq('id', broadcastId)
      .select()
      .single();
    if (error) throw this.translate(error);

    await this.audit.write({
      actorId,
      action: 'ADMIN_BROADCAST_UPDATED',
      resourceType: 'broadcast',
      resourceId: broadcastId,
      metadata: { fields: Object.keys(payload) },
    });

    return data;
  }

  async setBroadcastStatus(
    actorId: string,
    broadcastId: string,
    status: 'PUBLISHED' | 'ARCHIVED' | 'DRAFT',
  ) {
    const client = this.supabaseService.getServiceClient();

    const payload: Updatable<'broadcasts'> = { status };
    if (status === 'PUBLISHED') {
      // Publishing with no publish_at means "now" — otherwise the RLS window
      // check (publish_at IS NULL OR publish_at <= now()) would be the only
      // thing making it visible, and the console would show no send time.
      const { data: current } = await client
        .from('broadcasts')
        .select('publish_at')
        .eq('id', broadcastId)
        .single();
      if (!current?.publish_at) payload.publish_at = new Date().toISOString();
    }

    const { data, error } = await client
      .from('broadcasts')
      .update(payload)
      .eq('id', broadcastId)
      .select()
      .single();
    if (error) throw this.translate(error);

    await this.audit.write({
      actorId,
      action: `ADMIN_BROADCAST_${status}`,
      resourceType: 'broadcast',
      resourceId: broadcastId,
    });
    this.systemEvents.record({
      level: 'INFO',
      eventCode: `BROADCAST_${status}`,
      message: `Broadcast "${data.title_en}" → ${status}`,
      actorId,
    });

    if (status === 'PUBLISHED') {
      await this.notifications.notifyBroadcast(data);
    }

    return data;
  }

  // ─── Phase 2: Performance metrics ────────────────────────────────────────

  /**
   * p50/p95/p99 latency, error rate, and request volume from system_events.
   * All aggregations run on the service role so RLS on system_events (which is
   * operator-only) does not block them.
   */
  async getPerformanceMetrics(_accessToken: string, windowHours: number = 1) {
    const client = this.supabaseService.getServiceClient();
    const since = new Date(
      Date.now() - windowHours * 60 * 60 * 1000,
    ).toISOString();

    const { data, error } = await client
      .from('system_events')
      .select(
        'latency_ms, status_code, platform, route, method, created_at, event_code',
      )
      .gte('created_at', since)
      .not('latency_ms', 'is', null);

    if (error) throw this.translate(error);

    const rows = (data ?? []) as Array<{
      latency_ms: number;
      status_code: number | null;
      platform: string | null;
      route: string | null;
      method: string | null;
      event_code: string;
    }>;

    const latencies = rows.map((r) => r.latency_ms).sort((a, b) => a - b);
    const total = latencies.length;
    const errors = rows.filter(
      (r) => r.status_code !== null && r.status_code >= 500,
    ).length;
    const client4xx = rows.filter(
      (r) =>
        r.status_code !== null && r.status_code >= 400 && r.status_code < 500,
    ).length;

    const pct = (n: number) =>
      total === 0 ? 0 : (latencies[Math.floor((n / 100) * total)] ?? 0);

    // Per-route aggregation (top 10 slowest by p95)
    const routeMap = new Map<
      string,
      { count: number; latencies: number[]; errors: number }
    >();
    for (const row of rows) {
      const key = `${row.method ?? 'GET'} ${row.route ?? '/'}`;
      const entry = routeMap.get(key) ?? { count: 0, latencies: [], errors: 0 };
      entry.count += 1;
      entry.latencies.push(row.latency_ms);
      if (row.status_code !== null && row.status_code >= 500) entry.errors += 1;
      routeMap.set(key, entry);
    }
    const routes = [...routeMap.entries()]
      .map(([route, v]) => {
        const sorted = v.latencies.sort((a, b) => a - b);
        const rPct = (n: number) =>
          sorted[Math.floor((n / 100) * sorted.length)] ?? 0;
        return {
          route,
          count: v.count,
          p50: rPct(50),
          p95: rPct(95),
          p99: rPct(99),
          error_count: v.errors,
        };
      })
      .sort((a, b) => b.p95 - a.p95)
      .slice(0, 10);

    // Per-platform breakdown
    const platformMap = new Map<string, number>();
    for (const row of rows) {
      const p = row.platform ?? 'unknown';
      platformMap.set(p, (platformMap.get(p) ?? 0) + 1);
    }

    return {
      window_hours: windowHours,
      total_requests: total,
      error_count: errors,
      client_error_count: client4xx,
      error_rate: total === 0 ? 0 : Math.round((errors / total) * 10000) / 100,
      p50: pct(50),
      p95: pct(95),
      p99: pct(99),
      slowest_routes: routes,
      by_platform: Object.fromEntries(platformMap),
      computed_at: new Date().toISOString(),
    };
  }

  // ─── Phase 2: Alerts ──────────────────────────────────────────────────────

  async getAlerts(_accessToken: string) {
    void _accessToken;
    const client = this.supabaseService.getServiceClient();
    const { data, error } = await client
      .from('alert_state')
      .select('*')
      .order('updated_at', { ascending: false });
    if (error) throw this.translate(error);
    return data ?? [];
  }

  async acknowledgeAlert(actorId: string, alertKey: string) {
    const client = this.supabaseService.getServiceClient();
    const { data, error } = await client
      .from('alert_state')
      .update({
        is_firing: false,
        last_resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('alert_key', alertKey)
      .select()
      .single();

    if (error) throw this.translate(error);

    await this.audit.write({
      actorId,
      action: 'ADMIN_ALERT_ACKNOWLEDGED',
      resourceType: 'alert_state',
      resourceId: alertKey,
      metadata: { alert_key: alertKey },
    });
    this.systemEvents.record({
      level: 'INFO',
      eventCode: 'ALERT_ACKNOWLEDGED',
      message: `Alert "${alertKey}" acknowledged by operator`,
      actorId,
    });

    await this.notifications.notifyOperators({
      severity: 'SUCCESS',
      titleEn: 'Operator alert resolved',
      titleBn: 'অপারেটর সতর্কতা সমাধান হয়েছে',
      bodyEn: `${alertKey} was acknowledged and resolved.`,
      bodyBn: `${alertKey} স্বীকৃত ও সমাধান করা হয়েছে।`,
      actionUrl: '/admin/monitoring/alerts',
      resourceType: 'alert_state',
      metadata: { alert_key: alertKey, resolved_by: actorId },
      dedupeKey: `alert-resolved:${alertKey}:${data.updated_at}`,
    });

    return data;
  }

  // ─── Phase 2: Security — auth events ─────────────────────────────────────

  async getAuthEvents(
    accessToken: string,
    query: { limit?: number; offset?: number; platform?: string },
  ) {
    const client = this.supabaseService.getUserClient(accessToken);
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;

    // Auth-related actions written by the API on login/signup/password-reset.
    const AUTH_ACTIONS = [
      'USER_SIGNED_IN',
      'USER_SIGNED_UP',
      'PASSWORD_RESET_REQUESTED',
      'EMAIL_CHANGED',
      'MFA_ENROLLED',
      'MFA_VERIFIED',
      'ACCOUNT_DELETED',
      'ADMIN_USER_SUSPENDED',
      'ADMIN_USER_REINSTATED',
    ];

    let builder = client
      .from('audit_events')
      .select('*', { count: 'exact' })
      .in('action', AUTH_ACTIONS)
      .order('created_at', { ascending: false });

    if (query.platform) builder = builder.eq('platform', query.platform);

    const { data, error, count } = await builder.range(
      offset,
      offset + limit - 1,
    );
    if (error) throw this.translate(error);

    return { items: data ?? [], total: count ?? 0, limit, offset };
  }

  // ─── Phase 2: Security — active sessions ─────────────────────────────────

  async getActiveSessions(
    _accessToken: string,
    query: { limit?: number; offset?: number; platform?: string },
  ) {
    const client = this.supabaseService.getServiceClient();
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;

    let builder = client
      .from('user_devices')
      .select(
        'id, user_id, device_id, platform, device_name, os_version, app_version, last_seen_at, last_ip, first_seen_at',
        { count: 'exact' },
      )
      .is('revoked_at', null)
      .order('last_seen_at', { ascending: false });

    if (query.platform) builder = builder.eq('platform', query.platform);

    const { data, error, count } = await builder.range(
      offset,
      offset + limit - 1,
    );
    if (error) throw this.translate(error);

    return { items: data ?? [], total: count ?? 0, limit, offset };
  }

  async revokeSession(actorId: string, deviceRowId: string) {
    const client = this.supabaseService.getServiceClient();
    const { data, error } = await client
      .from('user_devices')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', deviceRowId)
      .is('revoked_at', null)
      .select('id, user_id, platform')
      .single();

    if (error || !data) {
      throw new NotFoundException({
        code: 'DEVICE_NOT_FOUND',
        message: 'Device not found or already revoked',
      });
    }

    await this.audit.write({
      actorId,
      action: 'ADMIN_SESSION_REVOKED',
      resourceType: 'user_devices',
      resourceId: deviceRowId,
      metadata: { target_user: data.user_id, platform: data.platform },
    });
    await this.notifications.create({
      userId: data.user_id,
      category: 'security',
      severity: 'WARNING',
      titleEn: 'A device session was revoked',
      titleBn: 'একটি ডিভাইস সেশন বাতিল করা হয়েছে',
      bodyEn: `An operator revoked an active ${data.platform} session.`,
      bodyBn: `একজন অপারেটর একটি সক্রিয় ${data.platform} সেশন বাতিল করেছেন।`,
      actionUrl: '/dashboard/settings/sessions',
      resourceType: 'user_device',
      resourceId: deviceRowId,
      dedupeKey: `session-revoked:${deviceRowId}`,
    });

    return { revoked: true, device_id: deviceRowId };
  }

  async revokeAllUserSessions(actorId: string, userId: string) {
    const client = this.supabaseService.getServiceClient();
    const { error } = await client
      .from('user_devices')
      .update({ revoked_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('revoked_at', null);

    if (error) throw this.translate(error);

    await this.audit.write({
      actorId,
      action: 'ADMIN_ALL_SESSIONS_REVOKED',
      resourceType: 'user_devices',
      resourceId: userId,
      metadata: { target_user: userId },
    });
    await this.notifications.create({
      userId,
      category: 'security',
      severity: 'CRITICAL',
      titleEn: 'All device sessions were revoked',
      titleBn: 'সব ডিভাইস সেশন বাতিল করা হয়েছে',
      bodyEn: 'An operator signed your account out on every registered device.',
      bodyBn:
        'একজন অপারেটর সব নিবন্ধিত ডিভাইসে আপনার অ্যাকাউন্ট সাইন আউট করেছেন।',
      actionUrl: '/dashboard/settings/sessions',
      dedupeKey: `all-sessions-revoked:${userId}:${new Date().toISOString()}`,
    });

    return { revoked: true };
  }

  // ─── Phase 2: Security — anomalies (heuristic) ───────────────────────────

  /**
   * Simple heuristic anomaly signals.
   *
   * Real impossible-travel detection requires geoIP resolution on every request
   * IP, which is not available on the Free Tier without a third-party service.
   * These are the signals available from existing data:
   *   - New-device logins (first_seen_at very recent)
   *   - High throttle-hit users (from system_events event_code THROTTLE_*)
   *   - Accounts with > N platforms (web + ios + android at once)
   */
  async getAnomalies(_accessToken: string) {
    void _accessToken;
    const client = this.supabaseService.getServiceClient();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // New devices seen in the last 24h
    const { data: newDevices } = await client
      .from('user_devices')
      .select('id, user_id, platform, device_name, first_seen_at, last_ip')
      .gte('first_seen_at', oneDayAgo)
      .is('revoked_at', null)
      .order('first_seen_at', { ascending: false })
      .limit(25);

    // Throttle hits in the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: throttleEvents } = await client
      .from('system_events')
      .select('actor_id, created_at, route, metadata')
      .in('event_code', [
        'THROTTLE_SHORT',
        'THROTTLE_MEDIUM',
        'THROTTLE_LONG',
        'RATE_LIMIT_EXCEEDED',
      ])
      .gte('created_at', oneHourAgo)
      .not('actor_id', 'is', null)
      .limit(100);

    // Summarise throttle by actor
    const throttleByActor = new Map<string, number>();
    for (const evt of (throttleEvents ?? []) as Array<{ actor_id: string }>) {
      const id = evt.actor_id;
      throttleByActor.set(id, (throttleByActor.get(id) ?? 0) + 1);
    }
    const throttleAbusers = [...throttleByActor.entries()]
      .filter(([, count]) => count >= 5)
      .map(([actor_id, hit_count]) => ({ actor_id, hit_count }))
      .sort((a, b) => b.hit_count - a.hit_count);

    return {
      new_devices: newDevices ?? [],
      throttle_abusers: throttleAbusers,
    };
  }

  // ─── Phase 2: Correlated trace view ──────────────────────────────────────

  async getEventsByRequestId(accessToken: string, requestId: string) {
    const client = this.supabaseService.getUserClient(accessToken);
    const { data, error } = await client
      .from('system_events')
      .select('*')
      .eq('request_id', requestId)
      .order('created_at', { ascending: true })
      .limit(200);

    if (error) throw this.translate(error);
    return data ?? [];
  }

  // ─── Errors ───────────────────────────────────────────────────────────────

  /**
   * Map PostgREST/Postgres errors onto the API's error contract.
   *
   * 42501 ("insufficient privilege") arrives from two completely different
   * causes and MUST NOT be collapsed:
   *
   *   a) our own RPCs raising it when `is_super_admin()` is false — a real
   *      authorization failure, and a genuine 403;
   *   b) a MISSING GRANT, i.e. the deployment is misconfigured — a server fault
   *      that has nothing to do with who is calling.
   *
   * Reporting (b) as "you are not a super admin" is how a broken deployment
   * spends an afternoon looking like a permissions puzzle: the operator IS a
   * super admin, and the message tells them they are not. This distinguishes
   * them by the message our own RPCs raise, and reports (b) as a 503 so it
   * reads as "the service is misconfigured", which is what it is.
   */
  private translate(error: { code?: string; message: string }) {
    if (error.code === '42501') {
      if (error.message.includes('requires super admin privileges')) {
        return new ForbiddenException({
          code: 'NOT_SUPER_ADMIN',
          message: 'This action requires super admin privileges',
        });
      }
      this.logger.error(
        `MISSING GRANT — the API's database role lacks a privilege it needs: ${error.message}. ` +
          'Check that supabase/migrations/00014_service_role_grants.sql has been applied.',
      );
      this.systemEvents.record({
        level: 'FATAL',
        eventCode: 'MISSING_DB_GRANT',
        message: error.message,
        metadata: { hint: 'migration 00014_service_role_grants.sql' },
      });
      return new ServiceUnavailableException({
        code: 'DB_PRIVILEGE_MISSING',
        message:
          'The service is missing a required database privilege. This is a ' +
          'server configuration fault, not a permissions problem with your account.',
      });
    }
    if (error.code === 'PGRST116') {
      return new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Resource not found',
      });
    }
    this.logger.error(`Admin operation failed: ${error.message}`);
    return new BadRequestException({
      code: 'ADMIN_OPERATION_FAILED',
      message: error.message,
    });
  }
}
