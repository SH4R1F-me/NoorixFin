-- NoorixFin Migration: Fix RLS Recursion on workspace_members
--
-- FOUND BY THE FIRST LIVE RUN OF THE SCHEMA (2026-08-04). Every query that
-- touched workspace_members failed with:
--     42P17: infinite recursion detected in policy for relation "workspace_members"
--
-- Cause: the policy from migration 00001 reads the table it guards —
--
--     CREATE POLICY "Members can view workspace members" ON workspace_members
--       USING (EXISTS (SELECT 1 FROM workspace_members wm
--                       WHERE wm.workspace_id = workspace_members.workspace_id
--                         AND wm.user_id = auth.uid() AND wm.status = 'ACTIVE'));
--
-- Evaluating the policy runs the subquery, which is itself subject to the same
-- policy, which runs the subquery... PostgreSQL detects the cycle and aborts.
--
-- Blast radius was total, not partial: the workspaces, ledger_accounts,
-- journal_entries, journal_postings, categories, and audit_events policies all
-- join workspace_members, so *every* authenticated read failed. The API would
-- have returned 500s on every endpoint.
--
-- Migration 00004 fixed the analogous recursion on `profiles` via the
-- SECURITY DEFINER is_super_admin() helper, but this one is on a different
-- table and a different policy, and was missed.
--
-- Fix: under DEC-007 a workspace has exactly one member — its owner — enforced
-- by uq_workspace_members_single_owner (00004). "Can I see this membership row?"
-- therefore reduces to "is it mine?", which needs no subquery at all.

DROP POLICY IF EXISTS "Members can view workspace members" ON workspace_members;

CREATE POLICY "Users can view own membership"
  ON workspace_members FOR SELECT
  USING (user_id = auth.uid());

COMMENT ON TABLE workspace_members IS
  'DEC-007: exactly one member (the OWNER) per workspace. The SELECT policy is '
  'deliberately a direct auth.uid() comparison — any subquery against this table '
  'from its own policy recurses (42P17). If multi-member workspaces ever return, '
  'the membership lookup must move into a SECURITY DEFINER function, as '
  'is_super_admin() does for profiles.';
