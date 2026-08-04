-- NoorixFin Migration: Two-Role Cleanup (W2 / DEC-007)
--
-- Migration 00003 collapsed the four-role family model to two roles but left
-- three remnants behind. This migration closes them, and fixes a recursion
-- defect in the SUPER_ADMIN policies 00003 introduced.
--
-- 1. RLS recursion in the SUPER_ADMIN policies (see §1 below)
-- 2. workspace_members.status still defaults to the deleted 'INVITED' state
-- 3. Nothing enforced "one workspace = one member" or "one personal workspace
--    per user" at the database level — both were app-code-only

-- ============================================================
-- 1. Fix infinite recursion in SUPER_ADMIN policies
-- ============================================================
-- 00003 defined "Super admins can view all profiles" ON profiles with
--   USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_super_admin))
-- The subquery reads `profiles`, so evaluating the policy re-invokes the same
-- policy: PostgreSQL raises 42P17 "infinite recursion detected in policy for
-- relation profiles". The other three policies query `profiles` from a different
-- table, but that subquery is still subject to profiles' RLS — so they inherit
-- the same recursion.
--
-- Fix: resolve the flag in a SECURITY DEFINER function, which runs as the
-- function owner and therefore bypasses RLS on the lookup. `search_path` is
-- pinned so the function cannot be hijacked by a caller-controlled path.

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT p.is_super_admin FROM public.profiles p WHERE p.id = auth.uid()),
    FALSE
  );
$$;

REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

COMMENT ON FUNCTION public.is_super_admin() IS
  'Returns TRUE if the current JWT belongs to a SUPER_ADMIN. SECURITY DEFINER to '
  'avoid RLS recursion when used inside policies on profiles (DEC-007).';

-- Recreate the four SUPER_ADMIN policies against the helper.
-- SCOPE REMINDER (DEC-002 #12, DEC-013): these cover METADATA tables only.
-- Do NOT add a SUPER_ADMIN policy to ledger_accounts, categories,
-- journal_entries, journal_postings, tags, or journal_entry_tags. A platform
-- operator must never gain ambient read access to a user's financial rows.

DROP POLICY IF EXISTS "Super admins can view all workspaces" ON workspaces;
CREATE POLICY "Super admins can view all workspaces"
  ON workspaces FOR SELECT
  USING (public.is_super_admin());

DROP POLICY IF EXISTS "Super admins can view all profiles" ON profiles;
CREATE POLICY "Super admins can view all profiles"
  ON profiles FOR SELECT
  USING (public.is_super_admin());

DROP POLICY IF EXISTS "Super admins can view all workspace members" ON workspace_members;
CREATE POLICY "Super admins can view all workspace members"
  ON workspace_members FOR SELECT
  USING (public.is_super_admin());

DROP POLICY IF EXISTS "Super admins can view all audit events" ON audit_events;
CREATE POLICY "Super admins can view all audit events"
  ON audit_events FOR SELECT
  USING (public.is_super_admin());

-- ============================================================
-- 2. Remove the 'INVITED' member status
-- ============================================================
-- The invitation system was deleted in 00003 (workspace_invitations dropped),
-- but workspace_members.status kept `DEFAULT 'INVITED'` and allowed it in the
-- CHECK. `WorkspaceMemberGuard` requires status = 'ACTIVE', so any INSERT that
-- omits status silently creates a membership that can never access its own
-- workspace. WorkspacesService sets it explicitly today, but the super-admin
-- bootstrap script (W6) also inserts memberships — this closes the trap before
-- a second write path exists.

UPDATE workspace_members SET status = 'ACTIVE' WHERE status = 'INVITED';

ALTER TABLE workspace_members ALTER COLUMN status SET DEFAULT 'ACTIVE';
ALTER TABLE workspace_members DROP CONSTRAINT IF EXISTS workspace_members_status_check;
ALTER TABLE workspace_members ADD CONSTRAINT workspace_members_status_check
  CHECK (status IN ('ACTIVE', 'SUSPENDED', 'LEFT'));

-- ============================================================
-- 3. Enforce "one workspace = exactly one member" (DEC-007)
-- ============================================================
-- DEC-007 states every workspace has exactly one member, its OWNER. Until now
-- that was only a convention. The PK is (workspace_id, user_id), which permits
-- many members per workspace; a UNIQUE on workspace_id alone forbids it.
-- This is the database-level expression of the two-role model and makes the
-- SEC-02 negative test provable rather than assumed.

CREATE UNIQUE INDEX IF NOT EXISTS uq_workspace_members_single_owner
  ON workspace_members(workspace_id);

COMMENT ON INDEX uq_workspace_members_single_owner IS
  'DEC-007: a workspace has exactly one member. Drop this index first if '
  'multi-member workspaces are ever re-introduced.';

-- ============================================================
-- 4. Enforce one active PERSONAL workspace per user
-- ============================================================
-- WorkspacesService.createWorkspace() checks for an existing personal workspace
-- and then inserts — a read-then-write with no constraint behind it, so two
-- concurrent requests can both pass the check and create two workspaces.
-- A partial unique index closes the race; the service's existing
-- PERSONAL_WORKSPACE_EXISTS conflict remains the friendly path.

CREATE UNIQUE INDEX IF NOT EXISTS uq_workspaces_one_active_personal_per_user
  ON workspaces(created_by)
  WHERE type = 'PERSONAL' AND status = 'ACTIVE';

COMMENT ON INDEX uq_workspaces_one_active_personal_per_user IS
  'DEC-007: one active personal workspace per user. Closes the TOCTOU race in '
  'WorkspacesService.createWorkspace().';
