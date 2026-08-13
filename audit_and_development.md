# NoorixFin — Enterprise Audit & Master Development Plan

**Date:** 2026-08-08
**Audited revision:** `310e1dd` (branch `main`, clean tree)
**Scope:** Landing pages · User Dashboard · Super Admin Panel · REST API · Database · Mobile App

---

## How to read this document

This audit was produced by **reading the source and querying the running local
database**, not by reading the project's own planning documents. Where this
document and [`ARCHITECTURE.md`](ARCHITECTURE.md) or
[`memory/MASTER_PLAN.md`](memory/MASTER_PLAN.md) disagree, the disagreement is
called out explicitly rather than smoothed over — see
[§0.4 Documentation drift](#04-documentation-drift-found-during-this-audit).

Everything in **Part 0** is *verified present behaviour*. Everything from
**Part 1** onward is *proposed*. That line is kept sharp on purpose: a roadmap
that blurs "what exists" into "what we want" is how a team ships the same
feature twice.

A note on the phrase "enterprise-grade." It is not one thing, and for this
project it pulls in two directions at once — see
[§1.0 What "enterprise-grade" costs here](#10-what-enterprise-grade-costs-here)
before committing to the roadmap. The single most consequential finding in this
audit is not a missing feature; it is that the **mobile app is a prototype, not
a product** (§0.3), and several sections below depend on that being fixed first.

---

# Part 0 — Verified baseline

## 0.1 What is genuinely strong

The foundation is better than most projects at this stage. These are load-bearing
strengths that the roadmap should *preserve*, not refactor:

| Area | Evidence |
|---|---|
| **Double-entry ledger with append-only history** | `journal_entries` + `journal_postings` summing to zero; corrections are reversals via `POST /transactions/:id/reverse`, never edits ([00019_reverse_entry_atomic.sql](supabase/migrations/00019_reverse_entry_atomic.sql)) |
| **Money as integer minor units** | `@noorixfin/money`, decimal-string on the wire — no float anywhere |
| **Layered authorization** | CORS → `SupabaseAuthGuard` → `IdentityThrottlerGuard` → `ValidationPipe` (`forbidNonWhitelisted`) → `WorkspaceMemberGuard` → Postgres RLS |
| **`SUPER_ADMIN` does not bypass tenant isolation** | Operators get metadata endpoints, never ambient ledger access (DEC-007, DEC-013, DEC-016) |
| **Local JWT verification via JWKS** | [`auth/jwt-verifier.service.ts`](apps/api/src/auth/jwt-verifier.service.ts) — no per-request Auth round trip |
| **Dual idempotency, correctly separated** | Ledger writes use a DTO `idempotency_key` field hashed into a UNIQUE index; admin writes use the `Idempotency-Key` header via `IdempotencyInterceptor` |
| **Offline-first sync with a durable outbox** | [`sync/engine.ts`](apps/mobile/src/sync/engine.ts) — push-before-pull, at-least-once pull, failures parked as `NEEDS_ATTENTION` rather than silently merged |
| **CI proves the database, not just the code** | 3 jobs: static, migrations-from-scratch + SQL invariants, and e2e run **twice** — once normally, once with the API deliberately unreachable |
| **Operator console already exists** | 25 admin routes, an SSE live event feed, `system_events` + `audit_events` separation (DEC-018), `pg_cron` jobs with an `alert_state` table |
| **Type-safe i18n with CI-enforced parity** | `bn` ↔ `en` key drift fails the build |

## 0.2 Current inventory

**API — 10 controllers, ~70 routes** (`/v1` prefix; `GET /health` is the only public route)

```
health · profiles(/me) · account(/me/*, /settings/public) · workspaces
accounts · categories · transactions(+tags) · planning(budgets/goals/calendar/recurring/reports)
sync · admin(25 routes)
```

**Web — Next.js 16 App Router**

- Marketing (15 pages): `/`, features, open-source, docs, community, security, support, about, contact, faq, roadmap, changelog, contribute, bug-report
- Dashboard (9 pages): overview, transactions, accounts, categories, budgets, calendar, goals, reports, settings
- Admin (6 pages): overview, monitoring, audit, users, broadcasts, site-settings, settings
- Auth: login, forgot-password, callback; onboarding
- **Shared components: 4 total** — `broadcast-banner`, `error-state`, `not-yet-available`, `skeleton`

**Database — 21 migrations, 24 public tables**

```
profiles · workspaces · workspace_members · ledger_accounts · journal_entries
journal_postings · journal_entry_tags · tags · categories · budgets · budget_lines
savings_goals · calendar_events · recurring_rules · debt_details
app_settings · site_settings · donation_options · broadcasts · broadcast_receipts
system_events · audit_events · alert_state · idempotency_records
```

**Mobile — Expo Router, 3 screens total:** `_layout.tsx`, `index.tsx`, `sign-in.tsx`

**Tests:** 26 `.spec.ts` + 2 `.test.ts` (7 API suites, 13 sync-engine tests), 20 Playwright e2e specs, SQL invariants for tenant isolation / ledger balance / idempotency.

## 0.3 The three structural findings

These are not feature gaps. They are shape problems that constrain everything else.

### Finding A — The mobile app is a prototype, not a product

`apps/mobile` contains **one functional screen** (a transactions list) plus a
sign-in screen. There is no tab navigator, no account list, no add-transaction
form, no budgets, no goals, no settings, no profile.

Worse, the active workspace is **hardcoded from an environment variable**:

```ts
// apps/mobile/app/index.tsx:20
const WORKSPACE_ID = process.env.EXPO_PUBLIC_DEV_WORKSPACE_ID ?? '';
```

The file's own comment is honest about this — `TODO(W4-followup)` — but the
consequence is that the app cannot be handed to a real user at all. The
sophisticated sync engine underneath it is production-quality; the UI on top of
it is a harness for testing that engine.

**Every mobile-facing item in this roadmap (§3 device monitoring, §4
distribution, §5 push notifications) is blocked on building a real app first.**
Section 4's download page would otherwise link to a binary with nothing in it.

### Finding B — A workspace can have exactly one member, with exactly one role

```sql
workspace_members_role_check  CHECK ((role = 'OWNER'::text))
```

There is no `MEMBER`, no `VIEWER`, no invitation flow, no pending-membership
state (`status` allows `ACTIVE`/`SUSPENDED`/`LEFT`, but nothing ever creates a
non-owner row). This was a deliberate scope cut — migrations `00003` and `00004`
are literally named `simplify_roles` and `two_role_cleanup` — but it means:

- A household cannot share a budget. A couple cannot co-manage money.
- The word "workspace" currently describes a container with a permanent
  population of one.
- Any B2B or team story is not a feature away; it is a schema change,
  an RLS rewrite, an invitation system, and a permissions matrix away.

This is the **single largest gap between the current system and "enterprise."**
It is also the one most worth questioning — see §1.0.

### Finding C — There is no notification system of any kind

Grep across `apps/`, `packages/`, and `supabase/migrations/` finds **zero**
notification infrastructure: no `notifications` table, no `expo-notifications`
dependency, no push-token storage, no Web Push / VAPID keys, no in-app
notification centre, no email transport beyond Supabase Auth's own mails.

The closest existing thing is **broadcasts** — an operator composes a message,
publishes it to an audience, and `broadcast-banner.tsx` renders it. That is a
one-way announcement channel, not a notification system. It cannot tell a user
"your budget is 90% spent" or "a recurring rule just posted."

Section 5 designs this from zero.

## 0.4 Documentation drift found during this audit

Recorded so the next reader does not lose an hour to them:

| # | Drift | Reality |
|---|---|---|
| 1 | `ARCHITECTURE.md` §9 and `.env.example` say the API listens on **3001** | `apps/api/.env.local` sets `API_PORT=8080`, and web's `NEXT_PUBLIC_API_URL` points at 8080. The running system is on **8080**; Swagger is at `:8080/api/docs`, not `:3001/api/docs`. The code default in [`main.ts:86`](apps/api/src/main.ts:86) is 3001, so only the docs and the example file are stale. |
| 2 | Migration `00021_site_settings.sql` was **on disk but never applied** to the local database | Applied during this session via `supabase migration up --local`. Without it, `/admin/site-settings` queries tables that do not exist. Worth a CI check that local dev DBs are not silently behind. |
| 3 | `ARCHITECTURE.md` §2 says "21 ordered SQL migrations" and MASTER_PLAN says "3 migrations" | 21 is correct; `memory/MASTER_PLAN.md`'s audit table is from Session 3 and was never refreshed. |
| 4 | `packages/api-client` is described as "reserved for a generated OpenAPI client" | Its build script is `echo 'TODO: OpenAPI client generation'`. Web and mobile each hand-maintain a separate `apiFetch`. |

---

# Part 1 — Enterprise Feature Gap Analysis

## 1.0 What "enterprise-grade" costs here

Before the gap list, one tension worth deciding deliberately, because it changes
what belongs in the roadmap at all.

`memory/MASTER_PLAN.md` records the **Supabase Free Tier as an explicit design
constraint** (DEC-011), and the marketing site's entire promise is *"100% free,
no subscription, no ads, self-hostable, MIT."* Several canonical enterprise
features are in direct conflict with that promise:

| Enterprise feature | Conflict |
|---|---|
| SAML / OIDC SSO, SCIM provisioning | Supabase SSO is a **paid Pro/Team** feature; self-hosters can have it, the hosted free instance cannot |
| Long audit retention (1–7 years) | Free-tier storage and the existing `prune_system_events()` job are sized for days, not years |
| Real-time push at scale | FCM/APNs are free, but the *delivery worker* needs always-on compute the free tier does not provide |
| SOC 2 / ISO 27001 posture | An organisational and audit-cost problem, not a code problem |
| 99.9% SLA, multi-region | Requires paid infrastructure by definition |

There are two coherent readings of "enterprise-grade," and they produce
different roadmaps:

- **Reading A — "Enterprise-quality for individuals."** Rigour, observability,
  security, accessibility, and reliability at an enterprise standard, serving
  the same free single-user/household audience. Everything below is achievable
  on free or self-hosted infrastructure.
- **Reading B — "Sellable to organisations."** Adds multi-tenancy with roles,
  SSO, contractual retention, SLAs, and a billing surface — which means a paid
  tier, which changes the product's public promise.

**Reading A was ratified on 2026-08-14** (DEC-025). Reading B items marked
`[B-only]` and the whole of Phase 6 are permanently excluded from this roadmap.
Household finance remains a first-class use case under a single workspace
owner; shared tenancy, commercial billing, and paid SaaS constraints are not
part of NoorixFin.

## 1.1 Gap register

Severity: **P0** blocks a credible enterprise claim · **P1** expected by any serious user · **P2** competitive polish.

### Security & identity

| # | Gap | Current state | Severity |
|---|---|---|---|
| S1 | **No HTTP security headers** — no CSP, HSTS, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` | [`next.config.ts`](apps/web/next.config.ts) contains only a `turbopack.root` setting | **P0** |
| S2 | **No session/device management** — a user cannot see where they are logged in, and cannot revoke a stolen session | No `user_devices` or `user_sessions` table exists | **P0** |
| S3 | **MFA is optional and TOTP-only** — no recovery codes, no enforcement policy, no WebAuthn/passkeys | [`mfa-actions.ts`](apps/web/src/app/auth/mfa-actions.ts) enrolls/verifies TOTP; `admin/mfa-gate.tsx` gates the console | **P1** |
| S4 | **No suspicious-activity detection** — no impossible-travel, no new-device alert, no brute-force lockout beyond the generic throttler | `IdentityThrottlerGuard` is a flat rate limiter (10/s, 100/min, 1000/hr) | **P1** |
| S5 | **`audit_events` has `ip_address` but no `user_agent`, device, or platform** | Column list confirmed against the live schema | **P1** |
| S6 | **No secrets rotation or key-management story**; service-role key lives in a `.env.local` | — | **P1** |
| S7 | **No documented data-retention or GDPR/DPA posture** beyond the 30-day deletion grace (DEC-017) | Export and deletion exist and work; the *policy* does not | **P1** |
| S8 | `[B-only]` **No SSO/SAML/SCIM** | — | P2 |

### Reliability & operations

| # | Gap | Current state | Severity |
|---|---|---|---|
| R1 | **No error tracking or APM** — no Sentry, OpenTelemetry, Prometheus, or equivalent in any `package.json` | `system_events` is a home-grown log table; useful, but it has no traces, no release tagging, and no stack-trace grouping | **P0** |
| R2 | **No backup/restore verification** — `supabase/BACKUP_RESTORE.md` documents the procedure; nothing tests it | A backup never restored is a hypothesis | **P0** |
| R3 | **`system_events` cannot distinguish a client** — no `platform`, `app_version`, `device_id`, or `session_id` columns | This is what blocks §3's mobile monitoring | **P0** |
| R4 | **Only one alert rule exists** (`check_error_rate_alert()`), with no delivery channel — it flips a row in `alert_state` and nothing reads it | [`00017_scheduler_and_alerting.sql`](supabase/migrations/00017_scheduler_and_alerting.sql) | **P1** |
| R5 | **No `/health` depth** — the public probe returns `{status, timestamp, version}` with no dependency checks; the *rich* health check is admin-only | [`health.controller.ts`](apps/api/src/health/health.controller.ts) vs `admin/health` | **P1** |
| R6 | **No graceful-shutdown / readiness split**, no `SIGTERM` drain | — | **P1** |
| R7 | **No load or soak testing**; no documented capacity envelope | — | **P2** |

### Product & data

| # | Gap | Current state | Severity |
|---|---|---|---|
| P1a | **No multi-user workspaces** — see Finding B | `role CHECK (role = 'OWNER')` | **P0** |
| P2a | **No notification system** — see Finding C | — | **P0** |
| P3a | **No bulk import** (CSV/OFX/QIF) and export is JSON-only | `/me/export` produces a full JSON dump | **P1** |
| P4a | **No attachments/receipts** — no file upload on a transaction | A `site-assets` bucket exists for logos only | **P1** |
| P5a | **No search** — no global search across transactions, accounts, categories, tags | Transactions list supports filters only | **P1** |
| P6a | **No multi-currency in practice** — `base_currency` exists per workspace/profile, but there is no FX rate table and no conversion path | `@noorixfin/money` has currency metadata but no rates | **P1** |
| P7a | **Reports are one endpoint** (`reports/categories`) — no cash-flow statement, net-worth trend, income-vs-expense over time, or custom date ranges | — | **P1** |
| P8a | **No scheduled/exported reports** (email me a monthly PDF/CSV) | — | **P2** |
| P9a | **Only 2 locales** (en, bn); no RTL support | — | **P2** |

### Engineering & delivery

| # | Gap | Current state | Severity |
|---|---|---|---|
| E1 | **`packages/api-client` is a stub** — web and mobile hand-maintain duplicate clients that can drift from the API | Build script is an `echo` | **P1** |
| E2 | **No design system** — 4 shared web components; pages use inline `style={{}}` objects extensively | `apps/web/src/components/` | **P1** |
| E3 | **No component/visual testing** — no Storybook, no snapshot tests | 20 e2e specs carry the whole UI burden | **P1** |
| E4 | **No mobile CI** — the `test` job runs `jest --passWithNoTests`; there is no EAS build, no store pipeline | [`ci.yml`](.github/workflows/ci.yml) | **P0** for §4 |
| E5 | **Prettier/ESLint config duplicated** between api and web | Already recorded in `ARCHITECTURE.md` §12 | **P2** |
| E6 | **No API deprecation policy** despite `/v1` URI versioning being in place | — | **P2** |

---

# Part 2 — Menu & Navigation Architecture

## 2.1 Design principles

1. **Depth ≤ 2.** A sidebar group may have children; children may not.
2. **Settings is a hub, not a page.** The current single-page
   `/dashboard/settings` will not survive the additions below.
3. **Never render a menu item that 403s.** Gate by capability, not by hope.
4. **Every destructive operator action requires an idempotency key and writes an
   audit row.** This is already true of admin writes; keep it true as the
   surface grows.

## 2.2 User Dashboard — target navigation

Current (9 flat items, [`dashboard-shell.tsx:40`](apps/web/src/app/dashboard/dashboard-shell.tsx:40)):
`Dashboard · Transactions · Accounts · Categories · Budgets · Calendar · Goals · Reports · Settings`

Proposed — 5 groups, existing routes preserved, `NEW` marks additions:

```
🏠  Overview                          /dashboard

💸  Money
    ├── Transactions                  /dashboard/transactions
    ├── Accounts                      /dashboard/accounts
    ├── Categories                    /dashboard/categories
    ├── Tags                     NEW  /dashboard/tags
    └── Import & Export          NEW  /dashboard/import

📊  Plan
    ├── Budgets                       /dashboard/budgets
    ├── Goals                         /dashboard/goals
    ├── Recurring                NEW  /dashboard/recurring     (today: a panel inside Calendar)
    ├── Calendar                      /dashboard/calendar
    └── Debts                    NEW  /dashboard/debts         (debt_details table exists, unsurfaced)

📈  Insights
    ├── Reports                       /dashboard/reports
    ├── Cash Flow                NEW  /dashboard/reports/cash-flow
    ├── Net Worth                NEW  /dashboard/reports/net-worth
    └── Scheduled Reports        NEW  /dashboard/reports/scheduled

👥  Workspace                    NEW  (hidden until multi-member ships — Finding B)
    ├── Members & Invites        NEW  /dashboard/workspace/members
    ├── Roles & Permissions      NEW  /dashboard/workspace/roles
    └── Workspace Settings       NEW  /dashboard/workspace/settings

⚙️  Settings  →  hub at /dashboard/settings
    ├── Profile                       /dashboard/settings            (exists)
    ├── Preferences              NEW  /dashboard/settings/preferences   (locale, timezone, currency, week start, privacy default)
    ├── Security                 NEW  /dashboard/settings/security      (password, MFA, recovery codes, passkeys)
    ├── Sessions & Devices       NEW  /dashboard/settings/sessions      (gap S2)
    ├── Notifications            NEW  /dashboard/settings/notifications (gap P2a — §5)
    ├── Connected Apps           NEW  /dashboard/settings/connections   (Google identity linking — partly wired)
    ├── Data & Privacy           NEW  /dashboard/settings/data          (export, deletion request — exists, needs its own page)
    └── Mobile App               NEW  /dashboard/settings/mobile        (§4 — download + device pairing)
```

**Persistent chrome additions:**

| Element | Placement | Purpose |
|---|---|---|
| 🔔 Notification bell + unread badge | Top bar, all dashboard routes | §5 |
| 🔎 Global search (`⌘K` / `Ctrl-K`) | Top bar | Gap P5a |
| Workspace switcher | Top-left | Meaningless until Finding B is fixed; build it with the members work |
| Sync/offline indicator | Top bar | Web parity with the mobile status strip |

## 2.3 Super Admin Panel — target navigation

Current (7 flat items, [`admin-shell.tsx:33`](apps/web/src/app/admin/admin-shell.tsx:33)):
`Overview · Monitoring · Audit · Users · Broadcasts · Site Settings · Global Settings`

Proposed — 6 groups:

```
🛡️  Overview                          /admin

📡  Monitoring
    ├── Live Events                   /admin/monitoring          (SSE feed — exists)
    ├── System Health                 /admin/monitoring/health   (promote from a card to a page)
    ├── Performance              NEW  /admin/monitoring/performance   (p50/p95/p99 latency, error rate, throughput)
    ├── Scheduled Jobs           NEW  /admin/monitoring/jobs     (admin_scheduled_jobs() exists, no page)
    ├── Alerts                   NEW  /admin/monitoring/alerts   (alert_state exists, no page — gap R4)
    └── API Usage                NEW  /admin/monitoring/api      (per-endpoint, per-client, throttle hits)

📱  Client Telemetry             NEW  (§3 — the mobile-usage requirement)
    ├── Devices                  NEW  /admin/clients/devices
    ├── App Versions             NEW  /admin/clients/versions    (adoption + forced-upgrade floor)
    ├── Sync Health              NEW  /admin/clients/sync        (queue depth, NEEDS_ATTENTION, conflicts)
    └── Crashes & ANRs           NEW  /admin/clients/crashes

🔐  Security                     NEW
    ├── Security Dashboard       NEW  /admin/security
    ├── Auth Events              NEW  /admin/security/auth       (logins, failures, MFA, lockouts)
    ├── Active Sessions          NEW  /admin/security/sessions   (global; force-revoke)
    ├── Threats & Anomalies      NEW  /admin/security/threats
    └── Access Reviews           NEW  /admin/security/access     (who holds SUPER_ADMIN, and since when)

👤  People
    ├── Users                         /admin/users               (exists)
    ├── User Detail                   /admin/users/:id           (exists)
    ├── Workspaces               NEW  /admin/workspaces
    └── Deletion Queue           NEW  /admin/users/deletions     (30-day grace — visible, not just cron'd)

📣  Communications
    ├── Broadcasts                    /admin/broadcasts          (exists)
    ├── Notifications            NEW  /admin/notifications       (§5 — compose, target, schedule)
    ├── Templates                NEW  /admin/notifications/templates
    └── Delivery Log             NEW  /admin/notifications/delivery  (sent/delivered/opened/failed)

📜  Governance
    ├── Audit Trail                   /admin/audit               (exists)
    ├── Data Retention           NEW  /admin/governance/retention
    └── Compliance Export        NEW  /admin/governance/export

⚙️  Configuration
    ├── Global Settings               /admin/settings            (exists)
    ├── Site Settings                 /admin/site-settings       (exists)
    ├── Mobile Releases          NEW  /admin/config/releases     (§4 — store links, APK, changelog, min version)
    ├── Feature Flags            NEW  /admin/config/flags
    └── Maintenance Mode         NEW  /admin/config/maintenance  (setting exists; give it a page)
```

## 2.4 Mobile app — target navigation

From 3 screens to a real app. Bottom tabs + stacks:

```
[ Home ]  [ Transactions ]  [ Add + ]  [ Plan ]  [ More ]

Home           net worth, this-month spend, budget rings, recent activity, sync status
Transactions   list · filter · search · detail · reverse
Add (+)        modal: amount pad → category → account → date → note → tags → attachment
Plan           budgets · goals · calendar · recurring · debts
More           accounts · reports · notifications · settings
                 └ settings: profile · preferences · security · sessions · notifications ·
                             offline & sync · data & privacy · about
```

Plus first-run **workspace selection** (kills the hardcoded `EXPO_PUBLIC_DEV_WORKSPACE_ID`),
biometric app-lock, and an offline banner that is honest about queue depth.

---

# Part 3 — Super Admin Monitoring

The requirement is deep visibility into user activity, **mobile app usage**,
system logs, and security metrics. Two thirds of the plumbing exists; the mobile
third does not exist at all.

## 3.0 The constraint that shapes this section

**`system_events` cannot tell a web request from a mobile one.** Its columns are
`level, source, event_code, message, request_id, actor_id, route, method,
status_code, latency_ms, metadata, created_at`. There is no `platform`, no
`app_version`, no `device_id`. Every "mobile usage" dashboard below is blocked
on adding that dimension (gap R3) — this is the **first task in Phase 2**, and
it is small: a client-identification header plus four nullable columns.

**A boundary to hold.** DEC-016 makes the operator console *metadata-only* —
operators never see a user's ledger. That principle must survive this expansion.
"Deeply monitor user activities" means **behavioural and operational telemetry**
(which screens, which versions, which errors, which sessions), never transaction
contents. Concretely: log `event_code = 'TXN_CREATED'` with a workspace id and a
latency; never log the amount, the payee, or the note. The audit below is worth
having precisely because it is not surveillance of people's finances.

## 3.1 Client identification — the enabling change

Every client sends a structured header on every request:

```
X-Client-Info: platform=ios; app_version=1.4.2; build=142; os=17.4; device_id=<opaque-uuid>
```

- `device_id` is an **opaque, app-generated UUID** stored in SecureStore — not an
  IDFA/advertising ID, not a hardware serial. It is rotated on reinstall and on
  explicit "reset device identity."
- The API parses this in a new `ClientContextMiddleware` and attaches it to the
  request; `LoggingInterceptor` and `system-events.service.ts` persist it.

**Schema change (migration `00022_client_telemetry`):**

```sql
ALTER TABLE public.system_events
  ADD COLUMN platform    TEXT,        -- 'web' | 'ios' | 'android' | 'api'
  ADD COLUMN app_version TEXT,
  ADD COLUMN device_id   UUID,
  ADD COLUMN session_id  UUID;

ALTER TABLE public.audit_events
  ADD COLUMN user_agent  TEXT,
  ADD COLUMN platform    TEXT,
  ADD COLUMN device_id   UUID;

CREATE TABLE public.user_devices (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id         UUID NOT NULL,
  platform          TEXT NOT NULL CHECK (platform IN ('web','ios','android')),
  device_name       TEXT,            -- user-editable: "Sharif's Pixel"
  os_version        TEXT,
  app_version       TEXT,
  push_token        TEXT,            -- §5
  push_provider     TEXT CHECK (push_provider IN ('expo','fcm','apns','webpush')),
  last_seen_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_ip           INET,
  first_seen_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at        TIMESTAMPTZ,
  UNIQUE (user_id, device_id)
);
```

`user_devices` is the join between §3 (monitoring), §5 (push delivery), and the
user-facing Sessions & Devices page (gap S2). Build it once.

## 3.2 Monitoring surfaces

### A. Performance (`/admin/monitoring/performance`)

Fed by `system_events.latency_ms`, which is already populated.

- Request volume, error rate, and **p50/p95/p99 latency** — overall, per route,
  per platform, over a selectable window
- Slowest endpoints table; throttle-rejection counts by user tier
- Database probe latency trend (the `probe()` helper in `admin.service.ts`
  already measures this — it is just never stored)
- Apdex-style score with a configurable target

### B. Client telemetry (`/admin/clients/*`)

- **Devices** — active devices by platform/OS/app version; DAU/WAU/MAU by
  platform; new vs returning; last-seen distribution
- **App Versions** — adoption curve per release; % on the current version;
  **minimum supported version** control that drives a forced-upgrade screen
- **Sync Health** — this is the one nobody else can give you, and the mobile
  architecture makes it cheap: outbox queue depth distribution,
  `NEEDS_ATTENTION` rate and reasons, push-failure and 409-conflict rates,
  average time-to-drain, and the count of users stuck offline > 24h
- **Crashes & ANRs** — JS exceptions and native crashes with stack traces,
  grouped by fingerprint, tagged with release (requires R1's error tracker)

### C. System logs (`/admin/monitoring` — extend what exists)

The SSE live feed is good. Add:

- Faceted filtering (level × source × platform × route × status × actor)
- Full-text search over `message`
- **Correlated trace view** — click an `X-Request-ID` and see every event, audit
  row, and error for that request, across client and server
- Saved views and CSV/NDJSON export
- Retention shown honestly per level, with the prune schedule visible

### D. Security metrics (`/admin/security/*`)

| Panel | Signals |
|---|---|
| Security dashboard | Failed-login rate, lockouts, MFA coverage %, active `SUPER_ADMIN` count, unresolved alerts, open deletion requests |
| Auth events | Login success/failure, provider used, MFA challenge outcomes, password resets, email changes — with device and IP |
| Active sessions | Every live session platform-wide; force-revoke one user, one device, or all |
| Threats & anomalies | New-device logins, impossible travel, credential-stuffing patterns, throttle-limit abusers, privilege-escalation attempts, RLS denials |
| Access reviews | Who holds `SUPER_ADMIN`, granted by whom and when; quarterly attestation with an audit trail |

### E. Alerting (`/admin/monitoring/alerts`) — gap R4

`alert_state` and `check_error_rate_alert()` already exist and run on `pg_cron`.
What is missing is (a) more rules and (b) anywhere for a firing alert to go.

Rules to add: p95 latency breach · sync failure rate · auth failure spike ·
job failure/overrun · database latency · storage quota · crash-rate spike.

Delivery: reuse §5's notification pipeline with an `OPERATOR` audience, so an
alert reaches admins by push/email/in-app rather than sitting in a table. Include
severity routing, acknowledge/resolve with an actor, and suppression windows so
one incident does not page ten times.

---

# Part 4 — Mobile App Distribution

## 4.0 Sequencing honesty

**This section must not ship before the mobile app is real (Finding A).** A
polished download page that installs a one-screen prototype does more brand
damage than no download page at all. Build Phase 3 (mobile app), then this.

## 4.1 Where downloads appear

| Surface | Treatment |
|---|---|
| **Landing hero** | Secondary CTA row under the existing buttons: two store badges + "Direct APK". Never above the primary "Get started free" CTA. |
| **`/download`** `NEW` | Dedicated page — the canonical link, the one that goes in the README and social posts |
| **Marketing nav** | A "Get the app" item, or an icon in the utility cluster next to GitHub |
| **Marketing footer** | "Download" column: iOS · Android · APK · Release notes · System requirements |
| **`/dashboard/settings/mobile`** `NEW` | Signed-in: QR pairing code, device list, download links |
| **Post-onboarding** | A dismissible "Continue on mobile" card with a QR code |
| **`/docs`** | An install section |

## 4.2 `/download` page structure

```
┌──────────────────────────────────────────────────────────┐
│  Hero:  device mockup  |  "NoorixFin on your phone"      │
│         Offline-first · Your data stays yours · Free      │
│         [ App Store ]  [ Google Play ]  [ Direct APK ]    │
│         ↑ platform-detected: the user's own platform      │
│           is emphasised, the others stay visible          │
├──────────────────────────────────────────────────────────┤
│  QR code — "Scan to install"                              │
├──────────────────────────────────────────────────────────┤
│  Feature strip: works offline · biometric lock · instant  │
│                 sync · Bangla & English                   │
├──────────────────────────────────────────────────────────┤
│  Version card:  v1.4.2 · 24 MB · released 12 Mar 2026     │
│                 SHA-256 fingerprint (APK)                 │
│                 [ Release notes ]  [ All releases ]       │
├──────────────────────────────────────────────────────────┤
│  Requirements: iOS 15+ · Android 8.0+                     │
├──────────────────────────────────────────────────────────┤
│  APK safety note — how to verify the checksum, why        │
│  "unknown sources" is required, and that F-Droid is       │
│  the preferred route once listed                          │
└──────────────────────────────────────────────────────────┘
```

**UX rules that matter here:**

1. **Platform detection assists, never restricts.** Show all three; emphasise
   one. A desktop visitor gets the QR code promoted instead.
2. **Never render a dead store badge.** Before a listing is live, the badge
   becomes a "Coming to the App Store" state with an email-notify capture.
   `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED` already establishes this pattern — reuse
   the discipline.
3. **The APK link must publish its SHA-256** and be served over HTTPS from a
   pinned origin (GitHub Releases is the honest default for an MIT project).
   A direct APK download without a published checksum teaches users a bad habit.
4. **Store badges must follow Apple's and Google's brand guidelines** — official
   assets, minimum clear space, no recolouring. Ship them as local SVGs, not
   hotlinks.
5. **Accessibility:** badges are links with real text alternatives
   (`aria-label="Download NoorixFin on the App Store"`), not bare images. The QR
   code carries a visible URL beneath it for anyone who cannot scan.
6. **Localise the badges** — Apple and Google both publish Bangla variants.

## 4.3 Operator control — `/admin/config/releases`

Store links and APK URLs must not be hardcoded in JSX. They belong in
`site_settings` (the table exists) behind an admin page:

```
site.mobile.ios_url · site.mobile.android_url · site.mobile.apk_url
site.mobile.apk_sha256 · site.mobile.latest_version · site.mobile.min_version
site.mobile.release_notes_url · site.mobile.ios_status · site.mobile.android_status
```

`min_version` is the forced-upgrade floor read by the mobile app at launch, and
it is the reason this page is operational rather than cosmetic: it lets you
retire a client with a known sync bug without shipping anything.

**New API:** `GET /v1/releases/mobile` — public, cached, returns latest/minimum
version, download URLs, and the checksum. The app calls it on launch; the web
`/download` page renders from it.

## 4.4 Build & release pipeline (gap E4)

`EAS Build` → internal distribution → TestFlight / Play Internal Testing →
production, with an `EAS Update` OTA channel for JS-only fixes. CI gains a
mobile job: typecheck, jest, and a build on tagged releases. The APK artifact
and its checksum publish to GitHub Releases, which is what `site_settings`
points at.

---

# Part 5 — Global Notification System

Designed from zero (Finding C). One pipeline serves user notifications, operator
alerts, and the existing broadcast feature.

## 5.1 Architecture

```
  EVENT SOURCES                    PIPELINE                      CHANNELS
┌────────────────┐         ┌──────────────────────┐      ┌────────────────────┐
│ Ledger writes  │         │ 1. Event emitted     │      │ In-app (bell)      │
│ Budget engine  │────────▶│ 2. Rules matched     │─────▶│ Web Push (VAPID)   │
│ Recurring cron │         │ 3. User prefs applied│      │ Mobile Push (Expo) │
│ Goal progress  │         │ 4. Quiet hours/dedupe│      │ Email (SMTP)       │
│ Security events│         │ 5. Fan out to devices│      │ Operator alerts    │
│ Sync failures  │         │ 6. Delivery tracked  │      └────────────────────┘
│ Admin alerts   │         └──────────────────────┘
│ Broadcasts     │                    │
└────────────────┘         ┌──────────▼───────────┐
                           │ notifications        │  ← durable, per-user
                           │ notification_        │  ← per-channel outcome
                           │   deliveries         │
                           │ notification_        │  ← per-user, per-category
                           │   preferences        │
                           └──────────────────────┘
```

**Two design decisions worth recording as `DEC-0xx`:**

1. **Realtime carries a payload-free hint, not the notification.** This matches
   DEC-011's existing use of Supabase Realtime for sync invalidation: the client
   is told "you have something new" and fetches over the authenticated API. It
   keeps financial content off the Realtime transport and keeps egress low.
2. **The notification row is the source of truth; a push is a best-effort
   pointer to it.** A push that fails to deliver must never lose the
   notification — the bell will still have it on next open. This is the same
   principle as the mobile outbox: durability first, transport second.

## 5.2 Schema (migration `00023_notifications`)

```sql
CREATE TABLE public.notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  category     TEXT NOT NULL,       -- see §5.3
  severity     TEXT NOT NULL DEFAULT 'INFO'
               CHECK (severity IN ('INFO','SUCCESS','WARNING','CRITICAL')),
  title_en     TEXT NOT NULL,  title_bn TEXT,
  body_en      TEXT NOT NULL,  body_bn  TEXT,
  action_url   TEXT,
  resource_type TEXT,  resource_id UUID,
  metadata     JSONB NOT NULL DEFAULT '{}',
  read_at      TIMESTAMPTZ,
  archived_at  TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ,
  dedupe_key   TEXT,               -- collapses "budget at 90%" repeats
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, dedupe_key)
);

CREATE INDEX idx_notif_unread ON public.notifications (user_id, created_at DESC)
  WHERE read_at IS NULL AND archived_at IS NULL;

CREATE TABLE public.notification_preferences (
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category    TEXT NOT NULL,
  in_app      BOOLEAN NOT NULL DEFAULT TRUE,
  push        BOOLEAN NOT NULL DEFAULT TRUE,
  email       BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (user_id, category)
);

CREATE TABLE public.notification_deliveries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  device_id       UUID REFERENCES public.user_devices(id) ON DELETE SET NULL,
  channel         TEXT NOT NULL CHECK (channel IN ('in_app','push','email','webpush')),
  status          TEXT NOT NULL CHECK (status IN ('PENDING','SENT','DELIVERED','FAILED','SUPPRESSED')),
  provider_id     TEXT,
  error           TEXT,
  attempts        SMALLINT NOT NULL DEFAULT 0,
  sent_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- quiet hours live on profiles: quiet_hours_start, quiet_hours_end, quiet_hours_tz
```

RLS: a user reads and updates **only their own** notifications; `service_role`
writes. Operators see aggregate delivery stats, never another user's
notification body — the same aperture discipline as DEC-016.

## 5.3 Categories and triggers

| Category | Triggers | Default channels |
|---|---|---|
| `security` | New-device login, password/email change, MFA change, session revoked, suspension | in-app + push + **email** (not user-disableable) |
| `budget` | 50/80/100% thresholds, overspend, period rollover | in-app + push |
| `goal` | Milestone reached, target met, contribution due | in-app + push |
| `recurring` | Rule posted, rule failed, upcoming in 3 days | in-app + push |
| `transaction` | Large transaction, reversal posted, duplicate suspected | in-app |
| `sync` | Push rejected (`NEEDS_ATTENTION`), offline > 24h, conflict | in-app + push |
| `account` | Low balance, deletion scheduled/cancelled, export ready | in-app + email |
| `system` | Maintenance, new release, broadcasts (migrated here) | in-app |
| `operator` | Alert fired/resolved, job failed, error-rate breach, crash spike | in-app + push + email |

`security` is deliberately not opt-out. Everything else is per-category,
per-channel, with global quiet hours that **`CRITICAL` severity overrides**.

## 5.4 Channels

| Channel | Implementation |
|---|---|
| **In-app (web)** | Bell + dropdown + `/dashboard/notifications`. Realtime hint → `GET /v1/notifications`. Optimistic read-marking via the existing `use-optimistic-mutation` hook. |
| **In-app (mobile)** | Notification tab under **More**, plus badges. Reads from SQLite, syncs through the existing delta-sync endpoint — notifications become a synced entity, so they work offline. |
| **Mobile push** | `expo-notifications` + Expo Push Service (which fronts FCM and APNs). Token registered into `user_devices.push_token` at sign-in and on rotation; deep links route to `action_url`. Android channels per category so users can tune at OS level. |
| **Web push** | VAPID + service worker; a progressive enhancement, gated on explicit permission requested **contextually** (never on first paint). |
| **Email** | Supabase SMTP (Mailpit locally). Reserved for `security`, `account`, and digests — email is the fallback, not the default. |
| **Digest** | Optional daily/weekly rollup via `pg_cron`, so a chatty category degrades into one message instead of twenty. |

## 5.5 API surface

```
GET    /v1/notifications?status=unread&category=&cursor=   List (paginated)
GET    /v1/notifications/unread-count                      Badge count (cheap, cacheable)
POST   /v1/notifications/:id/read                          Mark read
POST   /v1/notifications/read-all                          Mark all read
POST   /v1/notifications/:id/archive                       Archive
DELETE /v1/notifications/:id                               Delete
GET    /v1/me/notification-preferences                     Read prefs
PUT    /v1/me/notification-preferences                     Update prefs
POST   /v1/me/devices                                      Register device + push token
DELETE /v1/me/devices/:deviceId                            Revoke device / unregister push
GET    /v1/me/devices                                      Sessions & Devices page (gap S2)

POST   /v1/admin/notifications                             Compose + target (Idempotency-Key)
GET    /v1/admin/notifications                             List sent
GET    /v1/admin/notifications/:id/deliveries              Per-channel outcomes
GET    /v1/admin/notifications/templates                   Templates CRUD
POST   /v1/admin/alerts/:alertKey/acknowledge              Ack a firing alert
```

**Sync integration:** notifications join the delta-sync payload
(`GET /workspaces/:id/sync`) so the mobile app gets them in the round trip it
already makes — no second polling loop, no extra egress.

---

# Part 6 — UI/UX & API Enhancements

## 6.1 Cross-cutting UI/UX

### The design-system gap (E2) is the highest-leverage UI fix

`apps/web/src/components/` holds **four** components, while pages carry large
inline `style={{}}` objects. Meanwhile `@noorixfin/design-tokens` exists and is
consumed only by mobile. Every screen added in Parts 2–5 will either compound
that inconsistency or resolve it.

**Proposal:** promote `@noorixfin/design-tokens` to the shared source of truth
for web *and* mobile, and build `@noorixfin/ui` on top of it — Button, Input,
Select, Modal, Drawer, Table, Card, Badge, Toast, Tabs, EmptyState, Skeleton,
Pagination, DatePicker, CurrencyInput, ConfirmDialog. Document with Storybook
(E3). Do this **before** Phases 3–5 add ~40 screens, not after.

### Accessibility

An `accessibility.spec.ts` with `@axe-core/playwright` already runs — genuinely
ahead of the curve. Extend it to: full keyboard traversal of every new menu,
focus traps in modals/drawers, `aria-live` for the notification bell and toasts,
prefers-reduced-motion honoured by the `framer-motion` usage, 4.5:1 contrast
verified across both themes, and a target of WCAG 2.1 AA on all new surfaces.

### Other cross-cutting UI work

| Area | Change |
|---|---|
| **Dark mode** | Not implemented. Token-driven, `prefers-color-scheme` + a user override on the profile. |
| **Empty & error states** | `error-state.tsx` and `not-yet-available.tsx` are a good start; every new page needs a designed empty state, not a blank table. |
| **Optimistic UI** | `use-optimistic-mutation.ts` exists — apply it consistently to every mutation, per DEC-012. |
| **Command palette** | `⌘K` for search + navigation + quick actions (gap P5a). |
| **Mobile-web responsiveness** | The dashboard shell has a collapse; audit every new page at 360px. |
| **Motion** | `framer-motion` is already a dependency; standardise durations/easings as tokens rather than per-component values. |

### Landing pages

Beyond §4's download surfaces: a live product demo or screenshot carousel,
trust signals (self-host, MIT, no telemetry-by-default, security page link),
a "Why free?" section that answers the suspicion the promise creates, real
performance budgets (LCP < 2.5s, CLS < 0.1), OpenGraph/Twitter cards, JSON-LD,
and a `/status` page fed by the health endpoint.

### Super Admin panel

The amber operator shell is a good signal that you are in a dangerous place —
keep it. Add: a global time-range picker shared across monitoring pages,
saved filter views, CSV/NDJSON export on every table, dense-table mode,
keyboard-first navigation, a **destructive-action confirmation pattern**
(type-the-name-to-confirm) for purge/suspend/revoke, and a visible "you are
acting as operator" indicator on any page that can mutate another user's state.

### Mobile UI/UX

Amount-first entry (numeric pad, not a text field), swipe actions on the
transaction list, pull-to-refresh triggering a real sync, skeletons over
spinners (`Skeleton.tsx` exists), haptics on commit, biometric app-lock,
an honest offline banner with queue depth, deep links from push into the right
screen, and a Bangla-first typography pass — the marketing site already renders
Bangla as its default locale, and the app should not regress that.

## 6.2 API enhancements

### New endpoints required by Parts 2–5

```
── Notifications (§5) ────────────────────────────────────
GET    /v1/notifications                       POST  /v1/notifications/:id/read
GET    /v1/notifications/unread-count          POST  /v1/notifications/read-all
POST   /v1/notifications/:id/archive           DELETE /v1/notifications/:id
GET    /v1/me/notification-preferences         PUT   /v1/me/notification-preferences

── Devices & sessions (S2, §3) ───────────────────────────
GET    /v1/me/devices                          POST  /v1/me/devices
DELETE /v1/me/devices/:deviceId                POST  /v1/me/sessions/revoke-all

── Mobile distribution (§4) ──────────────────────────────
GET    /v1/releases/mobile                     (public, cached)

── Search & reporting (P5a, P7a) ─────────────────────────
GET    /v1/workspaces/:id/search?q=
GET    /v1/workspaces/:id/reports/cash-flow
GET    /v1/workspaces/:id/reports/net-worth
GET    /v1/workspaces/:id/reports/income-expense
POST   /v1/workspaces/:id/reports/scheduled

── Import/export & attachments (P3a, P4a) ────────────────
POST   /v1/workspaces/:id/import               (CSV/OFX/QIF, idempotency_key in DTO)
GET    /v1/workspaces/:id/import/:jobId
POST   /v1/workspaces/:id/transactions/:id/attachments
DELETE /v1/workspaces/:id/transactions/:id/attachments/:attachmentId

── Multi-member workspaces (Finding B) ───────────────────
GET    /v1/workspaces/:id/members              POST  /v1/workspaces/:id/invites
DELETE /v1/workspaces/:id/invites/:inviteId    POST  /v1/invites/:token/accept
PATCH  /v1/workspaces/:id/members/:userId      DELETE /v1/workspaces/:id/members/:userId

── Admin (§3) ────────────────────────────────────────────
GET    /v1/admin/metrics/performance           GET   /v1/admin/clients/devices
GET    /v1/admin/clients/versions              GET   /v1/admin/clients/sync-health
GET    /v1/admin/clients/crashes               GET   /v1/admin/security/auth-events
GET    /v1/admin/security/sessions             POST  /v1/admin/security/sessions/:id/revoke
GET    /v1/admin/security/anomalies            GET   /v1/admin/alerts
POST   /v1/admin/alerts/:alertKey/acknowledge  GET   /v1/admin/workspaces
GET    /v1/admin/notifications                 POST  /v1/admin/notifications
GET    /v1/admin/notifications/:id/deliveries  GET   /v1/admin/feature-flags
PUT    /v1/admin/feature-flags/:key            GET   /v1/admin/releases
PUT    /v1/admin/releases/mobile
```

### API-wide improvements

| # | Change | Why |
|---|---|---|
| A1 | **Generate `@noorixfin/api-client` from the Swagger document** the API already produces | Deletes two hand-maintained clients that can drift (E1). The API grows by ~45 endpoints below — do this *first* or pay for it 45 times. |
| A2 | **Cursor pagination everywhere**, standard envelope `{ data, cursor, has_more }` | Offset pagination on `system_events` will not survive the volume §3 creates |
| A3 | **Field selection / sparse fieldsets** (`?fields=`) | Mobile on a slow connection should not download what it will not render |
| A4 | **`ETag` / `If-None-Match` on all GETs** | `If-Match` is already used for writes; the read side gets bandwidth back for free |
| A5 | **Standardised error catalogue** with stable `code` values, documented in Swagger | `GlobalHttpExceptionFilter` already shapes `{code, message}` — publish the enumeration so clients can branch on it |
| A6 | **Per-endpoint throttle tiers** | Export and import must not share a budget with `GET /me` |
| A7 | **Structured request logging with trace propagation** (`traceparent`) | Ties client crash → API request → DB query into one story (R1) |
| A8 | **API deprecation policy** with `Sunset`/`Deprecation` headers | `/v1` versioning exists; the policy does not (E6) |
| A9 | **Webhooks** `[B-only]` | Outbound events for integrations |
| A10 | **Idempotency for every new mutating endpoint** | Follow the existing split precisely: ledger writes take the key **in the DTO**; admin writes use the **header**. The `IdempotencyInterceptor` is registered only in `admin.module.ts` — a new ledger endpoint that relies on the header will silently have no protection. |

---

# Part 7 — Master Roadmap

## 7.0 Execution status — updated 2026-08-14

**The Reading A roadmap is complete.** Phases 0–5 are implemented; Phase 6 is
excluded by DEC-025 and no commercial, billing, SSO, or shared-tenant scope was
started.

| Item | Status | Evidence |
|---|---|---|
| P0.1 Port drift | ✅ | Converged on **3001**, not 8080 as this document originally proposed — see the note below |
| P0.2 Stale audit table | ✅ | `memory/MASTER_PLAN.md` refreshed against the live tree |
| P0.3 Migration drift | ✅ | `pnpm db:check-drift`, in CI; proven to fail on an unapplied migration *and* a mis-named file |
| P0.4 Scope decision | ✅ ratified | `DEC-025` — Reading A; free, open-source, self-hostable personal/household finance |
| P1.1 Security headers | ✅ | Nonce CSP + 7 headers; 6 e2e assertions |
| P1.2 Error tracking / APM | ✅ | `@noorixfin/observability` — release tagging, stable fingerprints, redaction, W3C trace context; 23 tests; verified live against `system_events` |
| P1.3 Generated API client | ✅ | `openapi.json` (51 paths) → `schema.d.ts`; `check:fresh` in CI, proven to fail on a new route |
| P1.4 Design system | ✅ | `@noorixfin/design-tokens` is now the single palette (74 generated CSS vars, `check:fresh` in CI); `@noorixfin/ui` — 8 components, Storybook, 17 component tests |
| P1.5 Backup restore drill | ✅ | `pnpm db:restore-drill`, in CI; **executed and passed** |
| P1.6 Shutdown / health | ✅ | `/health/live`, `/health/ready`, SIGTERM drain; 7 unit tests |
| P1.7 Error catalogue + paging | ✅ | 62 codes in `@noorixfin/domain`, published to Swagger; drift test |

**Final gate:** 19/19 typecheck · 14/14 test tasks · 10/10 build · 105 browser
scenarios (101 passed, 4 environment-dependent scenarios skipped) · lint at
zero warnings · locale parity · all 32 migrations from scratch · SQL invariants
· migration drift · API-client freshness · design-token freshness · full
backup/restore drill with row-count and ledger-balance comparison — all green.

### Continuation status — updated 2026-08-14

| Phase | Status | Evidence |
|---|---|---|
| Phase 2 — observability & telemetry | ✅ complete | `7d771cb` |
| Phase 3 — mobile product foundation | ✅ complete | `e76546d`, `850a8a2` |
| Phase 4 — global notifications | ✅ complete | `1690601` |
| Phase 5 — distribution | ✅ complete | `49aab53` |
| Phase 5 — search & reports | ✅ complete | `a46b5ed` |
| Phase 5 — imports, CSV/PDF export & receipts | ✅ complete | Migration `00026_imports_attachments`; staged CSV/OFX/QIF jobs, private idempotent receipt storage, and live browser coverage |
| Phase 5 — dark mode | ✅ complete | Migration `00027_theme_preference`; token-driven system/light/dark preference, persisted profile override, and live WCAG 2.2 AA browser pass across dashboard surfaces |
| Phase 5 — Recurring page | ✅ complete | Migration `00029_recurring_management`; dedicated route with create/pause/resume/delete lifecycle and live no-ledger-side-effect coverage |
| Phase 5 — Tags page | ✅ complete | Migration `00030_tag_management`; canonical create/rename/delete management, usage drill-down, and live proof that tag deletion never changes ledger entries |
| Phase 5 — Debts page | ✅ complete | Migration `00031_debt_management`; dedicated terms lifecycle with ledger-derived outstanding balances and live account-preservation coverage |
| Phase 5 — restore portability | ✅ complete | Migration `00032_portable_trigram_indexes`; extension-qualified search indexes and a restore drill that recreates the schema-scoped Realtime publication safely |
| Phase 6 | 🚫 excluded | Reading A ratified in DEC-025; commercial and multi-tenant `[B-only]` work is out of scope |

**Four drift guards now exist**, each proven to fail on real drift before being
trusted: migrations vs database, OpenAPI vs API routes, `tokens.css` vs the
tokens, and stylesheets vs the token set. They exist because every problem this
audit found in the "shared" layer — a stale migration, an `echo` stub, four
palettes — was invisible to the compiler, the tests and the build.

> **Repository renamed.** `~/Runing_Project/MyFin` → `~/Runing_Project/NoorixFin`
> on 2026-08-09, closing the open question in `memory/PROGRESS.md`. pnpm
> workspace links, turbo caches and the Supabase containers all survived it.

### Three places this document was wrong, corrected in the doing

1. **§0.4 #1 said converge on 8080.** Wrong trade. The repository said `3001`
   in four places (`main.ts`'s fallback, `.env.example`, `ARCHITECTURE.md`, the
   mobile client's default) and only the two gitignored `.env.local` files said
   8080. Aligning those two files was one edit; the alternative was changing
   code, docs and the mobile default to chase a local override.

2. **§6.2 A2 proposed `{ data, cursor, has_more }`.** The API already returns
   `{ items, next_cursor, has_more }` from transactions and sync. Adopting the
   proposed names would have renamed fields on two shipped endpoints and broken
   both clients to gain a synonym. The envelope in `@noorixfin/domain` matches
   the wire instead.

3. **§1.1 E1 implied generating a full client.** Generating a *transport* would
   mean reimplementing the web client's timeout/degraded-mode handling and the
   mobile client's idempotency-key reuse before either could adopt it — the
   usual reason generated clients sit unused. The drift risk was in the types,
   so the types are what is generated.

### Found while working, not in the original audit

- **`SystemEventsService` lost its final flush on every SIGTERM.** It buffers
  events and flushes in `onModuleDestroy`, but nothing called `app.close()` on
  a signal, so the last seconds before a restart were dropped — on exactly the
  restarts worth investigating. Fixed with P1.6.
- **The landing page failed its own WCAG 2.2 AA e2e test on `main`.** Footer
  text at 2.66:1 against a required 4.5:1. Verified failing at `HEAD` before
  being touched, so it was pre-existing rather than a regression. Fixed.
- **The web app fetched Google Fonts from a third party** via a render-blocking
  `@import`, on a site whose landing page advertises "০ ট্র্যাকার" (0 trackers).
  Now self-hosted through `next/font`.
- **`DEC-021` and `DEC-022` are cited by ~10 source files but were never
  written up** in `memory/DECISIONS.md`. Recorded as missing rather than
  reconstructed from guesswork.
- **`PaginatedResponse<T>` in `@noorixfin/domain` was exported, used by
  nothing, and disagreed with the wire format.** Anyone who had trusted it
  would have unwrapped the wrong keys. Removed.
- **`pg_restore -j 4` deadlocks on this dump**, abandoning items and leaving a
  database that looks restored and is missing constraints. The drill uses `-j 1`.
- **The product shipped four palettes, and the "shared" one shipped to nobody.**
  `@noorixfin/design-tokens` declared a primary of `#0DAB76`; `globals.css`
  declared `#10b981`; `marketing.css` declared a third set; the mobile app
  hardcoded a fourth. **Nothing in the workspace imported the tokens package at
  all** — so no type error, failing test or broken build could have revealed it,
  and ARCHITECTURE.md's claim that mobile consumed it was simply untrue. The
  tokens are now generated from the palette that actually ships, verified
  byte-identical across all 72 properties before the swap.
- **`apps/api`'s `start:prod` would have crashed in production.** Adding
  `scripts/generate-openapi.ts` outside `src/` widened TypeScript's inferred
  `rootDir` to the package root, so the build silently emitted `dist/src/main.js`
  while `package.json` still said `node dist/main`. Self-inflicted, caught by
  running the built artefact rather than trusting a green build, and fixed by
  excluding `scripts/` from `tsconfig.build.json`. Nothing about the build
  output warned — this class of failure only appears at the first prod boot.

Sizing is relative (**S** ≈ days, **M** ≈ 1–2 weeks, **L** ≈ 3–6 weeks) for one
experienced full-stack developer. Phases are ordered by dependency, not by
appeal.

## Phase 0 — Correct the record (S)

*Nothing else should start on top of documentation that is wrong.*

- Fix the port drift: `.env.example` and `ARCHITECTURE.md` §9 → **8080** (§0.4 #1)
- Refresh the stale audit table in `memory/MASTER_PLAN.md` (§0.4 #3)
- Add a CI/dev check that local migrations are fully applied (§0.4 #2)
- Record the `DEC-0xx` for **Reading A vs Reading B** (§1.0)

## Phase 1 — Enterprise foundations (M–L) · *no user-visible features*

*Everything after this is cheaper if this lands first.*

| Task | Size | Addresses |
|---|---|---|
| Security headers: CSP, HSTS, frame/content/referrer/permissions policies | S | S1 |
| Error tracking + APM (Sentry or OTel) across api/web/mobile, release-tagged | M | R1 |
| Generate `@noorixfin/api-client` from Swagger; adopt in web + mobile | M | E1, A1 |
| `@noorixfin/ui` design system on shared tokens + Storybook | L | E2, E3 |
| Backup restore drill, documented and scheduled | S | R2 |
| Graceful shutdown, readiness/liveness split, deep public health | S | R5, R6 |
| Standard error catalogue + cursor pagination envelope | S | A2, A5 |

## Phase 2 — Observability & client telemetry (M)

*This is §3, and it unblocks every "mobile usage" question.*

| Task | Size |
|---|---|
| Migration `00022_client_telemetry` + `user_devices` + `X-Client-Info` middleware | M |
| `/admin/monitoring/performance`, `/jobs`, `/alerts` pages | M |
| Expanded alert rules with acknowledge/resolve | S |
| `/admin/security/*` — dashboard, auth events, sessions, anomalies | M |
| User-facing **Sessions & Devices** page | S |
| Correlated trace view by `X-Request-ID` | S |

## Phase 3 — Make the mobile app real (L) · **the critical path**

*Finding A. Phases 4 and 5's mobile halves are blocked here.*

| Task | Size |
|---|---|
| Tab navigation + screen architecture (§2.4) | M |
| Workspace selection on first launch — delete `EXPO_PUBLIC_DEV_WORKSPACE_ID` | S |
| Add/edit transaction, accounts, budgets, goals, calendar, reports screens | L |
| Settings stack: profile, preferences, security, sessions, data | M |
| Biometric app-lock, honest offline UX, haptics, skeletons | S |
| EAS Build + TestFlight/Play internal + mobile CI job | M |

## Phase 4 — Global notification system (L)

*§5. Web half can start after Phase 1; mobile half needs Phase 3.*

| Task | Size |
|---|---|
| Migration `00023_notifications` + preferences + deliveries | M |
| Notification service, rule engine, dedupe, quiet hours, digests | M |
| In-app centre: web bell + `/dashboard/notifications` + preferences page | M |
| Mobile push (`expo-notifications`), token lifecycle, deep links, channels | M |
| Web Push (VAPID + service worker) | S |
| Email channel for `security`/`account` + digests | S |
| `/admin/notifications` compose/target/schedule + delivery log | M |
| Migrate broadcasts onto the pipeline; route operator alerts through it | S |

## Phase 5 — Distribution & product depth (M–L)

| Task | Size |
|---|---|
| `/download` page, hero/nav/footer surfaces, QR pairing, `/admin/config/releases` | M |
| `GET /v1/releases/mobile` + forced-upgrade floor | S |
| Global search + `⌘K` command palette | M |
| Reports: cash flow, net worth, income vs expense, custom ranges | M |
| CSV/OFX/QIF import with a job model; CSV/PDF export | M |
| Receipt attachments on transactions | M |
| Dark mode + full WCAG 2.1 AA pass on new surfaces | M |
| Recurring, Tags, and Debts promoted to first-class pages | S |

## Phase 6 — Multi-tenancy & `[B-only]` items — **excluded**

*Reading A was ratified in DEC-025. This phase is retained only as a record of
deliberately rejected scope and must not be executed.*

| Task | Size |
|---|---|
| Roles beyond `OWNER` (`ADMIN`/`MEMBER`/`VIEWER`) — schema, RLS rewrite, guards | L |
| Invitation flow: invite, accept, revoke, pending state | M |
| Members & permissions UI on web and mobile | M |
| `/admin/workspaces` operator surface | S |
| `[B-only]` SSO/SAML/SCIM · webhooks · long retention · billing surface | L |

## Dependency graph

```
Phase 0 ─┬─▶ Phase 1 ─┬─▶ Phase 2 ────────────┬─▶ Phase 5
         │            │                        │
         │            ├─▶ Phase 3 (mobile) ────┤
         │            │        │               │
         │            └─▶ Phase 4 (web half) ──┘
         │                     └─ Phase 4 (mobile half) needs Phase 3
         │
         └─ Phase 6 excluded by DEC-025 (Reading A)
```

## Risks

| Risk | Mitigation |
|---|---|
| **Free-tier ceiling** — §3's telemetry and §5's deliveries are both write-heavy | Sample non-critical events, aggressive retention, aggregate into rollup tables rather than querying raw. Budget the write volume *before* building, not after the quota alert. |
| **Scope inflation from "enterprise"** | The §1.0 A/B decision, recorded as a `DEC-0xx`, is the guard. Phase 6 is deliberately severable. |
| **Notification fatigue** | Sensible defaults, quiet hours, digests, and per-category control shipped *with* the feature, not bolted on later. |
| **Store review delays** (Apple in particular, for a finance app) | Start the developer-account and review process during Phase 3, not at Phase 5. |
| **The design system arriving too late** | Phase 1 places it before ~40 new screens. Slipping it is the most expensive schedule decision available. |
| **Operator over-reach** | DEC-016's metadata-only boundary must be re-asserted in code review for every §3 surface. Telemetry about behaviour; never about balances. |

---

## Appendix — Proposed migrations

| Migration | Contents |
|---|---|
| `00022_client_telemetry` | `system_events` +platform/app_version/device_id/session_id · `audit_events` +user_agent/platform/device_id · `user_devices` |
| `00023_notifications` | `notifications` · `notification_preferences` · `notification_deliveries` · quiet-hours columns on `profiles` |
| `00024_search_indexes` | GIN/trigram indexes for global search |
| `00025_reporting` `[implemented]` | Cash-flow and net-worth reporting functions |
| `00026_imports_attachments` `[implemented]` | `transaction_attachments` + private storage; `import_jobs` + `import_rows` for staged CSV/OFX/QIF ingestion |
| `00027_theme_preference` `[implemented]` | System/light/dark preference on `profiles` |
| `00028_notification_worker_grants` `[implemented]` | Least-privilege notification-worker reads for calendar and membership sources |
| `00029_recurring_management` `[implemented]` | First-class recurring-rule validation, ordering, and lifecycle support |
| `00030_tag_management` `[implemented]` | Canonical tag names, duplicate consolidation, and workspace uniqueness |
| `00031_debt_management` `[implemented]` | Validated debt rates, minimum payments, and due-day terms |
| `00032_portable_trigram_indexes` `[implemented]` | Portable `pg_trgm` extension namespace and schema-qualified search opclasses |
| Multi-member migration `[excluded by DEC-025]` | No migration number reserved; roles, invites, and the corresponding RLS rewrite will not be implemented |

---

*Audit performed 2026-08-08 against `310e1dd`. Baseline claims were verified
against the source and the running local database; proposals are marked as such
throughout.*
