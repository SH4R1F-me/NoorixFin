/**
 * Durable outbound mutation queue — DEC-010.
 *
 * Writes land in SQLite first and render immediately; this queue drains them to
 * the API in the background. It lives in a table rather than memory so a write
 * the user believes is saved survives the app being killed.
 *
 * Ordering is FIFO per workspace. A permanently-failing mutation is parked in
 * NEEDS_ATTENTION rather than retried forever — otherwise one bad row blocks
 * every later write behind it.
 */
import type { SQLiteDatabase } from 'expo-sqlite';
import { getDb } from '../db';
import { apiFetch, ApiError } from '../lib/api';

export type MutationKind =
  'CREATE_TRANSACTION' | 'REVERSE_TRANSACTION' | 'READ_NOTIFICATION' | 'READ_ALL_NOTIFICATIONS';

export type QueueStatus = 'PENDING' | 'IN_FLIGHT' | 'NEEDS_ATTENTION';

export interface QueuedMutation {
  id: string;
  workspace_id: string;
  kind: MutationKind;
  payload: string;
  created_at: string;
  attempts: number;
  next_attempt_at: string | null;
  status: QueueStatus;
  last_error: string | null;
}

/** Retry backoff. Jitter avoids a thundering herd when connectivity returns. */
function backoffMs(attempts: number): number {
  const base = Math.min(1000 * 2 ** attempts, 5 * 60_000);
  return base + Math.random() * base * 0.25;
}

/**
 * Enqueue a mutation. `id` is the client-generated UUID that will be sent as
 * the Idempotency-Key on every attempt — pass the same id used for the
 * optimistic local row so the two can be reconciled.
 */
export async function enqueue(
  id: string,
  workspaceId: string,
  kind: MutationKind,
  payload: unknown,
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR IGNORE INTO _mutation_queue
       (id, workspace_id, kind, payload, created_at, attempts, status)
     VALUES (?, ?, ?, ?, ?, 0, 'PENDING')`,
    [id, workspaceId, kind, JSON.stringify(payload), new Date().toISOString()],
  );
}

export async function countPending(workspaceId: string): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM _mutation_queue
      WHERE workspace_id = ? AND status IN ('PENDING', 'IN_FLIGHT')`,
    [workspaceId],
  );
  return row?.n ?? 0;
}

export async function listNeedingAttention(workspaceId: string): Promise<QueuedMutation[]> {
  const db = await getDb();
  return db.getAllAsync<QueuedMutation>(
    `SELECT * FROM _mutation_queue
      WHERE workspace_id = ? AND status = 'NEEDS_ATTENTION'
      ORDER BY created_at`,
    [workspaceId],
  );
}

