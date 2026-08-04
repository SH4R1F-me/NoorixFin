/**
 * Offline sync engine — the four W4 tests (DEC-010).
 *
 * These run the REAL schema, the REAL queue SQL, and the REAL engine against
 * Node's built-in SQLite. Only the native binding and the network call are
 * substituted, so the durability and idempotency semantics under test are the
 * ones that will actually ship.
 *
 * What is being protected: the queue holds financial writes the user believes
 * are saved. A defect here loses data silently rather than erroring.
 */
import { __resetAll } from '../__tests__/mocks/expo-sqlite';
import { __resetUuid } from '../__tests__/mocks/expo-native';

// The API layer is the boundary — everything below it is real.
jest.mock('../lib/api', () => {
  const actual = jest.requireActual('../lib/api');
  return { ...actual, apiFetch: jest.fn() };
});

import { apiFetch, ApiError } from '../lib/api';
import { getDb } from '../db';
import { enqueue, drain, countPending, listNeedingAttention } from './queue';
import { sync } from './engine';

const mockFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;
const WS = '11111111-1111-1111-1111-111111111111';

/** Server-side view: which idempotency keys have been accepted. */
let serverEntries: Set<string>;

/** Online: record the key and succeed. Duplicate key → same row, as the API does. */
function online() {
  mockFetch.mockImplementation(async (path: string, options?: { idempotencyKey?: string }) => {
    if (path.includes('/sync')) {
      return { cursor: new Date().toISOString(), has_more: false, server_time: '', changes: {} } as never;
    }
    if (options?.idempotencyKey) serverEntries.add(options.idempotencyKey);
    return { id: options?.idempotencyKey } as never;
  });
}

/** Airplane mode: every call fails the way `fetch` does with no radio. */
function offline() {
  mockFetch.mockImplementation(async () => {
    throw new ApiError(0, 'NETWORK_UNAVAILABLE', 'Network request failed');
  });
}

beforeEach(async () => {
  __resetAll();
  __resetUuid();
  serverEntries = new Set();
  mockFetch.mockReset();
  await getDb(); // applies the real schema
});

describe('W4-1: airplane mode → 5 transactions → reconnect', () => {
  it('delivers exactly 5, with no duplicates and no drops', async () => {
    offline();

    for (let i = 0; i < 5; i += 1) {
      await enqueue(`key-${i}`, WS, 'CREATE_TRANSACTION', { type: 'EXPENSE', amount: '100' });
    }

    // Offline drain must not lose anything.
    const offlineResult = await drain(WS);
    expect(offlineResult.sent).toBe(0);
    expect(serverEntries.size).toBe(0);
    expect(await countPending(WS)).toBe(5);

    // Backoff sets next_attempt_at in the future; the user pulling to refresh
    // should not be told to wait, so clear it as a reconnect would.
    const db = await getDb();
    await db.runAsync(`UPDATE _mutation_queue SET next_attempt_at = NULL`);

    online();
    const onlineResult = await drain(WS);

    expect(onlineResult.sent).toBe(5);
    expect(serverEntries.size).toBe(5);
    expect(await countPending(WS)).toBe(0);
  });
});

