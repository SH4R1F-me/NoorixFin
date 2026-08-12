# Backup and restore runbook

Acceptance item **BACKUP-01 — "Restore is usable"**, audit item 17.

## Why this document exists, and what it is not

BACKUP-01 has sat at "not tested" since the acceptance matrix was written. The
reason it stayed there is worth stating, because it is the whole point of this
file: **taking a backup proves nothing.** Managed Postgres takes backups
automatically and reports success automatically. The question BACKUP-01 asks is
different — *can someone bring this system back?* — and that question is only
answered by having done it.

So this is a rehearsal script, not a policy statement. It is written to be
**executed**, and the verification section at the end is what makes a run count.

> An untested backup is a belief, not a control.

---

## 0. Run the rehearsal — one command

The whole of §2–§4 is now automated. It restores into a **new** database and
never writes to the source, so it is safe to run against anything you can read:

```bash
pnpm db:restore-drill
```

It dumps, prepares the target, restores, runs `ci-assertions.sql` against the
**restored** database, compares row counts table-by-table with the source,
proves the ledger still balances, and checks that role grants came back. Any
failure exits non-zero. It also runs in CI's `database` job, so BACKUP-01 is
re-proved on every push rather than whenever someone remembers.

**Last executed:** 2026-08-08 against the local stack — passed. 302 users, 302
profiles, 300 workspaces, 1594 entries, 3188 postings, 5030 ledger accounts all
matched; zero unbalanced entries; 24 tables carrying `authenticated` SELECT.

### Two things the first automated run found

1. **`-j 4` deadlocks. Use `-j 1`.** Parallel workers take conflicting locks
   restoring the ledger's interdependent foreign keys; pg_restore reports
   `deadlock detected` and abandons that item, leaving a database that looks
   restored and is quietly missing constraints. §3 below still shows `-j 4`
   because that is what was originally rehearsed by hand — the script is the
   corrected version, and serial is the only setting that finishes clean.

2. **Two error classes are expected and benign.** `pg_restore` exits non-zero
   even on a good run, so the exit code alone cannot be the gate:

   | Error | Why it is harmless |
   |---|---|
   | `schema "extensions" already exists` | The prepare step creates it deliberately (§3). Skip that step and this one benign collision becomes **208 real errors and zero tables**, because every `CREATE TABLE` needs `extensions.uuid_generate_v4()`. |
   | `permission denied to change default privileges` (×9) | `ALTER DEFAULT PRIVILEGES` for roles the restoring role does not own. It governs objects created in *future*, never anything in the dump. The grants check proves the restored objects kept theirs. |

   The script whitelists these **by pattern, not by count**, so a new kind of
   error cannot hide behind them.

---

## 1. What has to survive

Not all of it is in Postgres, and a restore that recovers only the database
comes back with a ledger nobody can sign into.

| Thing | Where it lives | Recovered by |
|---|---|---|
| Ledger, profiles, planning tables | `postgres` — schema `public` | `pg_dump` / `pg_restore` |
| **Users, passwords, identities, sessions** | schema `auth` | the same dump **only if `auth` is included** |
| Storage objects (avatars, future receipts) | Supabase Storage (S3) | bucket copy — *not* in the SQL dump |
| Migrations | this repository | git |
| `app_settings` (thresholds, maintenance, tracing) | `public.app_settings` | in the dump |
| Cron schedules | schema `cron` | **re-created by migration 00017**, not restored |

The two rows that catch people are the `auth` schema and Storage. A dump of
`public` alone restores every transaction and no way to log in — the data is
technically intact and the product is unusable, which is precisely the state
BACKUP-01 exists to rule out.

`cron` is deliberately NOT restored: migration 00017 unschedules and re-creates
its jobs, so re-running migrations after a restore leaves exactly one copy of
each. Restoring `cron` as well is how a schedule ends up running twice.

---

## 2. Taking a backup

### Managed (Supabase cloud)

Point-in-time recovery is on by default on paid plans and is the primary
mechanism. Take an explicit logical dump as well before anything irreversible —
a migration that drops a column, a bulk correction, a version upgrade:

```bash
supabase db dump --db-url "$PROD_DB_URL" -f backup-$(date +%F).sql
supabase db dump --db-url "$PROD_DB_URL" --data-only -f backup-data-$(date +%F).sql
```

`supabase db dump` covers `public` **and** `auth`. Verify rather than assume:

```bash
grep -c 'CREATE TABLE auth\.' backup-$(date +%F).sql   # must be > 0
```

### Self-hosted / local

```bash
pg_dump "$DB_URL" \
  --schema=public --schema=auth --schema=extensions --schema=supabase_migrations \
  --no-owner \
  -Fc -f backup-$(date +%F).dump
```

