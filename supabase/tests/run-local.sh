#!/usr/bin/env bash
# Run the schema + RLS acceptance suite against a throwaway local PostgreSQL.
#
# Why this exists: `supabase start` needs Docker, which is not always available.
# Everything below the Supabase platform layer — schema, constraints, triggers,
# RLS — can be verified against plain PostgreSQL with a small compatibility
# shim (_local_shim.sql). That is enough to catch the class of bug that had gone
# undetected for six migrations, including the 42P17 recursion in 00007.
#
# NOT covered here: Supabase Auth, Storage, Realtime, PostgREST, and the API
# layer. Those still need `supabase start` (see run-supabase.md).
#
# Usage:  ./supabase/tests/run-local.sh [pg_bindir]
set -euo pipefail

PGBIN="${1:-/usr/lib/postgresql/18/bin}"
WORKDIR="$(mktemp -d)"
SOCK="$(mktemp -d /tmp/nfpg.XXXX)"   # short path: sockets have a 107-byte limit
HERE="$(cd "$(dirname "$0")" && pwd)"
PORT=5433

cleanup() { "$PGBIN/pg_ctl" -D "$WORKDIR/pgdata" stop -m immediate >/dev/null 2>&1 || true; rm -rf "$WORKDIR" "$SOCK"; }
trap cleanup EXIT

"$PGBIN/initdb" -D "$WORKDIR/pgdata" -U postgres --auth=trust >/dev/null
"$PGBIN/pg_ctl" -D "$WORKDIR/pgdata" -o "-k $SOCK -p $PORT -c listen_addresses=''" -l "$WORKDIR/pg.log" start >/dev/null
sleep 2

P=(psql -h "$SOCK" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q)
"${P[@]}" -c "CREATE DATABASE noorixfin;" >/dev/null
"${P[@]}" -d noorixfin -f "$HERE/_local_shim.sql"
# Real auth.users carries this; migration 00001's handle_new_user() trigger reads it.
"${P[@]}" -d noorixfin -c "ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS raw_user_meta_data JSONB DEFAULT '{}'::jsonb;"

echo "── applying migrations ──"
for f in "$HERE"/../migrations/*.sql; do
  printf '   %s ' "$(basename "$f")"
  "${P[@]}" -d noorixfin -f "$f" >/dev/null 2>&1 && echo "ok" || { echo "FAILED"; exit 1; }
done

"${P[@]}" -d noorixfin -f "$HERE/_seed.sql"
echo "── acceptance suite ──"
psql -h "$SOCK" -p "$PORT" -U postgres -d noorixfin -f "$HERE/acceptance.sql" 2>&1 \
  | grep -vE '^(BEGIN|COMMIT|ROLLBACK|SET|INSERT 0 1)$|^\(1 row\)$|^$'
