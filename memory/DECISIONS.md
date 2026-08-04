# NoorixFin — DECISIONS LOG

**Last updated:** 2026-08-04 (Session 8)
**Product name:** NoorixFin (renamed from MyFin — see DEC-008)

---

## Decision Format

Each decision follows: **ID — Title — Decision — Rationale — Alternatives — Status**

---

## DEC-001: Greenfield Build

**Decision:** Start fresh — no existing code to reuse or preserve.
**Rationale:** Project directory contained only the production blueprint. No prior implementation existed.
**Status:** Confirmed

---

## DEC-002: MVP Scope Defaults (Pending Owner Decisions)

**Decision:** Proceed with these defaults for the 12 open owner decisions (Blueprint §26):

| # | Question | Default for Build | Now resolved by |
|---|----------|-------------------|-----------------|
| 1 | Name | ~~`MyFin` (working name)~~ → **`NoorixFin`** | DEC-008 |
| 2 | Launch countries | Global (no country-specific features) | — |
| 3 | Age restriction | 18+ only | — |
| 4 | Login methods | Email/password for MVP | — |
| 5 | Admin export permissions | ~~Admin can export~~ → N/A, no workspace admins | DEC-007 |
| 6 | Budget model | Simple category limit for MVP | — |
| 7 | Multi-currency | One workspace = one currency | — |
| 8 | Receipt upload | Deferred to Phase 4 | — |
| 9 | Business model | Free during beta | — |
| 10 | Data retention | 30-day soft delete retention | — |
| 11 | Hosting region | Supabase **Free Tier**, local dev first | DEC-011 |
| 12 | Support access | No finance-data access | — |

**Rationale:** Blueprint §26 states the foundation can be built without these. These defaults are safe and reversible.
**Status:** Active — items 1, 5, 11 now closed; the rest awaiting owner confirmation

---

## DEC-003: Monorepo Package Manager

**Decision:** pnpm + Turborepo
**Rationale:** Blueprint §2.3 specifies this. pnpm's strict node_modules, disk efficiency, and Turborepo's caching make this optimal for a multi-app TypeScript monorepo.
**Alternatives:** yarn workspaces + nx, npm workspaces
**Status:** Confirmed (blueprint-specified)

---

## DEC-004: Money Representation

**Decision:** Minor-unit bigint integers, decimal string in API, ISO currency codes.
**Rationale:** Blueprint §8.1 mandates no floating-point money arithmetic. PostgreSQL `bigint` for storage, `"1025"` string in JSON (not number), `Intl.NumberFormat` for display.
**Status:** Confirmed (blueprint-specified)

---

## DEC-005: All Financial Writes Through NestJS

**Decision:** Clients never directly mutate financial tables. All writes go through NestJS API.
**Rationale:** Blueprint §2.4 core architecture rule. NestJS validates, authorizes, audits. RLS is defence-in-depth only.
**Status:** Confirmed (blueprint-specified) — **reaffirmed and extended to mobile offline sync by DEC-010**

---

## DEC-006: Balanced Journal Model

**Decision:** Every transaction creates balanced journal entries (debit = credit).
**Rationale:** Blueprint §8.2. User sees simple income/expense forms; backend creates double-entry postings. Prevents balance drift.
**Status:** Confirmed (blueprint-specified)

---

## DEC-007: Drop Family Workspaces — Two-Role Model

**Decision:** NoorixFin ships **single-user personal workspaces only**. The four-role workspace matrix
(`OWNER` / `ADMIN` / `EDITOR` / `VIEWER`) from Blueprint §10.1 is removed. The system has exactly **two roles**:

| Role | Scope | Meaning |
|------|-------|---------|
| `SUPER_ADMIN` | System-level, flag on `profiles.is_super_admin` | Platform operator. Metadata/ops access. **No default access to any user's finance data** (DEC-002 #12). |
| `USER` | Workspace-level, `workspace_members.role = 'OWNER'` | Owns exactly one `PERSONAL` workspace and all data within it. |

