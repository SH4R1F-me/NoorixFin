# MyFin — MASTER IMPLEMENTATION PLAN

**Generated from:** `MyFin_Production_Blueprint.md` v1.0
**Created:** 2026-08-01
**Status:** ACTIVE — Phase 1 In Progress

---

## Audit Summary

| Item | Status |
|------|--------|
| Existing codebase | **None** — greenfield project, only blueprint exists |
| Reusable work | N/A |
| Blueprint completeness | Full 1330-line spec covering product, UX, architecture, DB, security, delivery |
| Open owner decisions | 12 items (Section 26) — buildable foundation without them, but needed for production |

---

## Technology Stack (from Blueprint §2.3)

| Layer | Technology |
|-------|-----------|
| Web | Next.js App Router + TypeScript |
| Mobile | React Native + Expo + TypeScript |
| Backend | NestJS modular monolith + REST/OpenAPI |
| Database | Supabase PostgreSQL |
| Auth | Supabase Auth |
| Storage | Supabase Storage (private buckets) |
| Realtime | Supabase Realtime (invalidation hints) |
| Local cache | Expo SQLite / SQLCipher |
| Secrets | Expo SecureStore |
| i18n | i18next + react-i18next + Expo Localization |
| Client state | TanStack Query |
| Monorepo | pnpm workspace + Turborepo |
| API contract | OpenAPI-generated clients |

---

## Phase 1 — Foundation (CURRENT)

> **Exit criteria:** Two users, two workspaces, all role isolation proven; empty app Web/Mobile shows same identity.

### 1.1 Monorepo Setup
- [ ] Initialize pnpm workspace with Turborepo
- [ ] Create directory structure per §7.5:
  - `apps/web/` (Next.js)
  - `apps/mobile/` (Expo React Native)
  - `apps/api/` (NestJS)
  - `packages/domain/` (shared types/rules)
  - `packages/money/` (minor-unit currency utilities)
  - `packages/i18n/` (bn/en catalogs)
  - `packages/design-tokens/` (colors, spacing, typography)
  - `packages/api-client/` (OpenAPI-generated)
  - `packages/test-fixtures/`
  - `supabase/` (migrations, seed, tests)
  - `infra/docker/`
  - `docs/`
- [ ] Configure TypeScript project references
- [ ] Configure ESLint + Prettier
- [ ] Add `.env.example` files with documented variables
- [ ] Setup `turbo.json` pipeline (build, dev, test, lint, typecheck)

### 1.2 Local Supabase Setup
- [ ] Install Supabase CLI
- [ ] Initialize Supabase project (`supabase/`)
- [ ] Configure local development environment
- [ ] Create initial migration: profiles table
- [ ] Create initial migration: workspaces + workspace_members
- [ ] Enable RLS on all exposed tables
- [ ] Write seed.sql with test fixtures
- [ ] Verify `supabase start` / `supabase db reset` works

### 1.3 NestJS API Foundation
- [ ] Scaffold NestJS app in `apps/api/`
- [ ] Configure module structure per §7.1 (auth, profiles, workspaces, memberships)
- [ ] Setup Supabase JWT validation (JWKS verification per §7.2)
- [ ] Create AuthGuard + workspace membership guard
- [ ] Setup ValidationPipe (global, whitelist, forbidNonWhitelisted)
- [ ] Configure OpenAPI/Swagger
- [ ] Add health check endpoint
- [ ] Configure CORS (strict origins)
- [ ] Add request ID middleware (`X-Request-ID`)
- [ ] Add structured logging (no sensitive data)
- [ ] Add rate limiting (NestJS throttler)
- [ ] Dockerize the API

### 1.4 Auth Flow
- [ ] Implement Supabase Auth email/password registration
- [ ] Email verification flow
- [ ] Password reset flow
- [ ] Magic link (optional)
- [ ] `GET /v1/me` — return current user profile
- [ ] `PATCH /v1/me/preferences` — update locale, timezone, currency, etc.
- [ ] Session/device list
- [ ] Sign-out-all-devices

