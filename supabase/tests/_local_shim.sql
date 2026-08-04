-- Local test shim: the parts of a Supabase project our migrations depend on.
-- Not shipped — lives in the scratchpad so migrations run unmodified.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE,
  encrypted_password TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Mirrors Supabase: reads the sub claim from the request GUC.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

DO $$ BEGIN
  CREATE ROLE anon NOLOGIN NOINHERIT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE ROLE authenticated NOLOGIN NOINHERIT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
-- NOTE: table privileges are deliberately NOT granted here. They belong in
-- migration 00008, and this shim previously granted them — which masked their
-- absence from the real migrations and let a total API outage ship undetected.
-- If a test fails with 42501, the migration is wrong, not the shim.