`-Fc` (custom format) rather than plain SQL so `pg_restore` can run selectively
and in parallel — which matters at 3am, when the ability to restore one table
instead of everything is the difference between minutes and hours.

**Every flag above is the way it is because the first rehearsal failed without
it.** This command originally read `--schema=public --schema=auth
--no-privileges`, which is the obvious form and is wrong three separate ways:

| Omission | What actually happened |
|---|---|
| no `--schema=extensions` | **190 errors, zero tables restored.** Every table's `id` defaults to `extensions.uuid_generate_v4()`, so `CREATE TABLE` failed on the first one and on all of the rest. |
| `--no-privileges` | Tables and rows restored perfectly, and **no role could read them**. The grants live in migrations 00008/00014; stripping them leaves a database where `authenticated` gets `relation "journal_entries" does not exist` — PostgreSQL's way of saying "no USAGE on the schema" — and the API 42501s on every request. It looks like data loss and is not. |
| no `--schema=supabase_migrations` | The migration history is gone, so the `supabase db push` in §3 tries to apply all 17 migrations to an already-populated database instead of being the no-op it should be. |

`--no-owner` stays: object ownership is per-cluster and the restore target's
roles are its own. Privileges are kept because they are granted TO roles that
exist in every Supabase instance (`anon`, `authenticated`, `service_role`).

### Storage

```bash
aws s3 sync s3://<project>/storage/v1/ ./storage-backup-$(date +%F)/ \
  --endpoint-url "$SUPABASE_S3_ENDPOINT"
```

---

## 3. Restoring

**Restore into a NEW database first, always.** Restoring over the live one
turns a recoverable incident into an unrecoverable one, and the rehearsal below
is worthless if it cannot be run without risk.

The target has to be **prepared**, not just created. Extensions must exist
before the restore, because the table definitions reference them; and the dump
recreates `public` itself, so the empty one a new database ships with has to go
or `pg_restore` exits non-zero on a cosmetic collision — which is indistinguishable
from a real failure when all you have is an exit code.

```bash
createdb noorixfin_restore

psql "$RESTORE_URL" -v ON_ERROR_STOP=1 <<'SQL'
DROP SCHEMA IF EXISTS public CASCADE;          -- the dump recreates it
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto   WITH SCHEMA extensions;
SQL

pg_restore --dbname "$RESTORE_URL" --no-owner -j 4 backup.dump
```

`pg_restore` must exit **0** with no `error:` lines. Anything else, stop and
read them — do not continue to verification on a partial restore.

Then re-run migrations. Two reasons, and the second is the one people miss:

1. the dump may predate a migration merged since;
2. **the cron schedules are not in the dump** — 00017 is what puts them back,
   and without it the purge and prune jobs silently never run again.

```bash
supabase db push --db-url "$RESTORE_URL"
```

### pg_cron and the restore database name

`pg_cron` runs in **exactly one database per cluster** — the one named by
`cron.database_name` — because a single background worker reads jobs from it.
Rehearsing this makes it concrete: `CREATE EXTENSION pg_cron` in
`noorixfin_restore` is refused outright, with
*"Jobs must be scheduled from the database configured in cron.database_name"*.

So a restored database **cannot** carry the schedules while it is a side
database, and step 3 above will not give it them. That is not a problem to solve
during the restore; it is a step that belongs to cutover, and §5 has it. What
matters is knowing it, because the failure is silent: the purge and prune jobs
simply never run, and under DEC-017 the 30-day deletion grace is a promise that
data is *gone* afterwards.

---

## 4. Verification — this is the part that makes it BACKUP-01

A restore is "usable" when the product works on it, not when `pg_restore`
exits 0. Run every check below against the RESTORED database.

```bash
# The RESTORED database, not the live one. Pointing this at production and
# watching it pass is the easiest way to believe a restore worked when nothing
# was restored at all.
export RESTORE_URL=postgresql://postgres:postgres@127.0.0.1:54322/noorixfin_restore
psql "$RESTORE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/ci-assertions.sql
```

That file asserts tenant isolation, the ledger constraints, idempotency and the
derived-not-stored rules, and it exits non-zero on any violation — so it is a
real gate on a restored database, not a report. It is safe to run more than
once, and it skips the cron check with an explanatory notice when the database
under test is not the one `pg_cron` is configured for (both properties exist
because the first rehearsal needed them). Then, by hand:

