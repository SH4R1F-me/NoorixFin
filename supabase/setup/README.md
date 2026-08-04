# Setup Scripts

Privileged, operator-run SQL. Nothing here is reachable from the application.

## `create_super_admin.sql` — DEC-013

Grants `SUPER_ADMIN` from the database level, with no UI form.

**Path A (recommended)** — the auth user already exists (app signup or Supabase Admin API):

```bash
psql "$DATABASE_URL" -v email="ops@example.com" -f supabase/setup/create_super_admin.sql
```

**Path B (first boot / self-hosted)** — no user exists yet; also creates the auth user:

```bash
psql "$DATABASE_URL" -v email="ops@example.com" -v password="$PW" -f supabase/setup/create_super_admin.sql
```

Both are idempotent. Verified live 2026-08-04: re-running creates no duplicate user and no duplicate
workspace, the password is stored bcrypt-hashed, and every run writes an `audit_events` row.

### Never commit a password
Pass it via a shell variable read at run time. The script has no default and no placeholder to
accidentally leave in.

### Path B caveat
Writing directly to `auth.users` is **unsupported** by Supabase — that schema is internal and its
shape changes between versions. Path A exists so the common case never depends on it.

### What SUPER_ADMIN is not
A platform/metadata role. It sees workspaces, profiles, memberships, and audit events. It has **no**
access to any user's financial rows — there is deliberately no super-admin RLS policy on
`ledger_accounts`, `categories`, `journal_entries`, `journal_postings`, `tags`, or
`journal_entry_tags` (DEC-002 #12, DEC-013).

Confirmed live: a freshly created super admin reads **0** `journal_entries` and **0**
`ledger_accounts` while seeing workspace metadata. See TEST_RESULTS.md TEST-006.
**Do not "fix" this by adding a bypass policy.**
