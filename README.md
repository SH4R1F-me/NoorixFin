# NoorixFin

NoorixFin is a free, MIT-licensed personal and household finance system. It
uses an append-only double-entry ledger, Supabase/Postgres with row-level
security, a NestJS API, a Next.js web application, and an Expo mobile client.

Reading A is the supported product boundary: one owner, personal/household
workspaces, self-hosting, strong security and recovery controls, and no billing,
commercial SSO, or shared-tenant administration.

## What is included

- Accounts, categorized transactions, reversals, tags, attachments, import and
  export.
- Budgets, goals, debts, recurring items, calendar, and financial reports.
- English and Bangla web/mobile experiences with currency-safe minor-unit arithmetic.
- Offline-first mobile repositories and a durable mutation queue.
- Admin health, security, audit, notification, release, and observability tools.
- A pinned Docker self-host deployment with migration and recovery runbooks.

## Local development

Requirements: Node.js 22.13 or newer, pnpm 11.18.0, Docker, and at least 8 GB of
available memory for the full local stack.

```sh
corepack enable
pnpm install --frozen-lockfile
DO_NOT_TRACK=1 pnpm exec supabase start
pnpm --filter @noorixfin/api start:dev
pnpm --filter @noorixfin/web dev
```

The web app runs at `http://localhost:3000`, the API at
`http://localhost:8080`, Swagger at `http://localhost:8080/api/docs`, and
Supabase Studio at `http://127.0.0.1:54323`. Copy `.env.example` into each
application's local environment only when the checked-in local defaults do not
fit your setup.

Run the release gates with:

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm security:audit
pnpm performance:budget
pnpm db:check-drift:strict
pnpm db:restore-drill
```

## Self-hosting

Use [docs/SELF_HOSTING.md](docs/SELF_HOSTING.md) for the pinned Docker
deployment, TLS and secrets checklist, migrations, upgrades, rollback, SMTP and
push setup, backup, restore, and disaster recovery. The Supabase CLI stack above
is for development only and must not be exposed publicly.

## Project policies

- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)
- [Support policy](SUPPORT.md)
- [Release artifact verification](docs/security/RELEASE_VERIFICATION.md)
- [Coverage policy](docs/testing/COVERAGE_POLICY.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [MIT licence](LICENSE)

Security vulnerabilities must be reported privately as described in
[SECURITY.md](SECURITY.md), never in a public issue.
