-- Phase 5 financial reports. All values are derived from immutable postings;
-- both functions are SECURITY INVOKER so existing RLS remains the tenant gate.

CREATE OR REPLACE FUNCTION public.cash_flow_report(
  p_workspace_id UUID,
  p_from DATE DEFAULT NULL,
  p_to DATE DEFAULT NULL,
  p_granularity TEXT DEFAULT 'month'
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tz TEXT;
  v_today DATE;
  v_from DATE;
  v_to DATE;
  v_step INTERVAL;
  v_periods JSONB;
BEGIN
  v_tz := public.workspace_tz(p_workspace_id);
  IF v_tz IS NULL THEN RETURN jsonb_build_object('visible', false); END IF;
  IF p_granularity NOT IN ('day','week','month') THEN
    RAISE EXCEPTION 'invalid report granularity' USING ERRCODE = '22023';
  END IF;
  v_today := (now() AT TIME ZONE v_tz)::date;
  v_from := COALESCE(p_from, (date_trunc('month', v_today) - INTERVAL '5 months')::date);
  v_to := COALESCE(p_to, v_today + 1);
  IF v_to <= v_from OR v_to - v_from > 3660 THEN
    RAISE EXCEPTION 'invalid report period' USING ERRCODE = '22023';
  END IF;
  v_step := CASE p_granularity WHEN 'day' THEN INTERVAL '1 day' WHEN 'week' THEN INTERVAL '1 week' ELSE INTERVAL '1 month' END;

  SELECT COALESCE(jsonb_agg(period ORDER BY period->>'period_start'), '[]'::jsonb)
    INTO v_periods
    FROM (
      SELECT jsonb_build_object(
        'period_start', s.start_date::date,
        'period_end', LEAST((s.start_date + v_step)::date, v_to),
        'income_minor', COALESCE(SUM(CASE WHEN la.class = 'INCOME' THEN p.credit_minor - p.debit_minor END), 0),
        'expense_minor', COALESCE(SUM(CASE WHEN la.class = 'EXPENSE' THEN p.debit_minor - p.credit_minor END), 0),
        'net_minor', COALESCE(SUM(CASE WHEN la.class = 'INCOME' THEN p.credit_minor - p.debit_minor WHEN la.class = 'EXPENSE' THEN p.credit_minor - p.debit_minor ELSE 0 END), 0)
      ) AS period
      FROM generate_series(
        CASE p_granularity WHEN 'day' THEN v_from::timestamp WHEN 'week' THEN date_trunc('week', v_from)::timestamp ELSE date_trunc('month', v_from)::timestamp END,
        (v_to - 1)::timestamp,
        v_step
      ) s(start_date)
      LEFT JOIN public.journal_entries je
        ON je.workspace_id = p_workspace_id AND je.status = 'POSTED'
       AND je.local_date >= GREATEST(s.start_date::date, v_from)
       AND je.local_date < LEAST((s.start_date + v_step)::date, v_to)
      LEFT JOIN public.journal_postings p ON p.journal_entry_id = je.id
      LEFT JOIN public.ledger_accounts la ON la.id = p.ledger_account_id
      GROUP BY s.start_date
    ) rows;

  RETURN jsonb_build_object(
    'visible', true, 'period_from', v_from, 'period_to', v_to,
    'granularity', p_granularity, 'timezone', v_tz,
    'currency_basis', (SELECT base_currency FROM public.workspaces WHERE id = p_workspace_id),
    'generated_at', now(), 'periods', v_periods
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.net_worth_report(
  p_workspace_id UUID,
  p_from DATE DEFAULT NULL,
  p_to DATE DEFAULT NULL,
  p_granularity TEXT DEFAULT 'month'
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tz TEXT;
  v_today DATE;
  v_from DATE;
  v_to DATE;
  v_step INTERVAL;
  v_periods JSONB;
BEGIN
  v_tz := public.workspace_tz(p_workspace_id);
  IF v_tz IS NULL THEN RETURN jsonb_build_object('visible', false); END IF;
  IF p_granularity NOT IN ('day','week','month') THEN
    RAISE EXCEPTION 'invalid report granularity' USING ERRCODE = '22023';
  END IF;
  v_today := (now() AT TIME ZONE v_tz)::date;
  v_from := COALESCE(p_from, (date_trunc('month', v_today) - INTERVAL '11 months')::date);
  v_to := COALESCE(p_to, v_today + 1);
  IF v_to <= v_from OR v_to - v_from > 3660 THEN
    RAISE EXCEPTION 'invalid report period' USING ERRCODE = '22023';
  END IF;
  v_step := CASE p_granularity WHEN 'day' THEN INTERVAL '1 day' WHEN 'week' THEN INTERVAL '1 week' ELSE INTERVAL '1 month' END;

  SELECT COALESCE(jsonb_agg(period ORDER BY period->>'period_start'), '[]'::jsonb)
    INTO v_periods
    FROM (
      SELECT jsonb_build_object(
        'period_start', s.start_date::date,
        'period_end', LEAST((s.start_date + v_step)::date, v_to),
        'assets_minor', COALESCE(SUM(CASE WHEN la.class = 'ASSET' THEN p.debit_minor - p.credit_minor ELSE 0 END), 0),
        'liabilities_minor', COALESCE(SUM(CASE WHEN la.class = 'LIABILITY' THEN p.credit_minor - p.debit_minor ELSE 0 END), 0),
        'net_worth_minor', COALESCE(SUM(CASE WHEN la.class = 'ASSET' THEN p.debit_minor - p.credit_minor WHEN la.class = 'LIABILITY' THEN p.debit_minor - p.credit_minor ELSE 0 END), 0)
      ) AS period
      FROM generate_series(
        CASE p_granularity WHEN 'day' THEN v_from::timestamp WHEN 'week' THEN date_trunc('week', v_from)::timestamp ELSE date_trunc('month', v_from)::timestamp END,
        (v_to - 1)::timestamp,
        v_step
      ) s(start_date)
      LEFT JOIN public.journal_entries je
        ON je.workspace_id = p_workspace_id AND je.status = 'POSTED'
       AND je.local_date < LEAST((s.start_date + v_step)::date, v_to)
      LEFT JOIN public.journal_postings p ON p.journal_entry_id = je.id
      LEFT JOIN public.ledger_accounts la ON la.id = p.ledger_account_id
      GROUP BY s.start_date
    ) rows;

  RETURN jsonb_build_object(
    'visible', true, 'period_from', v_from, 'period_to', v_to,
    'granularity', p_granularity, 'timezone', v_tz,
    'currency_basis', (SELECT base_currency FROM public.workspaces WHERE id = p_workspace_id),
    'generated_at', now(), 'periods', v_periods
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cash_flow_report(UUID, DATE, DATE, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.net_worth_report(UUID, DATE, DATE, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cash_flow_report(UUID, DATE, DATE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.net_worth_report(UUID, DATE, DATE, TEXT) TO authenticated;

COMMENT ON FUNCTION public.cash_flow_report(UUID, DATE, DATE, TEXT) IS
  'Phase 5 cash-flow and income/expense time series; SECURITY INVOKER.';
COMMENT ON FUNCTION public.net_worth_report(UUID, DATE, DATE, TEXT) IS
  'Phase 5 historical assets, liabilities and net-worth time series; SECURITY INVOKER.';
