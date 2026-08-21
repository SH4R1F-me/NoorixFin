/**
 * expo-sqlite shim over Node's built-in `node:sqlite`, for tests.
 *
 * The point is to run the REAL schema, the REAL queue SQL, and the REAL upsert
 * logic — not a reimplementation of them. Only the native binding is swapped;
 * every statement the app issues executes against a genuine SQLite engine.
 *
 * node:sqlite is synchronous, so each method wraps its result in a promise to
 * match expo-sqlite's async surface.
 */
import { DatabaseSync } from 'node:sqlite';

type Bind = null | number | string | bigint | Uint8Array;

function coerce(params: unknown[]): Bind[] {
  return params.map((p) => {
    if (p === undefined || p === null) return null;
    if (typeof p === 'boolean') return p ? 1 : 0;
    if (typeof p === 'number' || typeof p === 'string' || typeof p === 'bigint') return p;
    return String(p);
  });
}

export class SQLiteDatabase {
  constructor(private readonly db: DatabaseSync) {}

  execAsync(source: string): Promise<void> {
    this.db.exec(source);
    return Promise.resolve();
  }

  runAsync(source: string, params: unknown[] = []): Promise<{ changes: number; lastInsertRowId: number }> {
    const result = this.db.prepare(source).run(...coerce(params));
    return Promise.resolve({
      changes: Number(result.changes),
      lastInsertRowId: Number(result.lastInsertRowid),
    });
  }

  getAllAsync<T>(source: string, params: unknown[] = []): Promise<T[]> {
    return Promise.resolve(this.db.prepare(source).all(...coerce(params)) as T[]);
  }

  getFirstAsync<T>(source: string, params: unknown[] = []): Promise<T | null> {
    if (source.trim().toLowerCase() === 'pragma cipher_version') {
      return Promise.resolve({ cipher_version: 'test-sqlcipher' } as T);
    }
    const row = this.db.prepare(source).get(...coerce(params));
    return Promise.resolve((row ?? null) as T | null);
  }

  async withTransactionAsync(task: () => Promise<void>): Promise<void> {
    this.db.exec('BEGIN');
    try {
      await task();
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  closeSync(): void {
    this.db.close();
  }

  closeAsync(): Promise<void> {
    this.closeSync();
    return Promise.resolve();
  }

  /** Test-only: empty every user table without touching the schema. */
  clearAllRows(): void {
    const tables = this.db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
      .all() as { name: string }[];
    for (const { name } of tables) this.db.exec(`DELETE FROM "${name}"`);
  }
}

/** Named databases persist across openDatabaseAsync calls, so "app restart" can be simulated. */
const open = new Map<string, SQLiteDatabase>();

export function openDatabaseAsync(name: string): Promise<SQLiteDatabase> {
  let db = open.get(name);
  if (!db) {
    db = new SQLiteDatabase(new DatabaseSync(':memory:'));
    open.set(name, db);
  }
  return Promise.resolve(db);
}

export const defaultDatabaseDirectory = '/tmp/noorixfin-test-sqlite';

/**
 * Test helper: clear all rows, keeping schema and connection.
 *
 * Deliberately does NOT close the database: `src/db/index.ts` memoises its
 * open promise at module scope, so closing here would leave the app holding a
 * dead handle. Truncating gives each test clean state while the real caching
 * behaviour stays intact.
 */
export function __resetAll(): void {
  for (const wrapper of open.values()) wrapper.clearAllRows();
}

export type SQLiteBindValue = Bind;
