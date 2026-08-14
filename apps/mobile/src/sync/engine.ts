/**
 * Sync engine — DEC-010.
 *
 *   push:  local queue ──▶ NestJS API   (server enforces balance, dedup, audit)
 *   pull:  GET /workspaces/:id/sync ──▶ local SQLite
 *
 * Push runs BEFORE pull. Otherwise a pull could overwrite an optimistic local
 * row with the server's older copy, making a transaction the user just entered
 * flicker away and come back.
 *
 * Conflict rule: server wins on pull. Rejected pushes surface to the user via
 * the NEEDS_ATTENTION queue state rather than being silently merged — a silent
 * merge on money is worse than a visible prompt.
 */
import { getDb, getLocalColumns, upsertRows } from '../db';
import { SYNCABLE_TABLES, type SyncableTable } from '../db/schema';
import { apiFetch, ApiError } from '../lib/api';
import { reportMobileError } from '../lib/observability';
import { drain, type DrainResult } from './queue';

export type SyncState =
  | 'IDLE'
  | 'SYNCING'
  | 'OFFLINE'
  | 'NEEDS_ATTENTION'
  | 'ERROR';

interface SyncResponse {
  cursor: string;
  has_more: boolean;
  server_time: string;
  changes: Partial<Record<SyncableTable, Record<string, unknown>[]>>;
}

export interface SyncOutcome {
  push: DrainResult;
  pulled: number;
  cursor: string | null;
  state: SyncState;
  error?: string;
}

/** Guards against overlapping runs — foreground + network-regained can race. */
const inFlight = new Map<string, Promise<SyncOutcome>>();

export function sync(workspaceId: string): Promise<SyncOutcome> {
  const existing = inFlight.get(workspaceId);
  if (existing) return existing;

  const run = execute(workspaceId).finally(() => inFlight.delete(workspaceId));
  inFlight.set(workspaceId, run);
  return run;
}

async function execute(workspaceId: string): Promise<SyncOutcome> {
  const db = await getDb();

  // ── 1. Push ──────────────────────────────────────────────────────────────
  let push: DrainResult;
  try {
    push = await drain(workspaceId);
  } catch (error) {
    // Reported with the STAGE as context, so a push failure and a pull failure
    // never group together. They have different causes and different fixes,
    // and merging them would hide whichever is rarer.
    reportMobileError(error, 'sync:push');
    return {
      push: { sent: 0, parked: 0, deferred: 0, reclaimed: 0 },
      pulled: 0,
      cursor: null,
      state: 'ERROR',
      error: error instanceof Error ? error.message : String(error),
    };
  }

  // ── 2. Pull ──────────────────────────────────────────────────────────────
  const meta = await db.getFirstAsync<{ cursor: string | null }>(
    `SELECT cursor FROM _sync_meta WHERE workspace_id = ?`,
    [workspaceId],
  );

  let cursor = meta?.cursor ?? null;
  let pulled = 0;

  // Cache column sets once — PRAGMA per row would be needlessly chatty.
  const columnsByTable = new Map<SyncableTable, Set<string>>();
  for (const table of SYNCABLE_TABLES) {
    columnsByTable.set(table, await getLocalColumns(db, table));
  }

  try {
    // `has_more` means a table hit the server's page limit; keep going until
    // the server says it is done. Bounded so a misbehaving cursor cannot spin
    // forever (the API also guards this with SYNC_CURSOR_STALLED).
    for (let page = 0; page < 50; page += 1) {
      const query: '' | `?${string}` = cursor ? `?since=${encodeURIComponent(cursor)}` : '';
      const response: SyncResponse = await apiFetch(`/workspaces/${workspaceId}/sync${query}`);

      await db.withTransactionAsync(async () => {
        for (const table of SYNCABLE_TABLES) {
          const rows = response.changes[table];
          if (!rows?.length) continue;
          await upsertRows(db, table, rows, columnsByTable.get(table)!);
          pulled += rows.length;
        }

        // Rows confirmed by the server are no longer pending locally.
        const entries = response.changes.journal_entries;
        if (entries?.length) {
          const ids = entries.map((e) => String(e.id));
          await db.runAsync(
            `UPDATE journal_entries SET is_pending = 0
              WHERE id IN (${ids.map(() => '?').join(',')})`,
            ids,
          );
        }

        await db.runAsync(
          `INSERT INTO _sync_meta (workspace_id, cursor, last_synced_at)
           VALUES (?, ?, ?)
           ON CONFLICT(workspace_id) DO UPDATE SET
             cursor = excluded.cursor,
             last_synced_at = excluded.last_synced_at`,
          [workspaceId, response.cursor, new Date().toISOString()],
        );
      });

      cursor = response.cursor;
      if (!response.has_more) break;
    }
  } catch (error) {
    const offline = error instanceof ApiError && error.status === 0;
    // Being offline is the normal state of an offline-first app, not a fault.
    // Reporting it would drown the signal in the one condition this app is
    // designed around.
    if (!offline) reportMobileError(error, 'sync:pull');
    return {
      push,
      pulled,
      cursor,
      state: offline ? 'OFFLINE' : 'ERROR',
      error: error instanceof Error ? error.message : String(error),
    };
  }

  return {
    push,
    pulled,
    cursor,
    state: push.parked > 0 ? 'NEEDS_ATTENTION' : 'IDLE',
  };
}

/** Local-only: has this workspace ever completed a pull? */
export async function hasSynced(workspaceId: string): Promise<boolean> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ last_synced_at: string | null }>(
    `SELECT last_synced_at FROM _sync_meta WHERE workspace_id = ?`,
    [workspaceId],
  );
  return Boolean(row?.last_synced_at);
}