### 1.5 Workspace & Membership Model
- [ ] `POST /v1/workspaces` — create PERSONAL/FAMILY workspace
- [ ] `GET /v1/workspaces` — list user's workspaces
- [ ] `POST /v1/workspaces/:id/invitations` — invite to family workspace
- [ ] `PATCH /v1/workspaces/:id/members/:userId` — change role/status
- [ ] RLS policies for workspace isolation (per §10.2)
- [ ] Role matrix enforcement (Owner/Admin/Editor/Viewer per §10.1)
- [ ] **Tests:** Cross-workspace isolation, role-based access negative tests

### 1.6 Database Migrations — Ledger Schema
- [ ] `ledger_accounts` table (per §9.3)
- [ ] `categories` table with system categories
- [ ] `journal_entries` table
- [ ] `journal_postings` table with balance constraint
- [ ] `tags` + `journal_entry_tags`
- [ ] `idempotency_records` table
- [ ] `audit_events` table
- [ ] Indexes per §9.6
- [ ] RLS on all ledger tables

### 1.7 Shared Packages
- [ ] `packages/money/` — minor-unit arithmetic, currency metadata, formatting
- [ ] `packages/domain/` — shared TypeScript types (workspace, account, entry, etc.)
- [ ] `packages/i18n/` — bn/en JSON catalogs (common, transactions, budgets, calendar, errors)
- [ ] `packages/design-tokens/` — color palette, spacing, typography tokens

### 1.8 Next.js Web Foundation
- [ ] Scaffold Next.js App Router in `apps/web/`
- [ ] Configure i18next + react-i18next
- [ ] Implement language selection (bn/en)
- [ ] Auth pages: login, register, verify email, reset password
- [ ] Protected route layout with auth guard
- [ ] Sidebar navigation per §5.1
- [ ] Dashboard shell (empty, workspace switcher)
- [ ] Settings page (locale, timezone, currency, week start)
- [ ] Responsive design + design tokens integration
- [ ] SEO: title tags, meta descriptions, semantic HTML
- [ ] CSP headers per §16.2

### 1.9 Expo Mobile Foundation
- [ ] Scaffold Expo project in `apps/mobile/`
- [ ] Configure i18next + Expo Localization
- [ ] Language selection screen
- [ ] Auth screens: login, register, verify, reset
- [ ] Bottom navigation per §5.1 (Home, Transactions, Add, Budget, More)
- [ ] Dashboard shell
- [ ] Settings screen
- [ ] SecureStore for session tokens
- [ ] TanStack Query setup

### 1.10 Phase 1 Tests & Verification
- [ ] Unit tests: money package arithmetic
- [ ] Database tests: RLS isolation (pgTAP or integration)
- [ ] API integration tests: auth flow, workspace CRUD, role isolation
- [ ] Web E2E: login → dashboard → settings
- [ ] Mobile: build verification
- [ ] i18n: missing key check (bn vs en)

---

## Phase 2 — Core Finance

> **Exit criteria:** Financial invariants, retry, and Web/Mobile consistency evidence complete.

### 2.1 Accounts Module
- [ ] `POST /v1/workspaces/:id/accounts` — create ledger account (cash, bank, wallet, card, loan)
- [ ] `GET /v1/workspaces/:id/accounts` — list with balances
- [ ] `PATCH /v1/accounts/:id` — update name/archive
- [ ] Opening balance as balanced journal entry (§8.2)
- [ ] Account class/subtype validation
- [ ] Web: Accounts list + create/edit UI
- [ ] Mobile: Accounts screens

### 2.2 Categories Module
- [ ] System categories with translation_key (§9.3)
- [ ] Custom category CRUD (workspace-scoped)
- [ ] Parent/child hierarchy
- [ ] Icon + color assignment
- [ ] Web + Mobile category management UI

### 2.3 Transaction Engine (Journal Entries)
- [ ] `POST /v1/workspaces/:id/transactions` — create income/expense/transfer
- [ ] Balanced journal entry creation (§8.2): debit = credit
- [ ] Split transaction support
- [ ] `GET /v1/workspaces/:id/transactions` — cursor pagination, search, filters
- [ ] `GET /v1/transactions/:id` — detail with postings
- [ ] `POST /v1/transactions/:id/reverse` — reversal entry (§8.2)
- [ ] Idempotency key enforcement (§8.3)
- [ ] Optimistic concurrency with version field (§8.3)
- [ ] Amount as minor-unit bigint; API decimal string (§8.1)
- [ ] DB constraint: debit/credit not both positive; no zero-only posting
- [ ] Web: Transaction list, quick-add form (§5.4), detail view
- [ ] Mobile: Transaction list, quick-add, detail