Concretely this means:
- `workspaces.type` is constrained to `PERSONAL`.
- `workspace_members.role` is constrained to `OWNER`; every workspace has exactly one member.
- `workspace_invitations` is dropped — there is no invite flow.
- Blueprint §10.1's role matrix, Phase 4.1 (Family Workspace), and the member-activity audit are **cancelled**, not deferred.

**Rationale (the justification this entry exists to record):**

1. **RLS surface area.** Multi-member workspaces mean every RLS policy on every financial table must
   resolve `(user → membership → role → permission)` before it can answer "may this row be read/written."
   Single-owner workspaces collapse that to `workspace.owner_id = auth.uid()`, which is one indexed
   comparison. Fewer branches in a security policy means fewer places for an isolation bug to hide —
   and isolation bugs in a finance product are the worst class of defect we can ship.
2. **Free-tier cost.** Shared workspaces require a Realtime channel fan-out per member and per-member
   notification delivery. On Supabase Free Tier (DEC-011) concurrent Realtime connections and message
   volume are the binding constraint. One workspace = one device-set keeps us inside it.
3. **Privacy blast radius.** Shared household finance data is the highest-consequence feature in the
   blueprint: one wrong role check exposes a spouse's or family member's complete transaction history.
   That risk is not worth carrying for an MVP whose core value (track, budget, plan) is fully realised
   for a single user.
4. **Scope honesty.** Family workspaces pull in an invitation lifecycle (token hashing, expiry, rate
   limiting, revocation, email delivery), a permission matrix with a full negative-test suite, member
   removal semantics for historical data, and per-member audit. That is a multi-week feature set
   competing directly with getting a correct, verified ledger to real users.
5. **Reversibility.** The ledger is workspace-scoped, not user-scoped. Re-introducing multi-member
   workspaces later means re-adding the `role` column values, the invitations table, and the RLS
   membership join — it does **not** require reshaping the journal, postings, or account model. We are
   deferring an additive change, not painting into a corner.

**Trade-off accepted:** Couples and families are not served by v1. Target personas narrow to
individual, student, and freelancer (Blueprint §2.2 personas 1, 2, 4). Persona 3 (family/couple) is
explicitly out of scope until post-launch demand justifies it.

**Alternatives considered:**
- *Keep the four roles but hide the UI* — rejected: dead permission code still has to be secured and tested.
- *Read-only "partner view"* — rejected: still requires cross-user RLS, which is the expensive part.

**Migration status:** Already enforced in `supabase/migrations/00003_simplify_roles.sql`. This entry
supplies the justification that migration referenced but which was never written down.

**Status:** Confirmed — supersedes Blueprint §10.1 and cancels MASTER_PLAN Phase 4.1

---

## DEC-008: Product Rename — MyFin → NoorixFin

**Decision:** The product, monorepo, npm scope, and all user-facing text are renamed from
`MyFin` to **`NoorixFin`**. The npm scope changes from `@myfin/*` to `@noorixfin/*`.

**Rationale:** Blueprint §1.1 flagged `MyFin` as a live collision — a Bulgarian digital wallet
(myfin.bg), `MyFin Budget`, and at least one App Store expense tracker all use the name. Shipping
under a colliding name risks store-listing rejection, trademark challenge, and forced post-launch
rename with user-visible breakage. `NoorixFin` is distinctive and renaming now costs a mechanical
sweep; renaming after launch costs app-store identity, deep links, and user trust.

**Scope of the rename:**
| Layer | Change |
|-------|--------|
| npm scope | `@myfin/money` → `@noorixfin/money` (and `domain`, `i18n`, `design-tokens`, `api-client`, `test-fixtures`) |
| Apps | `web`/`api`/`mobile` → `@noorixfin/web` / `@noorixfin/api` / `@noorixfin/mobile` |
| Root package | `myfin` → `noorixfin` |
| UI text | i18n catalogs (bn + en), page titles, SEO metadata, Swagger title |
| Expo | `app.json` name / slug / scheme / bundle identifiers |
| Docs | Blueprint, memory files, READMEs, `.env.example` header |

