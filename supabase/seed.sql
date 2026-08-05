-- ═══════════════════════════════════════════════════════════════════════════
-- NoorixFin — LOCAL DEVELOPMENT SEED
-- Runs automatically after migrations on `supabase start` / `supabase db reset`
-- (config.toml → [db.seed]).
-- ═══════════════════════════════════════════════════════════════════════════
--
--                    ⚠️  READ THIS BEFORE RUNNING IT ANYWHERE  ⚠️
--
-- This file creates two accounts with a PUBLISHED, COMMITTED PASSWORD, and one
-- of them is a platform SUPER_ADMIN. Against any database reachable by anyone
-- other than you, that is not a convenience — it is a backdoor with the key
-- printed next to the lock, in a repository.
--
-- So it refuses to run outside a local Supabase. The guard below aborts unless
-- the database carries the local demo JWT secret, a value that exists only in a
-- developer's own stack. A managed project has its own secret, and this file
-- stops with a loud error rather than quietly seeding an operator.
--
-- The guard is worth more than a comment saying "dev only". `supabase db reset`
-- accepts `--db-url`, and one wrong URL at the wrong moment is all it takes.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_jwt TEXT := current_setting('app.settings.jwt_secret', true);
BEGIN
  IF v_jwt IS DISTINCT FROM 'super-secret-jwt-token-with-at-least-32-characters-long' THEN
    RAISE EXCEPTION
      'REFUSING TO SEED: this is not a local Supabase stack. %',
      'seed.sql creates a SUPER_ADMIN with a committed password and must never '
      'run against a shared or hosted database.';
  END IF;
END;
$$;

-- pgcrypto lives in `extensions` on Supabase, and the seed does not run with a
-- search_path that includes it.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ── The accounts ────────────────────────────────────────────────────────────
--
--   ops@noorixfin.local   — SUPER_ADMIN (operator console)
--   user@noorixfin.local  — ordinary user
--   password for both     — NoorixDev!2026
--
-- Hashed the way GoTrue hashes one: bcrypt via pgcrypto, which is what
-- `crypt(..., gen_salt('bf'))` produces. Sign-in therefore goes through the
-- real auth flow rather than anything that bypasses it. Writing the plaintext
-- into `encrypted_password` would produce an account that exists and can never
-- log in — the usual outcome of hand-seeding Supabase auth.
--
-- `.local` addresses on purpose: RFC 6762 reserves the suffix, so these can
-- never resolve to a real mailbox belonging to someone else.
--
-- Idempotent on the fixed ids, so re-running is an update rather than a
-- collision, and a reset keeps the same ids in any bookmarked URL.

DO $$
DECLARE
  v_password TEXT := 'NoorixDev!2026';
  v_account  RECORD;
