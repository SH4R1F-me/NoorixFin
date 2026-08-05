-- NoorixFin Migration: Service-Role Table Privileges
--
-- FOUND ON THE FIRST RUN OF THE ADMIN API (2026-08-04). Every service-role write
-- failed with:
--     42501: permission denied for table system_events
--
-- This is 00008 all over again, one role across. 00008 discovered that
-- migrations 00001–00007 created tables and RLS policies but never GRANTed, so
-- `authenticated` could not touch anything. It fixed `authenticated` — and only
-- `authenticated`. `service_role` was left with no INSERT, SELECT, UPDATE or
-- DELETE on a single table in this schema.
--
-- Why nothing noticed until now: until the admin console there was no
-- service-role write path in the product. `getServiceClient()` existed and was
-- documented, but every request handler used `getUserClient()`. The first code
-- to actually use it — audit writes, system events, operator actions — failed
-- on its first call.
--
--   * Supabase's project-init `GRANT ALL ON ALL TABLES ... TO service_role`
--     applies to tables existing AT THAT MOMENT. Migration-created tables are
--     not covered.
--   * The default ACL for schema `public` does not extend arwd to service_role
--     (see `auto_expose_new_tables` in config.toml — new entities are not
--     auto-exposed on current Supabase).
--
-- ┌─ WHY THERE IS NO `ALTER DEFAULT PRIVILEGES` FOR service_role BELOW ──────┐
-- │ 00008 ends with a default-privileges line for `authenticated` so that a  │
-- │ future migration cannot reproduce its outage. The same convenience is    │
-- │ DELIBERATELY NOT extended to service_role here.                          │
-- │                                                                          │
-- │ service_role has BYPASSRLS. For `authenticated`, a too-broad GRANT is    │
-- │ still fenced by row-level policies; for service_role the GRANT is the    │
-- │ ENTIRE boundary. A blanket default would silently hand the API's admin   │
-- │ identity full read access to every future ledger table — exactly the     │
-- │ ambient access to users' finances that DEC-002 #12 and DEC-007 forbid.   │
-- │                                                                          │
-- │ So: every service_role grant is explicit, per table, and listed here.    │
-- │ Adding one is a deliberate reviewable act. If a new migration needs a    │
-- │ service-role write, it must say so out loud.                             │
-- └──────────────────────────────────────────────────────────────────────────┘
--
-- Note what is absent below: ledger_accounts, categories, journal_entries,
-- journal_postings, tags, journal_entry_tags. The API never touches a user's
-- financial rows with the service role, so it is not granted the ability to.
-- The purge path does reach them, but through purge_expired_deletions(), which
-- is SECURITY DEFINER and therefore runs as the function owner, not as
-- service_role — no grant required.

-- ============================================================
-- Identity & lifecycle
-- ============================================================
-- Operator user management (display name/locale/timezone edits, suspension,
-- deletion scheduling) and the account-lifecycle endpoints write here. Writes
-- are confined to the operator-editable columns by AdminService, and the
-- privilege-escalation surface is closed separately by the column-level grants
-- in 00012 — which apply to `authenticated`, not to this role. service_role is
-- trusted; the guard in front of it is what makes that safe.
GRANT SELECT, UPDATE ON public.profiles TO service_role;

-- Audit is append-only for every role, including this one. No UPDATE, no
-- DELETE: an audit trail the API can rewrite is not an audit trail.
GRANT SELECT, INSERT ON public.audit_events TO service_role;

-- ============================================================
-- Admin platform
-- ============================================================
-- SELECT is needed alongside INSERT for the buffered writer's own diagnostics.
-- DELETE is NOT granted: pruning goes through prune_system_events(), which is
-- SECURITY DEFINER, so the only way to remove operational history is the
-- audited function — not an ad-hoc call from application code.
GRANT SELECT, INSERT ON public.system_events TO service_role;

GRANT SELECT, UPDATE ON public.app_settings TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.broadcasts TO service_role;

-- Read-only: the console reports aggregate delivery counts. Receipts are the
-- user's own record of what they dismissed, and nothing operator-side has a
-- reason to write or remove them.
GRANT SELECT ON public.broadcast_receipts TO service_role;

-- system_events uses GENERATED ALWAYS AS IDENTITY, whose sequence needs USAGE
-- for the INSERT above to succeed.
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
