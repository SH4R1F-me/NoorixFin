-- Multi-replica-safe notification delivery.
--
-- A delivery remains PENDING while it is leased. This keeps the public status
-- vocabulary stable while making ownership durable: another replica cannot
-- claim it until the lease expires, and a crashed worker is recovered without
-- operator intervention. next_attempt_at persists exponential backoff; rows
-- that exhaust the attempt budget become visible FAILED/dead-letter rows.

ALTER TABLE public.notification_deliveries
  ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS lease_owner UUID,
  ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dead_lettered_at TIMESTAMPTZ;

DROP INDEX IF EXISTS public.idx_deliveries_pending;
CREATE INDEX idx_deliveries_claimable
  ON public.notification_deliveries (next_attempt_at, created_at)
  WHERE status = 'PENDING' AND attempts < 5;

CREATE OR REPLACE FUNCTION public.claim_notification_deliveries(
  p_worker_id UUID,
  p_batch_size INTEGER DEFAULT 50,
  p_lease_seconds INTEGER DEFAULT 120
)
RETURNS TABLE (
  id UUID,
  notification_id UUID,
  device_id UUID,
  channel TEXT,
  attempts SMALLINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH claimable AS (
    SELECT d.id
      FROM public.notification_deliveries AS d
     WHERE d.status = 'PENDING'
       AND d.attempts < 5
       AND d.next_attempt_at <= clock_timestamp()
       AND (d.lease_expires_at IS NULL OR d.lease_expires_at <= clock_timestamp())
     ORDER BY d.next_attempt_at, d.created_at, d.id
     FOR UPDATE SKIP LOCKED
     LIMIT LEAST(GREATEST(p_batch_size, 1), 100)
  )
  UPDATE public.notification_deliveries AS d
     SET lease_owner = p_worker_id,
         lease_expires_at = clock_timestamp()
           + make_interval(secs => LEAST(GREATEST(p_lease_seconds, 30), 900)),
         last_attempt_at = clock_timestamp()
    FROM claimable
   WHERE d.id = claimable.id
  RETURNING d.id, d.notification_id, d.device_id, d.channel, d.attempts;
$$;

REVOKE ALL ON FUNCTION public.claim_notification_deliveries(UUID, INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_notification_deliveries(UUID, INTEGER, INTEGER)
  TO service_role;

COMMENT ON FUNCTION public.claim_notification_deliveries(UUID, INTEGER, INTEGER)
  IS 'Atomically leases due notification deliveries using FOR UPDATE SKIP LOCKED.';
