-- NoorixFin Migration: Account Lifecycle (DEC-017)
--
-- Adds the account states an enterprise system needs — suspension and a
-- 30-day-grace deletion — and closes a privilege-escalation hole found while
-- building on top of `profiles.is_super_admin`.
--
-- Contents:
--   1. Privilege escalation fix: column-level UPDATE grants on profiles
--   2. Lifecycle columns on profiles
--   3. Foreign-key repair so a user (and their workspace) can actually be deleted
--   4. purge_expired_deletions() — the ordered, deliberate hard-delete path

-- ============================================================
-- 1. PRIVILEGE ESCALATION FIX
-- ============================================================
-- Before this migration:
--   * 00008 granted `UPDATE ON public.profiles TO authenticated` — every column.
--   * 00001's policy "Users can update own profile" allows UPDATE of one's own
--     row with no column restriction.
--
-- Composed, those two mean ANY authenticated user could run
--     update profiles set is_super_admin = true where id = auth.uid()
-- and promote themselves to platform operator. RLS restricts *rows*, never
-- *columns* — the row being their own was the only check, and it passed.
--
-- Nothing in the app did this, so it was latent. It stops being latent the
-- moment `is_super_admin` gates an admin console, which is what 00013 builds.
--
-- Fix: PostgreSQL *does* support column-level privileges. Grant UPDATE only on
-- the columns a user legitimately edits about themselves. Every lifecycle and
-- privilege column below is writable exclusively by the service role, i.e. only
-- through a NestJS endpoint that has already run SuperAdminGuard.
REVOKE UPDATE ON public.profiles FROM authenticated;

GRANT UPDATE (
  -- `id` is here only because ProfilesService.getOrCreateProfile() upserts with
  -- onConflict:'id', and PostgREST's generated ON CONFLICT DO UPDATE assigns
  -- every column in the payload — including the conflict target. It is not a
  -- hole: the RLS policy's USING *and* WITH CHECK both pin id = auth.uid(), so
  -- the only value a caller can write is the one already there.
  id,
  display_name,
  avatar_path,
  locale,
  timezone,
  base_currency,
  week_starts_on,
  amount_privacy_default,
  onboarding_status,
  updated_at            -- ProfilesService.updatePreferences() sets this explicitly
) ON public.profiles TO authenticated;

-- The same hole exists on INSERT: "Users can insert own profile" checks only
-- `id = auth.uid()`, so a self-insert could carry is_super_admin = TRUE. The row
-- normally already exists (handle_new_user creates it on signup) which makes
-- this hard to reach, but "hard to reach" is not "closed".
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (
    id = auth.uid()
    AND is_super_admin = FALSE
  );

-- ============================================================
-- 2. LIFECYCLE COLUMNS
-- ============================================================
-- ACTIVE            — normal.
-- SUSPENDED         — operator action. Data retained, sign-in blocked.
-- PENDING_DELETION  — user asked to be deleted. Data retained until the grace
--                     period expires, then purge_expired_deletions() removes it.
--
-- The status column is advisory *within the app*. The binding enforcement is
-- Supabase Auth's own `banned_until` plus a global sign-out, both applied by the
-- API through the Admin API. That way a suspended user is locked out by the auth
-- server itself and no per-request database check is needed (DEC-011).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspended_reason TEXT,
  ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deletion_scheduled_for TIMESTAMPTZ;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_status_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_status_check
  CHECK (status IN ('ACTIVE', 'SUSPENDED', 'PENDING_DELETION'));

