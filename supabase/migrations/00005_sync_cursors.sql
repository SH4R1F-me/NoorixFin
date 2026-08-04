-- NoorixFin Migration: Sync Cursors & Hot-Path Indexes (W5 / DEC-010, DEC-011)
--
-- Prepares the schema for delta sync (`GET /v1/workspaces/:id/sync?since=`) and
-- cuts work off the RLS hot path.
--
-- Four groups of change:
--   1. `updated_at` (+ trigger) on the syncable tables that lack it
--   2. `workspace_id` denormalised onto journal_postings / journal_entry_tags
--   3. `deleted_at` tombstones so deletions can reach offline clients
--   4. `(workspace_id, updated_at)` covering indexes for the sync scan

-- ============================================================
-- 1. updated_at on the tables that lack it
-- ============================================================
-- ledger_accounts and journal_entries already have updated_at + triggers
-- (migration 00002). These four did not, so a delta cursor could not see them.

ALTER TABLE categories          ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE tags                ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE journal_postings    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE journal_entry_tags  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- created_at for the two tables that had neither timestamp
ALTER TABLE tags                ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE journal_postings    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE journal_entry_tags  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- update_updated_at() was defined in 00001.
DROP TRIGGER IF EXISTS categories_updated_at ON categories;
CREATE TRIGGER categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS tags_updated_at ON tags;
CREATE TRIGGER tags_updated_at
  BEFORE UPDATE ON tags
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS journal_postings_updated_at ON journal_postings;
CREATE TRIGGER journal_postings_updated_at
  BEFORE UPDATE ON journal_postings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS journal_entry_tags_updated_at ON journal_entry_tags;
CREATE TRIGGER journal_entry_tags_updated_at
  BEFORE UPDATE ON journal_entry_tags
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 2. Denormalise workspace_id onto the two child tables
-- ============================================================
-- journal_postings and journal_entry_tags reach their workspace only through
-- journal_entries. That costs an extra join on two hot paths:
--
--   a) RLS — "Members can view postings" joins journal_entries THEN
--      workspace_members for every row considered.
--   b) Sync — a cursor scan cannot use a (workspace_id, updated_at) index on a
--      column the table does not have.
--
-- The value is derived, never user-supplied: a BEFORE INSERT trigger copies it
-- from the parent entry, so it cannot drift even if a caller omits or forges it.

ALTER TABLE journal_postings   ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE RESTRICT;
ALTER TABLE journal_entry_tags ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;

UPDATE journal_postings p
   SET workspace_id = je.workspace_id
  FROM journal_entries je
 WHERE je.id = p.journal_entry_id
   AND p.workspace_id IS DISTINCT FROM je.workspace_id;

UPDATE journal_entry_tags jt
   SET workspace_id = je.workspace_id
  FROM journal_entries je
 WHERE je.id = jt.journal_entry_id
   AND jt.workspace_id IS DISTINCT FROM je.workspace_id;

ALTER TABLE journal_postings   ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE journal_entry_tags ALTER COLUMN workspace_id SET NOT NULL;

CREATE OR REPLACE FUNCTION derive_workspace_from_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  SELECT je.workspace_id INTO NEW.workspace_id
    FROM public.journal_entries je
   WHERE je.id = NEW.journal_entry_id;

  IF NEW.workspace_id IS NULL THEN
    RAISE EXCEPTION 'journal entry % not found; cannot derive workspace_id', NEW.journal_entry_id;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION derive_workspace_from_entry() IS
  'Copies workspace_id from the parent journal entry. Ignores any caller-supplied '
  'value so the denormalised column can never disagree with the parent.';

DROP TRIGGER IF EXISTS journal_postings_workspace ON journal_postings;
CREATE TRIGGER journal_postings_workspace
  BEFORE INSERT ON journal_postings
  FOR EACH ROW EXECUTE FUNCTION derive_workspace_from_entry();

DROP TRIGGER IF EXISTS journal_entry_tags_workspace ON journal_entry_tags;
CREATE TRIGGER journal_entry_tags_workspace
  BEFORE INSERT ON journal_entry_tags
  FOR EACH ROW EXECUTE FUNCTION derive_workspace_from_entry();

-- Now that workspace_id is local, the postings policy no longer needs to join
-- through journal_entries.
DROP POLICY IF EXISTS "Members can view postings" ON journal_postings;
CREATE POLICY "Members can view postings"
  ON journal_postings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = journal_postings.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'ACTIVE'
    )
  );

-- ============================================================
-- 3. Tombstones
-- ============================================================
-- An offline client that pulls only changed rows never learns about a row that
-- simply vanished. Soft-delete the reference tables so deletions propagate.
--
-- The ledger itself is NOT tombstoned: journal entries are corrected by
-- reversal, never deleted (FIN-03 / DEC-006), so a delete tombstone there would
-- imply an operation the domain does not permit.

ALTER TABLE ledger_accounts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE categories      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE tags            ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

COMMENT ON COLUMN ledger_accounts.deleted_at IS
  'Soft-delete tombstone for offline sync (DEC-010). Distinct from archived_at, '
  'which hides an account from pickers but keeps it in reports.';

-- ============================================================
-- 4. Sync scan indexes
-- ============================================================
-- The delta endpoint reads WHERE workspace_id = $1 AND updated_at > $2
-- ORDER BY updated_at. These make each table a single index range scan
-- instead of a sequential scan (DEC-011 — egress and CPU both matter on Free Tier).

CREATE INDEX IF NOT EXISTS idx_ledger_accounts_sync     ON ledger_accounts(workspace_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_journal_entries_sync     ON journal_entries(workspace_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_journal_postings_sync    ON journal_postings(workspace_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_tags_sync                ON tags(workspace_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_journal_entry_tags_sync  ON journal_entry_tags(workspace_id, updated_at);

-- categories.workspace_id is NULLABLE — system categories are global and shared
-- by every workspace (00002). Two indexes: one for workspace-owned rows, one
-- partial index for the system set, which the sync endpoint queries separately.
CREATE INDEX IF NOT EXISTS idx_categories_sync
  ON categories(workspace_id, updated_at)
  WHERE workspace_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_categories_system_sync
  ON categories(updated_at)
  WHERE workspace_id IS NULL;
