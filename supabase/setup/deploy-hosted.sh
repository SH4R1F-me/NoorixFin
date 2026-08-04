#!/usr/bin/env bash
#
# Deploy the NoorixFin schema to a HOSTED Supabase project.
#
#   ⚠️  This writes to remote infrastructure. Read the plan it prints before
#       confirming. It is not destructive to existing tables, but `db push`
#       applies every migration in supabase/migrations to the linked project.
#
# ── Prerequisites (you run these; they are not things to paste into a chat) ──
#
#   1. Authenticate the CLI once. Opens a browser and stores a token locally:
#
#        pnpm exec supabase login
#
#      Or, in CI, export a personal access token from
#      https://supabase.com/dashboard/account/tokens :
#
#        export SUPABASE_ACCESS_TOKEN=sbp_...
#
#   2. Have the project's database password ready — the CLI will prompt for it
#      on `link`. It is at Dashboard → Settings → Database → Database password.
#      This is NOT the service_role key.
#
# ── Usage ────────────────────────────────────────────────────────────────────
#
#   ./supabase/setup/deploy-hosted.sh <project-ref>
#
set -euo pipefail

PROJECT_REF="${1:-}"
if [ -z "$PROJECT_REF" ]; then
  echo "usage: $0 <project-ref>   (e.g. the subdomain of your project URL)" >&2
  exit 1
fi

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
cd "$ROOT"

PNPM=(npx --yes pnpm@11.18.0)

echo
echo "About to apply the following to hosted project: $PROJECT_REF"
echo
for f in supabase/migrations/*.sql; do echo "   $(basename "$f")"; done
echo
echo "This creates the full NoorixFin schema: identity, ledger, RLS policies,"
echo "and table grants. Existing unrelated tables are not touched."
echo
read -r -p "Continue? [y/N] " reply
case "$reply" in [yY]*) ;; *) echo "aborted."; exit 1 ;; esac

echo
echo "── linking ──"
"${PNPM[@]}" exec supabase link --project-ref "$PROJECT_REF"

echo
echo "── pushing migrations ──"
"${PNPM[@]}" exec supabase db push

echo
echo "── done ──"
cat <<'NEXT'

Schema is live. Two things remain:

1. Create the operator account. Do NOT use the raw auth.users path against a
   hosted project — create the user through the dashboard (Authentication →
   Users → Add user, with "Auto Confirm" on), then promote:

     psql "$HOSTED_DB_URL" -v email="you@example.com" \
       -f supabase/setup/create_super_admin.sql

   The connection string is at Settings → Database → Connection string (URI).

2. Point the apps at the project. Copy the anon key from Settings → API into:

     apps/web/.env.local     NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY
     apps/api/.env.local     SUPABASE_URL / _ANON_KEY / _SERVICE_ROLE_KEY

   Keep the service_role key out of anything prefixed NEXT_PUBLIC_ or
   EXPO_PUBLIC_ — those are embedded in client bundles (SEC-03).

NEXT