**Explicitly NOT renamed:** database table, column, constraint, index, and policy identifiers. No SQL
identifier contains "myfin" — only comments do. Renaming schema objects would force a destructive
migration for zero benefit.

**Blocker closed:** BLK-001 item #1 (final product name / trademark clearance) — clearance itself is
still an owner/legal action before public launch, but the working name is now settled.

**Status:** Confirmed — execution tracked as Phase 1.11

---

## DEC-009: Web Session Management — Cookie-Backed JWT + Rotating Refresh

**Decision:** The Next.js app stores the Supabase session in **httpOnly, Secure, SameSite=Lax cookies**
via `@supabase/ssr`, refreshed by Next.js middleware on every matched request. Access tokens are short
lived; refresh tokens rotate. No token is ever written to `localStorage` or `sessionStorage`.

**Implementation contract** (as built — see plan §1.13):
- **The file is `src/proxy.ts`, not `middleware.ts`** — Next.js 16 renamed the convention and the
  exported function is `proxy()`. A `middleware.ts` would be silently ignored.
- **httpOnly means the browser client cannot see the session**, so sign-in/up/out are Server Actions in
  `app/auth/actions.ts`. This was not anticipated when DEC-009 was written; it is the correct trade for
  the XSS protection, but it makes all authenticated data access server-side.
- `lib/supabase/client.ts` — `createBrowserClient`, now unused and unable to read the session
- `lib/supabase/server.ts` — `createServerClient` bound to Next's `cookies()`, for RSC/route handlers
- `middleware.ts` — calls `supabase.auth.getUser()` to trigger refresh and write rotated cookies back on the response, and gates `/dashboard/*`
- Server-side auth checks use **`getUser()`**, never `getSession()` — `getSession()` reads the cookie without verifying the JWT signature, so it is untrustworthy on the server
- The API client attaches the access token as `Authorization: Bearer`
- ~~a **single-flight** refresh handles concurrent 401s~~ — **AMENDED 2026-08-04 during W3:** not
  implemented, deliberately. Single-flight guards N concurrent *browser* requests each firing a refresh;
  `proxy.ts` refreshes once per request before any handler runs, so the race cannot occur. It would have
  been a lock guarding nothing.
- Sign-out clears cookies server-side and calls `signOut({ scope: 'global' })`

**Rationale:** `localStorage` tokens are readable by any injected script, so one XSS becomes full
account takeover of a finance app. httpOnly cookies remove that path. Middleware-driven refresh means
the user is never bounced to login mid-session because a token expired between page loads.
`SameSite=Lax` plus the API's strict CORS origin list covers CSRF for our flows.

