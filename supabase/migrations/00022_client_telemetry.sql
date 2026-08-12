-- ============================================================
-- 00022 — Client Telemetry
--
-- Closes audit gap R3: "system_events cannot distinguish a client".
-- Also closes gap S2: "no session/device management".
--
-- Three changes:
--
--   1. system_events   — 4 nullable columns (platform, app_version,
--                        device_id, session_id) so every log line knows
--                        whether it came from the web app, iOS, Android,
--                        or a raw API call. The Phase 2 performance and
--                        client-telemetry dashboards are fed entirely by
--                        these columns.
--
--   2. audit_events    — 3 nullable columns (user_agent, platform,
--                        device_id) so auth-event pages can show which
--                        device triggered a login/change.
--
--   3. user_devices    — the join between monitoring (§3), push delivery
--                        (§5), and the user-facing Sessions & Devices
--                        page (gap S2). Built once, used by all three.
--
-- All columns are nullable. A request that does not carry X-Client-Info
-- simply leaves them NULL — there is no breaking change to the existing
-- 21 migrations' data.
--
-- Access model for user_devices:
--   authenticated    — SELECT / UPDATE / DELETE own rows only
--   service_role     — ALL (registration, push-token rotation, revocation)
-- ============================================================

-- ── 1. system_events — client dimensions ─────────────────────────────────────

ALTER TABLE public.system_events
  ADD COLUMN IF NOT EXISTS platform     TEXT
    CHECK (platform IN ('web','ios','android','api')),
  ADD COLUMN IF NOT EXISTS app_version  TEXT,
  ADD COLUMN IF NOT EXISTS device_id    UUID,
  ADD COLUMN IF NOT EXISTS session_id   UUID;

-- Partial index for the admin "client devices" dashboard — active requests
-- only, so it stays small regardless of overall event volume.
CREATE INDEX IF NOT EXISTS idx_system_events_platform
  ON public.system_events (platform, created_at DESC)
  WHERE platform IS NOT NULL;

COMMENT ON COLUMN public.system_events.platform IS
  'Client platform that originated the request: web|ios|android|api. '
  'NULL for requests that did not supply X-Client-Info.';
COMMENT ON COLUMN public.system_events.app_version IS
  'Semver string from X-Client-Info. NULL for requests without that header.';
COMMENT ON COLUMN public.system_events.device_id IS
  'Opaque UUID from X-Client-Info. Matches user_devices.device_id. '
  'Not an advertising/hardware id — app-generated and rotated on reinstall.';
COMMENT ON COLUMN public.system_events.session_id IS
  'Optional browser/app session UUID for correlated trace views.';

-- ── 2. audit_events — client context ─────────────────────────────────────────

ALTER TABLE public.audit_events
  ADD COLUMN IF NOT EXISTS user_agent   TEXT,
  ADD COLUMN IF NOT EXISTS platform     TEXT
    CHECK (platform IN ('web','ios','android','api')),
  ADD COLUMN IF NOT EXISTS device_id    UUID;

COMMENT ON COLUMN public.audit_events.user_agent IS
  'Raw User-Agent string from the request that produced this audit row. '
  'Stored once here; never repeated in the API response to a user.';
COMMENT ON COLUMN public.audit_events.platform IS
  'Resolved platform from X-Client-Info (or User-Agent fallback).';
COMMENT ON COLUMN public.audit_events.device_id IS
  'Device UUID from X-Client-Info. Links to user_devices.device_id.';

-- ── 3. user_devices ──────────────────────────────────────────────────────────
--
-- One row per (user, device). A device is re-identified by its device_id; a
-- second install on the same phone updates the row rather than creating a new
-- one. `revoked_at` non-NULL means "this session is dead" — the row is kept
-- for the audit trail (who revoked, when) rather than deleted.
--
-- `push_token` and `push_provider` are Phase 5 (notification system). The
-- columns are here now because they belong to the same join point, and adding
-- them in a later migration to an already-live table would require a backfill.

CREATE TABLE IF NOT EXISTS public.user_devices (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id        UUID        NOT NULL,
  platform         TEXT        NOT NULL
    CHECK (platform IN ('web','ios','android')),
  device_name      TEXT,                   -- user-editable: "Sharif's Pixel"
  os_version       TEXT,
  app_version      TEXT,
  push_token       TEXT,                   -- Phase 5 — mobile/web push
  push_provider    TEXT
    CHECK (push_provider IN ('expo','fcm','apns','webpush')),
  last_seen_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_ip          INET,
  first_seen_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at       TIMESTAMPTZ,            -- NULL = active session

  UNIQUE (user_id, device_id)
);

ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;

-- A user manages only their own devices.
CREATE POLICY "user_devices: owner reads own"
  ON public.user_devices FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "user_devices: owner revokes own"
  ON public.user_devices FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_devices: owner deletes own"
  ON public.user_devices FOR DELETE
  USING (auth.uid() = user_id);

-- service_role writes registrations, push-token rotations, and admin revocations.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_devices TO service_role;
GRANT SELECT, UPDATE, DELETE         ON public.user_devices TO authenticated;

-- Supporting indexes.
CREATE INDEX IF NOT EXISTS idx_user_devices_user_active
  ON public.user_devices (user_id, last_seen_at DESC)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_devices_platform
  ON public.user_devices (platform, last_seen_at DESC)
  WHERE revoked_at IS NULL;

COMMENT ON TABLE public.user_devices IS
  'One row per (user_id, device_id). Tracks active sessions, push tokens, '
  'and device metadata. Operator metadata-only — no financial data here.';
