-- NoorixFin Migration: Scheduler and alerting
--
-- Closes two items the 2026-08-04 audit left open:
--
--   #8  "No scheduler for purge_expired_deletions() / prune_system_events() —
--        operator-triggered only." Both functions have been complete and
--        correct since 00012/00013 and have never run unless a human clicked
--        a button. A retention policy nobody executes is not a retention
--        policy, and under DEC-017 the 30-day deletion grace is a PROMISE:
--        data is supposed to be gone after it, and until now it never was.
--
--   #19 "Alerting on system_events — the data is collected but nobody is told."
--        The console shows an error count; it shows it to whoever happens to
--        open the console. This adds the threshold check that turns "we record
--        incidents" into "we notice them".

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ============================================================
-- 1. ALERT STATE
-- ============================================================
-- One row per alert kind, holding when it last fired.
--
-- ┌─ WHY A TABLE RATHER THAN JUST FIRING EVERY TIME ─────────────────────────┐
-- │ An alert that repeats every five minutes for the duration of an incident │
-- │ is an alert people mute, and a muted alert is worse than none because it │
-- │ is still believed to be working. `last_fired_at` implements a cooldown,  │
-- │ so one incident produces one notification and a RESOLVED note.           │
-- └──────────────────────────────────────────────────────────────────────────┘
CREATE TABLE public.alert_state (
  alert_key      TEXT PRIMARY KEY,
  is_firing      BOOLEAN NOT NULL DEFAULT FALSE,
  last_fired_at  TIMESTAMPTZ,
  last_resolved_at TIMESTAMPTZ,
  last_value     NUMERIC,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.alert_state ENABLE ROW LEVEL SECURITY;
-- No policy at all: this is operator infrastructure, read through the admin
-- API with the service role, and `authenticated` has no business here. RLS
-- enabled with no policy denies everyone, which is the intent (00009's lesson
-- inverted — there it was an accident, here it is the design).
GRANT SELECT, INSERT, UPDATE ON public.alert_state TO service_role;

COMMENT ON TABLE public.alert_state IS
  'Cooldown state for system_events alerting. Deliberately has RLS enabled and NO policy: '
  'operator-only, reachable through the service role.';

-- ============================================================
-- 2. THE ALERT CHECK
-- ============================================================
INSERT INTO public.app_settings (key, value, is_public, description) VALUES
  ('alert_errors_per_hour',
   '{"threshold": 25}'::jsonb,
   FALSE,
   'ERROR-level system_events in the last hour that trigger an operator alert. 0 disables.')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.check_error_rate_alert()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_threshold  INT;
  v_errors     INT;
  v_state      RECORD;
  v_action     TEXT := 'none';
BEGIN
  -- SECURITY DEFINER here is correct and is NOT the pattern banned elsewhere:
  -- it reads system_events (operational telemetry) and app_settings, never a
  -- ledger table. The aggregations in 00011/00016 must stay INVOKER because
  -- they read a user's money; this one cannot see any.

  SELECT COALESCE((value->>'threshold')::int, 0) INTO v_threshold
    FROM public.app_settings WHERE key = 'alert_errors_per_hour';

  IF v_threshold IS NULL OR v_threshold <= 0 THEN
    RETURN jsonb_build_object('checked', false, 'reason', 'disabled');
  END IF;

  SELECT count(*) INTO v_errors
    FROM public.system_events
   WHERE level = 'ERROR'
     AND created_at >= now() - INTERVAL '1 hour';

  INSERT INTO public.alert_state (alert_key) VALUES ('errors_per_hour')
    ON CONFLICT (alert_key) DO NOTHING;

  SELECT * INTO v_state FROM public.alert_state WHERE alert_key = 'errors_per_hour';

  IF v_errors >= v_threshold AND NOT v_state.is_firing THEN
    -- Crossing INTO the bad state. Recorded as a system_event of its own so
    -- the alert appears in the same feed as the errors that caused it — an
    -- operator reading the timeline should not have to consult a second place
    -- to learn that someone was told.
    UPDATE public.alert_state
       SET is_firing = TRUE, last_fired_at = now(), last_value = v_errors, updated_at = now()
     WHERE alert_key = 'errors_per_hour';

    INSERT INTO public.system_events (level, source, event_code, message, metadata)
    VALUES ('ERROR', 'alerting', 'ALERT_FIRING',
            format('Error rate alert: %s errors in the last hour (threshold %s)',
                   v_errors, v_threshold),
            jsonb_build_object('errors_1h', v_errors, 'threshold', v_threshold));
    v_action := 'fired';

  ELSIF v_errors < v_threshold AND v_state.is_firing THEN
    -- Crossing OUT. Emitting the resolution matters as much as the alert: an
    -- operator who sees only the firing event cannot tell an ongoing incident
    -- from one that ended an hour ago.
    UPDATE public.alert_state
       SET is_firing = FALSE, last_resolved_at = now(), last_value = v_errors, updated_at = now()
     WHERE alert_key = 'errors_per_hour';

    INSERT INTO public.system_events (level, source, event_code, message, metadata)
    VALUES ('INFO', 'alerting', 'ALERT_RESOLVED',
            format('Error rate back to normal: %s errors in the last hour', v_errors),
            jsonb_build_object('errors_1h', v_errors, 'threshold', v_threshold));
    v_action := 'resolved';

  ELSE
    UPDATE public.alert_state
       SET last_value = v_errors, updated_at = now()
     WHERE alert_key = 'errors_per_hour';
  END IF;

  RETURN jsonb_build_object(
    'checked', true, 'errors_1h', v_errors, 'threshold', v_threshold,
    'is_firing', v_errors >= v_threshold, 'action', v_action
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_error_rate_alert() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_error_rate_alert() TO service_role;

COMMENT ON FUNCTION public.check_error_rate_alert() IS
  'Audit #19. Fires once on crossing the threshold and once on recovery — an alert that '
  'repeats for the length of an incident is an alert people mute.';

-- ============================================================
-- 3. SCHEDULES
-- ============================================================
-- Times are UTC (pg_cron always is). Chosen so the two heavy jobs do not
-- overlap each other or the daily traffic peak in Asia/Dhaka (UTC+6).
--
-- Unscheduled first so re-running this migration, or changing a schedule
-- later, cannot leave a duplicate job silently running the old cadence.
DO $$
DECLARE
  j TEXT;
BEGIN
  FOREACH j IN ARRAY ARRAY['noorixfin-purge-deletions',
                           'noorixfin-prune-events',
                           'noorixfin-error-alert'] LOOP
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = j) THEN
      PERFORM cron.unschedule(j);
    END IF;
  END LOOP;
END;
$$;

-- 03:20 UTC = 09:20 Dhaka. Daily: the grace period is measured in days, so
-- checking more often buys nothing, and this is the only job that destroys
-- data — it should run at a predictable time an operator can watch.
--
-- `p_limit => 50` keeps one run bounded. A purge that tried to remove every
-- expired account in one transaction would hold locks across the whole ledger;
-- a backlog simply clears over several days, which is fine for a 30-day grace.
SELECT cron.schedule(
  'noorixfin-purge-deletions',
  '20 3 * * *',
  $$SELECT public.purge_expired_deletions(50);$$
);

-- 03:50 UTC, after the purge. Retention comes from app_settings, so the
-- operator changes it in the console rather than by editing a schedule.
SELECT cron.schedule(
  'noorixfin-prune-events',
  '50 3 * * *',
  $$SELECT public.prune_system_events();$$
);

-- Every five minutes. Frequent enough that an incident is noticed while it is
-- still happening; the cooldown in alert_state is what stops that frequency
-- becoming noise.
SELECT cron.schedule(
  'noorixfin-error-alert',
  '*/5 * * * *',
  $$SELECT public.check_error_rate_alert();$$
);

-- ============================================================
-- 4. OPERATOR VISIBILITY
-- ============================================================
-- A scheduler nobody can inspect is a scheduler nobody trusts. This exposes
-- the job list and each job's last outcome to the admin console — including
-- FAILURES, which is the case that matters: a purge that has been erroring for
-- a week looks exactly like a purge with nothing to do unless someone can see
-- the run log.
CREATE OR REPLACE FUNCTION public.admin_scheduled_jobs()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp, cron
AS $$
DECLARE
  v_jobs JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(j ORDER BY j->>'jobname'), '[]'::jsonb)
    INTO v_jobs
    FROM (
      SELECT jsonb_build_object(
               'jobname',  job.jobname,
               'schedule', job.schedule,
               'active',   job.active,
               'last_run_started_at', last.start_time,
               'last_status',         last.status,
               -- Truncated: a failure message can be a full Postgres error
               -- with a stack, and this feeds a console table.
               'last_message',        left(COALESCE(last.return_message, ''), 500)
             ) AS j
        FROM cron.job job
        LEFT JOIN LATERAL (
          SELECT d.start_time, d.status, d.return_message
            FROM cron.job_run_details d
           WHERE d.jobid = job.jobid
           ORDER BY d.start_time DESC
           LIMIT 1
        ) last ON TRUE
       WHERE job.jobname LIKE 'noorixfin-%'
    ) rows;

  RETURN jsonb_build_object('jobs', v_jobs, 'generated_at', now());
END;
$$;

REVOKE ALL ON FUNCTION public.admin_scheduled_jobs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_scheduled_jobs() TO service_role;

COMMENT ON FUNCTION public.admin_scheduled_jobs() IS
  'Audit #8. SECURITY DEFINER because cron.job is owned by postgres — it exposes job '
  'metadata only, never a workspace row.';

-- ============================================================
-- 5. REQUEST TRACING WINDOW (audit item 15)
-- ============================================================
-- Off by default and expressed as a DEADLINE rather than a boolean.
--
-- A boolean flag has to be turned off by a human who remembers, and one that
-- nobody remembers becomes a permanent behavioural log of every user's activity
-- — which DEC-002 #12 and DEC-016 do not permit an operator to keep. A timestamp
-- expires whether or not anyone comes back to it. `TracingService` clamps how
-- far ahead the deadline can be set, so "trace for a year" is not reachable
-- through the API either.
INSERT INTO public.app_settings (key, value, is_public, description) VALUES
  ('request_tracing',
   '{"until": null}'::jsonb,
   FALSE,
   'Deadline until which EVERY request is recorded to system_events. Null = off. '
   'Deliberately a deadline, not a flag: a trace that must be switched off by hand stays on.')
ON CONFLICT (key) DO NOTHING;