BEGIN
  FOR v_account IN
    SELECT * FROM (VALUES
      ('00000000-0000-4000-a000-00000000ba51'::UUID, 'ops@noorixfin.local',  'Ops (dev super admin)', TRUE),
      ('00000000-0000-4000-a000-00000000c0de'::UUID, 'user@noorixfin.local', 'Dev User',              FALSE)
    ) AS t(id, email, display_name, is_operator)
  LOOP
    -- ── auth.users ──────────────────────────────────────────────────────────
    -- `email_confirmed_at` is set: without it GoTrue refuses the sign-in and
    -- sends a confirmation mail to Mailpit, which defeats the point of a seed.
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new
    ) VALUES (
      v_account.id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      v_account.email,
      extensions.crypt(v_password, extensions.gen_salt('bf')),
      NOW(),
      jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
      jsonb_build_object('display_name', v_account.display_name),
      NOW(), NOW(),
      -- ── Empty strings, NOT NULL. This is load-bearing. ──────────────────
      -- These columns are nullable in the schema, and GoTrue scans them into
      -- non-nullable Go strings. A seeded row that leaves them NULL makes every
      -- sign-in fail with HTTP 500 "Database error querying schema" — a message
      -- that points at the schema and is nothing to do with it. The first
      -- version of this seed did exactly that; the auth log said
      --   `Scan error on column index 3, name "confirmation_token":
      --    converting NULL to string is unsupported`
      -- which is the only place the real cause appears.
      '', '', '', ''
    )
    ON CONFLICT (id) DO UPDATE SET
      encrypted_password = EXCLUDED.encrypted_password,
      email_confirmed_at = EXCLUDED.email_confirmed_at,
      confirmation_token = '',
      recovery_token     = '',
      email_change       = '',
      email_change_token_new = '',
      updated_at         = NOW();

    -- ── auth.identities ─────────────────────────────────────────────────────
    -- A user with no identity row cannot sign in on current GoTrue: the email
    -- provider is looked up here, not on the user. This is the single most
    -- common reason a hand-seeded account "exists but the password is wrong".
    INSERT INTO auth.identities (
      id, user_id, provider_id, provider, identity_data,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      extensions.uuid_generate_v4(),
      v_account.id,
      v_account.id::TEXT,
      'email',
      jsonb_build_object(
        'sub', v_account.id::TEXT,
        'email', v_account.email,
        'email_verified', true,
        'phone_verified', false
      ),
      NOW(), NOW(), NOW()
    )
    ON CONFLICT (provider_id, provider) DO NOTHING;

    -- ── public.profiles ─────────────────────────────────────────────────────
    -- `handle_new_user()` (migration 00001) already created the row on INSERT.
    -- This sets what the trigger cannot know — and is necessarily a separate
    -- statement, because `is_super_admin` is deliberately not writable through
    -- the API (DEC-019), so a direct write is the only other legitimate path.
    UPDATE public.profiles
       SET display_name      = v_account.display_name,
           is_super_admin    = v_account.is_operator,
           locale            = 'en',
           onboarding_status = 'COMPLETED'
     WHERE id = v_account.id;

    RAISE NOTICE 'seeded % (%)',
      v_account.email,
      CASE WHEN v_account.is_operator THEN 'SUPER_ADMIN' ELSE 'user' END;
  END LOOP;
END;
$$;

-- ── A verified TOTP factor for the operator ─────────────────────────────────
--
-- Since audit item 18, `/admin` requires a second factor for THIS SESSION, not
-- merely an operator flag — so a seeded super admin with no authenticator can
-- sign in and still not reach the console. Seeding the factor is what makes the
-- account usable, and it is safe for the same reason the password is: this file
-- cannot run anywhere but a local stack.
--
-- Add this to any authenticator app as a manual / "enter a setup key" entry:
--
--     Account:  NoorixFin dev ops
--     Key:      JBSWY3DPEHPK3PXP
--     Type:     Time-based (TOTP), 6 digits, 30 seconds
--
-- (If you would rather not, delete this row and enrol normally through
--  Settings → Security. Nothing else depends on it.)
INSERT INTO auth.mfa_factors (
  id, user_id, friendly_name, factor_type, status, secret, created_at, updated_at
) VALUES (
  '00000000-0000-4000-a000-0000000f4c70',
  '00000000-0000-4000-a000-00000000ba51',
  'Dev authenticator',
  'totp',
  'verified',
  'JBSWY3DPEHPK3PXP',
  NOW(), NOW()
)
ON CONFLICT (id) DO UPDATE SET
  status     = 'verified',
  secret     = EXCLUDED.secret,
  updated_at = NOW();

-- ── What is deliberately NOT seeded ─────────────────────────────────────────
-- No workspace, accounts, categories or transactions. The app creates a
-- workspace on first sign-in and seeds the system categories on first read, so
-- a hand-written fixture here would drift from what that flow actually
-- produces — which is exactly how a seed stops representing the product.
--
-- For a workspace with known figures, the E2E fixture builds one through the
-- real API: apps/web/e2e/support/fixture.ts.

SELECT 'Seed complete — ops@noorixfin.local (SUPER_ADMIN) + user@noorixfin.local · password NoorixDev!2026' AS status;
