-- Bounded, integrity-verifiable account export artifacts.
--
-- Financial rows are never assembled into one application object. The API
-- reads with the caller's RLS token in fixed pages, emits NDJSON into bounded
-- chunks, and stores only those chunks plus integrity/expiry metadata here.

CREATE TABLE public.data_export_artifacts (
  id              UUID PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'PROCESSING'
                  CHECK (status IN ('PROCESSING','READY','FAILED','EXPIRED')),
  format          TEXT NOT NULL DEFAULT 'ndjson-v1' CHECK (format = 'ndjson-v1'),
  size_bytes      BIGINT NOT NULL DEFAULT 0 CHECK (size_bytes >= 0),
  row_count       BIGINT NOT NULL DEFAULT 0 CHECK (row_count >= 0),
  checksum_sha256 TEXT CHECK (checksum_sha256 ~ '^[0-9a-f]{64}$'),
  error           TEXT,
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

CREATE INDEX idx_data_export_artifacts_owner
  ON public.data_export_artifacts (user_id, created_at DESC);
CREATE INDEX idx_data_export_artifacts_expiry
  ON public.data_export_artifacts (expires_at);

CREATE TABLE public.data_export_chunks (
  artifact_id UUID NOT NULL REFERENCES public.data_export_artifacts(id) ON DELETE CASCADE,
  sequence    INTEGER NOT NULL CHECK (sequence >= 0),
  content     TEXT NOT NULL,
  byte_length INTEGER NOT NULL CHECK (byte_length >= 0 AND byte_length <= 1048576),
  PRIMARY KEY (artifact_id, sequence)
);

ALTER TABLE public.data_export_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_export_chunks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.data_export_artifacts, public.data_export_chunks
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.data_export_artifacts, public.data_export_chunks TO service_role;

CREATE OR REPLACE FUNCTION public.purge_expired_data_exports()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE deleted_count BIGINT;
BEGIN
  DELETE FROM public.data_export_artifacts WHERE expires_at <= NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
REVOKE ALL ON FUNCTION public.purge_expired_data_exports()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_expired_data_exports() TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid)
      FROM cron.job WHERE jobname = 'noorixfin-expired-data-exports';
    PERFORM cron.schedule(
      'noorixfin-expired-data-exports',
      '17 * * * *',
      'SELECT public.purge_expired_data_exports()'
    );
  END IF;
END;
$$;
