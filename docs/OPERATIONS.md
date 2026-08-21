# Operations and recovery

## Service-level targets

The default single-host profile targets 99.5% monthly availability, RPO 24
hours, and RTO 4 hours. These are operating targets, not a hosted-service SLA.
Meeting them requires daily off-host backups, health alerting, retained image
versions, and quarterly restore drills. A single host has no high availability.

## Health and alerting

Monitor at least:

- `GET /v1/health/live` for process liveness and `GET /v1/health/ready` for
  routing readiness;
- web, Supabase Auth, REST, Storage, Postgres, and notification worker health;
- disk capacity/inodes, memory pressure, certificate expiry, backup age, and
  dead-letter notification count;
- API error rate/p95 latency and external exporter failures.

Page when readiness fails for five minutes, disk is above 85%, the latest
verified backup exceeds 26 hours, or notification/error-export queues remain
stalled beyond their lease/backoff window.

## Executable performance budgets

The repository carries a dependency-free concurrent HTTP budget runner. Against
the local or staging API, the liveness baseline is 500 requests at concurrency
20 with zero errors, p95 below 100 ms, and p99 below 250 ms:

```sh
pnpm performance:budget
```

CI runs this baseline against the same API process used by the real database
and browser acceptance suites. For an authenticated query path, supply an
opaque test-user token and override the path and risk-based thresholds:

```sh
PERF_PATH=/v1/workspaces/WORKSPACE_ID/sync?limit=100 \
PERF_BEARER_TOKEN=TEST_USER_ACCESS_TOKEN \
PERF_P95_MS=750 PERF_P99_MS=1500 pnpm performance:budget
```

Never use a production user token or run an unapproved load against production.
Record the commit, host shape, dataset scale, concurrency, and JSON output when
changing a budget. Sync queries fetch at most `limit + 1` rows per source and
account exports page at 500 rows into 512 KiB chunks; their unit and SQL tests
enforce those query/memory bounds independently of host speed.

## Daily backup

Create an encrypted destination outside the Docker host. From `infra/docker`,
capture the database, object bytes, manifest, and checksums:

```sh
backup_dir=/secure/off-host/noorixfin/$(date -u +%Y%m%dT%H%M%SZ)
mkdir -p "$backup_dir"
docker compose exec -T db pg_dump -U postgres -d postgres \
  --format=custom --compress=9 > "$backup_dir/postgres.dump"
tar -C supabase/volumes/storage -czf "$backup_dir/storage.tar.gz" .
docker compose images --format json > "$backup_dir/images.json"
git -C ../.. rev-parse HEAD > "$backup_dir/noorixfin.commit"
sha256sum "$backup_dir"/* > "$backup_dir/SHA256SUMS"
```

Encrypt before replication using an organization-approved tool and a key stored
separately. Confirm `sha256sum --check`, inspect `pg_restore --list`, and test the
archive in an isolated restore environment. A command that merely produced a
file is not a verified backup.

For RPO below 24 hours, configure Postgres WAL archiving to encrypted object
storage and version/replicate Storage objects. Monitor both pipelines and retain
base backups compatible with the WAL chain.

## Restore drill

Never test restoration over the only production copy.

1. Provision an isolated host/network with the same pinned deployment commit.
2. Verify `SHA256SUMS` and decrypt the recovery set.
3. Start the database only, restore the custom dump with `pg_restore`, and
   restore object bytes into the Storage path with ownership preserved.
4. Start the remaining stack. Run `pnpm db:check-drift:strict` from a trusted
   checkout and execute the SQL invariant suite.
5. Sign in as a recovery fixture, compare table/object counts, exercise ledger
   read/write/reversal and export, and record actual RPO/RTO.
6. Destroy the isolated copy after retaining redacted evidence.

The repository's `pnpm db:restore-drill` performs an additional automated
logical database drill against the local Supabase fixture. It complements but
does not replace the production database-plus-object restore exercise.

## Incident recovery order

1. Stop writes by removing API/web from the proxy or stopping those services.
2. Preserve logs, image digests, commit identity, and a forensic snapshot.
3. Decide whether to roll back application images, restore data, or rotate
   secrets. Do not mix actions without a timeline.
4. Restore into isolation and validate invariants before directing users to it.
5. Rotate affected database, Supabase, SMTP, push, and exporter credentials.
6. Re-enable traffic gradually, monitor errors/latency, and document data loss
   relative to the last confirmed backup.

## Secret rotation

Database/JWT key rotation affects every Supabase component and can invalidate
sessions. Follow the pinned upstream key-rotation utility in staging, update all
consumers atomically, restart the stack, and verify Auth/REST/Storage before
revoking the old material. SMTP, VAPID, and exporter credentials can be rotated
independently; overlap old/new provider credentials where supported.
