-- ============================================================
-- 00020 — Make tags usable
-- Audit §6.3: "`tags` / `journal_entry_tags` tables and API support exist
--              with no UI"
-- ============================================================
--
-- Wiring the UI surfaced two schema gaps that were invisible while nothing
-- read or wrote these tables.
--
-- ── 1. A tag could be created and never removed ─────────────────────────────
-- `tags` shipped with SELECT, INSERT and UPDATE policies and no DELETE. The
-- table GRANT includes DELETE, so this is not a missing privilege — it is RLS
-- silently rejecting every delete, which returns success with zero rows
-- affected. A user tidying up a typo'd tag would have watched it not disappear
-- with nothing explaining why.
--
-- `journal_entry_tags` already cascades on `tag_id`, so removing a tag detaches
-- it from every entry without touching the entries themselves. That is the
-- correct behaviour and worth stating: a tag is a label, not a fact about the
-- money, so deleting one must never alter a balance.
DROP POLICY IF EXISTS "Members can delete tags" ON public.tags;
CREATE POLICY "Members can delete tags"
  ON public.tags FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members m
       WHERE m.workspace_id = tags.workspace_id
         AND m.user_id = auth.uid()
    )
  );

-- ── 2. The filter had no index to stand on ──────────────────────────────────
-- Filtering a transaction list by tag reads `journal_entry_tags` by `tag_id`.
-- The table's primary key is (journal_entry_id, tag_id), which cannot serve a
-- lookup keyed on the SECOND column — so every tag filter was a sequential
-- scan. Harmless at ten transactions and not at ten thousand, which is the
-- point at which someone would actually be using tags to find things.
CREATE INDEX IF NOT EXISTS idx_entry_tags_tag
  ON public.journal_entry_tags (tag_id, journal_entry_id);

-- Listing a workspace's tags alphabetically is the other hot path — it happens
-- on every render of the transactions page.
CREATE INDEX IF NOT EXISTS idx_tags_workspace_name
  ON public.tags (workspace_id, name);

COMMENT ON TABLE public.tags IS
  'Free-form labels, scoped per workspace and unique by name within one. '
  'Deleting a tag detaches it from every entry (journal_entry_tags cascades) '
  'and never alters a posting — a tag is a label, not a fact about the money.';
