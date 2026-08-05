-- NoorixFin Migration: Planning aggregations — DEC-011, Blueprint §11.3
--
-- Four read functions behind /budgets, /calendar, /goals and /reports. Same
-- contract as workspace_summary() in 00011, for the same reasons:
--
--   * SECURITY INVOKER, always. These read journal_postings — the user's actual
--     finances. A SECURITY DEFINER function here would be a cross-tenant read
--     of every user's money wearing a helpful name, and would defeat SEC-01 at
--     a layer no API guard can compensate for. Stated on each function because
--     the default is easy to flip by accident during a later edit.
--   * One JSONB payload per screen (DEC-011 rule 6), not raw rows for the
--     client to sum. On Free Tier every avoided row is avoided egress, and a
--     client-side sum of a ledger is a second implementation of arithmetic
--     that must agree with Postgres forever.
--   * Every "spent" / "progress" figure is DERIVED from postings. Nothing here
--     reads a stored total, so a reversal is reflected with no reconciliation
--     step (DEC-006, DEC-022).
--
-- §11.3 requires a report response to carry period, timezone, currency basis
-- and generated-at. Each payload below does.

-- ============================================================
-- Shared: the workspace's timezone, or NULL when RLS hides the row
-- ============================================================
-- Returning NULL rather than raising lets each caller answer
-- {"visible": false} — the same response for "does not exist" and "not yours",
-- so the function cannot be used to probe which workspace IDs are real.
CREATE OR REPLACE FUNCTION public.workspace_tz(p_workspace_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT w.timezone FROM public.workspaces w WHERE w.id = p_workspace_id;
$$;

REVOKE ALL ON FUNCTION public.workspace_tz(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.workspace_tz(UUID) TO authenticated;

-- ============================================================
-- 1. budget_status() — planned vs actual per category
-- ============================================================
CREATE OR REPLACE FUNCTION public.budget_status(p_workspace_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tz            TEXT;
  v_today         DATE;
  v_budget        RECORD;
  v_period_start  DATE;
  v_period_end    DATE;
  v_lines         JSONB;
BEGIN
  v_tz := public.workspace_tz(p_workspace_id);
  IF v_tz IS NULL THEN
    RETURN jsonb_build_object('visible', false);
  END IF;

  v_today := (now() AT TIME ZONE v_tz)::date;

  SELECT * INTO v_budget
    FROM public.budgets b
   WHERE b.workspace_id = p_workspace_id AND b.status = 'ACTIVE'
   ORDER BY b.created_at
   LIMIT 1;

  IF v_budget.id IS NULL THEN
    -- No budget is a legitimate state, not an error. The caller renders an
    -- empty state with a "create one" action rather than a failure.
    RETURN jsonb_build_object(
      'visible', true, 'has_budget', false,
      'timezone', v_tz, 'generated_at', now()
    );
  END IF;

  -- The CURRENT period containing today, derived from cadence + anchor. Storing
  -- a row per period would leave gaps for any month the app was not opened.
  IF v_budget.cadence = 'WEEKLY' THEN
    v_period_start := v_budget.period_start
      + (((v_today - v_budget.period_start) / 7) * 7);
    v_period_end := v_period_start + 7;
  ELSE
    v_period_start := date_trunc('month', v_today)::date;
    v_period_end := (v_period_start + INTERVAL '1 month')::date;
  END IF;

  SELECT COALESCE(jsonb_agg(line ORDER BY line->>'name'), '[]'::jsonb)
    INTO v_lines
    FROM (
      SELECT jsonb_build_object(
               'line_id',        bl.id,
               'category_id',    c.id,
               'name',           COALESCE(c.custom_name, c.translation_key, 'Unnamed'),
               -- Sent separately so the client can translate a seeded category
               -- while showing a user-named one verbatim (DEC-015). Passing only
               -- a pre-resolved label is what leaked raw `cat.food_dining` keys
               -- to users before.
               'translation_key', c.translation_key,
               'custom_name',     c.custom_name,
               'icon',            c.icon,
               'color',           c.color,
               'planned_minor',   bl.planned_minor,
               'spent_minor',     COALESCE(spend.total, 0),
               'remaining_minor', bl.planned_minor - COALESCE(spend.total, 0),
               'alert_threshold_pct', bl.alert_threshold_pct
             ) AS line
        FROM public.budget_lines bl
        JOIN public.categories c ON c.id = bl.category_id
        LEFT JOIN LATERAL (
          -- Spend for THIS category in THIS period, read off the EXPENSE ledger
          -- account the category posts into. Debit minus credit, so a reversal
          -- (which credits the same account) subtracts itself automatically.
          SELECT SUM(p.debit_minor - p.credit_minor) AS total
            FROM public.journal_postings p
            JOIN public.journal_entries je ON je.id = p.journal_entry_id
           WHERE p.ledger_account_id = c.ledger_account_id
             AND p.workspace_id = p_workspace_id
             AND je.status = 'POSTED'
             AND je.local_date >= v_period_start
             AND je.local_date <  v_period_end
        ) spend ON TRUE
       WHERE bl.budget_id = v_budget.id
    ) rows;

  RETURN jsonb_build_object(
    'visible',       true,
    'has_budget',    true,
    'budget_id',     v_budget.id,
    'name',          v_budget.name,
    'cadence',       v_budget.cadence,
    'rollover',      v_budget.rollover,
    'period_start',  v_period_start,
    'period_end',    v_period_end,
    'timezone',      v_tz,
    'generated_at',  now(),
    'lines',         v_lines,
    'planned_total', (SELECT COALESCE(SUM((l->>'planned_minor')::bigint), 0)
                        FROM jsonb_array_elements(v_lines) l),
    'spent_total',   (SELECT COALESCE(SUM((l->>'spent_minor')::bigint), 0)
                        FROM jsonb_array_elements(v_lines) l)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.budget_status(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.budget_status(UUID) TO authenticated;

COMMENT ON FUNCTION public.budget_status(UUID) IS
  'DEC-011/DEC-022. SECURITY INVOKER so RLS applies — must never become SECURITY DEFINER.';

-- ============================================================
-- 2. calendar_overview() — upcoming, due and overdue
-- ============================================================
CREATE OR REPLACE FUNCTION public.calendar_overview(
  p_workspace_id UUID,
  p_days INTEGER DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tz     TEXT;
  v_today  DATE;
  v_events JSONB;
BEGIN
  v_tz := public.workspace_tz(p_workspace_id);
  IF v_tz IS NULL THEN
    RETURN jsonb_build_object('visible', false);
  END IF;

  v_today := (now() AT TIME ZONE v_tz)::date;

  SELECT COALESCE(jsonb_agg(e ORDER BY e->>'local_date'), '[]'::jsonb)
    INTO v_events
    FROM (
      SELECT jsonb_build_object(
               'id',            ce.id,
               'type',          ce.type,
               'title',         ce.title,
               'amount_minor',  ce.amount_minor,
               'currency_code', ce.currency_code,
               'due_at',        ce.due_at,
               'local_date',    ce.local_date,
               -- OVERDUE is COMPUTED, never stored. A stored value needs a
               -- sweeper, and a sweeper that has not run must not be the reason
               -- a user is never told a bill is late.
               'status',        CASE
                                  WHEN ce.status <> 'UPCOMING' THEN ce.status
                                  WHEN ce.local_date <  v_today THEN 'OVERDUE'
                                  WHEN ce.local_date =  v_today THEN 'DUE'
                                  ELSE 'UPCOMING'
                                END,
               'days_away',     ce.local_date - v_today,
               'journal_entry_id', ce.journal_entry_id,
               'recurring_rule_id', ce.recurring_rule_id
             ) AS e
        FROM public.calendar_events ce
       WHERE ce.workspace_id = p_workspace_id
         -- Past PAID/SKIPPED events are history; overdue UPCOMING ones are not,
         -- however old, because they still need action.
         AND (ce.status = 'UPCOMING' OR ce.local_date >= v_today - 30)
         AND ce.local_date <= v_today + p_days
    ) rows;

  RETURN jsonb_build_object(
    'visible',      true,
    'timezone',     v_tz,
    'today',        v_today,
    'horizon_days', p_days,
    'generated_at', now(),
    'events',       v_events,
    'overdue_count', (SELECT count(*) FROM jsonb_array_elements(v_events) e
                       WHERE e->>'status' = 'OVERDUE'),
    'due_soon_total_minor',
      (SELECT COALESCE(SUM((e->>'amount_minor')::bigint), 0)
         FROM jsonb_array_elements(v_events) e
        WHERE e->>'status' IN ('UPCOMING', 'DUE', 'OVERDUE')
          AND e->>'type' = 'BILL')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.calendar_overview(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.calendar_overview(UUID, INTEGER) TO authenticated;

-- ============================================================
-- 3. goals_overview() — savings progress and debt summary
-- ============================================================
CREATE OR REPLACE FUNCTION public.goals_overview(p_workspace_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tz    TEXT;
  v_today DATE;
  v_goals JSONB;
  v_debts JSONB;
BEGIN
  v_tz := public.workspace_tz(p_workspace_id);
  IF v_tz IS NULL THEN
    RETURN jsonb_build_object('visible', false);
  END IF;

  v_today := (now() AT TIME ZONE v_tz)::date;

  SELECT COALESCE(jsonb_agg(g ORDER BY g->>'priority' DESC, g->>'name'), '[]'::jsonb)
    INTO v_goals
    FROM (
      SELECT jsonb_build_object(
               'id',            sg.id,
               'name',          sg.name,
               'target_minor',  sg.target_minor,
               'currency_code', sg.currency_code,
               'target_date',   sg.target_date,
               'status',        sg.status,
               'priority',      sg.priority,
               'linked_account_id', sg.linked_account_id,
               -- The BALANCE of the linked account, not an editable number.
               -- §9.4: progress is source-driven. A goal with no linked account
               -- reports null rather than 0, so the UI can say "link an account"
               -- instead of "you have saved nothing".
               'current_minor', bal.amount,
               'days_left',     CASE WHEN sg.target_date IS NULL THEN NULL
                                     ELSE sg.target_date - v_today END
             ) AS g
        FROM public.savings_goals sg
        LEFT JOIN LATERAL (
          SELECT SUM(CASE WHEN la.normal_balance = 'DEBIT'
                          THEN p.debit_minor - p.credit_minor
                          ELSE p.credit_minor - p.debit_minor END) AS amount
            FROM public.journal_postings p
            JOIN public.ledger_accounts la ON la.id = p.ledger_account_id
            JOIN public.journal_entries je ON je.id = p.journal_entry_id
           WHERE p.ledger_account_id = sg.linked_account_id
             AND je.status = 'POSTED'
        ) bal ON sg.linked_account_id IS NOT NULL
       WHERE sg.workspace_id = p_workspace_id
         AND sg.status <> 'ABANDONED'
    ) rows;

  SELECT COALESCE(jsonb_agg(d ORDER BY d->>'name'), '[]'::jsonb)
    INTO v_debts
    FROM (
      SELECT jsonb_build_object(
               'ledger_account_id', dd.ledger_account_id,
               'name',              la.name,
               'currency_code',     la.currency_code,
               'principal_minor',   dd.principal_minor,
               'annual_rate_bps',   dd.annual_rate_bps,
               'minimum_payment_minor', dd.minimum_payment_minor,
               'due_day',           dd.due_day,
               -- Outstanding balance from the ledger. A LIABILITY account has a
               -- CREDIT normal balance, so credit - debit is what is still owed
               -- and every repayment reduces it without anyone updating a field.
               'outstanding_minor', COALESCE(bal.amount, 0)
             ) AS d
        FROM public.debt_details dd
        JOIN public.ledger_accounts la ON la.id = dd.ledger_account_id
        LEFT JOIN LATERAL (
          SELECT SUM(p.credit_minor - p.debit_minor) AS amount
            FROM public.journal_postings p
            JOIN public.journal_entries je ON je.id = p.journal_entry_id
           WHERE p.ledger_account_id = dd.ledger_account_id
             AND je.status = 'POSTED'
        ) bal ON TRUE
       WHERE dd.workspace_id = p_workspace_id
         AND la.deleted_at IS NULL
    ) rows;

  RETURN jsonb_build_object(
    'visible',      true,
    'timezone',     v_tz,
    'generated_at', now(),
    'goals',        v_goals,
    'debts',        v_debts,
    'total_debt_minor', (SELECT COALESCE(SUM((d->>'outstanding_minor')::bigint), 0)
                           FROM jsonb_array_elements(v_debts) d)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.goals_overview(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.goals_overview(UUID) TO authenticated;

-- ============================================================
-- 4. category_report() — spending breakdown for /reports
-- ============================================================
CREATE OR REPLACE FUNCTION public.category_report(
  p_workspace_id UUID,
  p_from DATE DEFAULT NULL,
  p_to   DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tz         TEXT;
  v_today      DATE;
  v_from       DATE;
  v_to         DATE;
  v_categories JSONB;
  v_trend      JSONB;
BEGIN
  v_tz := public.workspace_tz(p_workspace_id);
  IF v_tz IS NULL THEN
    RETURN jsonb_build_object('visible', false);
  END IF;

  v_today := (now() AT TIME ZONE v_tz)::date;
  v_from  := COALESCE(p_from, date_trunc('month', v_today)::date);
  v_to    := COALESCE(p_to, (date_trunc('month', v_today) + INTERVAL '1 month')::date);

  SELECT COALESCE(jsonb_agg(c ORDER BY (c->>'amount_minor')::bigint DESC), '[]'::jsonb)
    INTO v_categories
    FROM (
      SELECT jsonb_build_object(
               'category_id',     cat.id,
               'translation_key', cat.translation_key,
               'custom_name',     cat.custom_name,
               'icon',            cat.icon,
               'color',           cat.color,
               'kind',            cat.kind,
               'amount_minor',    SUM(CASE WHEN cat.kind = 'EXPENSE'
                                           THEN p.debit_minor - p.credit_minor
                                           ELSE p.credit_minor - p.debit_minor END),
               'entry_count',     COUNT(DISTINCT je.id)
             ) AS c
        FROM public.journal_postings p
        JOIN public.journal_entries je ON je.id = p.journal_entry_id
        JOIN public.categories cat ON cat.ledger_account_id = p.ledger_account_id
       WHERE p.workspace_id = p_workspace_id
         AND je.status = 'POSTED'
         AND je.local_date >= v_from
         AND je.local_date <  v_to
       GROUP BY cat.id, cat.translation_key, cat.custom_name,
                cat.icon, cat.color, cat.kind
      HAVING SUM(CASE WHEN cat.kind = 'EXPENSE'
                      THEN p.debit_minor - p.credit_minor
                      ELSE p.credit_minor - p.debit_minor END) <> 0
    ) rows;

  -- Six months of income/expense so /reports can show a trend without a second
  -- round trip. Generated from a series rather than from the data, so a month
  -- with no activity appears as a zero instead of vanishing and making the
  -- chart lie about the shape of the year.
  SELECT COALESCE(jsonb_agg(m ORDER BY m->>'month'), '[]'::jsonb)
    INTO v_trend
    FROM (
      SELECT jsonb_build_object(
               'month',         to_char(months.m, 'YYYY-MM'),
               'income_minor',  COALESCE(agg.income, 0),
               'expense_minor', COALESCE(agg.expense, 0)
             ) AS m
        FROM generate_series(
               date_trunc('month', v_today) - INTERVAL '5 months',
               date_trunc('month', v_today),
               INTERVAL '1 month'
             ) AS months(m)
        LEFT JOIN LATERAL (
          SELECT
            SUM(CASE WHEN la.class = 'INCOME'  THEN p.credit_minor - p.debit_minor END) AS income,
            SUM(CASE WHEN la.class = 'EXPENSE' THEN p.debit_minor - p.credit_minor END) AS expense
            FROM public.journal_postings p
            JOIN public.ledger_accounts la ON la.id = p.ledger_account_id
            JOIN public.journal_entries je ON je.id = p.journal_entry_id
           WHERE p.workspace_id = p_workspace_id
             AND je.status = 'POSTED'
             AND je.local_date >= months.m::date
             AND je.local_date <  (months.m + INTERVAL '1 month')::date
        ) agg ON TRUE
    ) rows;

  RETURN jsonb_build_object(
    'visible',      true,
    -- §11.3: a report response carries period, timezone, currency basis and
    -- generated-at. Without them a screenshot of a report is uninterpretable.
    'period_from',  v_from,
    'period_to',    v_to,
    'timezone',     v_tz,
    'currency_basis', (SELECT w.base_currency FROM public.workspaces w
                        WHERE w.id = p_workspace_id),
    'generated_at', now(),
    'categories',   v_categories,
    'trend',        v_trend
  );
END;
$$;

REVOKE ALL ON FUNCTION public.category_report(UUID, DATE, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.category_report(UUID, DATE, DATE) TO authenticated;

COMMENT ON FUNCTION public.category_report(UUID, DATE, DATE) IS
  'Blueprint §11.3 report contract. SECURITY INVOKER so RLS applies.';
