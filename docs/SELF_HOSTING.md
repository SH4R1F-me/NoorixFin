# Self-hosting NoorixFin

This runbook deploys NoorixFin and its data plane on one Docker host. The stack
uses the official Supabase self-host configuration pinned to
`self-hosted/v0.7.2`, Supabase Postgres 17.6.1.136, Node 24.7.0, and pnpm
11.18.0. It is suitable for a personal or household deployment when the
operator provides TLS, backups, monitoring, and host maintenance.

The Supabase CLI stack (`supabase start`) is only a development fixture. Never
expose it as a production service.

## Capacity and prerequisites

- Linux host with 4 CPU cores, 8 GB RAM, and 80 GB SSD recommended.
- Docker Engine 27 or newer with Compose v2.30 or newer.
- A DNS name and HTTPS reverse proxy for web, API, Supabase gateway, and Studio.
- An SMTP provider. Optional push channels also require a VAPID key pair and an
  Expo project/provider configuration.
- A backup destination outside the Docker host.

Pin deployments to a NoorixFin release tag or commit. Do not deploy an
unreviewed moving branch.

## Clean-clone deployment

```sh
git clone https://github.com/SH4R1F-me/NoorixFin.git
cd NoorixFin
git checkout <release-tag-or-commit>
cp infra/docker/.env.example infra/docker/.env
cd infra/docker
sh supabase/utils/generate-keys.sh --update-env
```

Edit `.env` before starting anything:

1. Set `SITE_URL`, `SUPABASE_PUBLIC_URL`, `API_EXTERNAL_URL`, and
   `NOORIXFIN_API_PUBLIC_URL` to their external HTTPS origins. Add allowed Auth
   callback URLs to `ADDITIONAL_REDIRECT_URLS`.
2. Replace the generated dashboard username/password and keep Studio private or
   behind an additional access-control layer.
3. Set the real `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, sender, and
   TLS mode. The example `supabase-mail` host does not exist in production.
4. Generate VAPID keys (`pnpm exec web-push generate-vapid-keys`) if web push is
   enabled. Leave both keys empty to disable that channel explicitly.
5. Set immutable `NOORIXFIN_VERSION` and `NOORIXFIN_COMMIT` values.
6. Configure `ERROR_EXPORT_URL` only for an HTTPS endpoint you operate or trust;
   exported events are redacted but remain operational metadata.

Never commit `.env`. Store a sealed copy of the generated secrets in a password
manager and restrict the file to the deployment account:

```sh
chmod 600 .env
./preflight.sh
docker compose pull
docker compose build --pull api web
docker compose up -d
```

The `migrate` service waits for Auth and Storage, obtains a database advisory
sequence through Compose ordering, applies each NoorixFin migration once, and
records its SHA-256 checksum. An edited historical migration stops startup.
API waits for successful migrations; web waits for API readiness.

Verify every public and internal boundary:

```sh
docker compose ps
curl --fail --silent --show-error https://api.example.com/v1/health/ready
curl --fail --silent --show-error https://app.example.com/
curl --fail --silent --show-error https://data.example.com/auth/v1/health
```

Keep Postgres/Supavisor, Storage, and Studio ports off the public firewall. Only
the TLS proxy should reach the published web/API/gateway listeners. Terminate
TLS with modern ciphers, redirect HTTP to HTTPS, and preserve `X-Forwarded-Proto`
and the client IP. Rate-limit Auth and API endpoints at the proxy in addition to
application throttling.

## Migrations and upgrades

Before every upgrade:

1. Read NoorixFin release notes and the vendored Supabase `versions.md`.
2. Take and verify a database plus storage backup using the operations runbook.
3. Record `docker compose images --digests` and the current Git commit.
4. Pull the target tag/commit, run `./preflight.sh`, render Compose with
   `docker compose config`, then build/pull images.
5. Run `docker compose up -d`; watch `migrate`, `api`, and `web` health before
   removing the old application images.
6. Execute an authenticated smoke test: sign in, read accounts, add and reverse
   a small test transaction, download an export, and sign out.

Application rollback is `git checkout <previous-commit>` followed by rebuild and
`docker compose up -d api web` when no migration ran. Database migrations are
forward-only. If an upgrade migration changed data incompatibly, restore the
pre-upgrade database and storage snapshot instead of editing or deleting the
migration record.

Supabase upgrades must follow the pinned upstream `update.sh`/`upgrades.json`
instructions in a staging copy first. Never change a single Supabase image tag
without checking the release's coordinated version matrix.

## Notifications

Auth email and NoorixFin notification email share the configured SMTP relay.
Use a dedicated credential with the minimum allowed sender scope, enforce TLS,
and verify SPF, DKIM, and DMARC. Failed notification deliveries are retained
with bounded exponential backoff and dead-letter visibility in the admin UI.

Web push requires a VAPID public/private pair. The private key belongs only in
the API environment. Mobile Expo push requires a configured EAS project and
provider credentials; leaving those settings empty disables delivery without
breaking in-app notifications.

## Backup, restore, and disaster recovery

Follow [OPERATIONS.md](OPERATIONS.md). A complete recovery set contains:

- a custom-format `pg_dump` of the entire Postgres database;
- the Storage object directory or an independently versioned S3 bucket;
- SHA-256 checksums and the NoorixFin/Supabase image and commit inventory; and
- an encrypted copy of deployment secrets kept separately from the data.

For a household deployment, the baseline target is RPO 24 hours and RTO 4
hours. Operators who need a lower RPO must add encrypted WAL archiving and
continuous storage replication; Compose does not claim point-in-time recovery
by default. Run a restore drill at least quarterly and after database or storage
version changes.

## Uninstall

`docker compose down` removes containers and networks but retains the bind
mounted database and storage. `docker compose down -v` and deleting
`supabase/volumes/db/data` or `supabase/volumes/storage` destroys data. Take and
verify an off-host backup before any destructive cleanup.
