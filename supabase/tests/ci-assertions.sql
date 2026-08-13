-- NoorixFin — machine-checkable invariants.
--
-- ── WHY THIS EXISTS ALONGSIDE acceptance.sql ─────────────────────────────────
-- `acceptance.sql` PRINTS counts for a human to read. That is genuinely useful
-- during a session — you can see the numbers and reason about them — but it
-- cannot gate anything: it exits 0 whatever the counts say. Putting it in CI
-- unchanged would be theatre, a green tick that proves only that psql ran.
--
-- Every check below RAISES on violation, so `psql -v ON_ERROR_STOP=1` exits
-- non-zero and the pipeline fails. The two files are complementary: that one is
-- for reading, this one is for gating.
--
-- Scope is deliberately the invariants that must NEVER regress — tenant
-- isolation, ledger balance, idempotency, and the derived-not-stored rules the
-- planning layer depends on. Feature behaviour is covered by the API and E2E
-- suites; this is the floor beneath them.
--
-- Expects `_seed.sql` to have been applied first.

\set ON_ERROR_STOP on

DO $$
DECLARE
  v_count  BIGINT;
  v_failed INT := 0;

  PROCEDURE_NOTE TEXT;
BEGIN
  RAISE NOTICE '── Tenant isolation (SEC-01, SEC-02) ──';

  -- Alice is a SUPER_ADMIN. DEC-016 confines operators to metadata: the
  -- console must never become a way to read someone's finances, and RLS is
  -- the layer that has to hold even if an API guard is removed by mistake.
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);

  SELECT count(*) INTO v_count FROM journal_entries;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'SEC-02 FAILED: super admin sees % journal entries of another user', v_count;
  END IF;

  SELECT count(*) INTO v_count FROM journal_postings;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'SEC-02 FAILED: super admin sees % postings of another user', v_count;
  END IF;

  SELECT count(*) INTO v_count FROM ledger_accounts;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'SEC-02 FAILED: super admin sees % ledger accounts of another user', v_count;
  END IF;

  -- NOT asserted here: that Alice cannot see Bob's WORKSPACE ROW. She can, and
  -- should — `Super admins can view all workspaces` is the deliberate aperture
  -- DEC-016 describes, and the operator console's user list depends on it. The
  -- boundary is between METADATA (a workspace's name, currency, status) and
  -- FINANCES (entries, postings, accounts, budgets, goals), and it is the
  -- second set that the checks above and below pin down.
  --
  -- The complement is worth stating positively, because "operator sees
  -- nothing" and "operator sees only metadata" are different designs and only
  -- one of them is this one:
  SELECT count(*) INTO v_count FROM workspaces WHERE id = '22222222-2222-2222-2222-222222222222';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'DEC-016 FAILED: the operator console cannot see workspace METADATA (expected 1 row, got %)', v_count;
  END IF;

  -- The planning tables added in 00015 hold financial data too, and a new
  -- table with RLS but no correct policy is exactly the 00009 outage.
  SELECT count(*) INTO v_count FROM budgets;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'SEC-01 FAILED: Alice sees % budgets belonging to Bob', v_count;
  END IF;

  SELECT count(*) INTO v_count FROM savings_goals;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'SEC-01 FAILED: Alice sees % savings goals belonging to Bob', v_count;
  END IF;

  SELECT count(*) INTO v_count FROM calendar_events;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'SEC-01 FAILED: Alice sees % calendar events belonging to Bob', v_count;
  END IF;

  RAISE NOTICE '   isolation holds';

  -- Positive control. Without this the checks above would pass on an empty
  -- database, which is the classic way an isolation suite proves nothing.
  PERFORM set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true);
  SELECT count(*) INTO v_count FROM journal_entries;
  IF v_count = 0 THEN
    RAISE EXCEPTION 'POSITIVE CONTROL FAILED: Bob cannot see his OWN entries — the isolation checks above are vacuous';
  END IF;
  RAISE NOTICE '   positive control holds (Bob sees % of his own entries)', v_count;

  RESET ROLE;
END;
$$;

