-- NoorixFin Migration: Admin Platform (DEC-016, DEC-018)
--
-- The tables and read paths behind the operator console: global settings,
-- broadcasts, and an operational event log. Plus two reporting functions.
--
-- ┌─ THE RULE THIS MIGRATION MUST NOT BREAK ────────────────────────────────┐
-- │ SUPER_ADMIN is a PLATFORM/METADATA role. It has no access to any user's │
-- │ financial rows (DEC-002 #12, DEC-007, DEC-013). Nothing below adds a    │
-- │ super-admin SELECT policy to ledger_accounts, categories,               │
-- │ journal_entries, journal_postings, tags or journal_entry_tags — and     │
-- │ acceptance test ADMIN-06 fails if a future migration does.              │
-- └─────────────────────────────────────────────────────────────────────────┘
--
-- ┌─ GRANTS: READ THIS BEFORE ADDING A TABLE ───────────────────────────────┐
-- │ 00008 ends with                                                         │
-- │   ALTER DEFAULT PRIVILEGES IN SCHEMA public                             │
-- │     GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;    │
-- │ so every table created here is ALREADY granted to `authenticated` the   │
-- │ moment it exists. "We never granted it" is not true in this schema.     │
-- │ Each table below therefore REVOKEs explicitly and re-grants the         │
-- │ narrowest set it needs. RLS is the second layer, not the only one.      │
-- └─────────────────────────────────────────────────────────────────────────┘

-- ============================================================
-- APP SETTINGS
-- ============================================================
-- Key/value rather than a one-row table with a column per setting: adding a
-- setting is then an INSERT, not a migration, which matters because the console
-- edits these at runtime.
--
-- `is_public` is the read boundary. Public settings (maintenance banner, whether
-- signups are open, donation link) are readable by any signed-in user because
-- the app must render them. Everything else is operator-only.
CREATE TABLE IF NOT EXISTS public.app_settings (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_public   BOOLEAN NOT NULL DEFAULT FALSE,
  description TEXT NOT NULL DEFAULT '',
  updated_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone signed in can read public settings"
  ON public.app_settings FOR SELECT
  USING (is_public = TRUE);

CREATE POLICY "Super admins can read all settings"
  ON public.app_settings FOR SELECT
  USING (public.is_super_admin());

-- Writes go through NestJS with the service role, never from a user session.
REVOKE INSERT, UPDATE, DELETE ON public.app_settings FROM authenticated;

INSERT INTO public.app_settings (key, value, is_public, description) VALUES
  ('maintenance_mode',
   '{"enabled": false, "message_en": "", "message_bn": ""}'::jsonb, TRUE,
   'When enabled the app shows a maintenance banner to every user.'),
  ('signups_enabled',
   '{"enabled": true}'::jsonb, TRUE,
   'Whether new account registration is open.'),
  ('app_version',
   '{"value": "0.1.0"}'::jsonb, TRUE,
   'Version string surfaced in the UI footer and update notices.'),
  ('donation_url',
   '{"value": ""}'::jsonb, TRUE,
   'NoorixFin is free and donation-funded; this is the link the UI points at.'),
  ('support_email',
   '{"value": ""}'::jsonb, TRUE,
   'Contact address shown to users needing help.'),
  ('system_event_retention_days',
   '{"days": 30}'::jsonb, FALSE,
   'How long system_events rows are kept before prune_system_events() drops them.')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- BROADCASTS
-- ============================================================
-- Operator → user messaging: release notes, maintenance windows, notices.
-- Bilingual by construction (bn/en) because the app is, and a broadcast that
-- exists in only one language is a broadcast half the users cannot read.
CREATE TABLE IF NOT EXISTS public.broadcasts (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  severity    TEXT NOT NULL DEFAULT 'INFO'
              CHECK (severity IN ('INFO', 'SUCCESS', 'WARNING', 'CRITICAL')),
  audience    TEXT NOT NULL DEFAULT 'ALL'
              CHECK (audience IN ('ALL', 'SUPER_ADMINS')),
  status      TEXT NOT NULL DEFAULT 'DRAFT'
              CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  title_en    TEXT NOT NULL,
  title_bn    TEXT NOT NULL,
  body_en     TEXT NOT NULL DEFAULT '',
  body_bn     TEXT NOT NULL DEFAULT '',
  link_url    TEXT,
  dismissible BOOLEAN NOT NULL DEFAULT TRUE,
  publish_at  TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ,
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_broadcast_window CHECK (expires_at IS NULL OR publish_at IS NULL OR expires_at > publish_at)
);

CREATE INDEX IF NOT EXISTS idx_broadcasts_live
  ON public.broadcasts(status, publish_at DESC);

ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;

-- A user sees a broadcast only while it is live. DRAFT and ARCHIVED rows, and
-- anything outside its publish window, are invisible — not merely un-rendered.
-- The visibility rule lives in the database so a UI bug cannot leak a draft.
CREATE POLICY "Users can read live broadcasts"
  ON public.broadcasts FOR SELECT
  USING (
    status = 'PUBLISHED'
    AND (publish_at IS NULL OR publish_at <= now())
    AND (expires_at IS NULL OR expires_at > now())
    AND (audience = 'ALL' OR public.is_super_admin())
  );

CREATE POLICY "Super admins can read all broadcasts"
  ON public.broadcasts FOR SELECT
  USING (public.is_super_admin());

REVOKE INSERT, UPDATE, DELETE ON public.broadcasts FROM authenticated;

CREATE TRIGGER broadcasts_updated_at
  BEFORE UPDATE ON public.broadcasts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ─── Receipts ───────────────────────────────────────────────
-- Per-user seen/dismissed state. Written by the user's own session, so unlike
-- the tables above this one keeps its INSERT/UPDATE grant.
CREATE TABLE IF NOT EXISTS public.broadcast_receipts (
  broadcast_id UUID NOT NULL REFERENCES public.broadcasts(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seen_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  dismissed_at TIMESTAMPTZ,
  PRIMARY KEY (broadcast_id, user_id)
);

ALTER TABLE public.broadcast_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own receipts"
  ON public.broadcast_receipts FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can record their own receipt"
  ON public.broadcast_receipts FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own receipt"
  ON public.broadcast_receipts FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Aggregate delivery stats are the operator's, individual read state is not —
-- who read what is behaviour tracking the console has no need for. Counting is
-- done inside admin_platform_stats(), which returns totals only.
REVOKE DELETE ON public.broadcast_receipts FROM authenticated;

-- ============================================================
-- SYSTEM EVENTS (DEC-018)
-- ============================================================
-- The operational log behind "System Audit & Logs". Distinct from audit_events:
--
--   audit_events  — WHO did WHAT to WHICH resource. Business/security record,
--                   append-only, retained.
--   system_events — HOW the system behaved: errors, slow requests, integration
--                   failures. Operational telemetry, pruned on a retention
--                   window.
--
-- Conflating them would mean either dropping audit history on a retention sweep
-- or paying to keep every 500 forever. They stay separate.
--
-- BIGINT identity rather than UUID: the live feed pages by "id > last seen",
-- which needs a monotonic cursor. A random UUID cannot provide one.
CREATE TABLE IF NOT EXISTS public.system_events (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  level       TEXT NOT NULL CHECK (level IN ('DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL')),
  source      TEXT NOT NULL DEFAULT 'api',
  event_code  TEXT NOT NULL,
  message     TEXT NOT NULL DEFAULT '',
  request_id  TEXT,
  actor_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  route       TEXT,
  method      TEXT,
  status_code INTEGER,
  latency_ms  INTEGER,
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_events_created_at
  ON public.system_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_events_level
  ON public.system_events(level, id DESC);
CREATE INDEX IF NOT EXISTS idx_system_events_request
  ON public.system_events(request_id)
  WHERE request_id IS NOT NULL;

ALTER TABLE public.system_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can read system events"
  ON public.system_events FOR SELECT
  USING (public.is_super_admin());

-- Written exclusively by the API's service-role client. A user session must not
-- be able to forge an entry in the operator's log — a writable audit surface is
-- a compromised one. Both layers say no: no grant, and no INSERT policy.
REVOKE INSERT, UPDATE, DELETE ON public.system_events FROM authenticated;
REVOKE USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public FROM anon;

-- ─── Retention ──────────────────────────────────────────────
-- Free Tier is the design constraint (DEC-011): an unbounded operational log is
-- the fastest way to spend a 500 MB database on noise.
CREATE OR REPLACE FUNCTION public.prune_system_events(p_retain_days INT DEFAULT NULL)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_days    INT;
  v_deleted BIGINT;
BEGIN
  v_days := COALESCE(
    p_retain_days,
    (SELECT (value->>'days')::INT FROM public.app_settings WHERE key = 'system_event_retention_days'),
    30
  );

  DELETE FROM public.system_events
   WHERE created_at < now() - make_interval(days => v_days);

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.prune_system_events(INT) FROM PUBLIC;

COMMENT ON FUNCTION public.prune_system_events(INT) IS
  'DEC-018: drops system_events past the retention window. Service role only; '
  'invoked from the admin console and ready to attach to pg_cron.';

-- ============================================================
-- ADMIN REPORTING FUNCTIONS (DEC-016)
-- ============================================================
-- ┌─ WHY THESE ARE SECURITY DEFINER, AND WHY THAT IS NOT A BYPASS ──────────┐
-- │ The console needs to answer "how many accounts does this user have?" —  │
-- │ which reads ledger tables the operator is, correctly, forbidden to      │
-- │ read. The alternatives were: a super-admin RLS policy on the ledger     │
-- │ (hands over every amount, payee and note — unacceptable), or no numbers │
-- │ at all.                                                                 │
-- │                                                                         │
-- │ These functions are the third option: a fixed, auditable aperture. Both │
-- │ return ONLY bigint counts and timestamps. There is no parameter, and no │
-- │ combination of parameters, that makes either emit an amount, a payee or │
-- │ a note — the projection is closed, not filtered. The ledger RLS ban     │
-- │ stays fully in force for every other access path.                       │
-- │                                                                         │
-- │ If you extend these, the invariant to preserve is the RETURN TYPE:      │
-- │ counts and timestamps only. Adding a money column here would quietly    │
-- │ undo DEC-002 #12.                                                       │
-- └─────────────────────────────────────────────────────────────────────────┘

CREATE OR REPLACE FUNCTION public.admin_platform_stats()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  -- The gate is inside the function, not on the GRANT: EXECUTE is granted to
  -- `authenticated` so the API can call it with the caller's token, and this
  -- check is what makes that safe. is_super_admin() reads the CALLER's uid even
  -- though the body runs as owner, because auth.uid() reads the request JWT.
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'admin_platform_stats requires super admin privileges'
      USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'users', jsonb_build_object(
      'total',             (SELECT count(*) FROM public.profiles),
      'active',            (SELECT count(*) FROM public.profiles WHERE status = 'ACTIVE'),
      'suspended',         (SELECT count(*) FROM public.profiles WHERE status = 'SUSPENDED'),
      'pending_deletion',  (SELECT count(*) FROM public.profiles WHERE status = 'PENDING_DELETION'),
      'super_admins',      (SELECT count(*) FROM public.profiles WHERE is_super_admin),
      'new_24h',           (SELECT count(*) FROM public.profiles WHERE created_at > now() - INTERVAL '24 hours'),
      'new_7d',            (SELECT count(*) FROM public.profiles WHERE created_at > now() - INTERVAL '7 days'),
      'active_7d',         (SELECT count(*) FROM auth.users WHERE last_sign_in_at > now() - INTERVAL '7 days')
    ),
    'workspaces', jsonb_build_object(
      'total',  (SELECT count(*) FROM public.workspaces),
      'active', (SELECT count(*) FROM public.workspaces WHERE status = 'ACTIVE')
    ),
    -- Volume only. Never a sum of amounts.
    'ledger', jsonb_build_object(
      'accounts', (SELECT count(*) FROM public.ledger_accounts WHERE deleted_at IS NULL),
      'entries',  (SELECT count(*) FROM public.journal_entries),
      'entries_24h', (SELECT count(*) FROM public.journal_entries WHERE created_at > now() - INTERVAL '24 hours')
    ),
    'events', jsonb_build_object(
      'total',      (SELECT count(*) FROM public.system_events),
      'errors_1h',  (SELECT count(*) FROM public.system_events
                      WHERE level IN ('ERROR','FATAL') AND created_at > now() - INTERVAL '1 hour'),
      'errors_24h', (SELECT count(*) FROM public.system_events
                      WHERE level IN ('ERROR','FATAL') AND created_at > now() - INTERVAL '24 hours'),
      'warns_24h',  (SELECT count(*) FROM public.system_events
                      WHERE level = 'WARN' AND created_at > now() - INTERVAL '24 hours'),
      'oldest',     (SELECT min(created_at) FROM public.system_events)
    ),
    'broadcasts', jsonb_build_object(
      'published', (SELECT count(*) FROM public.broadcasts WHERE status = 'PUBLISHED'),
      'draft',     (SELECT count(*) FROM public.broadcasts WHERE status = 'DRAFT')
    ),
    'audit', jsonb_build_object(
      'total',    (SELECT count(*) FROM public.audit_events),
      'last_24h', (SELECT count(*) FROM public.audit_events WHERE created_at > now() - INTERVAL '24 hours')
    ),
    'generated_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_platform_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_platform_stats() TO authenticated;

COMMENT ON FUNCTION public.admin_platform_stats() IS
  'DEC-016: platform-wide counts for the operator console. Gated on '
  'is_super_admin() internally. Returns counts and timestamps only — never a '
  'monetary amount.';

-- ─── Per-user metadata ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_user_overview(
  p_search TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_limit  INT  DEFAULT 50,
  p_offset INT  DEFAULT 0
)
RETURNS TABLE (
  user_id                UUID,
  email                  TEXT,
  display_name           TEXT,
  locale                 TEXT,
  timezone               TEXT,
  base_currency          TEXT,
  status                 TEXT,
  is_super_admin         BOOLEAN,
  onboarding_status      TEXT,
  created_at             TIMESTAMPTZ,
  last_sign_in_at        TIMESTAMPTZ,
  email_confirmed_at     TIMESTAMPTZ,
  banned_until           TIMESTAMPTZ,
  suspended_at           TIMESTAMPTZ,
  suspended_reason       TEXT,
  deletion_scheduled_for TIMESTAMPTZ,
  provider_count         BIGINT,
  workspace_count        BIGINT,
  account_count          BIGINT,
  entry_count            BIGINT,
  last_entry_at          TIMESTAMPTZ,
  total_count            BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'admin_user_overview requires super admin privileges'
      USING ERRCODE = '42501';
  END IF;

  -- Every selected expression is a count, a timestamp, or profile metadata the
  -- user themselves chose. Deliberately absent: debit_minor, credit_minor,
  -- payee, note, memo — the whole of a user's actual finances.
  RETURN QUERY
  WITH filtered AS (
    SELECT p.id
      FROM public.profiles p
      JOIN auth.users u ON u.id = p.id
     WHERE (p_status IS NULL OR p.status = p_status)
       AND (
         p_search IS NULL OR p_search = ''
         OR u.email ILIKE '%' || p_search || '%'
         OR p.display_name ILIKE '%' || p_search || '%'
       )
  )
  SELECT
    p.id,
    u.email::TEXT,
    p.display_name,
    p.locale,
    p.timezone,
    p.base_currency::TEXT,
    p.status,
    p.is_super_admin,
    p.onboarding_status,
    p.created_at,
    u.last_sign_in_at,
    u.email_confirmed_at,
    u.banned_until,
    p.suspended_at,
    p.suspended_reason,
    p.deletion_scheduled_for,
    (SELECT count(*) FROM auth.identities i WHERE i.user_id = p.id),
    (SELECT count(*) FROM public.workspaces w WHERE w.created_by = p.id),
    (SELECT count(*) FROM public.ledger_accounts la
       JOIN public.workspaces w2 ON w2.id = la.workspace_id
      WHERE w2.created_by = p.id
        AND la.deleted_at IS NULL
        AND la.subtype NOT IN ('CATEGORY', 'SYSTEM')),
    (SELECT count(*) FROM public.journal_entries je
       JOIN public.workspaces w3 ON w3.id = je.workspace_id
      WHERE w3.created_by = p.id),
    (SELECT max(je2.created_at) FROM public.journal_entries je2
       JOIN public.workspaces w4 ON w4.id = je2.workspace_id
      WHERE w4.created_by = p.id),
    (SELECT count(*) FROM filtered)
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
   WHERE p.id IN (SELECT f.id FROM filtered f)
   ORDER BY p.created_at DESC
   LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 200))
  OFFSET GREATEST(0, COALESCE(p_offset, 0));
END;
$$;

REVOKE ALL ON FUNCTION public.admin_user_overview(TEXT, TEXT, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_user_overview(TEXT, TEXT, INT, INT) TO authenticated;

COMMENT ON FUNCTION public.admin_user_overview(TEXT, TEXT, INT, INT) IS
  'DEC-016: per-user platform metadata for the operator console. Gated on '
  'is_super_admin(). The return type is the security boundary — counts, '
  'timestamps and self-chosen profile fields only. Do not add a money column.';
