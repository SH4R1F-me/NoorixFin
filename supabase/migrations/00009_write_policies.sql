-- NoorixFin Migration: Missing RLS Write Policies
--
-- FOUND ON THE FIRST REAL API RUN (2026-08-04), immediately after the missing
-- GRANTs in 00008. Five tables had RLS enabled with **no write policy at all**,
-- so every INSERT was denied. RLS denies by default: enabling it without an
-- INSERT policy makes a table permanently read-only, silently.
--
--   audit_events        SELECT only   → the super-admin grant could not be audited
--   categories          SELECT only   → seeding and category creation failed
--   journal_postings    SELECT only   → **every transaction write failed**
--   tags                (none)        → tagging failed
--   journal_entry_tags  (none)        → tagging failed
--
-- journal_postings is the severe one: a transaction is an entry PLUS its
-- balancing postings (DEC-006). The entry insert succeeded and the postings
-- insert was denied, so recording a transaction — the product's core action —
-- could never work.
--
-- Why this survived every earlier test: the local suite (run-local.sh) seeds
-- through `postgres`, which bypasses RLS, and asserted only on SELECT
-- isolation. It proved nobody could read another tenant's rows; it never proved
-- the owner could write their own.

-- ============================================================
-- categories
-- ============================================================
CREATE POLICY "Members can create categories"
  ON categories FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = categories.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'ACTIVE'
    )
  );

CREATE POLICY "Members can update categories"
  ON categories FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = categories.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'ACTIVE'
    )
  );

-- ============================================================
-- journal_postings
-- ============================================================
-- Uses the workspace_id denormalised in 00005, so this is one membership
-- lookup rather than a join through journal_entries.
--
-- INSERT only, deliberately: postings are immutable. A correction is a REVERSAL
-- entry with its own postings (FIN-03 / DEC-006), never an edit. Granting
-- UPDATE here would make the ledger silently rewritable.
CREATE POLICY "Members can create postings"
  ON journal_postings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = journal_postings.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'ACTIVE'
    )
  );

-- ============================================================
-- tags
-- ============================================================
CREATE POLICY "Members can view tags"
  ON tags FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = tags.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'ACTIVE'
    )
  );

CREATE POLICY "Members can create tags"
  ON tags FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = tags.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'ACTIVE'
    )
  );

CREATE POLICY "Members can update tags"
  ON tags FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = tags.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'ACTIVE'
    )
  );

-- ============================================================
-- journal_entry_tags
-- ============================================================
-- Had no policies at all. workspace_id is populated by the
-- derive_workspace_from_entry() trigger (00005).
CREATE POLICY "Members can view entry tags"
  ON journal_entry_tags FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = journal_entry_tags.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'ACTIVE'
    )
  );

CREATE POLICY "Members can link entry tags"
  ON journal_entry_tags FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = journal_entry_tags.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'ACTIVE'
    )
  );

-- Unlinking a tag is not a ledger edit, so DELETE is allowed here.
CREATE POLICY "Members can unlink entry tags"
  ON journal_entry_tags FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = journal_entry_tags.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'ACTIVE'
    )
  );

-- ============================================================
-- audit_events
-- ============================================================
-- Append-only: INSERT but never UPDATE or DELETE. An audit trail a caller can
-- rewrite is not an audit trail.
--
-- workspace_id is nullable — account-level events such as SUPER_ADMIN_GRANTED
-- belong to no workspace — so the check accepts either an owned workspace or a
-- workspace-less event attributed to the caller.
CREATE POLICY "Members can append audit events"
  ON audit_events FOR INSERT
  WITH CHECK (
    actor_id = auth.uid()
    AND (
      workspace_id IS NULL
      OR EXISTS (
        SELECT 1 FROM workspace_members wm
        WHERE wm.workspace_id = audit_events.workspace_id
          AND wm.user_id = auth.uid()
          AND wm.status = 'ACTIVE'
      )
    )
  );