/** Discard a parked mutation the user has chosen to abandon. */
export async function discard(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM _mutation_queue WHERE id = ?`, [id]);
}

/**
 * Return stranded IN_FLIGHT rows to PENDING.
 *
 * If the app is killed between marking a mutation IN_FLIGHT and receiving the
 * server's reply, nothing else would ever move it back — it would sit in the
 * queue forever, never retried and never surfaced (listNeedingAttention only
 * reports NEEDS_ATTENTION). That is silent loss of a financial write.
 *
 * Re-sending is safe precisely because every mutation carries a stable
 * Idempotency-Key: if the pre-kill request did reach the server, the replay
 * resolves to the same row rather than creating a second one (FIN-02).
 *
 * Drain is serialised per workspace (see engine.sync), so any IN_FLIGHT row
 * present when a drain starts is by definition left over from a previous run.
 */
async function reclaimStranded(db: SQLiteDatabase, workspaceId: string): Promise<number> {
  const result = await db.runAsync(
    `UPDATE _mutation_queue
        SET status = 'PENDING', next_attempt_at = NULL
      WHERE workspace_id = ? AND status = 'IN_FLIGHT'`,
    [workspaceId],
  );
  return result.changes ?? 0;
}

async function claimNext(db: SQLiteDatabase, workspaceId: string): Promise<QueuedMutation | null> {
  const now = new Date().toISOString();
  return db.getFirstAsync<QueuedMutation>(
    `SELECT * FROM _mutation_queue
      WHERE workspace_id = ?
        AND status = 'PENDING'
        AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
      ORDER BY created_at
      LIMIT 1`,
    [workspaceId, now],
  );
}

function endpointFor(m: QueuedMutation): { path: string; body: unknown } {
  const payload = JSON.parse(m.payload) as Record<string, unknown>;
  switch (m.kind) {
    case 'CREATE_TRANSACTION':
      return {
        path: `/workspaces/${m.workspace_id}/transactions`,
        // The server dedupes on idempotency_key; it must match the queue id so
        // a replay after an ambiguous failure cannot double-post (FIN-02).
        body: { ...payload, idempotency_key: m.id },
      };
    case 'REVERSE_TRANSACTION':
      return {
        path: `/workspaces/${m.workspace_id}/transactions/${String(payload.transaction_id)}/reverse`,
        body: {},
      };
    case 'READ_NOTIFICATION':
      return { path: `/notifications/${String(payload.notification_id)}/read`, body: {} };
    case 'READ_ALL_NOTIFICATIONS':
      return { path: '/notifications/read-all', body: {} };
  }
}

export interface DrainResult {
  sent: number;
  parked: number;
  deferred: number;
  /** Mutations recovered from a previous run that was killed mid-flight. */
  reclaimed: number;
}

/**
 * Drain the queue for one workspace.
 *
 * Stops at the first retryable failure: if the network is down, every
 * subsequent attempt would fail too, and hammering it wastes battery and
 * Supabase quota. Permanent failures are parked and draining continues.
 */
export async function drain(workspaceId: string): Promise<DrainResult> {
  const db = await getDb();
  const result: DrainResult = { sent: 0, parked: 0, deferred: 0, reclaimed: 0 };

  // Recover anything a previous run left mid-flight before draining.
  result.reclaimed = await reclaimStranded(db, workspaceId);

  for (;;) {
    const mutation = await claimNext(db, workspaceId);
    if (!mutation) break;

    await db.runAsync(`UPDATE _mutation_queue SET status = 'IN_FLIGHT' WHERE id = ?`, [
      mutation.id,
    ]);

    const { path, body } = endpointFor(mutation);

    try {
      await apiFetch(path, {
        method: 'POST',
        body,
        idempotencyKey: mutation.id,
      });

      // Confirmed by the server. The authoritative row arrives on the next
      // pull and overwrites the optimistic local copy.
      await db.runAsync(`DELETE FROM _mutation_queue WHERE id = ?`, [mutation.id]);
      result.sent += 1;
    } catch (error) {
      const attempts = mutation.attempts + 1;
      const apiError = error instanceof ApiError ? error : null;
      const message = apiError?.message ?? String(error);

      if (apiError?.isPermanent) {
        // 4xx: the payload itself is wrong (stale version → 409, validation →
        // 400). Retrying cannot help, and a 409 in particular needs the user to
        // decide — never silently merge money (DEC-010).
        await db.runAsync(
          `UPDATE _mutation_queue
              SET status = 'NEEDS_ATTENTION', attempts = ?, last_error = ?
            WHERE id = ?`,
          [attempts, message, mutation.id],
        );
        result.parked += 1;
        continue;
      }

      // Retryable: offline, 5xx, 429. Back off and stop draining.
      await db.runAsync(
        `UPDATE _mutation_queue
            SET status = 'PENDING', attempts = ?, next_attempt_at = ?, last_error = ?
          WHERE id = ?`,
        [attempts, new Date(Date.now() + backoffMs(attempts)).toISOString(), message, mutation.id],
      );
      result.deferred += 1;
      break;
    }
  }

  return result;
}
