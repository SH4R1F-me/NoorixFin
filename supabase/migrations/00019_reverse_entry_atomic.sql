-- ============================================================
-- 00019 — Reversal becomes ONE transaction
-- Audit §6.4 (FIN-03: "correction preserves history")
-- ============================================================
--
-- ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
-- `reverseTransaction()` performed FOUR sequential writes through PostgREST
-- with no transaction around them and no error check on the last three:
--
--   1. INSERT the reversal entry        (checked)
--   2. INSERT the reversed postings     (result discarded)
--   3. UPDATE the original to VOIDED    (result discarded)
--
-- Every failure mode in between corrupts a double-entry ledger, and each one
-- is silent:
--
--   * step 2 fails  → a POSTED entry with NO postings. The ledger no longer
--     balances, and `workspace_summary()` sums postings, so the figure a user
--     sees is simply wrong with nothing indicating why.
--   * step 3 fails  → the original and its mirror disagree about what the
--     ledger holds, with nothing recording which write won.
--
-- It was also racy. The POSTED check was a SELECT followed by an unconditional
-- INSERT, so two concurrent reversals both saw POSTED and both proceeded —
-- producing two reversal entries for one original and a balance off by the
-- full amount. The status transition looks like it protects against this and
-- does not: it happens after the decision, not as part of it.
--
-- ── WHY A FUNCTION AND NOT A CLIENT-SIDE TRANSACTION ────────────────────────
-- PostgREST has no multi-statement transaction. The only way to make these
-- writes atomic from the API is to move them into the database, which is where
-- a ledger invariant belongs anyway: this now holds no matter which client
-- calls it, including psql.
--
-- SECURITY INVOKER, deliberately. RLS stays the tenant boundary — this function
-- must not become a way to reverse an entry in someone else's workspace, and a
-- DEFINER function would need to re-implement that check itself and could get
-- it wrong. The workspace argument is belt-and-braces on top of RLS, matching
-- what the API guard already asserts (DEC-005).

CREATE OR REPLACE FUNCTION public.reverse_journal_entry(
  p_entry_id     UUID,
  p_workspace_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_original    public.journal_entries%ROWTYPE;
  v_reversal_id UUID := extensions.uuid_generate_v4();
  v_postings    INT;
BEGIN
  -- ── Claim the entry ──────────────────────────────────────────────────────
  -- `FOR UPDATE` locks the row for the life of this transaction, so two
  -- concurrent reversals serialise here rather than both reading POSTED and
  -- both proceeding. The partial unique index below is the backstop.
  SELECT * INTO v_original
    FROM public.journal_entries
   WHERE id           = p_entry_id
     AND workspace_id = p_workspace_id
     AND status       = 'POSTED'
   FOR UPDATE;

  IF NOT FOUND THEN
    -- Deliberately one message for three cases (absent, not yours, not
    -- posted). Distinguishing "not yours" from "does not exist" would let a
    -- caller probe for entry ids in other workspaces.
    RAISE EXCEPTION 'ENTRY_NOT_REVERSIBLE'
      USING HINT = 'The entry does not exist in this workspace, or is not POSTED.';
  END IF;

  -- ── THE ORIGINAL STAYS POSTED. This is the whole design. ─────────────────
  -- An earlier draft set it to VOIDED as well as posting the mirror, which
  -- DOUBLE-COUNTED the correction and was caught by a live check: reversing a
  -- 1,234.00 expense moved net worth from −1,234.00 to +1,234.00 instead of to
  -- zero. Every aggregation in this schema — `workspace_summary()`,
  -- `category_report()`, the budget and goal rollups — sums postings
  -- `WHERE status = 'POSTED'`, so voiding the original REMOVES its effect and
  -- the mirror then ADDS the opposite. Two corrections for one mistake.
  --
  -- Standard double-entry practice, and what FIN-03 means by "correction
  -- preserves history": you never retroactively un-post. The original and its
  -- mirror both stand, both counted, and they cancel. That an entry has been
  -- corrected is DERIVED from a reversal pointing at it, not stored as a
  -- status — so there is no second source of truth to drift.
  INSERT INTO public.journal_entries (
    id, workspace_id, entry_type, occurred_at, local_date, note, status, source,
    client_entry_id, reverses_entry_id, created_by, posted_at, version
  ) VALUES (
    v_reversal_id, v_original.workspace_id, 'REVERSAL', NOW(), CURRENT_DATE,
    'Reversal of ' || v_original.id, 'POSTED', 'MANUAL',
    -- DERIVED from the original, not random: a retry cannot insert a second
    -- reversal, because this collides on the unique index below.
    v_original.id,
    v_original.id, auth.uid(), NOW(), 1
  );

  -- ── The postings ARE the money (DEC-006) ─────────────────────────────────
  -- Debit and credit swapped. Failure here rolls back the entry with them, so
  -- the ledger cannot be left holding an entry that carries no amount.
  INSERT INTO public.journal_postings (
    journal_entry_id, workspace_id, ledger_account_id,
    debit_minor, credit_minor, currency_code, base_amount_minor, memo
  )
  SELECT
    v_reversal_id, p.workspace_id, p.ledger_account_id,
    p.credit_minor, p.debit_minor, p.currency_code, p.base_amount_minor,
    'Reversal of posting ' || p.id
  FROM public.journal_postings p
  WHERE p.journal_entry_id = p_entry_id;

  GET DIAGNOSTICS v_postings = ROW_COUNT;

  -- An entry with no postings carries no amount, so "reversing" it would post
  -- nothing at all while reporting success.
  IF v_postings = 0 THEN
    RAISE EXCEPTION 'ENTRY_HAS_NO_POSTINGS'
      USING HINT = 'The original entry carries no postings; it cannot be reversed.';
  END IF;

  RETURN v_reversal_id;
END;
$$;

REVOKE ALL ON FUNCTION public.reverse_journal_entry(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reverse_journal_entry(UUID, UUID) TO authenticated;

COMMENT ON FUNCTION public.reverse_journal_entry(UUID, UUID) IS
  'FIN-03: atomically post the mirror image of an entry. The ORIGINAL STAYS '
  'POSTED — both entries are counted and they cancel; voiding the original as '
  'well would double-count the correction. SECURITY INVOKER so RLS remains the '
  'tenant boundary. Raises ENTRY_NOT_REVERSIBLE if the entry is absent, not in '
  'this workspace, or not POSTED.';

-- The unique index this relies on to make a retry a no-op rather than a second
-- reversal. Partial, because ordinary entries have no `reverses_entry_id`.
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_reversal_per_entry
  ON public.journal_entries (reverses_entry_id)
  WHERE reverses_entry_id IS NOT NULL;
