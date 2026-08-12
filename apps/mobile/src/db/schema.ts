/**
 * Local SQLite schema — DEC-010.
 *
 * Mirrors the server tables the app reads, plus two tables that exist only on
 * the device:
 *   `_sync_meta`       — the delta cursor per workspace
 *   `_mutation_queue`  — outbound writes awaiting the server
 *
 * Design notes:
 *  - The queue is a TABLE, not an in-memory array. It has to survive the app
 *    being killed mid-flight, which is exactly when a user would otherwise
 *    lose a transaction they believed they had saved.
 *  - Amounts are INTEGER minor units, matching the server (DEC-004). SQLite's
 *    INTEGER is 64-bit, so no precision is lost.
 *  - Mirrored rows keep `updated_at` so the pull can upsert idempotently.
 */

export const SCHEMA_VERSION = 2;

export const CREATE_TABLES = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ── Mirrored server tables ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ledger_accounts (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  class TEXT NOT NULL,
  subtype TEXT NOT NULL,
  currency_code TEXT NOT NULL,
  normal_balance TEXT NOT NULL,
  include_in_budget INTEGER NOT NULL DEFAULT 1,
  include_in_net_worth INTEGER NOT NULL DEFAULT 1,
  opening_date TEXT,
  archived_at TEXT,
  deleted_at TEXT,
  created_at TEXT,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_accounts_ws ON ledger_accounts(workspace_id, deleted_at);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT,
  ledger_account_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  parent_id TEXT,
  translation_key TEXT,
  custom_name TEXT,
  icon TEXT,
  color TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  archived_at TEXT,
  deleted_at TEXT,
  created_at TEXT,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_categories_ws ON categories(workspace_id, kind);

CREATE TABLE IF NOT EXISTS journal_entries (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL,
  entry_type TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  local_date TEXT NOT NULL,
  payee TEXT,
  note TEXT,
  status TEXT NOT NULL,
  source TEXT,
  client_entry_id TEXT,
  reverses_entry_id TEXT,
  created_by TEXT,
  posted_at TEXT,
  created_at TEXT,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  -- 1 while this row is an unconfirmed local write (DEC-012 optimistic UI).
  -- Cleared when the server's own copy arrives on the next pull.
  is_pending INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_entries_ws_date ON journal_entries(workspace_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS journal_postings (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL,
  journal_entry_id TEXT NOT NULL,
  ledger_account_id TEXT NOT NULL,
  debit_minor INTEGER NOT NULL DEFAULT 0,
  credit_minor INTEGER NOT NULL DEFAULT 0,
  currency_code TEXT NOT NULL,
  base_amount_minor INTEGER NOT NULL DEFAULT 0,
  memo TEXT,
  created_at TEXT,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_postings_entry ON journal_postings(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_postings_account ON journal_postings(ledger_account_id);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  deleted_at TEXT,
  created_at TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS journal_entry_tags (
  journal_entry_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  created_at TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (journal_entry_id, tag_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  workspace_id TEXT,
  category TEXT NOT NULL,
  severity TEXT NOT NULL,
  title_en TEXT NOT NULL,
  title_bn TEXT,
  body_en TEXT NOT NULL,
  body_bn TEXT,
  action_url TEXT,
  resource_type TEXT,
  resource_id TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  read_at TEXT,
  archived_at TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON notifications(created_at DESC)
  WHERE read_at IS NULL AND archived_at IS NULL AND deleted_at IS NULL;

-- ── Device-only tables ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS _sync_meta (
  workspace_id TEXT PRIMARY KEY NOT NULL,
  cursor TEXT,
  last_synced_at TEXT
);

CREATE TABLE IF NOT EXISTS _mutation_queue (
  -- Client-generated UUID, reused as the Idempotency-Key on every retry.
  -- This is what makes a retry after an ambiguous network failure safe (FIN-02).
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT,
  -- PENDING | IN_FLIGHT | NEEDS_ATTENTION
  -- A 4xx parks the row in NEEDS_ATTENTION instead of blocking everything
  -- behind it in the queue.
  status TEXT NOT NULL DEFAULT 'PENDING',
  last_error TEXT
);
CREATE INDEX IF NOT EXISTS idx_queue_pending ON _mutation_queue(workspace_id, status, created_at);
`;

/** Tables the pull writes into, in FK-safe order. */
export const SYNCABLE_TABLES = [
  'ledger_accounts',
  'categories',
  'journal_entries',
  'journal_postings',
  'tags',
  'journal_entry_tags',
  'notifications',
] as const;

export type SyncableTable = (typeof SYNCABLE_TABLES)[number];

/** Primary key columns per table, for upserts. */
export const PRIMARY_KEYS: Record<SyncableTable, string[]> = {
  ledger_accounts: ['id'],
  categories: ['id'],
  journal_entries: ['id'],
  journal_postings: ['id'],
  tags: ['id'],
  journal_entry_tags: ['journal_entry_id', 'tag_id'],
  notifications: ['id'],
};