-- ── Ledger invariants (FIN-01) ───────────────────────────────────────────────
-- Asserted by attempting the write and requiring it to FAIL. A constraint that
-- exists but is not enforced looks identical to one that is, until data is
-- already wrong.
DO $$
BEGIN
  RAISE NOTICE '── Ledger constraints (FIN-01) ──';

  BEGIN
    INSERT INTO journal_postings
      (journal_entry_id, workspace_id, ledger_account_id, debit_minor, credit_minor, currency_code, base_amount_minor)
    VALUES ('55555555-5555-5555-5555-555555555555','22222222-2222-2222-2222-222222222222',
            '33333333-3333-3333-3333-333333333333', 100, 100, 'SAR', 100);
    RAISE EXCEPTION 'FIN-01 FAILED: a posting with BOTH debit and credit positive was accepted';
  EXCEPTION
    WHEN check_violation THEN NULL;  -- expected
  END;

  BEGIN
    INSERT INTO journal_postings
      (journal_entry_id, workspace_id, ledger_account_id, debit_minor, credit_minor, currency_code, base_amount_minor)
    VALUES ('55555555-5555-5555-5555-555555555555','22222222-2222-2222-2222-222222222222',
            '33333333-3333-3333-3333-333333333333', 0, 0, 'SAR', 0);
    RAISE EXCEPTION 'FIN-01 FAILED: a zero-only posting was accepted';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO journal_postings
      (journal_entry_id, workspace_id, ledger_account_id, debit_minor, credit_minor, currency_code, base_amount_minor)
    VALUES ('55555555-5555-5555-5555-555555555555','22222222-2222-2222-2222-222222222222',
            '33333333-3333-3333-3333-333333333333', -100, 0, 'SAR', -100);
    RAISE EXCEPTION 'FIN-01 FAILED: a negative posting was accepted';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  RAISE NOTICE '   posting constraints enforced';
END;
$$;

-- ── Idempotency (§8.3) ───────────────────────────────────────────────────────
-- The only block here that WRITES a row which survives. Every other check
-- either reads, or asserts by attempting a write that must be rejected.
--
-- It therefore cleans up after itself, at both ends. That is not tidiness: this
-- file is a gate on a RESTORED database (see supabase/BACKUP_RESTORE.md §4), and
-- a restore is verified by someone who may well run it twice — once before
-- re-running migrations and once after. Leaving the row behind made the second
-- run fail on its own leftovers and report a corrupt restore, which is the worst
-- possible false alarm to raise at 3am. Found by rehearsing the restore.
--
-- Deleting by the sentinel hash is safe because no real entry carries it: the
-- API always writes a SHA-256 hex digest.
DO $$
DECLARE
  v_hash TEXT := 'ci-assertion-hash';
BEGIN
  RAISE NOTICE '── Idempotency (§8.3) ──';

  -- Leftovers from an interrupted previous run.
  DELETE FROM journal_entries WHERE idempotency_key_hash = v_hash;

  INSERT INTO journal_entries
    (workspace_id, entry_type, status, created_by, client_entry_id, idempotency_key_hash)
  VALUES ('22222222-2222-2222-2222-222222222222','EXPENSE','POSTED',
          'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', gen_random_uuid(), v_hash);

  BEGIN
    INSERT INTO journal_entries
      (workspace_id, entry_type, status, created_by, client_entry_id, idempotency_key_hash)
    VALUES ('22222222-2222-2222-2222-222222222222','EXPENSE','POSTED',
            'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', gen_random_uuid(), v_hash);
    -- This is the check that would have caught the bug where the hash was
    -- computed and discarded: with the column left NULL the partial unique
    -- index matches nothing and a duplicate sails through.
    RAISE EXCEPTION 'FIN/§8.3 FAILED: the same idempotency hash was accepted twice';
  EXCEPTION
    WHEN unique_violation THEN NULL;  -- expected
  END;

  DELETE FROM journal_entries WHERE idempotency_key_hash = v_hash;

  RAISE NOTICE '   duplicate idempotency keys rejected by the index';
END;
$$;

