/**
 * Local database handle — DEC-010.
 *
 * `expo-sqlite` is used directly rather than WatermelonDB: we already model the
 * ledger in SQL, and WatermelonDB's opinionated sync protocol assumes it owns
 * the push path, which DEC-010 routes through the NestJS API instead.
 *
 * The native build uses SQLCipher. A device-only 256-bit database key is held
 * in SecureStore and applied before the first page is touched. Existing preview
 * installs are converted with sqlcipher_export before the plaintext file is
 * replaced; queued offline writes are therefore retained across the upgrade.
 */
import { getRandomBytesAsync } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as SQLite from 'expo-sqlite';
import { CREATE_TABLES, PRIMARY_KEYS, type SyncableTable } from './schema';

const DB_NAME = 'noorixfin.db';
const MIGRATION_DB_NAME = 'noorixfin.encrypted.db';
const BACKUP_DB_NAME = 'noorixfin.plaintext-backup.db';
const DATABASE_KEY_NAME = 'noorixfin.database-key.v1';

const KEY_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function rawKeyLiteral(key: string): string {
  if (!/^[0-9a-f]{64}$/.test(key)) {
    throw new Error('The local database key is invalid');
  }
  return `\"x'${key}'\"`;
}

async function getOrCreateDatabaseKey(): Promise<string> {
  const existing = await SecureStore.getItemAsync(DATABASE_KEY_NAME, KEY_OPTIONS);
  if (existing) return existing;

  const bytes = await getRandomBytesAsync(32);
  const created = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  await SecureStore.setItemAsync(DATABASE_KEY_NAME, created, KEY_OPTIONS);
  return created;
}

async function assertCipherAvailable(db: SQLite.SQLiteDatabase): Promise<void> {
  const cipher = await db.getFirstAsync<{ cipher_version?: string }>('PRAGMA cipher_version');
  if (!cipher?.cipher_version) {
    throw new Error(
      'This build does not include SQLCipher. Install a NoorixFin development or release build; Expo Go is not supported.',
    );
  }
}

async function openEncryptedDatabase(key: string): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  try {
    await assertCipherAvailable(db);
    await db.execAsync(`PRAGMA key = ${rawKeyLiteral(key)};`);
    // SQLCipher derives the key lazily. Reading sqlite_master is the required
    // authentication check; a missing or incorrect key fails here.
    await db.getFirstAsync('SELECT count(*) AS count FROM sqlite_master');
    return db;
  } catch (error) {
    await db.closeAsync();
    throw error;
  }
}

function fileUri(path: string): string {
  return path.startsWith('file://') ? path : `file://${path}`;
}

/** Convert an existing preview-era plaintext database without losing its outbox. */
async function migratePlaintextDatabase(key: string): Promise<void> {
  const plaintext = await SQLite.openDatabaseAsync(DB_NAME);
  try {
    await assertCipherAvailable(plaintext);
    // This succeeds only when the old file really is plaintext. It prevents a
    // corrupt encrypted file from being mistaken for a migration candidate.
    await plaintext.getFirstAsync('SELECT count(*) AS count FROM sqlite_master');
    await plaintext.execAsync('PRAGMA wal_checkpoint(TRUNCATE); PRAGMA journal_mode = DELETE;');

    const targetPath = `${String(SQLite.defaultDatabaseDirectory).replace(/\/$/, '')}/${MIGRATION_DB_NAME}`;
    const escapedTarget = targetPath.replaceAll("'", "''");
    await plaintext.execAsync(
      `ATTACH DATABASE '${escapedTarget}' AS encrypted KEY ${rawKeyLiteral(key)};`,
    );
    try {
      await plaintext.execAsync("SELECT sqlcipher_export('encrypted');");
      const version =
        (await plaintext.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))
          ?.user_version ?? 0;
      await plaintext.execAsync(`PRAGMA encrypted.user_version = ${Math.max(0, version)};`);
    } finally {
      await plaintext.execAsync('DETACH DATABASE encrypted;');
    }
  } finally {
    await plaintext.closeAsync();
  }

  const { File } = await import('expo-file-system');
  const directory = String(SQLite.defaultDatabaseDirectory).replace(/\/$/, '');
  const original = new File(fileUri(`${directory}/${DB_NAME}`));
  const encrypted = new File(fileUri(`${directory}/${MIGRATION_DB_NAME}`));
  const backup = new File(fileUri(`${directory}/${BACKUP_DB_NAME}`));

  if (!encrypted.exists) throw new Error('Encrypted database migration did not produce an output');
  if (backup.exists) backup.delete();
  await original.move(backup, { overwrite: true });
  try {
    await encrypted.move(original, { overwrite: true });
  } catch (error) {
    await backup.move(original, { overwrite: true });
    throw error;
  }
  if (backup.exists) backup.delete();
}

async function initializeDatabase(): Promise<SQLite.SQLiteDatabase> {
  const key = await getOrCreateDatabaseKey();
  let db: SQLite.SQLiteDatabase;
  try {
    db = await openEncryptedDatabase(key);
  } catch (firstError) {
    if (firstError instanceof Error && firstError.message.includes('does not include SQLCipher')) {
      throw firstError;
    }
    await migratePlaintextDatabase(key);
    db = await openEncryptedDatabase(key);
  }

  await db.execAsync(CREATE_TABLES);
  const entryColumns = await getLocalColumns(db, 'journal_entries');
  if (!entryColumns.has('pending_amount_minor')) {
    await db.execAsync('ALTER TABLE journal_entries ADD COLUMN pending_amount_minor INTEGER;');
  }
  if (!entryColumns.has('pending_currency_code')) {
    await db.execAsync('ALTER TABLE journal_entries ADD COLUMN pending_currency_code TEXT;');
  }
  return db;
}

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = initializeDatabase().catch((error) => {
      dbPromise = null;
      throw error;
    });
  }
  return dbPromise;
}

/** Close the keyed handle whenever the app lock engages. */
export async function closeDb(): Promise<void> {
  const pending = dbPromise;
  dbPromise = null;
  if (!pending) return;
  const db = await pending;
  await db.closeAsync();
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
