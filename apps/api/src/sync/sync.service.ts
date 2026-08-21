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
const ZERO_UUID = '00000000-0000-0000-0000-000000000000';
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/;

const SOURCES = [
  { name: 'ledger_accounts', table: 'ledger_accounts', keys: ['id'] },
  { name: 'categories', table: 'categories', keys: ['id'] },
  { name: 'journal_entries', table: 'journal_entries', keys: ['id'] },
  { name: 'journal_postings', table: 'journal_postings', keys: ['id'] },
  { name: 'tags', table: 'tags', keys: ['id'] },
  {
    name: 'journal_entry_tags',
    table: 'journal_entry_tags',
    keys: ['journal_entry_id', 'tag_id'],
  },
  { name: 'system_categories', table: 'categories', keys: ['id'] },
  { name: 'notifications', table: 'notifications', keys: ['id'] },
] as const satisfies ReadonlyArray<{
  name: string;
  table: TableName;
  keys: readonly string[];
}>;

type SourceName = (typeof SOURCES)[number]['name'];
type CursorPosition = { updated_at: string; key: string[] };
type SyncCursor = {
  v: 1;
  sources: Partial<Record<SourceName, CursorPosition>>;
};

type SyncQueryResult = {
  data: unknown[] | null;
  error: { message: string } | null;
};

interface SyncQueryBuilder {
  select(columns: string): SyncQueryBuilder;
  eq(column: string, value: unknown): SyncQueryBuilder;
  is(column: string, value: null): SyncQueryBuilder;
  or(filter: string): SyncQueryBuilder;
  order(column: string, options: { ascending: boolean }): SyncQueryBuilder;
  limit(count: number): PromiseLike<SyncQueryResult>;
}

function encodeCursor(cursor: SyncCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

function decodeCursor(raw?: string, legacySince?: string): SyncCursor {
  const candidate = raw ?? legacySince;
  if (!candidate) return { v: 1, sources: {} };

  // A timestamp cursor was persisted by every pre-v1 mobile build. Accept it
  // as a migration input, then always return an opaque versioned cursor.
  if (
    !raw &&
    ISO_TIMESTAMP_PATTERN.test(candidate) &&
    !Number.isNaN(Date.parse(candidate))
  ) {
    return {
      v: 1,
      sources: Object.fromEntries(
        SOURCES.map((source) => [
          source.name,
          { updated_at: candidate, key: source.keys.map(() => ZERO_UUID) },
        ]),
      ),
    };
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(candidate, 'base64url').toString('utf8'),
    ) as SyncCursor;
    if (parsed.v !== 1 || !parsed.sources || typeof parsed.sources !== 'object')
      throw new Error('unsupported cursor');
    for (const source of SOURCES) {
      const position = parsed.sources[source.name];
      if (!position) continue;
      if (
        !ISO_TIMESTAMP_PATTERN.test(position.updated_at) ||
        Number.isNaN(Date.parse(position.updated_at)) ||
        !Array.isArray(position.key) ||
        position.key.length !== source.keys.length ||
        position.key.some((value) => !UUID_PATTERN.test(value))
      )
        throw new Error('invalid cursor position');
    }
    return parsed;
  } catch {
    throw new BadRequestException({
      code: 'SYNC_CURSOR_STALLED',
      message: 'The sync cursor is invalid or unsupported. Start a full pull.',
    });
  }
}

function afterFilter(
  position: CursorPosition,
  keys: readonly string[],
): string {
  const timestamp = position.updated_at;
  const disjuncts = [`updated_at.gt.${timestamp}`];
  for (let index = 0; index < keys.length; index += 1) {
    const equalPrefix = keys
      .slice(0, index)
      .map((key, prefix) => `${key}.eq.${position.key[prefix] ?? ZERO_UUID}`);
    disjuncts.push(
      `and(updated_at.eq.${timestamp},${equalPrefix.join(',')}${equalPrefix.length ? ',' : ''}${keys[index]}.gt.${position.key[index] ?? ZERO_UUID})`,
    );
  }
  return disjuncts.join(',');
}

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
    // The generated Supabase union across eight heterogeneous tables becomes
    // too large for TypeScript to represent when built dynamically. This
    // narrow structural view retains the exact operations used by sync while
    // row payloads remain explicitly treated as unknown until decoded below.
    const sourceClient = client as unknown as {
      from(table: TableName): SyncQueryBuilder;
    };
    const limit = query.limit ?? DEFAULT_LIMIT;
    const serverTime = new Date().toISOString();
    const cursor = decodeCursor(query.cursor, query.since);
    const next: SyncCursor = { v: 1, sources: {} };
    const changes: Record<string, unknown[]> = {};
    let hasMore = false;

    for (const source of SOURCES) {
      const position = cursor.sources[source.name] ?? {
        updated_at: query.since ?? '1970-01-01T00:00:00.000Z',
        key: source.keys.map(() => ZERO_UUID),
      };
      let request = sourceClient
        .from(source.table)
        .select(TABLES[source.table]);

      if (source.name === 'system_categories') {
        request = request.is('workspace_id', null);
      } else if (source.name === 'notifications') {
        request = request.or(
          `workspace_id.eq.${workspaceId},workspace_id.is.null`,
        );
      } else {
        request = request.eq('workspace_id', workspaceId);
      }

      request = request
        .or(afterFilter(position, source.keys))
        .order('updated_at', { ascending: true });
      for (const key of source.keys) {
        request = request.order(key, { ascending: true });
      }

      const { data, error } = await request.limit(limit + 1);
      if (error) {
        this.logger.error(`Sync failed for ${source.name}: ${error.message}`);
        throw new BadRequestException({
          code: 'SYNC_FAILED',
          message: `Failed to read changes for ${source.name}`,
        });
      }

      const fetched = (data ?? []) as unknown as Array<
        Record<string, unknown> & { updated_at: string }
      >;
      const moreForSource = fetched.length > limit;
      const rows = fetched.slice(0, limit);
      hasMore ||= moreForSource;

      const outputName =
        source.name === 'system_categories' ? 'categories' : source.name;
      changes[outputName] = [...(changes[outputName] ?? []), ...rows];

      const last = rows.at(-1);
      next.sources[source.name] = last
        ? {
            updated_at: last.updated_at,
            key: source.keys.map((key) => String(last[key])),
          }
        : {
            updated_at: serverTime,
            key: source.keys.map(() => ZERO_UUID),
          };
    }

    return {
      cursor: encodeCursor(next),
      has_more: hasMore,
      server_time: serverTime,
      changes,
    };
  }
}
