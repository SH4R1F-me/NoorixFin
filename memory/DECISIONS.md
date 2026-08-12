# NoorixFin — DECISIONS LOG

**Last updated:** 2026-08-08 (enterprise audit — DEC-025 raised, still open)
**Product name:** NoorixFin (renamed from MyFin — see DEC-008)

> **Numbering gap:** `DEC-021` (server-side locale resolution) and `DEC-022`
> (budget figures recomputed from the ledger) are cited by ~10 source files but
> were never written up here. Their rationale is recoverable only from the code
> that cites them, so they are recorded as missing rather than reconstructed
> from guesswork. Next free id is **DEC-026**.

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

---

## DEC-016: Enterprise Admin Console — Metadata Only, with One Audited Aperture

**Decision:** Reverse the deferral of the admin console (DEC-013 shipped only the SQL bootstrap) and
build it, under a hard constraint: **SUPER_ADMIN remains a platform/metadata role with no access to any
user's financial rows.**

`SUPER_ADMIN` is a *dual role*, not a separate account type. The same person uses `/dashboard` for their
own finances exactly like any other user, and switches to `/admin` for platform operations. The two
modes are deliberately unmistakable — emerald user shell vs amber operator shell with a persistent
"OPERATOR MODE" band — because the entire risk of a dual-role account is acting in one mode while
believing you are in the other.

**The aperture, and why it is not a bypass:**
The console needs to answer "how many accounts does this user have?", which requires touching ledger
tables RLS forbids the operator to read. Three options existed:

| Option | Verdict |
|---|---|
| Super-admin RLS policy on the ledger | **Rejected** — hands over every amount, payee and note |
| No numbers at all | Rejected — makes User Management useless for support |
| A fixed, auditable `SECURITY DEFINER` projection | **Chosen** |

`admin_platform_stats()` and `admin_user_overview()` are `SECURITY DEFINER`, gated internally on
`is_super_admin()`, and **return only `bigint` counts, timestamps, and profile fields the user chose
themselves**. The return type IS the security boundary: no parameter combination can make either emit a
monetary value. Acceptance test `ADMIN-05c` asserts the signature contains no money-shaped column;
`ADMIN-06` asserts no ledger table has gained a super-admin policy.

**Verified live (2026-08-04):** an operator hitting another user's `/transactions`, `/accounts`,
`/summary`, `/categories` gets 403; direct RLS reads of `journal_postings`, `journal_entries`,
`ledger_accounts` return 0 rows; and no admin API response contains a seeded payee, note or amount.

**Three independent gates**, none load-bearing alone: `SuperAdminGuard` (API) · RLS + in-function checks
(database) · `notFound()` in `app/admin/layout.tsx` (web — a 404, not a redirect, so the console's
existence is not disclosed).

**Not editable from the console:** `is_super_admin`. Promotion stays a service-role SQL operation
(DEC-013) so granting platform access always leaves a psql-shaped footprint.

**Status:** Confirmed — implemented and verified 2026-08-04. Supersedes the deferral noted in DEC-013.

---

## DEC-017: Account Deletion — 30-Day Grace, Not Immediate Erasure

**Decision:** "Delete my account" schedules deletion; it does not perform one. The account is banned via
Supabase Auth `banned_until`, marked `PENDING_DELETION`, and given a `deletion_scheduled_for` 30 days
out. **No row is removed during the grace period.** `purge_expired_deletions()` then deletes in foreign-key
dependency order and returns the purged ids so the caller can remove the auth user.

**Rationale:** a finance app that irreversibly destroys years of records on one click is not one people
should trust with years of records. The grace period makes the action recoverable by an operator
(`POST /v1/admin/users/:id/reinstate`, which also cancels the schedule).

**Enforcement is the auth server, not a column.** `banned_until` means GoTrue refuses to issue or
refresh tokens, so no per-request database check is needed on the hot path (DEC-011). *Honest
limitation:* an access token already issued stays valid until it expires (`jwt_expiry`, 1h by default)
because the API verifies JWTs locally. Refresh is blocked immediately, so continued access is capped at
one token lifetime.

**Deliberately NOT done — do not "fix" this:** `workspaces.created_by`, `ledger_accounts.created_by`,
`journal_entries.created_by` and `idempotency_records.actor_user_id` were left as `RESTRICT`, not
changed to `CASCADE`. Cascading would let a single `auth.admin.deleteUser()` — or a mis-click in the
Supabase dashboard — silently erase an entire ledger. Leaving them RESTRICT means such a call fails
loudly, and the only path that destroys a ledger is the purge function, after 30 days. Only
`audit_events.actor_id`/`workspace_id` became `ON DELETE SET NULL`, so the audit trail outlives the
account it documents.

**No scheduler exists in this stack yet.** The purge is exposed as an explicit operator action
("Run purge") and the function is ready to attach to pg_cron or an Edge scheduled function.

**Status:** Confirmed — implemented 2026-08-04. Owner decision recorded in session 18.

---

## DEC-018: Observability — API-Written `system_events`, Bounded by Design

