-- MyFin Migration: Simplify Role System (4 → 2)
-- SUPER_ADMIN (system-level) + USER (personal finance)
-- DEC-007: Each user owns their own PERSONAL workspace as OWNER.
-- SUPER_ADMIN flag lives on profiles (system-level, not workspace-level).

-- ============================================================
-- 1. Add is_super_admin flag to profiles
-- ============================================================
ALTER TABLE profiles ADD COLUMN is_super_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- ============================================================
-- 2. Simplify workspace_members.role to OWNER only
-- ============================================================

-- Update any existing non-OWNER members to OWNER
UPDATE workspace_members SET role = 'OWNER' WHERE role != 'OWNER';

-- Drop old constraint and add new one
ALTER TABLE workspace_members DROP CONSTRAINT IF EXISTS workspace_members_role_check;
ALTER TABLE workspace_members ALTER COLUMN role SET DEFAULT 'OWNER';
ALTER TABLE workspace_members ADD CONSTRAINT workspace_members_role_check CHECK (role IN ('OWNER'));

-- ============================================================
-- 3. Force all workspaces to PERSONAL type
-- ============================================================
UPDATE workspaces SET type = 'PERSONAL' WHERE type != 'PERSONAL';
ALTER TABLE workspaces DROP CONSTRAINT IF EXISTS workspaces_type_check;
ALTER TABLE workspaces ADD CONSTRAINT workspaces_type_check CHECK (type IN ('PERSONAL'));

-- ============================================================
-- 4. Drop workspace_invitations table (no longer needed)
-- ============================================================
DROP POLICY IF EXISTS "Members can view workspace invitations" ON workspace_invitations;
DROP TABLE IF EXISTS workspace_invitations;

-- ============================================================
-- 5. Simplify RLS policies on workspaces
-- ============================================================

-- Drop old owner-only update policy and replace with simpler one
DROP POLICY IF EXISTS "Owners can update workspace" ON workspaces;
CREATE POLICY "Members can update own workspace"
  ON workspaces FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspaces.id
        AND wm.user_id = auth.uid()
        AND wm.status = 'ACTIVE'
    )
  );

-- Drop old complex invitation/member policies on workspace_members
DROP POLICY IF EXISTS "Owners and admins can invite members" ON workspace_members;
DROP POLICY IF EXISTS "Owners and admins can update members" ON workspace_members;

-- Simplified: users can only insert themselves as OWNER
CREATE POLICY "Users can add self as owner"
  ON workspace_members FOR INSERT
  WITH CHECK (
    workspace_members.user_id = auth.uid()
    AND workspace_members.role = 'OWNER'
  );

-- ============================================================
-- 6. Simplify RLS on ledger_accounts (remove role checks)
-- ============================================================

DROP POLICY IF EXISTS "Editors+ can create accounts" ON ledger_accounts;
CREATE POLICY "Active members can create accounts"
  ON ledger_accounts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = ledger_accounts.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'ACTIVE'
    )
  );

DROP POLICY IF EXISTS "Editors+ can update accounts" ON ledger_accounts;
CREATE POLICY "Active members can update accounts"
  ON ledger_accounts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = ledger_accounts.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'ACTIVE'
    )
  );

-- ============================================================
-- 7. Simplify RLS on journal_entries (remove role checks)
-- ============================================================

DROP POLICY IF EXISTS "Editors+ can create entries" ON journal_entries;
CREATE POLICY "Active members can create entries"
  ON journal_entries FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = journal_entries.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'ACTIVE'
    )
  );

DROP POLICY IF EXISTS "Editors+ can update entries" ON journal_entries;
CREATE POLICY "Active members can update entries"
  ON journal_entries FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = journal_entries.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'ACTIVE'
    )
  );

-- ============================================================
-- 8. Simplify audit_events RLS — allow workspace members (all are owners)
-- ============================================================

DROP POLICY IF EXISTS "Owners can view audit events" ON audit_events;
CREATE POLICY "Members can view own workspace audit events"
  ON audit_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = audit_events.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'ACTIVE'
    )
  );

-- ============================================================
-- 9. SUPER_ADMIN policies — system-wide read access
-- ============================================================

-- Super admins can view all workspaces
CREATE POLICY "Super admins can view all workspaces"
  ON workspaces FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = TRUE)
  );

-- Super admins can view all profiles
CREATE POLICY "Super admins can view all profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_super_admin = TRUE)
  );

-- Super admins can view all workspace members
CREATE POLICY "Super admins can view all workspace members"
  ON workspace_members FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = TRUE)
  );

-- Super admins can view all audit events
CREATE POLICY "Super admins can view all audit events"
  ON audit_events FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = TRUE)
  );