-- ── Schema-level guarantees the product depends on ───────────────────────────
-- These assert the ABSENCE of columns. DEC-022 and §9.4 turn on progress and
-- spend being DERIVED; a well-meaning migration adding a `spent_minor` cache
-- would reintroduce the second source of truth this design exists to avoid,
-- and nothing else in the suite would notice.
DO $$
DECLARE
  v_count INT;
BEGIN
  RAISE NOTICE '── Derived-not-stored (DEC-022, §9.4) ──';

  SELECT count(*) INTO v_count FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'budget_lines'
     AND column_name IN ('spent_minor', 'carry_in_minor', 'carry_out_minor');
  IF v_count > 0 THEN
    RAISE EXCEPTION 'DEC-022 FAILED: budget_lines has a stored spend column — spend must be derived from postings';
  END IF;

  SELECT count(*) INTO v_count FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'savings_goals'
     AND column_name IN ('current_minor', 'progress_minor', 'saved_minor');
  IF v_count > 0 THEN
    RAISE EXCEPTION '§9.4 FAILED: savings_goals has a stored progress column — progress must be the linked account balance';
  END IF;

  -- OVERDUE must stay derived: a stored value needs a sweeper, and a sweeper
  -- that has not run must never be the reason a user is not told a bill is late.
  SELECT count(*) INTO v_count
    FROM information_schema.check_constraints cc
    JOIN information_schema.constraint_column_usage ccu USING (constraint_name)
   WHERE ccu.table_name = 'calendar_events'
     AND cc.check_clause LIKE '%OVERDUE%';
  IF v_count > 0 THEN
    RAISE EXCEPTION 'FAILED: calendar_events.status accepts OVERDUE — it must be computed from the due date';
  END IF;

  RAISE NOTICE '   no stored duplicates of derived figures';
END;
$$;

-- ── The aggregations refuse to leak across tenants ───────────────────────────
-- SECURITY INVOKER is the whole guarantee here. A later edit flipping one of
-- these to DEFINER would turn it into a cross-tenant read of every user's
-- money, wearing a helpful name.
DO $$
DECLARE
  v_definer TEXT;
BEGIN
  RAISE NOTICE '── Aggregations are SECURITY INVOKER ──';

  SELECT string_agg(p.proname, ', ') INTO v_definer
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname IN ('workspace_summary','budget_status','calendar_overview',
                       'goals_overview','category_report','workspace_tz',
                       'cash_flow_report','net_worth_report')
     AND p.prosecdef;   -- true = SECURITY DEFINER

  IF v_definer IS NOT NULL THEN
    RAISE EXCEPTION 'SEC FAILED: these read a user''s ledger and are SECURITY DEFINER: %', v_definer;
  END IF;

  RAISE NOTICE '   all eight are INVOKER';
END;
$$;

