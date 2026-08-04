-- NoorixFin Migration: Table Privileges for API Roles
--
-- FOUND ON THE FIRST RUN AGAINST REAL SUPABASE (2026-08-04). Every PostgREST
-- request returned:
--     42501: permission denied for table <name>
--
-- Cause: migrations 00001–00007 create tables, enable RLS, and write policies —
-- but never GRANT anything. Those are two separate permission systems:
--
--   * GRANT decides whether a role may touch the table AT ALL.
--   * RLS decides WHICH ROWS it may touch, once it may.
--
-- PostgreSQL checks GRANT first, so with no grants the RLS policies were never
-- even evaluated. The whole API surface was dead: not "leaky", not "partially
-- broken" — every authenticated read and write failed.
--
-- Why the local test suite missed it: supabase/tests/_local_shim.sql issues
-- `ALTER DEFAULT PRIVILEGES ... TO authenticated`, which granted the privileges
-- the real migrations forgot. The shim was compensating for the bug it should
-- have exposed. That shim line has been removed so the suite now fails the same
-- way production would.
--
-- Note on `anon`: deliberately granted nothing. Every table in this schema is
-- user-scoped; an unauthenticated caller has no legitimate reason to reach any
-- of it, and RLS-with-no-matching-policy is a weaker guarantee than no grant.

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- ============================================================
-- Identity & access
-- ============================================================
-- No DELETE: profiles and workspaces are removed through the deletion workflow
-- (Phase 4.3), never by a direct client call.
GRANT SELECT, INSERT, UPDATE ON public.profiles           TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.workspaces         TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.workspace_members  TO authenticated;

-- ============================================================
-- Ledger
-- ============================================================
-- DELETE is granted on the tables whose services perform compensating cleanup
-- on a failed multi-step write (e.g. WorkspacesService rolls back a workspace
-- when the membership insert fails). There is no DELETE *policy* on any of
-- these, so RLS still denies every row — the grant only stops the request
-- failing with 42501 before RLS is consulted.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ledger_accounts     TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories          TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_entries     TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_postings    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tags                TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_entry_tags  TO authenticated;

-- ============================================================
-- Supporting tables
-- ============================================================
GRANT SELECT, INSERT ON public.idempotency_records TO authenticated;
-- Audit is append-only from the client's perspective: no UPDATE, no DELETE.
GRANT SELECT, INSERT ON public.audit_events        TO authenticated;

-- ============================================================
-- Future tables
-- ============================================================
-- Without this, every new migration would have to remember to GRANT, and the
-- next one that forgets reproduces this outage.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated;
