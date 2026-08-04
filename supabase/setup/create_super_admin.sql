-- ============================================================================
-- NoorixFin — SUPER_ADMIN bootstrap (DEC-013)
-- ============================================================================
--
--   ⚠️  PRIVILEGED SCRIPT. Run with psql as the database owner / service role.
--       It must NEVER be reachable from an application connection, and nothing
--       in the app should ever execute it.
--
--   ⚠️  NEVER hardcode a password here and never commit one. The password is
--       supplied as a psql variable at run time (see usage below).
--
-- SCOPE OF THE ROLE (DEC-002 #12, DEC-007, DEC-013):
--   SUPER_ADMIN is a PLATFORM/METADATA role. It can see workspaces, profiles,
--   memberships, and audit events. It CANNOT read any user's financial rows —
--   there is deliberately no super-admin RLS policy on ledger_accounts,
--   categories, journal_entries, journal_postings, tags, or journal_entry_tags.
--   Verified live: see TEST_RESULTS.md TEST-006, SEC-02(c).
--   Do not "fix" that by adding a bypass policy.
--
-- ── USAGE ───────────────────────────────────────────────────────────────────
--
--   Path A — RECOMMENDED. The auth user already exists (created by signing up
--   through the app or via the Supabase Admin API). Just promote them:
--
--     psql "$DATABASE_URL" \
--       -v email="ops@example.com" \
--       -f supabase/setup/create_super_admin.sql
--
--   Path B — first boot / self-hosted, when no user exists yet. Also pass a
--   password to have the auth user created directly:
--
--     psql "$DATABASE_URL" \
--       -v email="ops@example.com" -v password="$(read -s -p 'pw: ' p; echo $p)" \
--       -f supabase/setup/create_super_admin.sql
--
--   Both paths are idempotent — re-running promotes rather than duplicating.
--
-- ── WARNING ON PATH B ───────────────────────────────────────────────────────
--   Writing directly to auth.users is UNSUPPORTED by Supabase. That schema is
--   internal and its shape changes between versions; a future release can break
--   this block without notice. Path A exists so the common case never depends
--   on it. Prefer creating the user through Supabase Auth and promoting.
-- ============================================================================

\set ON_ERROR_STOP on

-- Default the password variable so Path A does not error on an unset variable.
\if :{?password} \else \set password '' \endif

BEGIN;

-- ─── 1. Reusable promotion function ─────────────────────────────────────────
-- SECURITY DEFINER so an operator can promote without direct table grants.
-- search_path is pinned: an unqualified name inside a SECURITY DEFINER function
-- is otherwise resolvable via a caller-controlled search_path.
CREATE OR REPLACE FUNCTION public.promote_super_admin(target_email TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  target_id UUID;
BEGIN
  SELECT u.id INTO target_id FROM auth.users u WHERE u.email = target_email;

  IF target_id IS NULL THEN
    RAISE EXCEPTION 'No auth user with email %. Create them via Supabase Auth first, or pass -v password=... to use the first-boot path.', target_email;
  END IF;

  -- profiles rows are created by handle_new_user() on signup, but a row written
  -- outside that path may not exist — insert defensively.
  INSERT INTO public.profiles (id, is_super_admin)
  VALUES (target_id, TRUE)
  ON CONFLICT (id) DO UPDATE SET is_super_admin = TRUE;

  -- Super-admin creation must never be silent.
  INSERT INTO public.audit_events (actor_id, action, resource_type, resource_id, metadata)
  VALUES (
    target_id, 'SUPER_ADMIN_GRANTED', 'profile', target_id,
    jsonb_build_object('email', target_email, 'granted_by', current_user, 'via', 'create_super_admin.sql')
  );

  RETURN target_id;
END;
$$;

REVOKE ALL ON FUNCTION public.promote_super_admin(TEXT) FROM PUBLIC;

COMMENT ON FUNCTION public.promote_super_admin(TEXT) IS
  'DEC-013: grant SUPER_ADMIN to an existing auth user. Platform/metadata access '
  'only — confers no access to any user''s financial rows.';

-- ─── 2. Path B: create the auth user if requested and absent ────────────────
-- Plain SQL, not a DO block: psql does NOT interpolate :'vars' inside
-- dollar-quoted bodies, so `:'email'` would reach the parser literally and fail.
-- Written as INSERT..SELECT..WHERE NOT EXISTS so it is idempotent and a no-op
-- on Path A (empty password).
INSERT INTO auth.users (id, email, encrypted_password, raw_user_meta_data)
SELECT gen_random_uuid(), :'email', crypt(:'password', gen_salt('bf')), '{}'::jsonb
 WHERE :'password' <> ''
   AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.email = :'email');

-- ─── 3. Promote ─────────────────────────────────────────────────────────────
SELECT public.promote_super_admin(:'email') AS super_admin_id;

-- ─── 4. Personal workspace (DEC-007: every user owns exactly one) ───────────
-- status is set explicitly: 00004 made ACTIVE the default, but being explicit
-- keeps this correct even if the default changes again.
WITH target AS (
  SELECT id FROM auth.users WHERE email = :'email'
), created AS (
  INSERT INTO public.workspaces (type, name, base_currency, timezone, created_by, status)
  SELECT 'PERSONAL', 'Operator', 'BDT', 'Asia/Dhaka', t.id, 'ACTIVE'
    FROM target t
   WHERE NOT EXISTS (
     SELECT 1 FROM public.workspaces w
      WHERE w.created_by = t.id AND w.type = 'PERSONAL' AND w.status = 'ACTIVE'
   )
  RETURNING id, created_by
)
INSERT INTO public.workspace_members (workspace_id, user_id, role, status)
SELECT c.id, c.created_by, 'OWNER', 'ACTIVE' FROM created c
ON CONFLICT DO NOTHING;

COMMIT;

\echo ''
\echo '  SUPER_ADMIN granted. Verify with:'
\echo '    SELECT p.id, u.email, p.is_super_admin FROM profiles p JOIN auth.users u ON u.id = p.id WHERE p.is_super_admin;'
\echo '    SELECT action, resource_id, metadata, created_at FROM audit_events WHERE action = ''SUPER_ADMIN_GRANTED'';'
\echo ''