-- ── Scheduler is actually scheduled (audit #8) ───────────────────────────────
-- pg_cron lives in exactly ONE database per cluster — whichever
-- `cron.database_name` names — because a single background worker reads job
-- descriptions from it. That is a cluster fact, not a property of this schema,
-- and it is why the check below is conditional.
--
-- Without the condition this file could not do the job BACKUP_RESTORE.md §4
-- asks of it: a restore lands in a NEW database by design ("restore into a new
-- database first, always"), where `cron` does not and cannot exist, so an
-- otherwise perfect restore would be reported as a failure. Skipping is
-- narrow — only when this is provably not the cron database — so CI, which runs
-- against the configured one, still gates on it.
DO $$
DECLARE
  v_count INT;
  v_cron_db TEXT := current_setting('cron.database_name', true);
BEGIN
  RAISE NOTICE '── Scheduled jobs (audit #8) ──';

  IF v_cron_db IS NOT NULL AND v_cron_db <> current_database() THEN
    RAISE NOTICE '   skipped: pg_cron is configured for "%", this is "%"', v_cron_db, current_database();
    RAISE NOTICE '   (a restored database gets its schedules when migration 00017 runs after cutover)';
    RETURN;
  END IF;

  SELECT count(*) INTO v_count FROM cron.job WHERE jobname LIKE 'noorixfin-%' AND active;
  IF v_count < 3 THEN
    RAISE EXCEPTION 'AUDIT #8 FAILED: expected 3 active noorixfin cron jobs, found % — the retention promise in DEC-017 depends on them running', v_count;
  END IF;

  RAISE NOTICE '   % jobs scheduled and active', v_count;
END;
$$;

-- ── Durable notifications and payload-free invalidation (§5) ────────────────
DO $$
DECLARE
  v_count BIGINT;
  v_started TIMESTAMPTZ := clock_timestamp();
BEGIN
  RAISE NOTICE '── Notification isolation and hint aperture (§5) ──';

  INSERT INTO notifications (id, user_id, category, title_en, body_en) VALUES
    ('e0000000-0000-0000-0000-000000000011','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','security','Alice only','private body'),
    ('e0000000-0000-0000-0000-000000000012','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','system','Bob only','private body');

  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true);

  SELECT count(*) INTO v_count FROM notifications
   WHERE id IN ('e0000000-0000-0000-0000-000000000011','e0000000-0000-0000-0000-000000000012');
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'NOTIF-01 FAILED: Bob sees % of 2 cross-user notifications (expected own row only)', v_count;
  END IF;

  BEGIN
    INSERT INTO notifications (user_id, category, title_en, body_en)
    VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','security','forged','forged');
    RAISE EXCEPTION 'NOTIF-02 FAILED: authenticated user forged a notification';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  UPDATE notifications SET read_at = NOW()
   WHERE id = 'e0000000-0000-0000-0000-000000000011';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'NOTIF-03 FAILED: Bob updated Alice''s notification';
  END IF;

  SELECT count(*) INTO v_count FROM notification_hints
   WHERE created_at >= v_started AND user_id <> 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'NOTIF-HINT FAILED: Bob sees another user''s invalidation hint';
  END IF;

  EXECUTE 'RESET ROLE';

  SELECT count(*) INTO v_count FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'notification_hints'
     AND column_name IN ('title_en','body_en','action_url','metadata','notification_id');
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'NOTIF-HINT FAILED: Realtime hint table contains notification payload columns';
  END IF;

  SELECT count(*) INTO v_count
    FROM pg_publication_tables
   WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'NOTIF-HINT FAILED: notification content table is in the Realtime publication';
  END IF;

  SELECT count(*) INTO v_count
    FROM pg_publication_tables
   WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notification_hints';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'NOTIF-HINT FAILED: payload-free hint table is absent from Realtime';
  END IF;

  DELETE FROM notifications WHERE id IN
    ('e0000000-0000-0000-0000-000000000011','e0000000-0000-0000-0000-000000000012');
  DELETE FROM notification_hints WHERE created_at >= v_started;

  RAISE NOTICE '   notification RLS and payload-free Realtime aperture enforced';
END;
$$;

DO $$
DECLARE v_count INT;
BEGIN
  IF current_setting('cron.database_name', true) = current_database() THEN
    SELECT count(*) INTO v_count FROM cron.job
     WHERE jobname = 'notification-digests' AND active;
    IF v_count <> 1 THEN
      RAISE EXCEPTION 'NOTIF-DIGEST FAILED: expected one active digest schedule, found %', v_count;
    END IF;
  END IF;
END;
$$;

-- ── Phase 5 distribution configuration and one-time pairing ────────────────
DO $$
DECLARE v_count INT;
BEGIN
  SELECT count(*) INTO v_count FROM site_settings
   WHERE key LIKE 'site.mobile.%';
  IF v_count <> 13 THEN
    RAISE EXCEPTION 'DIST-01 FAILED: expected 13 declared mobile release keys, found %', v_count;
  END IF;

  SELECT count(*) INTO v_count FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'device_pairing_tokens';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'DIST-02 FAILED: pairing tokens have an authenticated RLS aperture';
  END IF;

  IF has_table_privilege('authenticated', 'public.device_pairing_tokens', 'SELECT') THEN
    RAISE EXCEPTION 'DIST-03 FAILED: authenticated clients can read pairing token hashes';
  END IF;
END;
$$;

\echo ''
\echo '✓ All CI invariants hold.'
