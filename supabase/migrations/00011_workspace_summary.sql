-- NoorixFin Migration: Dashboard summary aggregation (DEC-011)
--
-- DEC-011 rule 6: "Dashboard summaries computed in Postgres and returned as one
-- payload, instead of shipping raw transaction rows to the client to sum."
-- Deferred from W7 because there was no real data to aggregate; there is now.
--
-- SECURITY INVOKER (the default — stated explicitly here because it matters):
-- the function runs with the CALLER's rights, so RLS applies and a caller can
-- only ever aggregate their own workspace. A SECURITY DEFINER function would
-- silently become a cross-tenant read of every user's finances, which is
-- exactly the kind of bypass SEC-01 exists to prevent.
--
-- Balance sign convention (Blueprint §8.2 double-entry):
--   normal_balance DEBIT  (ASSET, EXPENSE)            → debit - credit
--   normal_balance CREDIT (LIABILITY, INCOME, EQUITY) → credit - debit
-- Computing from postings rather than a stored balance means a reversal is
-- reflected automatically — there is no cached number to drift (DEC-006).

CREATE OR REPLACE FUNCTION public.workspace_summary(p_workspace_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tz            TEXT;
  v_month_start   DATE;
  v_prev_start    DATE;
  v_net_worth     BIGINT;
  v_income        BIGINT;
  v_expense       BIGINT;
  v_prev_income   BIGINT;
  v_prev_expense  BIGINT;
BEGIN
  -- Month boundaries in the WORKSPACE's timezone, not the server's. A user in
  -- Asia/Dhaka must not see their month roll over on UTC midnight (TIME-01).
  SELECT COALESCE(w.timezone, 'UTC') INTO v_tz
    FROM public.workspaces w WHERE w.id = p_workspace_id;

  IF v_tz IS NULL THEN
    -- No row visible: either it does not exist or RLS hid it. Same answer
    -- either way — an empty summary, never another tenant's numbers.
    RETURN jsonb_build_object('visible', false);
  END IF;

  v_month_start := date_trunc('month', (now() AT TIME ZONE v_tz))::date;
  v_prev_start  := (v_month_start - INTERVAL '1 month')::date;

  -- Net worth: assets minus liabilities, over accounts flagged for net worth.
  SELECT COALESCE(SUM(
           CASE WHEN la.normal_balance = 'DEBIT'
                THEN p.debit_minor - p.credit_minor
                ELSE p.credit_minor - p.debit_minor
           END
           * CASE WHEN la.class = 'LIABILITY' THEN -1 ELSE 1 END
         ), 0)
    INTO v_net_worth
    FROM public.journal_postings p
    JOIN public.ledger_accounts la ON la.id = p.ledger_account_id
    JOIN public.journal_entries je ON je.id = p.journal_entry_id
   WHERE p.workspace_id = p_workspace_id
     AND la.include_in_net_worth
     AND la.deleted_at IS NULL
     AND je.status = 'POSTED';

  -- Income and expense are read off the INCOME/EXPENSE accounts the categories
  -- post into, so they stay correct however the entry was categorised.
  SELECT
    COALESCE(SUM(CASE WHEN la.class = 'INCOME'  AND je.local_date >= v_month_start
                      THEN p.credit_minor - p.debit_minor END), 0),
    COALESCE(SUM(CASE WHEN la.class = 'EXPENSE' AND je.local_date >= v_month_start
                      THEN p.debit_minor - p.credit_minor END), 0),
    COALESCE(SUM(CASE WHEN la.class = 'INCOME'  AND je.local_date >= v_prev_start
                                                AND je.local_date <  v_month_start
                      THEN p.credit_minor - p.debit_minor END), 0),
    COALESCE(SUM(CASE WHEN la.class = 'EXPENSE' AND je.local_date >= v_prev_start
                                                AND je.local_date <  v_month_start
                      THEN p.debit_minor - p.credit_minor END), 0)
    INTO v_income, v_expense, v_prev_income, v_prev_expense
    FROM public.journal_postings p
    JOIN public.ledger_accounts la ON la.id = p.ledger_account_id
    JOIN public.journal_entries je ON je.id = p.journal_entry_id
   WHERE p.workspace_id = p_workspace_id
     AND je.status = 'POSTED'
     AND je.local_date >= v_prev_start;

  RETURN jsonb_build_object(
    'visible',        true,
    'timezone',       v_tz,
    'month_start',    v_month_start,
    'net_worth',      v_net_worth,
    'income',         v_income,
    'expense',        v_expense,
    'net',            v_income - v_expense,
    'prev_income',    v_prev_income,
    'prev_expense',   v_prev_expense,
    'prev_net',       v_prev_income - v_prev_expense,
    -- Percentage deltas are deliberately NOT computed here. With a zero prior
    -- month the change is undefined, not "+100%", and the caller needs to
    -- render that difference rather than be handed a misleading number.
    'account_count',  (SELECT count(*) FROM public.ledger_accounts la2
                        WHERE la2.workspace_id = p_workspace_id
                          AND la2.subtype NOT IN ('CATEGORY','SYSTEM')
                          AND la2.archived_at IS NULL
                          AND la2.deleted_at IS NULL)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.workspace_summary(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.workspace_summary(UUID) TO authenticated;

COMMENT ON FUNCTION public.workspace_summary(UUID) IS
  'DEC-011: single-payload dashboard aggregation. SECURITY INVOKER so RLS applies — '
  'must never be changed to SECURITY DEFINER, which would make it a cross-tenant read.';
