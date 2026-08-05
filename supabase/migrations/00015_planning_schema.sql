-- NoorixFin Migration: Planning tables — Blueprint §9.4
--
-- Closes the four stub routes (/budgets, /calendar, /goals, /reports) that made
-- 5 of the 10 items in the §5.3 dashboard contract undeliverable.
--
-- ┌─ DEC-022 — SIMPLE LIMITS, NOT ENVELOPES (BLK-001 #6, decided here) ───────┐
-- │ The envelope-vs-simple question has been open since DEC-002 #6 recorded a │
-- │ preference for simple limits without settling it. Settling it as SIMPLE:  │
-- │                                                                          │
-- │ An envelope budget requires each category to hold a running balance that  │
-- │ carries between periods, which means budget state becomes a SECOND        │
-- │ source of financial truth alongside the ledger — and the two can drift.   │
-- │ This codebase has already paid for a cached-number bug once. A simple     │
-- │ limit stores only the PLANNED figure; "spent" is derived from postings    │
-- │ every time it is read, so it cannot disagree with the ledger and a        │
-- │ reversal is reflected with no reconciliation step (DEC-006).              │
-- │                                                                          │
-- │ `rollover` below is therefore a per-budget FLAG, not stored carry state:  │
-- │ when true, `budget_status()` computes carry-in from prior periods on the  │
-- │ fly. Envelopes stay reachable later without a data migration.             │
-- └──────────────────────────────────────────────────────────────────────────┘
--
-- Every table here follows the conventions the earlier migrations paid to
-- learn: workspace_id NOT NULL on tenant tables (§9.6), ON DELETE RESTRICT
-- toward the ledger so nothing cascades a financial row away (§9.6, DEC-017),
-- RLS enabled WITH write policies (the 00009 lesson: RLS without an INSERT
-- policy is a silently read-only table), and explicit GRANTs (the 00008
-- lesson: GRANT and RLS are separate systems and GRANT is checked first).

-- ============================================================
-- 0. PERSONA — the missing onboarding column (§5.2 step 4)
-- ============================================================
-- `onboarding_status` has had a 7-state CHECK constraint since 00001 and
-- nothing has ever advanced it: every user has been stuck at ACCOUNT_CREATED
-- forever, because no code reads or writes it. The state machine is now driven
-- by the onboarding flow, and PERSONA_SELECTED needs somewhere to put the
-- answer.
--
-- FAMILY is absent from the CHECK on purpose. Blueprint §5.2 lists it, but
-- DEC-007 dropped family workspaces; offering a persona the product cannot
-- honour would be the blueprint outvoting a later decision.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS persona TEXT
    CHECK (persona IN ('INDIVIDUAL', 'STUDENT', 'FREELANCER'));

COMMENT ON COLUMN public.profiles.persona IS
  'Blueprint §5.2 step 4. FAMILY deliberately omitted — DEC-007 dropped family workspaces.';

-- The column-level UPDATE grant from 00012 enumerates every user-editable
-- column, so a new one is invisible to `authenticated` until it is named here.
-- This is the intended cost of that design: adding a user-writable column is a
-- deliberate act.
GRANT UPDATE (persona) ON public.profiles TO authenticated;

-- ============================================================
-- 1. BUDGETS (§9.4)
-- ============================================================
CREATE TABLE public.budgets (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id  UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE RESTRICT,
  name          TEXT NOT NULL DEFAULT '',
  cadence       TEXT NOT NULL DEFAULT 'MONTHLY' CHECK (cadence IN ('MONTHLY', 'WEEKLY')),
  -- The first period's start. Later periods are derived from cadence rather
  -- than stored, so a budget does not need a row per month and cannot develop
  -- gaps when nobody opens the app for a while.
  period_start  DATE NOT NULL,
  -- End of the budget's life, not of a period. NULL means "runs indefinitely".
  period_end    DATE,
  rollover      BOOLEAN NOT NULL DEFAULT FALSE,
  status        TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ARCHIVED')),
  created_by    UUID NOT NULL REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_budget_period CHECK (period_end IS NULL OR period_end > period_start)
);

CREATE INDEX idx_budgets_workspace ON public.budgets(workspace_id, status);

-- One ACTIVE budget per workspace per cadence. §9.4 wants "unique line per
-- category + period"; with a single active budget owning the lines, that
-- uniqueness follows from the line constraint below instead of needing a
-- period column on every line.
CREATE UNIQUE INDEX idx_budgets_one_active
  ON public.budgets(workspace_id, cadence)
  WHERE status = 'ACTIVE';

CREATE TABLE public.budget_lines (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  budget_id           UUID NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
  -- Denormalised so RLS is one membership lookup rather than a join through
  -- budgets — the same reason 00005 put workspace_id on journal_postings.
  workspace_id        UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE RESTRICT,
  category_id         UUID NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
  planned_minor       BIGINT NOT NULL CHECK (planned_minor > 0),
  -- Percentage of the limit at which the UI warns. 0 disables the warning.
  alert_threshold_pct SMALLINT NOT NULL DEFAULT 80
    CHECK (alert_threshold_pct BETWEEN 0 AND 100),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- §9.4: "unique line per category + period unless group budget explicitly
  -- enabled". Group budgets are not built, so this is unconditional.
  UNIQUE (budget_id, category_id)
);

CREATE INDEX idx_budget_lines_workspace ON public.budget_lines(workspace_id);
CREATE INDEX idx_budget_lines_budget ON public.budget_lines(budget_id);

-- NOTE what is NOT here: `spent_minor`, `carry_in_minor`, `carry_out_minor`.
-- Those are computed by budget_status() from postings. See DEC-022.

-- ============================================================
-- 2. SAVINGS GOALS (§9.4)
-- ============================================================
CREATE TABLE public.savings_goals (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id      UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE RESTRICT,
  name              TEXT NOT NULL,
  target_minor      BIGINT NOT NULL CHECK (target_minor > 0),
  currency_code     CHAR(3) NOT NULL,
  target_date       DATE,
  -- §9.4: "contribution calculation source-driven; arbitrary editable
  -- 'progress' নয়". Progress is the linked account's BALANCE, read from the
  -- ledger. There is deliberately no `current_minor` column: a goal that can be
  -- edited to say 90% while the account holds nothing is a lie the schema
  -- should not be able to express.
  linked_account_id UUID REFERENCES public.ledger_accounts(id) ON DELETE RESTRICT,
  priority          SMALLINT NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'ACHIEVED', 'ABANDONED')),
  created_by        UUID NOT NULL REFERENCES auth.users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_savings_goals_workspace ON public.savings_goals(workspace_id, status);