**Decision:** Add `system_events` as an operational log written by the NestJS API with the service role,
kept separate from `audit_events`.

| | `audit_events` | `system_events` |
|---|---|---|
| Answers | WHO did WHAT to WHICH resource | HOW the system behaved |
| Nature | Security/business record | Operational telemetry |
| Retention | Indefinite; survives account deletion | Pruned on a retention window |

Conflating them would force a choice between dropping audit history on a retention sweep and paying to
keep every 500 forever.

**Free Tier is the constraint (DEC-011).** Writes are buffered in a bounded ring (500 rows) and flushed
every 2s, so an error storm costs one batched INSERT per interval rather than one per event. A full
buffer drops the **oldest** and emits a `TELEMETRY_BUFFER_OVERFLOW` record — silent truncation would read
as "nothing else happened". `record()` is synchronous, returns void, and swallows everything: telemetry
that can 500 the endpoint it observes is worse than no telemetry.

**Never recorded:** request bodies and query strings. On this API they carry amounts, payees and notes,
which an operator has no right to (DEC-002 #12). Route templates only. Ordinary 400/404/409 are not
recorded either — they are the bulk of all failures and would bury the signal; 5xx is ERROR, and
401/403/429 are WARN because that shape is what credential-stuffing looks like.

**The live feed is SSE from NestJS, not Supabase Realtime** — Free Tier caps concurrent Realtime
connections, and this feed has at most a handful of operator viewers. One indexed query every 3s is the
cheaper trade. The browser holds no token (DEC-009), so `EventSource` talks to a Next route handler that
attaches the server-held token and pipes the upstream stream.

**Status:** Confirmed — implemented and verified 2026-08-04.

---

## DEC-019: Privilege Escalation Closed via Column-Level Grants

**Found while building DEC-016.** Migration 00008 granted `UPDATE ON public.profiles TO authenticated`
(every column) and 00001's policy allowed a user to update their own row with no column restriction.
Composed, **any authenticated user could run `UPDATE profiles SET is_super_admin = true WHERE id =
auth.uid()` and promote themselves to platform operator.** RLS restricts *rows*, never *columns*; the row
being their own was the only check, and it passed.

Nothing in the app did this, so it was latent — and it stops being latent the moment `is_super_admin`
gates an admin console.

**Fix (00012):** revoke the blanket UPDATE and re-grant only the columns a user legitimately edits about
themselves. `is_super_admin`, `status`, `suspended_*` and `deletion_*` are writable exclusively by the
service role, i.e. only through an endpoint that has already passed `SuperAdminGuard`. The INSERT policy
was also tightened to require `is_super_admin = FALSE`.

**Verified:** acceptance tests assert the escalation UPDATE is denied, that a suspended user cannot clear
their own status, and — as a positive control — that an ordinary display-name/locale update still works.

**Status:** Confirmed — closed 2026-08-04.

---

## DEC-020: `service_role` Table Privileges (the 00008 bug, one role across)

**Found on the first run of the admin API.** Every service-role write failed with
`42501: permission denied for table system_events`. `service_role` had **no INSERT/SELECT/UPDATE/DELETE
on a single table in this schema** — 00008 discovered and fixed exactly this class of bug for
`authenticated`, and fixed only `authenticated`.

Nothing noticed until now because until the admin console there was no service-role write path in the
product: `getServiceClient()` existed and was documented, but every handler used `getUserClient()`.

**Fix (00014):** explicit per-table grants for the six tables the API actually writes with that role.

**Deliberately no `ALTER DEFAULT PRIVILEGES` for `service_role`** — unlike the equivalent line 00008 added
for `authenticated`. `service_role` has `BYPASSRLS`: for `authenticated` a too-broad grant is still fenced
by row policies, but for `service_role` **the grant is the entire boundary**. A blanket default would
silently hand the API's admin identity full read access to every future ledger table. Every service-role
grant is therefore explicit and reviewable.

**Second defect fixed alongside:** `AdminService.translate()` mapped *any* `42501` to
`403 NOT_SUPER_ADMIN`. But 42501 arrives from two unrelated causes — our RPC's super-admin gate, and a
missing grant. Collapsing them told an operator who *was* a super admin that they were not one, which is
how a misconfigured deployment spends an afternoon looking like a permissions puzzle. They are now
distinguished by message, and a missing grant reports 503 with a pointer to migration 00014.

**Status:** Confirmed — closed 2026-08-04.

---

## DEC-023: Rate limits are keyed on the VERIFIED USER, not the IP

**Date:** 2026-08-05 (Session 24) · **Supersedes part of audit item 14**

`ThrottlerGuard` tracks by `req.ip`. That was survivable under one global budget
of 10 req/s, and stopped being survivable the moment audit item 14 introduced
tiers: `ThrottleSensitive` allows **three requests per minute**.

**Measured before the change:** one user's data export left a *different* user's
export returning 429 from the same loopback address. Behind any reverse proxy
that does not set `X-Forwarded-For` correctly, every user shares one bucket and
the tier collapses to a global three-per-minute — which presents as an outage.
Meanwhile the abuse case the limit exists to stop, one caller hammering one
account, is unaffected by changing IP.

**Decision:** `IdentityThrottlerGuard` keys on `user:<sub>` from a **verified**
token, falling back to `ip:<addr>`.

**The token must be verified, and this is the whole decision.** The obvious
shortcut is to decode the JWT without checking its signature — it is only a
cache key. It is not: an unverified `sub` is attacker-chosen, so anyone wanting
an unlimited budget mints a new one per request. That is strictly *worse* than
keying on IP, because it removes the limit rather than sharing it. Verification
is local (DEC-011) — an in-process signature check against a cached JWKS — so it
costs microseconds and no quota. The auth guard verifies the same token again
moments later; duplicating that is far cheaper than making the throttler depend
on guard ordering.

**Status:** Confirmed — verified live, 4 checks; 7 unit tests.

---

## DEC-024: Operator MFA is enforced on the SESSION's assurance level

**Date:** 2026-08-05 (Session 24) · **Closes audit item 18**

A super-admin account protected only by a password was the weakest link in an
otherwise careful authorization design.

**Decision:** TOTP via Supabase Auth (`auth.mfa.totp`), enforced by
`SuperAdminGuard` requiring `aal2` on every `/v1/admin/*` route.

**Why the `aal` claim and not a profile column.** A column saying "this operator
has MFA enabled" is satisfied by a stolen password: the attacker signs in, the
column still reads true, the console opens. `aal` describes how *this session*
was established, so it cannot be satisfied without the factor being presented.
Verified: a new password-only sign-in on an already-enrolled operator is still
refused. A stored flag would have passed that test — that is the distinction,
and without it the control would be decoration.

**Ordering is part of the design.** The MFA check runs *after* the operator and
status checks, so a non-operator receives `NOT_SUPER_ADMIN` and a 404 and never
learns that MFA guards an admin surface.

**A missing claim counts as unverified**, not as unknown-allow. An Auth server
that stops emitting `aal` is precisely where failing open would be silent and
total.

**It cannot lock anyone out.** Enrolment lives at `/dashboard/settings`, outside
the admin gate, so an operator with no factor can always sign in, enrol, step up
and return; the refusal names that path. Recovery from a lost authenticator is
service-role SQL, like the promotion that made them an operator (DEC-013).

**Operators cannot remove their own factor.** A self-service switch that turns
off the control protecting the console means a stolen session simply turns it
off. Ordinary users can.

**Consequence to accept:** MFA is a paid-plan feature on Supabase's managed
platform. On a plan without it, `/admin` becomes unreachable for anyone not
already enrolled. Recorded in `supabase/config.toml` above the provider block.

**Status:** Confirmed — 11 live checks, 3 new guard unit tests, 2 E2E specs.

---

## DEC-025: What "enterprise-grade" means here — OPEN, awaiting the owner

**Date raised:** 2026-08-08 (enterprise audit) · **Status: PROPOSED — NOT RATIFIED**

> This entry exists to stop a drift, not to record a choice. **The owner has not
> answered.** Nothing below has been decided; the working assumption is stated so
> that Phases 0–5 could proceed, and it is labelled as an assumption everywhere
> it has consequences.

`audit_and_development.md` asked for the system to be elevated to
"enterprise-grade." That phrase resolves two different ways here, and the two
produce different products:

- **Reading A — enterprise *quality*, same audience.** Rigour, observability,
  security, accessibility and reliability at an enterprise standard, still
  serving free individual and household users. Achievable on free or
  self-hosted infrastructure.
- **Reading B — enterprise *customers*.** Adds multi-member workspaces with a
  role matrix, SSO/SAML/SCIM, contractual retention, SLAs and a billing
  surface.

**Why this cannot be left implicit.** Reading B contradicts two things already
written down: DEC-011 makes the **Supabase Free Tier the design constraint**, and
the marketing site's central promise is *"100% free, no subscription, no ads."*
Supabase SSO is a paid-plan feature; multi-year audit retention does not fit the
free tier's storage; an SLA is a paid-infrastructure commitment by definition.
Reading B is therefore not a backlog of features — it is an amendment to DEC-011
and to the product's public promise.

**Working assumption (not a decision): Reading A.** The audit and the Phase 0–5
roadmap are written for it. Every Reading-B item is tagged `[B-only]` and
quarantined in Phase 6 so it can be dropped without unpicking anything else.

**What is genuinely blocked on the answer.** Only Phase 6 — the `OWNER`-only
role check in `workspace_members`, the invitation flow, and the RLS rewrite that
multi-member workspaces require. Phases 0–5 are identical under both readings,
which is why work proceeded without an answer.

**To close this:** the owner picks A or B, this entry is rewritten as a decision
with that rationale, and its status becomes Confirmed. If B, DEC-011 must be
amended in the same commit rather than left contradicting it.

**Status:** **OPEN.** Assumed-A for planning purposes only. No code depends on
this entry today.
