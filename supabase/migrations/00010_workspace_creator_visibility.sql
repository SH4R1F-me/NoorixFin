-- NoorixFin Migration: Let a workspace creator see the workspace they created
--
-- FOUND ON THE FIRST REAL SIGNUP (2026-08-04). Creating a workspace through the
-- API failed with:
--     42501: new row violates row-level security policy for table "workspaces"
--
-- The INSERT policy was fine — `created_by = auth.uid()` evaluated true. The
-- failure came from the RETURNING clause: `INSERT ... RETURNING` also applies
-- the table's SELECT policies to the new row, and the only SELECT policy was
--
--     EXISTS (SELECT 1 FROM workspace_members
--              WHERE workspace_id = workspaces.id AND user_id = auth.uid() ...)
--
-- At that instant no membership row exists — WorkspacesService inserts the
-- workspace first and the membership second. So the creator could not read back
-- the row they had just written, and `.insert().select().single()` failed.
--
-- Chicken-and-egg: membership grants visibility, but membership cannot be
-- created until the workspace exists.
--
-- Fix: the creator can always see their own workspace. Under DEC-007 the
-- creator IS the sole owner, so this grants nothing beyond what membership
-- would. It is additive and permissive — OR'd with the membership policy —
-- and scoped strictly to rows where created_by = auth.uid().
--
-- Diagnosis note for future readers: a plain INSERT (no RETURNING) returned
-- 201 while the same INSERT with `Prefer: return=representation` returned
-- 42501. If you see that asymmetry again, suspect a SELECT policy, not the
-- WITH CHECK.

CREATE POLICY "Creators can view their workspaces"
  ON workspaces FOR SELECT
  USING (created_by = auth.uid());

COMMENT ON POLICY "Creators can view their workspaces" ON workspaces IS
  'Required so INSERT ... RETURNING works during workspace bootstrap, before the '
  'workspace_members row exists. DEC-007: creator = sole owner.';
