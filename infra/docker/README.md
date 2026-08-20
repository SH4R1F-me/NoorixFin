# Container deployment

This directory contains the production-oriented, single-host Compose deployment
for NoorixFin. It combines the NoorixFin web and API images with the official
Supabase self-host stack pinned to `self-hosted/v0.7.2`.

Start with [the self-hosting runbook](../../docs/SELF_HOSTING.md). Do not expose
the example configuration to the Internet: its credentials are intentionally
insecure and email delivery is a placeholder until `.env` is configured.

## Files

- `docker-compose.yml`: one health-ordered stack for Supabase, migrations, API,
  and web.
- `Dockerfile.api` and `Dockerfile.web`: Node 24.7.0 / pnpm 11.18.0 production
  builds running as the unprivileged `node` user.
- `migrate.sh`: checksum-verified, idempotent migration gate. A changed applied
  migration stops deployment.
- `.env.example`: Supabase and NoorixFin settings; copy to `.env` and rotate all
  secrets before first start.
- `supabase/`: the minimal upstream Docker configuration, preserved with source
  provenance and checksums in `supabase/UPSTREAM.md`.

Validate configuration without starting containers:

```sh
docker compose --env-file infra/docker/.env.example \
  -f infra/docker/docker-compose.yml config --quiet
```
