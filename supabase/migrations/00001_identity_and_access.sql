-- NoorixFin Initial Schema Migration: Identity & Access
-- Blueprint §9.2: profiles, workspaces, workspace_members

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- PROFILES (§9.2)
-- ============================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  avatar_path TEXT,
  locale TEXT NOT NULL DEFAULT 'bn' CHECK (locale IN ('bn', 'en')),
  timezone TEXT NOT NULL DEFAULT 'Asia/Dhaka',
  base_currency CHAR(3) NOT NULL DEFAULT 'BDT',
  week_starts_on SMALLINT NOT NULL DEFAULT 6 CHECK (week_starts_on BETWEEN 0 AND 6),
  amount_privacy_default BOOLEAN NOT NULL DEFAULT FALSE,
  onboarding_status TEXT NOT NULL DEFAULT 'ACCOUNT_CREATED'
    CHECK (onboarding_status IN (
      'LANGUAGE_SELECTED','ACCOUNT_CREATED','PREFERENCES_SET',
      'PERSONA_SELECTED','WORKSPACE_CREATED','FIRST_ACCOUNT_ADDED','COMPLETED'
    )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', ''));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- WORKSPACES (§9.2)
-- ============================================================
CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL CHECK (type IN ('PERSONAL', 'FAMILY')),
  name TEXT NOT NULL DEFAULT '',
  base_currency CHAR(3) NOT NULL DEFAULT 'BDT',
  timezone TEXT NOT NULL DEFAULT 'Asia/Dhaka',
  created_by UUID NOT NULL REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'PENDING_DELETION', 'DELETED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- WORKSPACE MEMBERS (§9.2)
-- ============================================================
CREATE TABLE workspace_members (
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'VIEWER'
    CHECK (role IN ('OWNER', 'ADMIN', 'EDITOR', 'VIEWER')),
  status TEXT NOT NULL DEFAULT 'INVITED'
    CHECK (status IN ('INVITED', 'ACTIVE', 'SUSPENDED', 'LEFT')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workspace_id, user_id)
);

-- Index for RLS performance (§9.6)
CREATE INDEX idx_workspace_members_user_id ON workspace_members(user_id);
CREATE INDEX idx_workspace_members_lookup ON workspace_members(user_id, workspace_id, status);

ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES — Workspace Isolation (§10.2)
-- ============================================================

-- Workspace: visible only to active members
CREATE POLICY "Members can view their workspaces"
  ON workspaces FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspaces.id
        AND wm.user_id = auth.uid()
        AND wm.status = 'ACTIVE'
    )
  );

-- Workspace: only authenticated users can create
CREATE POLICY "Users can create workspaces"
  ON workspaces FOR INSERT
  WITH CHECK (created_by = auth.uid());

-- Workspace: only owner can update
CREATE POLICY "Owners can update workspace"
  ON workspaces FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspaces.id
        AND wm.user_id = auth.uid()
        AND wm.status = 'ACTIVE'
        AND wm.role = 'OWNER'
    )
  );

-- Workspace Members: visible to active members of same workspace
CREATE POLICY "Members can view workspace members"
  ON workspace_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'ACTIVE'
    )
  );

-- Members: owner/admin can insert (invite)
CREATE POLICY "Owners and admins can invite members"
  ON workspace_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'ACTIVE'
        AND wm.role IN ('OWNER', 'ADMIN')
    )
    OR (
      -- Allow self-insert for workspace creator (first member)
      workspace_members.user_id = auth.uid()
      AND workspace_members.role = 'OWNER'
    )
  );

-- Members: owner/admin can update roles
CREATE POLICY "Owners and admins can update members"
  ON workspace_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'ACTIVE'
        AND wm.role IN ('OWNER', 'ADMIN')
    )
  );

-- ============================================================
-- WORKSPACE INVITATIONS (§9.2)
-- ============================================================
CREATE TABLE workspace_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  invited_email TEXT NOT NULL,
  invited_role TEXT NOT NULL DEFAULT 'VIEWER'
    CHECK (invited_role IN ('ADMIN', 'EDITOR', 'VIEWER')),
  token_hash TEXT NOT NULL,
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE workspace_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view workspace invitations"
  ON workspace_invitations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_invitations.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'ACTIVE'
    )
  );

-- ============================================================
-- Updated_at trigger function
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER workspaces_updated_at
  BEFORE UPDATE ON workspaces
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER workspace_members_updated_at
  BEFORE UPDATE ON workspace_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