| Check | Command | Expected |
|---|---|---|
| Users came back | `psql "$RESTORE_URL" -c "SELECT count(*) FROM auth.users;"` | matches production |
| Profiles match users | `psql "$RESTORE_URL" -c "SELECT count(*) FROM auth.users u LEFT JOIN profiles p ON p.id=u.id WHERE p.id IS NULL;"` | **0** |
| **The ledger still balances** | see below | **0 rows** |
| Schedules exist exactly once | `psql "$RESTORE_URL" -c "SELECT jobname, count(*) FROM cron.job GROUP BY 1 HAVING count(*) > 1;"` | **0 rows** |
| Someone can sign in | point a local API + web at `$RESTORE_URL` and log in as a real user | dashboard renders their figures |

The balance check is the one that matters most, because a partial restore can
leave entries without their postings — which looks fine in a row count and is a
corrupt ledger:

```sql
-- Every POSTED entry must have debits equal to credits (§8.2, DEC-006).
SELECT je.id, SUM(p.debit_minor) AS debits, SUM(p.credit_minor) AS credits
  FROM journal_entries je
  JOIN journal_postings p ON p.journal_entry_id = je.id
 WHERE je.status = 'POSTED'
 GROUP BY je.id
HAVING SUM(p.debit_minor) <> SUM(p.credit_minor);
```

An entry appearing here means the restore is **not** usable, whatever else
succeeded. Do not cut over.

Finally, confirm the restore is not silently empty — the failure mode where
every check above passes because there is nothing to check:

```sql
SELECT
  (SELECT count(*) FROM auth.users)        AS users,
  (SELECT count(*) FROM journal_entries)   AS entries,
  (SELECT count(*) FROM journal_postings)  AS postings;
```

---

## 5. Cutting over

1. Put the platform in maintenance mode — the operator console's toggle writes
   `app_settings.maintenance_mode`, which the dashboard banner reads, so users
   see a sentence rather than errors.
2. Stop the API so nothing writes during the switch.
3. Repoint `SUPABASE_URL` / `DATABASE_URL` at the restored instance.
4. **Re-establish the schedules.** They could not exist before now (see §3). If
   the restored database has a different name from the original, set
   `cron.database_name` to it and reload Postgres, then re-run migration 00017 —
   it unschedules and re-creates its jobs, so this is safe to repeat:

   ```bash
   psql "$LIVE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/00017_scheduler_and_alerting.sql
   psql "$LIVE_URL" -c "SELECT jobname, active FROM cron.job WHERE jobname LIKE 'noorixfin-%';"
   ```

   Expect **three** active jobs. This is the step whose omission is invisible:
   everything works, and deleted accounts are never purged.
5. Start the API. Confirm `/v1/health`.
6. Run the verification table above **again**, against the live URL. The cron
   check must now assert rather than skip.
7. Clear maintenance mode.
8. Record the incident: what was lost, the window, and what the rehearsal missed.

---

## 6. Rehearsal log

| Date | Against | Result |
|---|---|---|
| 2026-08-05 | local Supabase (17 migrations, 15 users, 8 entries, 14 postings) | **Pass, after four corrections.** Dump → prepared target → `pg_restore` exit 0, 0 errors. Counts identical to source. 0 orphaned users, 0 unbalanced POSTED entries. `ci-assertions.sql` exits 0 on the restored database: tenant isolation, ledger constraints, idempotency, derived-not-stored and SECURITY INVOKER all hold. |

The four corrections are the ones written into §2, §3 and §5 above — the
`extensions` schema, the privileges, the migration history, and the pg_cron
database. **The first attempt, following this document as originally written,
restored zero tables.** That is the value of the exercise: the runbook was a
belief, and it was wrong in a way no amount of re-reading would have shown.

Not covered by this rehearsal, and therefore still unproven:

- **"Someone can sign in"** — the last row of the verification table. It needs a
  full Auth stack pointed at the restored database, not just Postgres. The
  schema-level precondition (every `auth.users` row has its profile) was checked
  and holds.
- **Storage objects.** Nothing uses Storage yet; when avatars or receipts land,
  this rehearsal has to grow a bucket-restore step.
- **A restore under load, or of a database large enough for timing to matter.**
  No RPO/RTO number is claimed for exactly this reason (§7).

---

## 7. Rehearsal cadence

Quarterly, and after any migration that changes the ledger tables. Record the
date and outcome in `memory/TEST_RESULTS.md` against BACKUP-01 — an entry
saying "restored on <date>, N users, ledger balanced" is what moves that row off
"not tested", and it expires: a restore rehearsed a year ago is a belief again.

---

## 8. What this does not cover

Stated so nobody assumes otherwise:

- **Cross-region failover.** There is one region.
- **RPO/RTO commitments.** No numbers are claimed because none have been
  measured. The first rehearsal should record how long a restore actually took;
  that measurement is the only honest basis for a target.
- **Per-user restore.** Recovering one account's data from a full backup is not
  a supported path today. The user-facing route is `/v1/me/export` (§15.3),
  which is why that endpoint exists.