describe('W4-2: app killed mid-queue → relaunch', () => {
  it('resumes and drains the survivors', async () => {
    offline();
    for (let i = 0; i < 3; i += 1) {
      await enqueue(`kill-${i}`, WS, 'CREATE_TRANSACTION', { type: 'EXPENSE', amount: '250' });
    }
    await drain(WS);

    // Simulate a kill *during* a send: a row left stuck as IN_FLIGHT.
    const db = await getDb();
    await db.runAsync(`UPDATE _mutation_queue SET status = 'IN_FLIGHT' WHERE id = ?`, ['kill-0']);
    await db.runAsync(`UPDATE _mutation_queue SET next_attempt_at = NULL`);

    // Relaunch: the queue is a table, so it is still here.
    const survived = await db.getAllAsync<{ id: string }>(`SELECT id FROM _mutation_queue`);
    expect(survived).toHaveLength(3);

    online();
    const result = await drain(WS);

    const stillQueued = await db.getAllAsync<{ id: string; status: string }>(
      `SELECT id, status FROM _mutation_queue`,
    );

    // All three must arrive, including the one interrupted mid-send. Replaying
    // it is safe because the Idempotency-Key is stable (FIN-02).
    expect(result.reclaimed).toBe(1);
    expect(result.sent).toBe(3);
    expect(serverEntries.has('kill-0')).toBe(true);
    expect(serverEntries.has('kill-1')).toBe(true);
    expect(serverEntries.has('kill-2')).toBe(true);
    expect(stillQueued).toHaveLength(0);
  });

  it('a reclaimed mutation cannot double-post', async () => {
    online();
    await enqueue('reclaim-dup', WS, 'CREATE_TRANSACTION', { amount: '100' });

    // The server DID receive it before the kill...
    serverEntries.add('reclaim-dup');
    const db = await getDb();
    await db.runAsync(`UPDATE _mutation_queue SET status = 'IN_FLIGHT' WHERE id = ?`, ['reclaim-dup']);

    // ...and the replay resolves to the same row, not a second one.
    await drain(WS);
    expect(serverEntries.size).toBe(1);
  });
});

describe('W4-3: idempotency replay (FIN-02)', () => {
  it('the same key sent twice yields one server entry', async () => {
    online();

    await enqueue('same-key', WS, 'CREATE_TRANSACTION', { type: 'EXPENSE', amount: '900' });
    await drain(WS);
    expect(serverEntries.size).toBe(1);

    // Replay the identical logical write.
    await enqueue('same-key', WS, 'CREATE_TRANSACTION', { type: 'EXPENSE', amount: '900' });
    await drain(WS);

    expect(serverEntries.size).toBe(1);
    expect([...serverEntries]).toEqual(['same-key']);
  });

  it('enqueue is idempotent — a duplicate id does not create a second row', async () => {
    await enqueue('dup', WS, 'CREATE_TRANSACTION', { amount: '1' });
    await enqueue('dup', WS, 'CREATE_TRANSACTION', { amount: '1' });
    expect(await countPending(WS)).toBe(1);
  });
});

describe('W4-4: rejected push surfaces, never silently merges (SYNC-02)', () => {
  it('parks a 409 as NEEDS_ATTENTION with the reason', async () => {
    mockFetch.mockImplementation(async () => {
      throw new ApiError(409, 'VERSION_CONFLICT', 'This record was changed on another device');
    });

    await enqueue('stale', WS, 'CREATE_TRANSACTION', { type: 'EXPENSE', amount: '100' });
    const result = await drain(WS);

    expect(result.parked).toBe(1);
    const parked = await listNeedingAttention(WS);
    expect(parked).toHaveLength(1);
    expect(parked[0]!.last_error).toContain('changed on another device');
    // Not deleted — the user must be able to act on it.
    expect(await countPending(WS)).toBe(0);
  });

  it('a permanent failure does not block later writes behind it', async () => {
    let call = 0;
    mockFetch.mockImplementation(async (_p: string, o?: { idempotencyKey?: string }) => {
      call += 1;
      if (call === 1) throw new ApiError(400, 'INVALID_AMOUNT', 'bad');
      if (o?.idempotencyKey) serverEntries.add(o.idempotencyKey);
      return { id: o?.idempotencyKey } as never;
    });

    await enqueue('bad', WS, 'CREATE_TRANSACTION', { amount: 'oops' });
    await enqueue('good', WS, 'CREATE_TRANSACTION', { amount: '500' });

    const result = await drain(WS);

    expect(result.parked).toBe(1);
    expect(result.sent).toBe(1);
    expect(serverEntries.has('good')).toBe(true);
  });

  it('a retryable failure stops the drain rather than hammering a dead network', async () => {
    mockFetch.mockImplementation(async () => {
      throw new ApiError(503, 'UNAVAILABLE', 'server down');
    });

    await enqueue('a', WS, 'CREATE_TRANSACTION', { amount: '1' });
    await enqueue('b', WS, 'CREATE_TRANSACTION', { amount: '2' });

    const result = await drain(WS);

    expect(result.deferred).toBe(1); // stopped after the first failure
    expect(result.parked).toBe(0);   // 5xx is retryable, not permanent
    expect(await countPending(WS)).toBe(2);
  });
});