-- A PENDING_DELETION row must always carry its deadline: the purge selects on
-- deletion_scheduled_for, so a NULL there would mean "pending forever", which is
-- the failure mode where a user asks to be forgotten and silently is not.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS chk_profiles_deletion_deadline;
ALTER TABLE public.profiles ADD CONSTRAINT chk_profiles_deletion_deadline
  CHECK (status <> 'PENDING_DELETION' OR deletion_scheduled_for IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_profiles_pending_deletion
  ON public.profiles(deletion_scheduled_for)
  WHERE status = 'PENDING_DELETION';

COMMENT ON COLUMN public.profiles.status IS
  'DEC-017 account lifecycle. Writable only by the service role — see the '
  'column-level UPDATE grant above.';

-- ============================================================
-- 3. FOREIGN-KEY REPAIR
-- ============================================================
-- Deleting a user, or their workspace, was impossible: `audit_events` references
-- both with no ON DELETE action, so either delete aborted with a 23503.
--
-- Audit rows must OUTLIVE the subject — an audit trail that vanishes with the
-- account it documents is not an audit trail. Hence SET NULL, not CASCADE: the
-- action, timestamp and metadata survive; only the pointer is dropped.
ALTER TABLE public.audit_events DROP CONSTRAINT IF EXISTS audit_events_actor_id_fkey;
ALTER TABLE public.audit_events
  ADD CONSTRAINT audit_events_actor_id_fkey
  FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.audit_events DROP CONSTRAINT IF EXISTS audit_events_workspace_id_fkey;
ALTER TABLE public.audit_events
  ADD CONSTRAINT audit_events_workspace_id_fkey
  FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE SET NULL;

-- DELIBERATELY NOT CHANGED — read before "fixing" these:
--
--   workspaces.created_by, ledger_accounts.created_by, journal_entries.created_by
--   and idempotency_records.actor_user_id all reference auth.users with NO
--   ACTION (= RESTRICT), and ledger_accounts.workspace_id / journal_postings.
--   workspace_id reference workspaces with ON DELETE RESTRICT.
--
-- Making those CASCADE would let a single `auth.admin.deleteUser()` — or a
-- mis-click in the Supabase dashboard — silently erase an entire ledger. Leaving
-- them RESTRICT means such a call fails loudly with a foreign-key violation, and
-- the ONLY way a ledger is destroyed is purge_expired_deletions() below, which
-- deletes in explicit dependency order after a 30-day grace period.
--
-- Loud failure is the feature here. Do not relax these.

-- Global-audit index: 00002 indexed (workspace_id, created_at DESC), which does
-- not serve the operator console's cross-workspace, time-ordered read.
CREATE INDEX IF NOT EXISTS idx_audit_events_created_at
  ON public.audit_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_events_actor
  ON public.audit_events(actor_id, created_at DESC);

-- ============================================================
-- 4. PURGE
-- ============================================================
-- The one deliberate hard-delete path. SECURITY DEFINER because it must reach
-- past RLS — no single caller can see every tenant's rows, which is precisely
-- the guarantee the rest of the system is built on.
--
-- Returns the purged user ids so the caller can finish the job with
-- `auth.admin.deleteUser()`. This function deliberately does NOT touch
-- auth.users: that schema is Supabase-internal (DEC-013) and its deletion has
-- side effects — identities, sessions, refresh tokens — that only the Auth
-- server handles correctly.
CREATE OR REPLACE FUNCTION public.purge_expired_deletions(p_limit INT DEFAULT 50)
RETURNS TABLE (user_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_users UUID[];
  v_workspaces UUID[];
BEGIN
  SELECT COALESCE(array_agg(p.id), '{}')
    INTO v_users
    FROM (
      SELECT pr.id
        FROM public.profiles pr
       WHERE pr.status = 'PENDING_DELETION'
         AND pr.deletion_scheduled_for IS NOT NULL
         AND pr.deletion_scheduled_for <= now()
       ORDER BY pr.deletion_scheduled_for
       LIMIT p_limit
    ) p;

  IF array_length(v_users, 1) IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(array_agg(w.id), '{}')
    INTO v_workspaces
    FROM public.workspaces w
   WHERE w.created_by = ANY(v_users);

  -- Dependency order matters — every step below is blocked by a RESTRICT
  -- constraint if the previous one has not run.
  DELETE FROM public.journal_entry_tags WHERE workspace_id = ANY(v_workspaces);
  DELETE FROM public.journal_postings   WHERE workspace_id = ANY(v_workspaces);
  DELETE FROM public.journal_entries    WHERE workspace_id = ANY(v_workspaces);
  DELETE FROM public.tags               WHERE workspace_id = ANY(v_workspaces);
  DELETE FROM public.categories         WHERE workspace_id = ANY(v_workspaces);
  DELETE FROM public.ledger_accounts    WHERE workspace_id = ANY(v_workspaces);
  DELETE FROM public.workspace_members  WHERE workspace_id = ANY(v_workspaces);
  DELETE FROM public.workspaces         WHERE id = ANY(v_workspaces);
  DELETE FROM public.idempotency_records WHERE actor_user_id = ANY(v_users);
  DELETE FROM public.profiles           WHERE id = ANY(v_users);

  -- The trail of the deletion itself outlives the account (actor_id nulls out
  -- when auth.users goes, metadata does not).
  INSERT INTO public.audit_events (actor_id, action, resource_type, resource_id, metadata)
  SELECT u, 'ACCOUNT_PURGED', 'profile', u,
         jsonb_build_object('via', 'purge_expired_deletions', 'grace_expired', TRUE)
    FROM unnest(v_users) AS u;

  RETURN QUERY SELECT unnest(v_users);
END;
$$;

REVOKE ALL ON FUNCTION public.purge_expired_deletions(INT) FROM PUBLIC;
-- Not granted to `authenticated`: the API calls it with the service role only,
-- from an endpoint already behind SuperAdminGuard. There is no path from a user
-- session to this function.

COMMENT ON FUNCTION public.purge_expired_deletions(INT) IS
  'DEC-017: hard-deletes users whose 30-day deletion grace has expired, in FK '
  'dependency order. Returns purged ids; caller must then remove the auth.users '
  'row via the Supabase Admin API. No scheduler exists in this stack yet — it is '
  'invoked from the admin console, and is ready to attach to pg_cron.';
