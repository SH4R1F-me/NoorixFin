-- ============================================================
-- 00018 — Make idempotency_records usable, and safe to use
-- Audit item 16: "user writes are idempotent; operator writes are not."
-- ============================================================
--
-- ── THE TABLE ALREADY EXISTED AND WAS A LIABILITY ───────────────────────────
-- Migration 00002 created `idempotency_records` for §8.3 and NOTHING has ever
-- read or written it. Wiring it up as-is would have introduced a tenant leak
-- rather than closing an audit item, because it was created with:
--
--   * RLS **disabled** — verified: pg_class.relrowsecurity = false — while
--     00008 granted `authenticated` SELECT on it. Every signed-in user could
--     therefore read every row. Empty, that is harmless; the instant it starts
--     storing response bodies it is one user reading another's API responses,
--     including an operator's. The table was safe only because it was unused.
--
--   * no UPDATE or DELETE grant, so the two-phase write this design needs
--     (reserve the key, then record the outcome) could not complete.
--
--   * no `service_role` privileges at all — the same omission migrations 00008
--     and 00014 each had to fix for other tables.
--
-- ── WHY THE USER'S CLIENT AND NOT service_role ──────────────────────────────
-- The interceptor runs these statements as the CALLER, so RLS is the boundary
-- and a bug in application code cannot widen it. That is the same reasoning as
-- the export service, and it is why `authenticated` gets full DML here while
-- the policy pins every row to its own actor.

-- ── 1. RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE public.idempotency_records ENABLE ROW LEVEL SECURITY;

-- One policy for all four verbs: a record belongs to the actor who created it,
-- and nobody else has any business seeing, replaying or releasing it. Split
-- policies would let the four drift apart, and the SELECT one is the one that
-- must never loosen.
DROP POLICY IF EXISTS "Actors manage their own idempotency records" ON public.idempotency_records;
CREATE POLICY "Actors manage their own idempotency records"
  ON public.idempotency_records
  FOR ALL
  USING (actor_user_id = auth.uid())
  WITH CHECK (actor_user_id = auth.uid());

-- ── 2. Grants ───────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.idempotency_records TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.idempotency_records TO service_role;

-- ── 3. Detecting a REUSED key ───────────────────────────────────────────────
-- The unique constraint is (actor, route, key). Without also remembering what
-- was sent, a client that reuses a key for a different payload silently gets
-- the FIRST call's response back and believes its second, different request
-- succeeded. That is a worse failure than no idempotency at all, because it is
-- invisible: the caller has a 200 and the change never happened.
--
-- A hash, not the body: request payloads here contain broadcast text and
-- settings values, and a table of stored request bodies is another copy of data
-- with its own lifetime.
ALTER TABLE public.idempotency_records
  ADD COLUMN IF NOT EXISTS request_fingerprint TEXT;

-- ── 4. Retention ────────────────────────────────────────────────────────────
-- `expires_at` has existed since 00002 with a 24-hour default and nothing has
-- ever acted on it. A retention column nobody enforces is a comment.
CREATE INDEX IF NOT EXISTS idx_idempotency_records_expires
  ON public.idempotency_records (expires_at);

CREATE OR REPLACE FUNCTION public.prune_idempotency_records()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_deleted BIGINT;
BEGIN
  DELETE FROM public.idempotency_records WHERE expires_at < NOW();
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.prune_idempotency_records() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prune_idempotency_records() TO service_role;

COMMENT ON FUNCTION public.prune_idempotency_records() IS
  'Drops idempotency records past expires_at. Scheduled by 00018; also safe to run by hand.';

-- Folded into the existing 03:50 UTC prune slot rather than given its own
-- schedule: it is a small DELETE on an indexed column, and one more entry in
-- cron.job is one more thing an operator has to recognise as healthy.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'noorixfin-prune-events') THEN
    PERFORM cron.unschedule('noorixfin-prune-events');
  END IF;
END;
$$;

SELECT cron.schedule(
  'noorixfin-prune-events',
  '50 3 * * *',
  $$SELECT public.prune_system_events(), public.prune_idempotency_records();$$
);
