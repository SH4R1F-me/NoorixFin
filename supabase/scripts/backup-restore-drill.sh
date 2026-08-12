#!/usr/bin/env bash
#
# Backup/restore rehearsal — executes supabase/BACKUP_RESTORE.md end to end.
#
# The runbook was thorough and had never been run by anything but a human, once.
# A backup that has not been restored is a hypothesis, and the failure mode is
# the worst kind: you find out during the incident. This turns the runbook into
# something CI or a human can run on demand and get a pass/fail from.
#
# SAFE BY CONSTRUCTION: it restores into a NEW database and never writes to the
# source. The source is only ever read by pg_dump.
#
#   ./supabase/scripts/backup-restore-drill.sh            # local stack
#   ./supabase/scripts/backup-restore-drill.sh --keep     # leave the restored DB
#   SOURCE_URL=... ./supabase/scripts/backup-restore-drill.sh
#
set -euo pipefail

SOURCE_URL="${SOURCE_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
RESTORE_DB="${RESTORE_DB:-noorixfin_restore_drill}"
KEEP=0
[[ "${1:-}" == "--keep" ]] && KEEP=1

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WORK="$(mktemp -d)"
DUMP="$WORK/backup.dump"

# Same host/port/credentials as the source, different database name.
ADMIN_URL="${SOURCE_URL%/*}/postgres"
RESTORE_URL="${SOURCE_URL%/*}/$RESTORE_DB"