**Alternatives considered:** localStorage + client-only refresh (rejected: XSS exposure);
custom NestJS-issued session cookies (rejected: duplicates Supabase Auth's rotation and revocation for no gain).

**Status:** Confirmed — execution tracked as Phase 1.12

---

## DEC-010: Mobile Offline-First — Local SQLite, Sync Pushes Through the API

**Decision:** The Expo app is offline-first with a local **SQLite** mirror and an outbound **mutation
queue**. Writes go to local SQLite first and render immediately; a sync engine drains the queue
**through the NestJS API**, not directly into Supabase. Pull/refresh uses a delta cursor. Session is
persisted in **Expo SecureStore** so the user logs in once.

**The critical constraint — why push does not go straight to Supabase:**
Requirement as stated was "sync with the Supabase database." Writing rows directly from the device
would bypass NestJS, which is the only place that enforces balanced double-entry postings (DEC-006),
idempotency-key deduplication, optimistic-concurrency version checks, and audit-event emission. A
device that inserts a `journal_entry` without its balancing `journal_postings` produces a corrupt
ledger that no client-side code can detect. Therefore:

| Direction | Path | Reason |
|-----------|------|--------|
| **Push** (local → server) | Queue → `POST /v1/...` with `Idempotency-Key` | Server enforces balance, dedup, version, audit |
| **Pull** (server → local) | `GET /v1/workspaces/:id/sync?since=<cursor>` | Single delta endpoint, one round trip |
| **Invalidation hint** | Supabase Realtime, payload-free | Cheap "something changed" ping only |

The offline UX is identical either way; the difference is that the ledger stays provably correct.

**Sync engine rules:**
- **Storage:** `expo-sqlite` directly (not WatermelonDB) — we already model the ledger in SQL, and
  WatermelonDB's opinionated sync protocol would fight the API-mediated push above. Sensitive local
  data upgrades to SQLCipher via a development build (Expo Go cannot load it).
- **Queue durability:** the mutation queue is a SQLite table, not memory — it survives app kill.
- **Idempotency:** each queued mutation carries a client-generated UUID reused on every retry, so a
  retry after an ambiguous network failure can never double-post (satisfies FIN-02 on mobile).
- **Ordering:** FIFO per workspace; a permanently failing mutation (4xx) is parked in a "needs
  attention" state rather than blocking the queue behind it.
- **Conflict rule:** **server wins** on pull. Rejected local mutations (409 stale version) are
  surfaced to the user for re-entry rather than silently merged — silent merges on money are worse
  than a visible prompt.
- **Cursor:** `updated_at` watermark per table, requiring `updated_at` + tombstone columns on tables
  that lack them (migration `00004`).
- **Triggers:** app foreground, network regained (`expo-network`), Realtime hint, manual pull-to-refresh.

**Alternatives considered:** WatermelonDB (rejected — protocol mismatch with API-mediated push);
AsyncStorage (rejected — no query capability for a relational ledger); direct Supabase client writes
(rejected — violates DEC-005/DEC-006 as argued above).

**Status:** Confirmed — execution tracked as Phase 1.13 / 2.7

---

## DEC-011: Supabase Free Tier as the Design Constraint

**Decision:** Target Supabase **Free Tier** for dev, staging, and initial production. Every data-access
decision is budgeted against it rather than assuming headroom.

**Binding constraints (verify current numbers on the Supabase pricing page before launch — quotas change):**
database size, egress, monthly active users, **concurrent Realtime connections**, Realtime message
volume, and **project pausing after ~7 days of inactivity**. Concurrent Realtime connections and egress
are the ones our architecture actually pushes on.

**Optimization rules adopted:**
1. **One Realtime channel per user**, not per table or per screen. Subscribe only while the app is
   foregrounded or the tab is visible; tear down on background/blur.
2. **Payload-free Realtime.** Hints carry `{table, workspace_id}` only — never row data. Halves egress
   and keeps financial content out of the Realtime transport (also a privacy win, Blueprint §16).
3. **Realtime is an optimization, not a dependency.** Refetch-on-focus plus the delta pull is the
   correctness path; if Realtime is unavailable the app degrades to slightly staler data, not broken data.
4. **JWT verified locally via JWKS in NestJS**, replacing the current per-request `supabase.auth.getUser()`
   network call. That call is one extra round trip *per authenticated request* — the single largest
   avoidable source of API calls in the system today.
5. **Delta sync over full refetch.** `?since=<cursor>` returns changed rows only.
6. **Server-side aggregation.** Dashboard summaries computed in Postgres views/RPC and returned as one
   payload, instead of shipping raw transaction rows to the client to sum.
7. **Cursor pagination everywhere**, `SELECT` explicit columns (never `*` on hot paths), and covering
   indexes on `(workspace_id, updated_at)` for the sync endpoint.
8. **Connection pooling** via Supavisor in transaction mode from NestJS — the API must not hold one
   Postgres connection per request.
9. **Keepalive** against the 7-day inactivity pause on non-production projects.

**Status:** Confirmed — execution tracked as Phase 1.14

---

## DEC-012: Optimistic UI as the Default Interaction Model

**Decision:** TanStack Query on both web and mobile. Mutations apply optimistically with automatic
rollback on error. Every async surface has a skeleton matching its final layout. No spinner-only screens
on primary flows.

**Rules:**
- **Optimistic-first for user-initiated writes** (add/edit transaction, category, account): the row
  appears instantly with the client-generated id, reconciled against the server response.
- **Rollback is mandatory** — `onError` restores the previous cache snapshot and surfaces a non-blocking,
  actionable toast. A silently-vanishing transaction is worse than an error.
- **Skeletons mirror layout** so nothing shifts when data lands (protects CLS and the "instant" feel).
- **Prefetch on intent** — hover/focus on web, tab-press on mobile.
- **`staleTime` tuned per resource:** reference data (categories, accounts) long; transaction lists short.
  This is also a free-tier lever (DEC-011).
- **Never optimistic:** balance/report figures derived server-side from the ledger. Showing a guessed
  balance that later corrects itself destroys trust in a finance app. Those get skeletons, not optimism.

**Status:** Confirmed — execution tracked as Phase 1.15

---

## DEC-013: Super Admin Bootstrap via SQL

**Decision:** Ship `supabase/setup/create_super_admin.sql` — a parameterised, service-role-only script
that provisions a `SUPER_ADMIN` from the database level with no UI form. Two entry points:

1. **`promote_super_admin(email)`** — `SECURITY DEFINER` function that flips `profiles.is_super_admin`
   for an existing auth user. **The recommended path**: the auth user is created through Supabase Auth
   (signup or Admin API) so password hashing, identity rows, and confirmation state are handled by
   Supabase itself.
2. **Raw bootstrap block** — inserts directly into `auth.users` + `auth.identities` (password hashed with
   `crypt(:'password', gen_salt('bf'))`), then `profiles`, `workspaces`, `workspace_members`. For local
   and self-hosted first-boot where no user exists yet.

**Rationale:** There must be a way to create the first operator before any UI exists, and an ops-level
recovery path if admin access is lost. Splitting it in two keeps the common case on the supported
Supabase path and confines the brittle part — `auth.users` is Supabase-internal and its shape can change
across versions — to a clearly-labelled bootstrap block.

**Safety requirements (non-negotiable):**
- Password is passed as a `psql` variable (`-v password=...`), **never hardcoded or committed**.
- The file carries an explicit header: service-role/`psql` only, never reachable from an app connection.
- The script is **idempotent** — re-running promotes rather than duplicating.
- Every run writes an `audit_events` row. Super-admin creation must never be invisible.
- `SUPER_ADMIN` grants **platform/metadata** access only; it does **not** grant read access to other
  users' financial rows (DEC-002 #12, DEC-007). RLS policies must not add a super-admin bypass on
  ledger tables.

**Status:** Confirmed — execution tracked as Phase 1.16

---

## DEC-014: Acceptance Matrix Re-Scoped and Gated on Live Verification

**Decision:** The 15-item acceptance matrix (Blueprint §21.2) is re-scoped for the two-role model and
must be executed against a **live Supabase instance**. Until then, no item may be recorded as anything
better than "not tested" — schema constraints existing is not evidence they hold.

**Re-scoped items under DEC-007:**
| ID | Was | Now |
|----|-----|-----|
| SEC-01 | User A cannot access User B's personal workspace | Unchanged — now the *primary* isolation test |
| SEC-02 | Viewer cannot mutate | **Rewritten:** (a) a non-owner cannot read or mutate another user's workspace by direct PostgREST call; (b) a `USER` cannot perform `SUPER_ADMIN` actions; (c) `SUPER_ADMIN` cannot read another user's ledger rows |
| SYNC-01 | Web and Mobile show same committed data | Unchanged, but now also covers offline→online convergence (DEC-010) |
| SYNC-02 | Stale edit detected | Extended: a queued mobile mutation against a stale version returns 409 and surfaces to the user |
| FIN-02 | Retry cannot duplicate | Extended: mobile queue replay after app kill cannot double-post |

**Method:** pgTAP for RLS/constraint-level tests (`supabase/tests/`), Supertest for API-level negative
tests, Playwright for web E2E. RLS tests must be executed as an **anon/authenticated role with a real
JWT** — running them as `postgres` bypasses RLS and produces a false pass, which is the single most
common way an RLS suite lies.

**Gate:** Phase 2 exit is blocked until SEC-01, SEC-02, FIN-01, FIN-02, FIN-03, SYNC-01, SYNC-02 pass
live with recorded evidence in `TEST_RESULTS.md`.

**Status:** Confirmed — execution tracked as Phase 1.17

---

## DEC-015: Categories Are Workspace-Scoped and Own a Backing Ledger Account

**Decision:** Every category row is workspace-scoped and owns a `ledger_accounts` row of subtype
`CATEGORY`. There are no global category rows. "System" is not a column — a category is
system-provided iff `translation_key IS NOT NULL`.

| Concept | Implementation |
|---|---|
| Is it a system category? | `translation_key IS NOT NULL` |
| Display name | `custom_name ?? t(translation_key)` — resolved client-side, so one row renders in bn or en |
| Income vs expense | `kind` (matches the backing account's `class`) |
| What a posting references | `category.ledger_account_id` — **never** `category.id` |

**Why not global system categories, which Blueprint §9.3 implies** (`workspace_id nullable (system
category হলে null)`): a category must reference a ledger account (`ledger_account_id` is NOT NULL), and
ledger accounts are workspace-scoped (`ledger_accounts.workspace_id` NOT NULL). A global category would
therefore have to point at some specific workspace's account — incoherent — or have no account, in which
case nothing could be posted against it. **The schema forces per-workspace materialisation.** The
nullable `workspace_id` column is left in place (harmless, blueprint-compatible) but is never used.

**Cost accepted:** ~16 categories + 16 ledger accounts per workspace. Negligible against the Free Tier
database budget (DEC-011). **Benefit:** users can rename, recolour, or archive any category, including
system ones, which shared global rows could not allow without a separate override table.
**Trade-off:** new system categories added later do not appear in existing workspaces automatically;
that needs a backfill migration.

**What this fixed.** The previous implementation targeted a schema that never existed:

1. `categories.service.ts` read and wrote `is_system`, `name`, and `type` — none are columns. The list
   query ordered by `is_system` and `name`, so `GET /categories` returned a 400 every time.
2. `seedSystemCategories()` inserted those phantom columns and omitted the NOT NULL
   `ledger_account_id`, so every seed insert failed.
3. **`buildPostings()` in `transactions.service.ts` passed `category_id` as `ledger_account_id`.** Those
   are different tables and `journal_postings.ledger_account_id` has an FK to `ledger_accounts`, so
   every income and expense insert violated it. Now resolved via
   `CategoriesService.resolveLedgerAccountId()`.

None of this had surfaced because nothing has ever run against a live database.

**Database support (migration `00006_categories_alignment.sql`):**
- Partial unique indexes on `(workspace_id, translation_key)` and category account names — makes seeding
  idempotent under concurrent first requests
- `CHECK (custom_name IS NOT NULL OR translation_key IS NOT NULL)` — a row must be nameable
- Trigger enforcing that a category's `kind` equals its account's `class` **and** both share a workspace.
  A mismatched pairing would silently invert the sign of every transaction using it; a cross-workspace
  pairing would breach SEC-01

**Also fixed:** `PATCH /categories/:id` had no `WorkspaceMemberGuard` and no workspace in its path, so
cross-workspace writes were stopped by RLS alone. Now `PATCH /workspaces/:workspaceId/categories/:id`
with the guard, per DEC-005 (NestJS primary, RLS defence-in-depth).

**Status:** Confirmed — supersedes the `workspace_id nullable` reading of Blueprint §9.3
