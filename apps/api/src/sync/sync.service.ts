/**
 * Sync Service — DEC-010, DEC-011
 *
 * One delta endpoint for the whole workspace. The mobile client calls this on
 * foreground, on network regained, on a Realtime hint, and on pull-to-refresh,
 * so it must return everything that changed in a single round trip rather than
 * one request per table.
 *
 * Delivery is **at-least-once**: boundary rows can repeat across pages. That is
 * deliberate — the client upserts by primary key, so a duplicate is harmless,
 * whereas a skipped row is silent data loss.
 */
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { SyncQueryDto } from './dto/sync.dto';
import { NotificationsService } from '../notifications/notifications.service';

/** Explicit column lists — never `SELECT *` on a sync path (DEC-011). */
const TABLES = {
  ledger_accounts:
    'id, workspace_id, name, class, subtype, currency_code, normal_balance, include_in_budget, include_in_net_worth, opening_date, archived_at, deleted_at, created_at, updated_at, version',
  categories:
    'id, workspace_id, ledger_account_id, kind, parent_id, translation_key, custom_name, icon, color, sort_order, archived_at, deleted_at, created_at, updated_at',
  journal_entries:
    'id, workspace_id, entry_type, occurred_at, local_date, payee, note, status, source, client_entry_id, reverses_entry_id, created_by, posted_at, created_at, updated_at, version',
  journal_postings:
    'id, workspace_id, journal_entry_id, ledger_account_id, debit_minor, credit_minor, currency_code, base_amount_minor, fx_rate, memo, created_at, updated_at',
  tags: 'id, workspace_id, name, deleted_at, created_at, updated_at',
  journal_entry_tags:
    'journal_entry_id, tag_id, workspace_id, created_at, updated_at',
  notifications:
    'id, user_id, workspace_id, category, severity, title_en, title_bn, body_en, body_bn, action_url, resource_type, resource_id, metadata, read_at, archived_at, expires_at, created_at, updated_at, deleted_at',
} as const;

type TableName = keyof typeof TABLES;

const DEFAULT_LIMIT = 500;

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly notifications: NotificationsService,
  ) {}

  async reportFailure(
    userId: string,
    workspaceId: string,
    cause: unknown,
  ): Promise<void> {
    try {
      await this.notifications.create({
        userId,
        workspaceId,
        category: 'sync',
        severity: 'WARNING',
        titleEn: 'Sync needs attention',
        titleBn: 'সিঙ্কে মনোযোগ প্রয়োজন',
        bodyEn:
          'Your latest sync could not finish. Your local changes remain queued safely.',
        bodyBn:
          'আপনার সর্বশেষ সিঙ্ক সম্পন্ন হয়নি। স্থানীয় পরিবর্তনগুলো নিরাপদে সারিতে আছে।',
        actionUrl: '/dashboard/settings',
        metadata: {
          error:
            cause instanceof Error
              ? cause.message.slice(0, 200)
              : 'sync_failed',
        },
        dedupeKey: `sync-failed:${workspaceId}:${new Date().toISOString().slice(0, 10)}`,
      });
    } catch (notificationError) {
      this.logger.warn(
        `Could not record sync failure notification: ${notificationError instanceof Error ? notificationError.message : String(notificationError)}`,
      );
    }
  }

  async getDelta(
    workspaceId: string,
    accessToken: string,
    query: SyncQueryDto,
  ) {
    const client = this.supabaseService.getUserClient(accessToken);
    const limit = query.limit ?? DEFAULT_LIMIT;
    const serverTime = new Date().toISOString();

    // Epoch on first pull: `since` omitted means "send me everything".
    const since = query.since ?? '1970-01-01T00:00:00.000Z';

    const changes: Record<string, unknown[]> = {};
    let hasMore = false;
    // When a table is truncated we must not advance the cursor past rows we did
    // not send, so the next cursor is the EARLIEST watermark among truncated
    // tables. Untruncated tables get re-scanned from there — redundant, but the
    // alternative is skipping rows.
    let truncatedWatermark: string | null = null;

    const workspaceTables = (Object.keys(TABLES) as TableName[]).filter(
      (table) => table !== 'notifications',
    );
    for (const table of workspaceTables) {
      const { data, error } = await client
        .from(table)
        .select(TABLES[table])
        .eq('workspace_id', workspaceId)
        // `gte`, not `gt`: rows sharing the boundary timestamp would otherwise
        // be skipped. Re-sending one row is cheap; losing one is not.
        .gte('updated_at', since)
        .order('updated_at', { ascending: true })
        .limit(limit);

      if (error) {
        this.logger.error(`Sync failed for ${table}: ${error.message}`);
        throw new BadRequestException({
          code: 'SYNC_FAILED',
          message: `Failed to read changes for ${table}`,
        });
      }

      const rows = (data ?? []) as unknown as Array<{ updated_at: string }>;
      changes[table] = rows;

      if (rows.length === limit) {
        hasMore = true;
        const last = rows[rows.length - 1].updated_at;

        // Pathological case: a full page whose rows all share the cursor's
        // timestamp (e.g. a bulk import stamping identical updated_at). The
        // cursor cannot advance, so the client would loop forever. Fail loudly
        // instead. Fix when it bites: a composite (updated_at, id) cursor.
        if (last === since && rows[0].updated_at === since) {
          throw new BadRequestException({
            code: 'SYNC_CURSOR_STALLED',
            message:
              `More than ${limit} rows in ${table} share updated_at=${since}; ` +
              'cannot page past them. Raise `limit` for this pull.',
          });
        }

        if (!truncatedWatermark || last < truncatedWatermark) {
          truncatedWatermark = last;
        }
      }
    }

    // System categories are global (workspace_id IS NULL) and shared by every
    // workspace, so the workspace-scoped query above cannot see them.
    const { data: systemCategories, error: sysError } = await client
      .from('categories')
      .select(TABLES.categories)
      .is('workspace_id', null)
      .gte('updated_at', since)
      .order('updated_at', { ascending: true })
      .limit(limit);

    if (sysError) {
      this.logger.error(
        `Sync failed for system categories: ${sysError.message}`,
      );
      throw new BadRequestException({
        code: 'SYNC_FAILED',
        message: 'Failed to read system categories',
      });
    }

    changes.categories = [
      ...(changes.categories ?? []),
      ...(systemCategories ?? []),
    ];

    // Notifications are user-scoped by RLS and may either belong to this
    // workspace or be global (security, account, system, operator). Keeping
    // them in this delta avoids a second mobile polling loop (§5.5).
    const { data: notifications, error: notificationError } = await client
      .from('notifications')
      .select(TABLES.notifications)
      .or(`workspace_id.eq.${workspaceId},workspace_id.is.null`)
      .gte('updated_at', since)
      .order('updated_at', { ascending: true })
      .limit(limit);

    if (notificationError) {
      this.logger.error(
        `Sync failed for notifications: ${notificationError.message}`,
      );
      throw new BadRequestException({
        code: 'SYNC_FAILED',
        message: 'Failed to read notifications',
      });
    }
    changes.notifications = notifications ?? [];
    if ((notifications?.length ?? 0) === limit) {
      hasMore = true;
      const rows = notifications as Array<{ updated_at: string }>;
      const last = rows[rows.length - 1].updated_at;
      if (!truncatedWatermark || last < truncatedWatermark)
        truncatedWatermark = last;
    }

    return {
      cursor: truncatedWatermark ?? serverTime,
      has_more: hasMore,
      server_time: serverTime,
      changes,
    };
  }
}