red()   { printf '\033[31m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
step()  { printf '\n\033[1m▸ %s\033[0m\n' "$*"; }
dim()   { printf '\033[2m%s\033[0m\n' "$*"; }

cleanup() {
  local code=$?
  if [[ $KEEP -eq 1 ]]; then
    dim "Restored database kept: $RESTORE_URL"
  else
    psql "$ADMIN_URL" -q -c "DROP DATABASE IF EXISTS $RESTORE_DB WITH (FORCE);" >/dev/null 2>&1 || true
  fi
  rm -rf "$WORK"
  [[ $code -ne 0 ]] && red "✗ Drill FAILED (exit $code)"
  exit $code
}
trap cleanup EXIT

step "Versions"
# A pg_dump older than the server cannot dump it at all, and the error names
# neither version clearly. Checking up front turns that into one line.
CLIENT_MAJOR="$(pg_dump --version | grep -oE '[0-9]+' | head -1)"
SERVER_FULL="$(psql "$SOURCE_URL" -tAc 'show server_version')"
SERVER_MAJOR="${SERVER_FULL%%.*}"
echo "  pg_dump $CLIENT_MAJOR · server $SERVER_FULL"
if (( CLIENT_MAJOR < SERVER_MAJOR )); then
  red "  pg_dump ($CLIENT_MAJOR) is older than the server ($SERVER_MAJOR) — it cannot dump this database."
  exit 1
fi

step "Dump"
# Flags are the runbook's §2, and each one is there because leaving it out
# broke a rehearsal: --schema=extensions (or every CREATE TABLE fails on its
# uuid default) and privileges retained (or the restore has rows nobody can read).
pg_dump "$SOURCE_URL" \
  --format=custom \
  --no-owner \
  --schema=public \
  --schema=auth \
  --schema=storage \
  --schema=extensions \
  --file="$DUMP"
dim "  $(du -h "$DUMP" | cut -f1) → $DUMP"

step "Prepare the restore target"
psql "$ADMIN_URL" -q -c "DROP DATABASE IF EXISTS $RESTORE_DB WITH (FORCE);"
# `createdb "$RESTORE_URL"` looks right and is not: createdb takes a database
# NAME, so it read the whole URL as one and then fell back to a local socket
# connection as the OS user. CREATE DATABASE over the admin URL reuses the
# credentials already in SOURCE_URL.
psql "$ADMIN_URL" -q -c "CREATE DATABASE $RESTORE_DB;"
psql "$RESTORE_URL" -q -v ON_ERROR_STOP=1 <<'SQL'
DROP SCHEMA IF EXISTS public CASCADE;          -- the dump recreates it
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto   WITH SCHEMA extensions;
SQL

step "Restore"
#
# `-j 1`, not the runbook's `-j 4`. Parallel restore of this dump deadlocks:
# workers take conflicting locks restoring the ledger's interdependent foreign
# keys, and pg_restore reports `deadlock detected` and abandons that item —
# leaving a database that looks restored and is missing constraints. Serial is
# slower and it is the only setting that finishes clean. Measured, not assumed.
#
# pg_restore also exits non-zero for errors that do not affect the data, so the
# exit code alone cannot be the gate. Two classes are expected here and are
# whitelisted **by pattern, not by count**, so a new kind of error can never
# hide behind them:
#
#   · `schema "extensions" already exists` — we created it deliberately in the
#     prepare step, because table defaults reference extensions.uuid_generate_v4()
#     and without it every CREATE TABLE fails. Verified: removing the prepare
#     step turns 1 benign collision into 208 real errors and zero tables.
#
#   · `permission denied to change default privileges` — ALTER DEFAULT
#     PRIVILEGES for roles the restoring role does not own (supabase_admin).
#     It governs objects created in FUTURE, not anything in the dump; grants on
#     the restored objects come across intact, which the grants check below
#     proves rather than assumes.
#
set +e
pg_restore --dbname "$RESTORE_URL" --no-owner -j 1 "$DUMP" 2>"$WORK/restore.err"
RESTORE_CODE=$?
set -e

BENIGN='schema "extensions" already exists|permission denied to change default privileges'
grep '^pg_restore: error:' "$WORK/restore.err" > "$WORK/all.err" || true
grep -Ev "$BENIGN" "$WORK/all.err" > "$WORK/real.err" || true

BENIGN_COUNT=$(( $(wc -l < "$WORK/all.err") - $(wc -l < "$WORK/real.err") ))
REAL_COUNT=$(wc -l < "$WORK/real.err")

if [[ $REAL_COUNT -gt 0 ]]; then
  red "  pg_restore exited $RESTORE_CODE with $REAL_COUNT unexpected error line(s):"
  head -20 "$WORK/real.err"
  exit 1
fi
green "  restored with no unexpected errors"
dim "  ($BENIGN_COUNT expected, explained above; pg_restore exit $RESTORE_CODE)"

step "Verify — SQL invariants on the RESTORED database"
# The same gate CI runs against a fresh migration chain. Every check RAISEs, so
# a violation is a non-zero exit rather than a report someone has to read.
psql "$RESTORE_URL" -q -v ON_ERROR_STOP=1 -f "$REPO_ROOT/supabase/tests/ci-assertions.sql"
green "  invariants hold"

step "Verify — the restored copy matches the source"
fail=0

compare() {
  local label="$1" query="$2"
  local a b
  a="$(psql "$SOURCE_URL"  -tAc "$query")"
  b="$(psql "$RESTORE_URL" -tAc "$query")"
  if [[ "$a" == "$b" ]]; then
    printf '  %-34s %s\n' "$label" "$(green "match ($a)")"
  else
    printf '  %-34s %s\n' "$label" "$(red "MISMATCH source=$a restored=$b")"
    fail=1
  fi
}

compare "auth.users"            "SELECT count(*) FROM auth.users"
compare "profiles"              "SELECT count(*) FROM public.profiles"
compare "workspaces"            "SELECT count(*) FROM public.workspaces"
compare "journal_entries"       "SELECT count(*) FROM public.journal_entries"
compare "journal_postings"      "SELECT count(*) FROM public.journal_postings"
compare "ledger_accounts"       "SELECT count(*) FROM public.ledger_accounts"

expect_zero() {
  local label="$1" query="$2" n
  n="$(psql "$RESTORE_URL" -tAc "$query")"
  if [[ "$n" == "0" ]]; then
    printf '  %-34s %s\n' "$label" "$(green "0")"
  else
    printf '  %-34s %s\n' "$label" "$(red "$n — expected 0")"
    fail=1
  fi
}

expect_zero "profiles without a user" \
  "SELECT count(*) FROM public.profiles p LEFT JOIN auth.users u ON u.id=p.id WHERE u.id IS NULL"

# The check that matters most. A partial restore can bring entries across
# without their postings, which passes a row count and is a corrupt ledger.
expect_zero "POSTED entries that do not balance" "
  SELECT count(*) FROM (
    SELECT je.id
    FROM public.journal_entries je
    JOIN public.journal_postings p ON p.journal_entry_id = je.id
    WHERE je.status = 'POSTED'
    GROUP BY je.id
    HAVING COALESCE(SUM(p.debit_minor),0) <> COALESCE(SUM(p.credit_minor),0)
  ) unbalanced"

expect_zero "POSTED entries with no postings" "
  SELECT count(*) FROM public.journal_entries je
  WHERE je.status = 'POSTED'
    AND NOT EXISTS (SELECT 1 FROM public.journal_postings p WHERE p.journal_entry_id = je.id)"

# The runbook's most expensive lesson: a restore with `--no-privileges` brings
# every row across and leaves a database no role can read, which presents as
# total data loss and is not. This asserts the grants actually came back, so
# the "permission denied to change default privileges" noise above can be
# dismissed on evidence rather than on reasoning.
step "Verify — role grants survived the restore"
GRANTS="$(psql "$RESTORE_URL" -tAc "
  SELECT count(*) FROM information_schema.role_table_grants
  WHERE grantee = 'authenticated'
    AND table_schema = 'public'
    AND privilege_type = 'SELECT'")"
if [[ "${GRANTS:-0}" -gt 0 ]]; then
  printf '  %-34s %s\n' "authenticated SELECT grants" "$(green "$GRANTS tables")"
else
  printf '  %-34s %s\n' "authenticated SELECT grants" "$(red "none — every request would 42501")"
  fail=1
fi

if [[ $fail -ne 0 ]]; then
  red "
One or more checks failed. The dump is NOT known-good — do not rely on it."
  exit 1
fi

green "
✓ Restore drill passed. The backup is restorable and the ledger balances on it."
dim "Not covered here (they belong to cutover, §5 of the runbook):"
dim "  · storage objects — dumped separately, see §2 Storage"
dim "  · pg_cron schedules — one database per cluster, so a side database"
dim "    cannot hold them; migration 00017 restores them at cutover"