describe('engine: push runs before pull', () => {
  it('drains the queue before requesting a delta', async () => {
    const order: string[] = [];
    mockFetch.mockImplementation(async (path: string, o?: { idempotencyKey?: string }) => {
      order.push(path.includes('/sync') ? 'PULL' : 'PUSH');
      if (path.includes('/sync')) {
        return { cursor: '2026-01-01T00:00:00.000Z', has_more: false, server_time: '', changes: {} } as never;
      }
      if (o?.idempotencyKey) serverEntries.add(o.idempotencyKey);
      return {} as never;
    });

    await enqueue('order-1', WS, 'CREATE_TRANSACTION', { amount: '10' });
    await sync(WS);

    // A pull first would overwrite the optimistic local row with the server's
    // older copy, making the user's new transaction flicker away.
    expect(order[0]).toBe('PUSH');
    expect(order).toContain('PULL');
  });

  it('reports OFFLINE rather than ERROR when the pull cannot reach the network', async () => {
    offline();
    const outcome = await sync(WS);
    expect(outcome.state).toBe('OFFLINE');
  });

  it('advances and persists the cursor after a successful pull', async () => {
    mockFetch.mockImplementation(async () =>
      ({ cursor: '2026-08-04T10:00:00.000Z', has_more: false, server_time: '', changes: {} }) as never,
    );

    await sync(WS);

    const db = await getDb();
    const meta = await db.getFirstAsync<{ cursor: string }>(
      `SELECT cursor FROM _sync_meta WHERE workspace_id = ?`,
      [WS],
    );
    expect(meta?.cursor).toBe('2026-08-04T10:00:00.000Z');
  });
});

describe('pull upserts are idempotent (at-least-once delivery)', () => {
  it('the same row delivered twice does not duplicate', async () => {
    const row = {
      id: 'entry-1',
      workspace_id: WS,
      entry_type: 'EXPENSE',
      occurred_at: '2026-08-04T00:00:00.000Z',
      local_date: '2026-08-04',
      status: 'POSTED',
      updated_at: '2026-08-04T00:00:00.000Z',
    };

    let page = 0;
    mockFetch.mockImplementation(async () => {
      page += 1;
      return {
        cursor: `2026-08-04T0${page}:00:00.000Z`,
        has_more: false,
        server_time: '',
        changes: { journal_entries: [row] },
      } as never;
    });

    await sync(WS);
    await sync(WS);

    const db = await getDb();
    const rows = await db.getAllAsync<{ id: string }>(`SELECT id FROM journal_entries`);
    expect(rows).toHaveLength(1);
  });

  it('clears is_pending once the server confirms the row', async () => {
    const db = await getDb();
    await db.runAsync(
      `INSERT INTO journal_entries (id, workspace_id, entry_type, occurred_at, local_date, status, updated_at, is_pending)
       VALUES ('opt-1', ?, 'EXPENSE', '2026-08-04T00:00:00.000Z', '2026-08-04', 'POSTED', '2026-08-04T00:00:00.000Z', 1)`,
      [WS],
    );

    mockFetch.mockImplementation(async () =>
      ({
        cursor: '2026-08-04T02:00:00.000Z',
        has_more: false,
        server_time: '',
        changes: {
          journal_entries: [{
            id: 'opt-1', workspace_id: WS, entry_type: 'EXPENSE',
            occurred_at: '2026-08-04T00:00:00.000Z', local_date: '2026-08-04',
            status: 'POSTED', updated_at: '2026-08-04T01:00:00.000Z',
          }],
        },
      }) as never,
    );

    await sync(WS);

    const entry = await db.getFirstAsync<{ is_pending: number }>(
      `SELECT is_pending FROM journal_entries WHERE id = 'opt-1'`,
    );
    expect(entry?.is_pending).toBe(0);
  });
});