### 2.4 Cross-Device Sync (MVP)
- [ ] Supabase Realtime subscription for workspace changes
- [ ] TanStack Query invalidation on realtime hint
- [ ] Offline read cache (existing data viewable)
- [ ] Offline draft save (submit when online)

### 2.5 Dashboard Basic Summary
- [ ] Current balance (selected accounts)
- [ ] This month income/expense/net
- [ ] Recent transactions
- [ ] Category spending breakdown
- [ ] Workspace switcher
- [ ] Privacy toggle ("amounts hide")
- [ ] Web + Mobile dashboard implementation

### 2.6 Phase 2 Tests
- [ ] FIN-01: Every posted journal balanced (DB constraint + property test)
- [ ] FIN-02: Retry cannot duplicate (idempotency test)
- [ ] FIN-03: Correction preserves history (reversal test)
- [ ] SYNC-01: Web and Mobile same committed data
- [ ] SYNC-02: Stale edit → 409 Conflict
- [ ] SEC-01: Cross-user workspace isolation
- [ ] SEC-02: Viewer cannot mutate

---

## Phase 3 — Planning

> **Exit criteria:** Monthly plan → transaction → budget/report/calendar lifecycle E2E pass.

### 3.1 Budgets Module
- [ ] Budget CRUD (workspace, cadence, category lines)
- [ ] Budget progress calculation (spent vs planned)
- [ ] Alert thresholds
- [ ] Web + Mobile budget UI with progress bars

### 3.2 Recurring Rules
- [ ] Recurring rule CRUD (template, recurrence, timezone)
- [ ] `REMIND_ONLY` and `AUTO_CREATE_DRAFT` behaviors
- [ ] Next occurrence calculation
- [ ] Cron job for due recurring rules

### 3.3 Calendar & Bills
- [ ] Calendar events (BILL, INCOME, GOAL, CUSTOM)
- [ ] Due date tracking (UPCOMING, DUE, PAID, SKIPPED, OVERDUE)
- [ ] In-app reminders
- [ ] Web calendar view + Mobile calendar screen

### 3.4 Goals & Debts
- [ ] Savings goals (target amount, linked accounts, progress)
- [ ] Debt details (principal, rate, minimum payment, due day)
- [ ] Web + Mobile goals/debts UI

### 3.5 Reports
- [ ] Cash flow report (`GET /v1/workspaces/:id/reports/cash-flow`)
- [ ] Net worth report
- [ ] Category breakdown
- [ ] Drill-down from aggregate to source transactions
- [ ] Report metadata: period, timezone, currency, generated-at
- [ ] Web + Mobile reports with charts

### 3.6 Notifications & Outbox
- [ ] `outbox_events` table (transactional outbox pattern)
- [ ] Notification preferences
- [ ] In-app notification list
- [ ] Bill reminder notifications
- [ ] Worker for processing outbox events

### 3.7 Phase 3 Tests
- [ ] Budget lifecycle: create → spend → check progress
- [ ] Recurring rule: create → trigger → verify draft
- [ ] Calendar: events display correctly across timezones
- [ ] Reports: cash flow matches actual transactions
- [ ] TIME-01: Timezone boundary tests

---

## Phase 4 — Family, Privacy & Data Portability

> **Exit criteria:** Family negative tests, export reconciliation, deletion and attachment security pass.

### 4.1 Family Workspace Full Implementation
- [ ] Invitation flow (email, token hash, rate limit, expiry)
- [ ] Full role matrix enforcement with tests
- [ ] Member activity audit
- [ ] Workspace-level settings

### 4.2 CSV Import/Export
- [ ] CSV upload to private storage
- [ ] Delimiter/encoding detection
- [ ] Column mapping UI
- [ ] Duplicate detection (hash/date/amount/account/payee)
- [ ] Batch import as balanced entries
- [ ] Import reversal as group
- [ ] CSV export (transactions, accounts, budgets, categories, goals)
- [ ] JSON export (complete machine-readable)

