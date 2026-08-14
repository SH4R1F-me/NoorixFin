/**
 * Local database handle — DEC-010.
 *
 * `expo-sqlite` is used directly rather than WatermelonDB: we already model the
 * ledger in SQL, and WatermelonDB's opinionated sync protocol assumes it owns
 * the push path, which DEC-010 routes through the NestJS API instead.
 *
 * SQLCipher note: sensitive local data should move to an encrypted database
 * before release. That requires a development build — Expo Go cannot load
 * SQLCipher — so it is deliberately not wired here (see BLOCKERS.md).
 */
import * as SQLite from 'expo-sqlite';
import { CREATE_TABLES, PRIMARY_KEYS, type SyncableTable } from './schema';

const DB_NAME = 'noorixfin.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await db.execAsync(CREATE_TABLES);
      const entryColumns = await getLocalColumns(db, 'journal_entries');
      if (!entryColumns.has('pending_amount_minor')) {
        await db.execAsync('ALTER TABLE journal_entries ADD COLUMN pending_amount_minor INTEGER;');
      }
      if (!entryColumns.has('pending_currency_code')) {
        await db.execAsync('ALTER TABLE journal_entries ADD COLUMN pending_currency_code TEXT;');
      }
      return db;
    })();
  }
  return dbPromise;
}

/** Test/sign-out helper: drop every local row but keep the schema. */
export async function clearLocalData(): Promise<void> {
  const db = await getDb();
  await db.execAsync(`
    DELETE FROM journal_entry_tags;
    DELETE FROM journal_postings;
    DELETE FROM journal_entries;
    DELETE FROM notifications;
    DELETE FROM tags;
    DELETE FROM categories;
    DELETE FROM ledger_accounts;
    DELETE FROM _sync_meta;
    DELETE FROM _mutation_queue;
  `);
}

/**
 * Upsert rows pulled from the server.
 *
 * The sync endpoint delivers at-least-once (boundary rows can repeat), so this
 * MUST be an upsert rather than an insert — see the sync service on the API.
 * Column names come from the row itself, so a new server column flows through
 * without a client change as long as the local table has it.
 */
export async function upsertRows(
  db: SQLite.SQLiteDatabase,
  table: SyncableTable,
  rows: Record<string, unknown>[],
  localColumns: Set<string>,
): Promise<void> {
  if (rows.length === 0) return;

  const conflictKeys = PRIMARY_KEYS[table];

  for (const row of rows) {
    // Drop server columns this client's schema does not know about, so an API
    // that adds a field does not break an older app build.
    const columns = Object.keys(row).filter((c) => localColumns.has(c));
    if (columns.length === 0) continue;

    const placeholders = columns.map(() => '?').join(', ');
    const updates = columns
      .filter((c) => !conflictKeys.includes(c))
      .map((c) => `${c} = excluded.${c}`)
      .join(', ');

    const sql =
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders}) ` +
      `ON CONFLICT(${conflictKeys.join(', ')}) DO UPDATE SET ${updates}`;

    const values = columns.map((c) => {
      const v = row[c];
      if (v === null || v === undefined) return null;
      if (typeof v === 'boolean') return v ? 1 : 0;
      if (typeof v === 'object') return JSON.stringify(v);
      return v as SQLite.SQLiteBindValue;
    });

    await db.runAsync(sql, values);
  }
}

/** Column names actually present on a local table. */
export async function getLocalColumns(
  db: SQLite.SQLiteDatabase,
  table: string,
): Promise<Set<string>> {
  const rows = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  return new Set(rows.map((r) => r.name));
}