-- ============================================================
-- 3. DEBT DETAILS (§9.4)
-- ============================================================
-- One row per LIABILITY ledger account. The debt's balance is the account's
-- balance — this table holds only the terms, which the ledger has no place for.
CREATE TABLE public.debt_details (
  ledger_account_id     UUID PRIMARY KEY REFERENCES public.ledger_accounts(id) ON DELETE RESTRICT,
  workspace_id          UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE RESTRICT,
  principal_minor       BIGINT NOT NULL CHECK (principal_minor >= 0),
  -- §9.4: "rate optional; calculator result স্পষ্টভাবে estimate হিসেবে label
  -- হবে". Nullable because many informal loans genuinely have no stated rate,
  -- and defaulting to 0 would render as "0% APR", which is a claim.
  annual_rate_bps       INTEGER CHECK (annual_rate_bps IS NULL OR annual_rate_bps >= 0),
  minimum_payment_minor BIGINT CHECK (minimum_payment_minor IS NULL OR minimum_payment_minor >= 0),
  due_day               SMALLINT CHECK (due_day IS NULL OR due_day BETWEEN 1 AND 31),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_debt_details_workspace ON public.debt_details(workspace_id);

COMMENT ON COLUMN public.debt_details.annual_rate_bps IS
  'Basis points (500 = 5.00%). An integer because a rate stored as a float and '
  'then compounded is the same class of error DEC-004 bans for amounts.';

-- ============================================================
-- 4. RECURRING RULES (§9.4)
-- ============================================================
CREATE TABLE public.recurring_rules (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id      UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE RESTRICT,
  name              TEXT NOT NULL,
  -- The entry this rule would create, held as data rather than as a real DRAFT
  -- journal_entry: an unfired template must not be visible to anything that
  -- sums the ledger.
  entry_type        TEXT NOT NULL CHECK (entry_type IN ('INCOME', 'EXPENSE', 'TRANSFER')),
  amount_minor      BIGINT NOT NULL CHECK (amount_minor > 0),
  currency_code     CHAR(3) NOT NULL,
  account_id        UUID REFERENCES public.ledger_accounts(id) ON DELETE RESTRICT,
  category_id       UUID REFERENCES public.categories(id) ON DELETE RESTRICT,
  payee             TEXT,
  note              TEXT,

  frequency         TEXT NOT NULL CHECK (frequency IN ('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY')),
  interval_count    SMALLINT NOT NULL DEFAULT 1 CHECK (interval_count > 0),
  -- Day of month for MONTHLY, day of week (0=Sun) for WEEKLY. NULL means "same
  -- as the anchor date".
  day_of_period     SMALLINT,
  timezone          TEXT NOT NULL DEFAULT 'Asia/Dhaka',
  next_occurrence   DATE NOT NULL,
  ends_at           DATE,

  -- §9.4: "MVP-তে unconfirmed external expense auto-post নয়". AUTO_CREATE_DRAFT
  -- is the strongest option available and it still only creates a DRAFT — no
  -- code path in this schema can post an entry the user has not confirmed.
  behavior          TEXT NOT NULL DEFAULT 'REMIND_ONLY'
    CHECK (behavior IN ('REMIND_ONLY', 'AUTO_CREATE_DRAFT')),
  status            TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PAUSED', 'ENDED')),
  created_by        UUID NOT NULL REFERENCES auth.users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- §9.6 names this index explicitly: "active recurring (workspace_id,
-- next_occurrence) WHERE status='ACTIVE'".
CREATE INDEX idx_recurring_active
  ON public.recurring_rules(workspace_id, next_occurrence)
  WHERE status = 'ACTIVE';

-- ============================================================
-- 5. CALENDAR EVENTS (§9.4)
-- ============================================================
CREATE TABLE public.calendar_events (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id       UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE RESTRICT,
  type               TEXT NOT NULL CHECK (type IN ('BILL', 'INCOME', 'GOAL', 'CUSTOM')),
  title              TEXT NOT NULL,
  amount_minor       BIGINT CHECK (amount_minor IS NULL OR amount_minor >= 0),
  currency_code      CHAR(3),
  due_at             TIMESTAMPTZ NOT NULL,
  -- Stored beside due_at, not folded into it: "the 1st of the month" is a local
  -- concept, and a bill due 1 Aug in Dhaka is 31 Jul in UTC (TIME-01).
  timezone           TEXT NOT NULL DEFAULT 'Asia/Dhaka',
  local_date         DATE NOT NULL,
  reminder_offsets   INTEGER[] NOT NULL DEFAULT '{}',

  recurring_rule_id  UUID REFERENCES public.recurring_rules(id) ON DELETE SET NULL,
  -- Set when the user records the payment. This is the link that turns "a bill
  -- was due" into "a bill was paid, here is the transaction".
  journal_entry_id   UUID REFERENCES public.journal_entries(id) ON DELETE RESTRICT,
  savings_goal_id    UUID REFERENCES public.savings_goals(id) ON DELETE CASCADE,

  -- OVERDUE is deliberately NOT a stored value that something must sweep.
  -- It is derived: status='UPCOMING' AND due_at < now(). A cron that has not
  -- run must never be the reason a user is not told a bill is late.
  status             TEXT NOT NULL DEFAULT 'UPCOMING'
    CHECK (status IN ('UPCOMING', 'PAID', 'SKIPPED')),
  created_by         UUID NOT NULL REFERENCES auth.users(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_calendar_events_workspace ON public.calendar_events(workspace_id, local_date);
CREATE INDEX idx_calendar_events_upcoming
  ON public.calendar_events(workspace_id, due_at)
  WHERE status = 'UPCOMING';

-- ============================================================
-- 6. ROW LEVEL SECURITY
-- ============================================================
-- Every policy is the same shape as the ledger's: membership in the row's
-- workspace. Under DEC-007 a workspace has exactly one ACTIVE member, so this
-- is "the row belongs to you". No role predicate — 00003/00004 collapsed the
-- role model to OWNER only, and a role check here would be dead code implying
-- a distinction that no longer exists.

ALTER TABLE public.budgets          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_lines     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.savings_goals    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debt_details     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_rules  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events  ENABLE ROW LEVEL SECURITY;

-- Emits SELECT/INSERT/UPDATE/DELETE policies for a workspace-scoped table.
-- Written as a DO block because six tables with four hand-written policies each
-- is 24 near-identical blocks, and the 00009 outage happened precisely because
-- one of a set of near-identical policies was missing and nobody spotted it.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'budgets', 'budget_lines', 'savings_goals',
    'debt_details', 'recurring_rules', 'calendar_events'
  ] LOOP
    EXECUTE format($f$
      CREATE POLICY "Members can view %1$s" ON public.%1$I FOR SELECT
        USING (EXISTS (
          SELECT 1 FROM public.workspace_members wm
           WHERE wm.workspace_id = %1$I.workspace_id
             AND wm.user_id = auth.uid() AND wm.status = 'ACTIVE'));

      CREATE POLICY "Members can create %1$s" ON public.%1$I FOR INSERT
        WITH CHECK (EXISTS (
          SELECT 1 FROM public.workspace_members wm
           WHERE wm.workspace_id = %1$I.workspace_id
             AND wm.user_id = auth.uid() AND wm.status = 'ACTIVE'));

      CREATE POLICY "Members can update %1$s" ON public.%1$I FOR UPDATE
        USING (EXISTS (
          SELECT 1 FROM public.workspace_members wm
           WHERE wm.workspace_id = %1$I.workspace_id
             AND wm.user_id = auth.uid() AND wm.status = 'ACTIVE'))
        WITH CHECK (EXISTS (
          SELECT 1 FROM public.workspace_members wm
           WHERE wm.workspace_id = %1$I.workspace_id
             AND wm.user_id = auth.uid() AND wm.status = 'ACTIVE'));

      -- DELETE is allowed here and NOT on ledger tables. A budget, a goal or a
      -- reminder is a plan; deleting one destroys no financial history. §9.6's
      -- "posted finance records hard-delete নয়" is about the ledger, and these
      -- tables reference it with ON DELETE RESTRICT so they cannot take any of
      -- it with them.
      CREATE POLICY "Members can delete %1$s" ON public.%1$I FOR DELETE
        USING (EXISTS (
          SELECT 1 FROM public.workspace_members wm
           WHERE wm.workspace_id = %1$I.workspace_id
             AND wm.user_id = auth.uid() AND wm.status = 'ACTIVE'));
    $f$, t);
  END LOOP;
END;
$$;

-- ============================================================
-- 7. GRANTS
-- ============================================================
-- 00008 ends with ALTER DEFAULT PRIVILEGES for `authenticated`, which should
-- cover these. Stated explicitly anyway: default privileges only apply to
-- tables created by the role that set them, and that is a silent dependency to
-- rest an entire feature on. The 42501 outage cost a full debugging session.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.budgets         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.budget_lines    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.savings_goals   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.debt_details    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_rules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_events TO authenticated;

-- No service_role grants. Per the 00014 rationale: service_role has BYPASSRLS,
-- so for it the GRANT is the entire boundary. The operator console has no
-- business reading a user's budgets or goals — that is financial data, and
-- DEC-016 confines the console to metadata.

-- ============================================================
-- 8. TRIGGERS
-- ============================================================
CREATE TRIGGER budgets_updated_at BEFORE UPDATE ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER budget_lines_updated_at BEFORE UPDATE ON public.budget_lines
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER savings_goals_updated_at BEFORE UPDATE ON public.savings_goals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER debt_details_updated_at BEFORE UPDATE ON public.debt_details
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER recurring_rules_updated_at BEFORE UPDATE ON public.recurring_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER calendar_events_updated_at BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