### 4.3 Account & Workspace Deletion
- [ ] In-app deletion request
- [ ] Impact explanation (workspace transfer, member effects)
- [ ] Deletion workflow with retention policy
- [ ] `data_deletion_requests` table

### 4.4 Receipt Pipeline
- [ ] Private bucket storage
- [ ] MIME/extension allowlist, size limit, checksum
- [ ] Scan status: PENDING → CLEAN/REJECTED
- [ ] Signed URL access
- [ ] Image metadata stripping

### 4.5 Phase 4 Tests
- [ ] SEC-01/SEC-02: Full role matrix negative tests
- [ ] DATA-01: Export complete and workspace-scoped
- [ ] DATA-02: Deletion flow end-to-end
- [ ] Attachment security: no public URLs, scan blocking

---

## Phase 5 — Production Hardening

> **Exit criteria:** All release gates signed with evidence; no critical open defect.

### 5.1 Infrastructure
- [ ] Production Supabase project (paid)
- [ ] Separate dev/staging/prod environments
- [ ] Docker production builds
- [ ] CI/CD pipeline (PR gates per §22.1)

### 5.2 Security Review
- [ ] OWASP ASVS checklist
- [ ] OWASP MASVS checklist
- [ ] Secret scanning (SEC-03: no service key in clients)
- [ ] Dependency vulnerability scan
- [ ] CSP + security headers verification

### 5.3 Backup & Recovery
- [ ] BACKUP-01: Restore exercise to isolated environment
- [ ] Ledger checksum after restore
- [ ] Monthly automated restore rehearsal setup

### 5.4 Performance
- [ ] Load testing (realistic tenant size)
- [ ] p95 latency ≤ 500ms verification
- [ ] Query plan review for top endpoints
- [ ] Connection pooler configuration

### 5.5 Accessibility
- [ ] A11Y-01: WCAG 2.2 AA audit
- [ ] Keyboard navigation
- [ ] Screen reader testing
- [ ] Bangla text truncation + 200% zoom
- [ ] Reduced motion support

### 5.6 Monitoring & Operations
- [ ] Structured logging pipeline
- [ ] Metrics dashboards
- [ ] Alerting with runbooks
- [ ] Admin console (metadata-only default view)

---

## Phase 6 — Public Launch

> **Exit criteria:** All Definition of Done items (§27) satisfied.

- [ ] Brand/trademark clearance
- [ ] Store declarations (STORE-01)
- [ ] Privacy policy + terms matching actual behavior
- [ ] Staged user rollout
- [ ] Incident/support process
- [ ] Metrics review pipeline
- [ ] Version 2 scope decision from measured usage

---

## Dependency Graph

```
Phase 1 (Foundation)
  ├── 1.1 Monorepo ──→ everything
  ├── 1.2 Supabase ──→ 1.3, 1.4, 1.5, 1.6
  ├── 1.3 NestJS ──→ 1.4, 1.5
  ├── 1.7 Packages ──→ 1.8, 1.9
  ├── 1.4 Auth ──→ 1.5
  ├── 1.5 Workspaces ──→ 1.6
  ├── 1.6 Ledger Schema ──→ Phase 2
  ├── 1.8 Web ──→ Phase 2 Web
  └── 1.9 Mobile ──→ Phase 2 Mobile

Phase 2 (Core Finance) ──→ Phase 3 (Planning)
Phase 3 (Planning) ──→ Phase 4 (Family/Privacy)
Phase 4 (Family/Privacy) ──→ Phase 5 (Hardening)
Phase 5 (Hardening) ──→ Phase 6 (Launch)
```

---

## Assumptions for MVP Build

Since the 12 open owner decisions (§26) are not yet resolved, I'm proceeding with these defaults:

1. **MyFin** as working name
2. **Global** initial target (no country-specific features)
3. **18+ users only**
4. **Email/password** login for MVP
5. **Owner/Admin/Editor/Viewer** roles as specified
6. **Simple category budget** for MVP
7. **One workspace = one currency** for MVP
8. **Receipt upload deferred** to Phase 4
9. **Free product** during beta
10. **30-day retention** for deleted data
11. **Local development** hosting initially
12. **No support staff finance-data access**

These can be adjusted when owner decisions are made.
