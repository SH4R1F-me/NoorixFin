#!/usr/bin/env bash
set -euo pipefail

psql=(psql -v ON_ERROR_STOP=1 --no-psqlrc)

until "${psql[@]}" -Atqc 'select 1' >/dev/null 2>&1; do
  sleep 2
done

"${psql[@]}" <<'SQL'
create table if not exists public.noorixfin_schema_migrations (
  version text primary key,
  checksum text not null,
  applied_at timestamptz not null default now()
);
SQL

for migration in /migrations/*.sql; do
  version="$(basename "$migration")"
  checksum="$(sha256sum "$migration" | cut -d ' ' -f 1)"
  applied_checksum="$("${psql[@]}" -Atqc "select checksum from public.noorixfin_schema_migrations where version = '$version'")"

  if [[ -n "$applied_checksum" ]]; then
    if [[ "$applied_checksum" != "$checksum" ]]; then
      echo "Refusing changed migration $version" >&2
      exit 1
    fi
    continue
  fi

  echo "Applying $version"
  "${psql[@]}" -1 -f "$migration"
  "${psql[@]}" -v version="$version" -v checksum="$checksum" <<'SQL'
insert into public.noorixfin_schema_migrations (version, checksum)
values (:'version', :'checksum');
SQL
done

"${psql[@]}" -Atqc "select count(*) || E'\\tNoorixFin migrations applied' from public.noorixfin_schema_migrations"
