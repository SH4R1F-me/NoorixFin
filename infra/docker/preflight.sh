#!/usr/bin/env bash
set -euo pipefail

deployment_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
environment_file="${1:-$deployment_dir/.env}"

if [[ ! -f "$environment_file" ]]; then
  echo "Missing $environment_file; copy .env.example and generate secrets first." >&2
  exit 1
fi

required=(
  POSTGRES_PASSWORD JWT_SECRET ANON_KEY SERVICE_ROLE_KEY DASHBOARD_PASSWORD
  SECRET_KEY_BASE REALTIME_DB_ENC_KEY VAULT_ENC_KEY PG_META_CRYPTO_KEY
  SITE_URL SUPABASE_PUBLIC_URL API_EXTERNAL_URL NOORIXFIN_API_PUBLIC_URL
)

declare -A values=()
while IFS='=' read -r key value; do
  [[ "$key" =~ ^[A-Z0-9_]+$ ]] || continue
  values["$key"]="$value"
done < "$environment_file"

for key in "${required[@]}"; do
  value="${values[$key]:-}"
  if [[ -z "$value" ]]; then
    echo "Required setting $key is empty." >&2
    exit 1
  fi
  if [[ "$value" == *your-super-secret* || "$value" == *insecure* || "$value" == *replace-me* ]]; then
    echo "Required setting $key still contains an example value." >&2
    exit 1
  fi
done

if [[ "${values[SITE_URL]}" != https://* && "${values[SITE_URL]}" != http://localhost* ]]; then
  echo "SITE_URL must use HTTPS outside localhost." >&2
  exit 1
fi
if [[ "${values[SUPABASE_PUBLIC_URL]}" != https://* && "${values[SUPABASE_PUBLIC_URL]}" != http://localhost* ]]; then
  echo "SUPABASE_PUBLIC_URL must use HTTPS outside localhost." >&2
  exit 1
fi
if [[ "${values[NOORIXFIN_API_PUBLIC_URL]}" != https://* && "${values[NOORIXFIN_API_PUBLIC_URL]}" != http://localhost* ]]; then
  echo "NOORIXFIN_API_PUBLIC_URL must use HTTPS outside localhost." >&2
  exit 1
fi

if [[ "${values[SMTP_HOST]:-}" == "supabase-mail" || "${values[SMTP_USER]:-}" == "fake_mail_user" ]]; then
  echo "SMTP still uses the non-existent sample relay; configure a real provider." >&2
  exit 1
fi

docker compose --env-file "$environment_file" \
  -f "$deployment_dir/docker-compose.yml" config --quiet

echo "NoorixFin self-host preflight passed."
