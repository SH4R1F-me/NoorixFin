# NoorixFin — MASTER IMPLEMENTATION PLAN

**Generated from:** `NoorixFin_Production_Blueprint.md` v1.0 (originally `MyFin_Production_Blueprint.md`)
**Created:** 2026-08-01
**Revised:** 2026-08-08 — enterprise audit (see [`audit_and_development.md`](../audit_and_development.md))
**Status:** ACTIVE — Phase 1 In Progress

---

## Audit Summary

**Refreshed 2026-08-08 against `310e1dd`** by reading the source and querying the
running local database. The previous table was written in Session 3 and had gone
five sessions stale — it still described 3 migrations and a default Expo
template, both long superseded. Verify this table against the code before
trusting it; do not let it drift again.

| Item | Status (verified 2026-08-08) |
|------|--------|
| API | **10 controllers, ~70 routes** across 13 feature modules — health, profiles, account, workspaces, accounts, categories, transactions (+tags), planning, sync, admin (25 routes) |
| Web | **Next.js 16 App Router — 15 marketing pages, 9 dashboard pages, 6 admin pages**, auth + onboarding. Only **4 shared components** — see audit gap E2 |
| Mobile | **3 screens** (`_layout`, `index`, `sign-in`). The sync engine beneath is production-quality; the UI above it is a test harness. Active workspace is still hardcoded from `EXPO_PUBLIC_DEV_WORKSPACE_ID` — audit Finding A |
| Database | **21 migrations, 24 public tables.** `workspace_members.role` is still `CHECK (role = 'OWNER')` — one member per workspace, audit Finding B |
| Shared packages | 7 — `domain`, `money`, `i18n`, `design-tokens`, `db-types`, `test-fixtures`, and `api-client` (**still an `echo` stub**) |
| Tests | 26 `.spec.ts` + 2 `.test.ts` (7 API suites, 13 sync-engine tests), 20 Playwright e2e specs, SQL invariants for tenant isolation / ledger balance / idempotency |
| CI | 3 jobs — static, migrations-from-scratch + generated-type drift + SQL acceptance, and e2e run **twice** (once with the API deliberately unreachable) |
| Blueprint completeness | Full 1330-line spec; §10.1 (role matrix) **superseded by DEC-007** |
| Open owner decisions | 12 items (Section 26) — **#1, #5, #11 closed** by DEC-008, DEC-007, DEC-011. **DEC-025 (enterprise scope A vs B) is newly open and unanswered** |
| Live verification | The 15-item acceptance matrix has **still never been run end-to-end** against a live instance — W8 remains the Phase 2 gate |
| Notifications | **None.** No table, no push, no in-app centre — audit Finding C |
| Observability | `system_events` + `audit_events` + SSE feed exist. **No error tracker, no APM, and no way to tell a mobile request from a web one** — audit gaps R1, R3 |

---

## Technology Stack (Blueprint §2.3, as amended)

| Layer | Technology | Amendment |
|-------|-----------|-----------|
| Web | Next.js App Router + TypeScript | Cookie-backed sessions via `@supabase/ssr` (DEC-009) |
| Mobile | React Native + Expo + TypeScript | Offline-first, `expo-sqlite` mirror + mutation queue (DEC-010) |
| Backend | NestJS modular monolith + REST/OpenAPI | Local JWKS verification, not per-request `getUser()` (DEC-011) |
| Database | Supabase PostgreSQL | **Free Tier is the design constraint** (DEC-011) |
| Auth | Supabase Auth | Two roles only: `SUPER_ADMIN`, `USER` (DEC-007) |
| Storage | Supabase Storage (private buckets) | — |
| Realtime | Supabase Realtime | **Payload-free invalidation hints only**, one channel per user |
| Local cache | Expo SQLite (SQLCipher via dev build) | Durable mutation queue lives here |
| Secrets | Expo SecureStore | Session persistence — log in once |
| i18n | i18next + react-i18next + Expo Localization | — |
| Client state | TanStack Query | Optimistic updates mandatory (DEC-012) |
| Monorepo | pnpm workspace + Turborepo | npm scope `@noorixfin/*` (DEC-008) |
| API contract | OpenAPI-generated clients | `packages/api-client` still a stub |

---

## Session 3 Work Packages — Execution Order

These are the seven items introduced this session. **W1 runs alone and lands first** — it touches
nearly every file, so anything merged alongside it will conflict.

```
W1  Rename (@myfin → @noorixfin)          ← ✅ DONE 2026-08-04
     │
     ├── W2  Scope cut (DEC-007 cleanup)  ✅ DONE ─┐
     ├── W3  Web session management  ✅ DONE  ├── independent, can run in parallel
     ├── W6  Super-admin SQL  ✅ DONE       ─┘
     │
     ├── W5  Free-tier opt  🟡 MOSTLY DONE ──→ W4  Mobile offline-first  🟡 CORE DONE
     │        (sync endpoint + cursor          (consumes the sync endpoint)
     │         columns are W4's input)
     │
     └── W7  UI/UX perf  🟡 INFRA DONE (wiring blocked on API)
                 │
                 └── W8  Live verification of the acceptance matrix  ← gate, runs last
```

---

## Phase 1 — Foundation (CURRENT)

> **Exit criteria:** Rename complete, two-role model enforced and proven, web sessions survive refresh,
> mobile works offline, acceptance matrix green against a live instance.

### 1.1 Monorepo Setup — ✅ COMPLETE
### 1.2 Local Supabase Setup — ✅ COMPLETE (migrations written; **not yet verified live**)
### 1.3 NestJS API Foundation — ✅ COMPLETE
### 1.4 Auth Flow — 🟡 PARTIAL (`GET /v1/me`, `PATCH /v1/me/preferences` done; reset/verify pending)
### 1.5 Workspace Model — ✅ COMPLETE (simplified per DEC-007)
### 1.6 Ledger Schema — ✅ COMPLETE
### 1.7 Shared Packages — ✅ COMPLETE (renamed to `@noorixfin/*` in 1.11)
### 1.8 Next.js Web Foundation — 🟡 PARTIAL
### 1.9 Expo Mobile Foundation — ❌ NOT STARTED (scaffold only)
### 1.10 Phase 1 Tests — ❌ BLOCKED on live Supabase (see 1.17)

---

### 1.11 — W1: Project Rename → NoorixFin (DEC-008) — ✅ **COMPLETE (2026-08-04)**

> Landed as one change across every workspace. Build 7/7, test 4/4, typecheck 7/7 green.

**Step 1 — Package identity**
- [x] `packages/*/package.json`: `@myfin/x` → `@noorixfin/x` (money, domain, i18n, design-tokens, api-client, test-fixtures)
- [x] `apps/*/package.json`: `web`/`api`/`mobile` → `@noorixfin/web` / `@noorixfin/api` / `@noorixfin/mobile`
- [x] Root `package.json`: `name` and `description`
- [x] Update every `dependencies` / `devDependencies` entry referencing `@myfin/*` (`workspace:*` protocol preserved)

**Step 2 — Code references**
- [x] Rewrite all `import ... from '@myfin/...'` statements across `apps/` and `packages/`
- [x] `tsconfig.json` path aliases in each app, if present
- [x] Doc-comment headers in `packages/*/src/index.ts`

**Step 3 — User-facing text**
- [x] `packages/i18n/locales/{bn,en}/common.json` — app name strings (3 occurrences each)
- [x] `apps/web/src/lib/locales/{bn,en}/common.json` — same
- [x] `apps/web/src/app/layout.tsx` — SEO title/description/OG metadata
- [x] `apps/web/src/app/page.tsx` (7), `auth/login/page.tsx` (2), `dashboard/layout.tsx` (2)
- [x] `apps/web/src/app/globals.css`, `landing.css` — comment headers
- [x] `apps/api/src/main.ts` — Swagger title/description (3)
- [x] `apps/mobile/app.json` — `name`, `slug`, `scheme`, iOS bundle id, Android package

**Step 4 — Infrastructure & docs**
- [x] `.env.example` header; `infra/docker/README.md`; `supabase/tests/README.md`
- [x] SQL **comments only** in migrations `00001`–`00003` and `seed.sql`
- [x] `git mv MyFin_Production_Blueprint.md NoorixFin_Production_Blueprint.md`; update §1.1 naming warning to record the collision as *resolved*
- [x] `memory/*.md` — including `BLOCKERS.md` and `TEST_RESULTS.md`, not just the three updated this session

**Step 5 — Verify**
- [x] `pnpm install` (regenerates `pnpm-lock.yaml` with new package names)
- [x] `grep -ri "myfin" --exclude-dir=node_modules` returns **only** the historical note in the blueprint and DEC-008
- [x] `pnpm build && pnpm typecheck && pnpm test` all green

> **Do NOT rename:** database table/column/constraint/index/policy identifiers. No SQL identifier
> contains "myfin" — comments only. Renaming schema objects would force a destructive migration for nothing.

---

### 1.12 — W2: Two-Role Scope Cleanup (DEC-007) — ✅ **COMPLETE (2026-08-04)**

> Smaller than planned: domain types, workspaces controller/service/DTOs, `@RequireSuperAdmin`, and
> `SuperAdminGuard` had already been cleaned alongside migration `00003`. Build 7/7 · test 4/4 · typecheck 7/7.

- [x] `packages/domain/src/index.ts` — *already clean* (`MemberRole = 'OWNER'`, `WorkspaceType = 'PERSONAL'`, no invitation types)
- [x] **🔴 SUPER_ADMIN bypass removed** from `workspace-member.guard.ts`. Membership is now the only way through. Side benefit: deletes a `profiles` lookup that ran on every workspace-scoped request (DEC-011 win).
- [x] Role-hierarchy comparison — *already absent*; the guard was a boolean membership check plus the bypass
- [x] `require-role.decorator.ts` — *already reduced* to `@RequireSuperAdmin()`. ⚠️ Both it and `SuperAdminGuard` are **currently unused** — no admin endpoints exist yet (W6 will be their first consumer)
- [x] `apps/api/src/workspaces/` — *already clean*; controller exposes only `POST /v1/workspaces` and `GET /v1/workspaces`
- [x] `apps/web` — removed the sidebar **Family** nav item (a dead link: `/dashboard/family` has no page), swapped the login page's "Family Workspace" feature bullet for "Goals & Debt Tracking" in both languages, dropped the now-unused `Users` icon import
- [x] `packages/test-fixtures` — *already single-owner*. Kept as-is: Alice is SUPER_ADMIN **and** owns workspace A while Bob owns workspace B, which is exactly the fixture SEC-02(c) needs
- [x] Migration **`00004_two_role_cleanup.sql`** (renumbered from 00005 — W2 lands before W5, and since no database has ever been migrated, renumbering avoids out-of-order application later). Four changes: RLS recursion fix, `INVITED` status removal, one-member-per-workspace index, one-personal-workspace-per-user index
- [x] i18n: removed `nav.family`, `workspace.family`, `workspace.createFamily`, `onboarding.personaFamily` from all four catalogs. Parity re-verified: 170/170 en/bn in both copies
- [x] **Confirmed clean:** the four SUPER_ADMIN policies cover only `workspaces`, `profiles`, `workspace_members`, `audit_events` — all metadata. No ledger table has a super-admin policy. `getServiceClient()` is never called by any service, so every read is RLS-enforced. Migration `00004` carries a scope reminder to keep it that way
- [x] **Cancelled** Phase 4.1 (Family Workspace Full Implementation) — see Phase 4 below

---

### 1.12b — Package Integration Pass — ✅ **COMPLETE (2026-08-04)**

> Unplanned, run between W2 and W3 at the owner's request. Closed the three "Open Findings" from W2.
> build 7/7 · typecheck 9/9 · test 6/6 (task counts rose because the dependency graph is now connected).

**Root cause found first:** every shared package emitted **ESM** (`export const ...`) into `dist/index.js`
while declaring no `"type": "module"`. Node therefore loads them as CommonJS and throws
`SyntaxError: Unexpected token 'export'`. This never surfaced because **no app had ever imported one**.
The packages would have broken NestJS at runtime, not at build time.

- [x] `packages/{money,domain,i18n,design-tokens}/tsconfig.json` -> `module: CommonJS`, `moduleResolution: node`
      (the base config's `moduleResolution: bundler` is incompatible with a CommonJS emit, so both had to change).
      CJS is the one format all three consumers accept - NestJS (CJS at runtime), Next.js, and Metro.
- [x] Verified by `require()`-ing all four from real Node, then again from inside `apps/api`
- [x] `apps/api` -> depends on `@noorixfin/money`, `@noorixfin/domain`
- [x] `apps/web` -> depends on `@noorixfin/i18n`, `@noorixfin/money`
- [x] **`transactions.service.ts`: `parseInt(dto.amount, 10)` -> `parseMinorUnits(dto.amount)`.**
      `parseInt` silently truncates `"12.7"` to `12` and accepts `"10abc"` as `10`; `parseMinorUnits`
      throws on both. Directly relevant to DEC-004 and FIN-01. Confirmed the compiled output emits
      `require("@noorixfin/money")` and resolves at runtime.
- [x] **Deleted `apps/web/src/lib/locales/`** - a hand-copy of `packages/i18n/locales/`, byte-identical
      after normalisation (verified before deleting). `lib/i18n.ts` now consumes the shared package and
      gains the `errors` namespace it never had.
- [x] **`fmt()` helpers in `accounts/page.tsx` and `transactions/page.tsx`** hardcoded the taka sign and
      `/100`. Replaced with `getCurrency(c).symbol + formatAmount(minor, c, 'en-BD')` - preserves the
      glyph exactly (plain `formatMoney` renders `"BDT 1,000.00"`, a visual regression) while applying
      each currency's real exponent. The old code rendered JPY (exponent 0) 100x too small.

**Deferred:** `@noorixfin/design-tokens` is still unconsumed. Wiring it means replacing the inline-style
system across every web page - that is a W7 (UI/UX) job, not a dependency fix.

---

### 1.13 — W3: Web Session Management (DEC-009) — ✅ **COMPLETE (2026-08-04)**

> build 7/7 · typecheck 9/9 · test 6/6. Two version-specific findings forced design changes — see below.

**⚠️ Next.js 16: `middleware.ts` is renamed `proxy.ts`,** exporting `proxy()` not `middleware()`
(confirmed in `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`, and
in the build output: `ƒ Proxy (Middleware)`). `cookies()` and `searchParams` are also async now.

**⚠️ httpOnly forced auth server-side.** `@supabase/ssr`'s browser client reads the session from
`document.cookie` — which httpOnly cookies deliberately block. Honouring DEC-009 therefore meant moving
sign-in/up/out to Server Actions. The browser now never holds a token, which is the point, but it is a
larger change than "add a middleware" and it cascades: client components can no longer call Supabase or
NestJS directly.


- [x] `lib/supabase/server.ts` — `createServerClient` bound to `await cookies()`, plus `getCurrentUser()`
- [x] **`src/proxy.ts`** (not `middleware.ts` — renamed in Next 16) — refresh per matched request, rotated cookies written to the response, `/dashboard/*` protected with `?next=` preserved, matcher excludes static assets and images (DEC-011)
- [x] Cookie flags: `httpOnly`, `Secure` (prod only), `SameSite=Lax`, `path=/`
- [x] **Applied the `headers` argument of `setAll`.** This `@supabase/ssr` version passes no-store cache
      headers alongside auth cookies; dropping them lets a CDN cache a response carrying one user's
      session cookie and serve it to another user. Easy to miss — it is a second parameter.
- [x] All authorization uses `getUser()`. The one remaining `getSession()` is in `api-client.ts` purely to read the raw token for forwarding — commented as such, since NestJS re-verifies it
- [x] `lib/api-client.ts` — server-only (`import 'server-only'`), attaches Bearer + optional `Idempotency-Key`, typed `ApiError`, `no-store` by default
- [x] **Single-flight refresh dropped as dead code, deliberately.** It exists to stop N concurrent
      *browser* requests each firing a refresh. Here `proxy.ts` refreshes once per request before any
      handler runs, so the race cannot occur. Implementing it would have been a lock guarding nothing.
- [x] `app/auth/actions.ts` — `signIn`/`signUp`/`signOut` Server Actions; sign-out uses `scope: 'global'`; sign-in returns a generic error code rather than the provider message (that message distinguishes 'no such user' from 'wrong password' — a user-enumeration oracle); `next` redirect validated against absolute URLs
- [ ] Route handler for auth callback / email confirmation — **still open**, needed when email verification and password reset land (plan §1.4)
- [ ] **Tests: still open — nothing here is verified against a running Supabase.** Deferred to W8 with
      the rest of the live matrix: session survives hard refresh; expired token refreshes without a
      login bounce; unauthenticated `/dashboard` → `/auth/login`; **assert no token in `localStorage`
      *or* in a JS-readable cookie**.

**Callers updated:** login page split into a server `page.tsx` (reads `searchParams`, which is a Promise
in this version) + client `login-form.tsx` — a client `useSearchParams()` bails the tree out of
prerendering and failed the production build. Dashboard layout split into a server `layout.tsx` +
client `dashboard-shell.tsx`. Landing page's client session check removed. `lib/supabase/client.ts` is
now unused and carries a warning that it cannot see the session.

> **Forward risk for W5:** browser Realtime subscriptions need a token the browser can read, which
> httpOnly now prevents. W5 must pick one of: mint a short-lived token server-side, subscribe on the
> server and relay over SSE, or subscribe anonymously under RLS. Noted in `lib/supabase/client.ts`.

---

### 1.14 — W5: Free-Tier Optimization (DEC-011) — 🟡 **MOSTLY COMPLETE (2026-08-04)**
### *(scheduled before W4 — it produces the sync endpoint and cursor columns W4 consumes)*

> build 7/7 · typecheck 9/9 · test 6/6. Two items deferred with reasons; one blocked on a W3 consequence.


- [x] Migration **`00005_sync_cursors.sql`**:
  - `updated_at` + triggers on `categories`, `tags`, `journal_postings`, `journal_entry_tags`; `created_at` where missing
  - **`workspace_id` denormalised onto `journal_postings` and `journal_entry_tags`**, filled by a
    `BEFORE INSERT` trigger that copies it from the parent entry (derived, never caller-supplied, so it
    cannot drift). Two wins: the sync scan can use a `(workspace_id, updated_at)` index on a column the
    table now has, and the postings RLS policy drops from a two-table join to one
  - `deleted_at` tombstones on `ledger_accounts`, `categories`, `tags`. **Not** on the ledger — entries
    are corrected by reversal, never deleted (FIN-03), so a delete tombstone there would imply an
    operation the domain forbids
  - `(workspace_id, updated_at)` indexes on all six syncable tables, plus a partial index for **system
    categories**, whose `workspace_id` is NULL (they are global in the schema)
- [x] `GET /v1/workspaces/:workspaceId/sync?since=&limit=` — one round trip, all six tables, explicit
      column lists. Design notes worth knowing before W4 consumes it:
  - **At-least-once delivery.** Query uses `gte`, not `gt`, so rows sharing the boundary timestamp are
    re-sent rather than skipped. The client MUST upsert by primary key
  - **Cursor safety under truncation.** If any table hits `limit`, the returned cursor is the *earliest*
    watermark among truncated tables, so untruncated tables get re-scanned. Redundant, never lossy
  - **Known limitation, guarded:** if >`limit` rows share one `updated_at` the cursor cannot advance and
    the client would loop. Detected and rejected with `SYNC_CURSOR_STALLED` rather than looping silently.
    Real fix when CSV import (Phase 4) makes it likely: a composite `(updated_at, id)` cursor
- [x] **Local JWT verification** — new `JwtVerifierService` using `jose`; `createRemoteJWKSet` caches
      keys in memory and only refetches on an unknown `kid`, so this is not a per-request fetch. Falls
      back to HS256 when `SUPABASE_JWT_SECRET` is set (legacy projects). Removes one Auth-server round
      trip from **every** authenticated request — the single largest avoidable call source in the system.
      **Trade-off accepted and documented in the service:** local verification cannot know a user was
      banned or deleted after issuance, so a token stays usable for up to one access-token TTL. Global
      sign-out revokes refresh tokens, capping the window. Fix if it ever matters: a short deny-list, not
      a return to per-request `getUser()`
- [ ] **Realtime — BLOCKED on a W3 consequence, not yet built.** httpOnly session cookies (DEC-009) mean
      the browser has no readable token to authenticate a Realtime subscription. Mobile is unaffected
      (SecureStore), so this can land with W4 for mobile while web waits on one of: mint a short-lived
      token server-side, subscribe on the server and relay over SSE, or subscribe anonymously under RLS.
      Payload-free hints also need `realtime.broadcast_changes()` triggers, which want a live DB to
      validate — deferring rather than writing untestable SQL
- [x] Correctness path is the delta pull, not Realtime — the sync endpoint stands alone and needs no
      Realtime to converge. Refetch-on-focus wiring lands with the clients (W4/W7)
- [ ] **Dashboard summary RPC — deferred to W7.** The dashboard still renders mock data; there is
      nothing to aggregate yet. Writing the RPC now would be guessing at the shape its consumer needs
- [x] **N+1 removed** from the tag handling in `transactions.service.ts` — was up to 3 queries *per tag*
      (select, insert, link), now 3 total regardless of tag count via bulk upsert + `in()` + bulk insert
- [x] Explicit column lists on the accounts and transactions **list** paths; accounts list also now
      filters the new `deleted_at`. Note: `.select()` must be a single string literal — supabase-js infers
      the row type from it, and a concatenated expression degrades to `GenericStringError`
- [x] Cursor pagination already in place on `listTransactions`
- [x] `DATABASE_POOLER_URL` documented in `.env.example` — Supavisor **transaction mode** (port 6543),
      not the direct 5432 connection. Wiring it is a deployment step; there is no live project yet
- [ ] Keepalive job — deferred until a hosted project exists to keep alive
- [ ] **Confirm current Free Tier quotas** before launch — still open, and deliberately not guessed at
      here. DEC-011's numbers are from spec-time

> **🔴 Found during W5, out of scope, needs its own task: the categories module does not match its
> schema.** `categories.service.ts` reads and writes `is_system`, `name`, and `type`; migration 00002
> defines none of them (the real columns are `translation_key`, `custom_name`, `kind`) and requires a
> NOT NULL `ledger_account_id` that `seedSystemCategories()` never supplies. Every categories insert and
> the list query would fail at runtime. This is a module rewrite needing a design call — are system
> categories global (`workspace_id IS NULL`, as the schema implies) or seeded per workspace (as the
> service assumes)? The sync endpoint handles **both** shapes, so it is safe either way.

---

### 1.15 — W4: Mobile Offline-First Sync (DEC-010) — 🟡 **ENGINE COMPLETE & TESTED (2026-08-04)**

> The offline engine is built and **executed**: 13 tests against the real schema and queue SQL
> (TEST-008), which found and fixed a silent data-loss bug. Feature screens remain minimal — no bottom
> nav, no add-transaction screen, no device/simulator run yet.


**Foundation (unblocks everything else in this package)**
- [x] expo-router structure (`app/_layout.tsx`, `sign-in.tsx`, `index.tsx`); entry switched to `expo-router/entry`, default template deleted. **Bottom navigation not built** — one screen exists
- [x] Dependencies installed via `expo install` (version-matched to SDK 57): `expo-sqlite`, `expo-secure-store`, `expo-network`, `expo-crypto`, `expo-localization`, `expo-router`, plus `@tanstack/react-query`, `@supabase/supabase-js`, `react-native-url-polyfill`, and the four `@noorixfin/*` workspace packages
- [ ] i18next wiring + `@noorixfin/design-tokens` — packages are installed but not yet consumed; screens use literal styles

**Session — log in once**
- [x] `src/lib/supabase.ts` — SecureStore storage adapter (keys sanitised: SecureStore rejects characters supabase-js puts in its key names, which would silently fail to persist), `autoRefreshToken`, `detectSessionInUrl: false`
- [x] `startAuthAutoRefresh()` — foreground-only refresh, so a backgrounded device does not spend auth calls (DEC-011)
- [x] Root layout restores the session before the first frame, then routes to `/sign-in` or `/`

**Local database**
- [x] `src/db/schema.ts` — six mirrored tables + `_sync_meta` + `_mutation_queue`, WAL, indexes. Amounts are INTEGER minor units (DEC-004; SQLite INTEGER is 64-bit). `journal_entries.is_pending` marks unconfirmed local writes
- [x] `src/repositories/transactions.ts` — reads hit SQLite only. Amount is derived by summing postings rather than stored on the entry, so the list stays honest after a reversal (DEC-006). Accounts/categories repositories not yet written

**Sync engine**
- [x] `src/sync/queue.ts` — FIFO drain through the API; the queue row id **is** the Idempotency-Key and the local row id, so a retry resolves to the same server row (FIN-02)
- [x] `src/sync/engine.ts` — pages until `has_more` is false (bounded at 50), upserts in a transaction, advances the cursor, clears `is_pending`. **Push runs before pull**, else a pull would overwrite an optimistic row with the server's older copy and the new transaction would visibly flicker away
- [x] `useSyncTriggers` — mount, foreground, network-regained (false→true edge only), pull-to-refresh. **No timer polling**, deliberately (DEC-011). Realtime hint slots in when W5's Realtime work unblocks
- [x] Exponential backoff with jitter, capped at 5 min. 4xx (except 408/429) parks as NEEDS_ATTENTION; retryable failures stop the drain rather than hammering a dead network
- [x] Server wins on pull (upsert). 409 parks for the user — never a silent merge
- [x] Status strip on the transactions screen with pending count; optimistic rows labelled `pending` rather than hidden

**Tests**
- [x] **All four W4 tests PASS (2026-08-04).** Airplane-mode round trip, kill-mid-queue relaunch,
      idempotency replay, and 409 surfacing — run against the real schema and queue SQL via a
      `node:sqlite` harness, no simulator required. **Found and fixed silent data loss:** mutations left
      `IN_FLIGHT` by an app kill were never retried and never surfaced. See TEST_RESULTS.md TEST-008

**Known gaps, deliberately left:**
- **Only the journal entry is written locally, not its postings.** Postings must balance (DEC-006) and
  only the server can build them — the category must be resolved to its backing ledger account
  (DEC-015), which the device may not have. So a pending row shows the amount the user typed and the
  real postings arrive on the pull. An alternative would be building postings client-side, which is
  exactly the ledger-corruption risk DEC-010 exists to prevent
- **Workspace id is read from `EXPO_PUBLIC_DEV_WORKSPACE_ID`.** Workspace selection needs
  `GET /v1/workspaces` on first launch plus local caching — not yet wired, and marked TODO in the screen
- **SQLCipher not wired.** Requires a development build (Expo Go cannot load it); the local DB is
  currently unencrypted
- **No add-transaction screen.** `createTransaction()` exists and is queue-wired, but nothing calls it

---

### 1.16 — W6: Super Admin Bootstrap SQL (DEC-013) — ✅ **COMPLETE (2026-08-04, verified live)**


- [x] `supabase/setup/create_super_admin.sql` — both paths executed against a real database:
  - Header block: service-role/`psql` only; never reachable from an application connection
  - `promote_super_admin(email)` — `SECURITY DEFINER`, flips `profiles.is_super_admin`; **the recommended path**
  - Raw bootstrap block for first-boot: `auth.users` + `auth.identities` with `crypt(:'password', gen_salt('bf'))`, then `profiles`, `workspaces` (PERSONAL), `workspace_members` (OWNER)
  - **Idempotent** — re-running promotes, never duplicates
  - Writes an `audit_events` row on every run
- [x] Password supplied as a `psql` variable (`-v password=...`) — never hardcoded, never committed
- [x] `supabase/setup/README.md` — usage, and an explicit warning that direct `auth.users` writes are Supabase-internal and version-sensitive
- [x] Verify `SUPER_ADMIN` grants **no** read access to other users' ledger rows (DEC-002 #12)
- [x] Add to `.gitignore`: any `*.local.sql` produced from the template

---


**Live verification (TEST-006):** Path B created + promoted an operator; Path A re-run produced no
duplicate user and no duplicate workspace; password stored bcrypt (`$2a$...`); two `audit_events` rows,
one per run. **Critically: the new super admin reads 0 `journal_entries` and 0 `ledger_accounts` while
seeing 3 workspaces of metadata** — DEC-013's core promise demonstrated, not asserted.

**Bug found and fixed while testing:** the first draft put Path B in a `DO $$ ... $$` block. psql does
**not** interpolate `:'vars'` inside dollar-quoted bodies, so `:'email'` reached the parser literally and
the script aborted. Rewritten as plain `INSERT..SELECT..WHERE NOT EXISTS`, which also made it naturally
idempotent. This would not have been caught by review — only by running it.
### 1.17 — W7: UI/UX Performance (DEC-012) — 🟡 **INFRASTRUCTURE COMPLETE (2026-08-04)**

> build 7/7 · typecheck 11/11 · test 8/8 · e2e **14/14**. The loading/animation/layout layer is built
> and verified. Optimistic mutations are implemented as a tested pattern but **not yet wired to screens**
> — the dashboard still renders mock data, and wiring real data needs the API, which needs Supabase.


**Web**
- [x] TanStack Query installed; `src/app/providers.tsx` mounts `QueryClientProvider` with per-resource `staleTime` (`reference` 5m / `transactions` 30s / `reports` 60s) — also a DEC-011 lever, since every avoided refetch is an avoided Supabase call. Verified mounted with no hydration errors
- [x] `src/lib/use-optimistic-mutation.ts` — cancel → snapshot → apply → **restore verbatim on error** →
      invalidate on settle. Rollback restores the snapshot rather than refetching, which could race or
      fail offline too. `mutationFn` is a **Server Action**, not a fetch: under DEC-009 the browser holds
      no token
- [ ] **Not yet wired to screens** — dashboard/accounts/transactions still render mock data. Wiring is
      blocked behind a working API, which is blocked on Supabase
- [x] `src/components/skeleton.tsx` — `SummaryCardsSkeleton`, `ListRowsSkeleton`, `PageHeaderSkeleton`, all with dimensions copied from the real components so nothing shifts when data lands
- [x] `loading.tsx` for all five dashboard routes, each mirroring its own page's layout
- [x] Prefetch: `next/link` prefetches on hover/viewport by default; no custom work needed
- [x] Enforced by documentation at both sites: the skeleton module and the mutation hook each state that balances/net-worth/report figures must never be optimistic, and why (a guessed balance that self-corrects destroys trust in a way a brief blank does not)
- [x] **CLS measured in CI** via `PerformanceObserver` in Playwright — landing and login both < 0.1
      (Google's "good" threshold). Dashboard CLS needs a session, so it is not yet measurable
- [ ] LCP / INP not yet measured — INP in particular needs real interaction against real data

**Mobile**
- [x] Already true since W4 — the repository layer reads SQLite only
- [x] Already true since W4; the queue path is covered by 13 tests (TEST-008)
- [x] `src/components/Skeleton.tsx` replaces the spinner with a layout-matched skeleton; `FlatList`
      virtualisation bounded (`initialNumToRender` 12, `maxToRenderPerBatch` 12, `windowSize` 7,
      `removeClippedSubviews`). FlashList not adopted — FlatList already virtualises, and adding a
      dependency for an unmeasured gain is not justified yet
- [ ] 60fps check on a low-end Android device — needs a device build; still open

---


**Accessibility, done here rather than deferred to A11Y-01:** shimmer elements are `aria-hidden`
(`accessibilityElementsHidden` on mobile) with the loading state announced via a `role="status"` region;
`prefers-reduced-motion` disables the web shimmer and `AccessibilityInfo.isReduceMotionEnabled()`
disables the mobile pulse. A continuous shimmer is a vestibular trigger, and it is cheaper to build this
in than to retrofit it. Verified in CI: keyframes present, and the animation is genuinely suppressed
under an emulated reduced-motion context.
### 1.18 — W8: Live Acceptance Verification (DEC-014) — **PHASE GATE**

> Nothing here can be signed off from reading the schema. `supabase start` must be running.

- [ ] `supabase start`; `supabase db reset` applies `00001`–`00005` cleanly
- [ ] Seed two real auth users (User A, User B) + one `SUPER_ADMIN` via W6's script
- [ ] pgTAP suite in `supabase/tests/` — **executed as `authenticated` with a real JWT, never as `postgres`** (running as `postgres` bypasses RLS and produces a false pass; this is the most common way an RLS suite lies)
- [ ] API-level negative tests (Supertest) + web E2E (Playwright)
- [ ] Record every result with evidence in `TEST_RESULTS.md` — no item may sit above "not tested" without a live run

| ID | Test | Notes |
|----|------|-------|
| SEC-01 | User A cannot read/write User B's workspace | Primary isolation test |
| SEC-02 | **(re-scoped)** non-owner blocked via direct PostgREST; `USER` cannot do `SUPER_ADMIN` actions; `SUPER_ADMIN` cannot read another user's ledger | Replaces "Viewer cannot mutate" (DEC-007) |
| SEC-03 | Service-role key absent from web and mobile bundles | Grep the built artifacts |
| FIN-01 | Every posted journal balanced | DB constraint + property test |
| FIN-02 | Retry cannot duplicate | Incl. mobile queue replay after app kill |
| FIN-03 | Correction preserves history | Reversal, not delete |
| SYNC-01 | Web and Mobile agree on committed data | Incl. offline→online convergence |
| SYNC-02 | Stale edit → 409 | Incl. queued mobile mutation |
| I18N-01 | bn/en key parity | Automate as a CI check |
| TIME-01 | Timezone boundary correctness | Cross-midnight in a non-UTC zone |
| DATA-01 | Export complete and workspace-scoped | |
| DATA-02 | Deletion flow end-to-end | |
| BACKUP-01 | Restore usable + ledger checksum | |
| STORE-01 | Store privacy declarations accurate | Post-rename (DEC-008) |
| A11Y-01 | Core flow accessible (WCAG 2.2 AA) | Incl. Bangla truncation at 200% zoom |

---

## Phase 2 — Core Finance

> **Exit criteria:** Financial invariants proven live. **Blocked** until SEC-01, SEC-02, FIN-01/02/03,
> SYNC-01, SYNC-02 pass with recorded evidence (DEC-014).

### 2.1 Accounts Module — 🟡 API done, web done, mobile pending
### 2.2 Categories Module — 🟡 API done, web done, mobile pending
### 2.3 Transaction Engine — 🟡 API done, web list/form done; reversal + splits pending
- [ ] `POST /v1/transactions/:id/reverse` — reversal entry (§8.2)
- [ ] Split transaction support
- [ ] Optimistic concurrency (`version`) end-to-end
- [ ] DB constraint: debit/credit not both positive; no zero-only posting
- [ ] Mobile: transaction list, quick-add, detail (offline-capable per DEC-010)

### 2.4 Cross-Device Sync — folded into W4/W5
### 2.5 Dashboard Summary — 🟡 web done; server-side aggregation pending (W5); mobile pending
### 2.6 Phase 2 Tests — see 1.18
### 2.7 Mobile Feature Parity — accounts, categories, transactions, dashboard on the offline stack

---

## Phase 3 — Planning

> **Exit criteria:** Monthly plan → transaction → budget/report/calendar lifecycle E2E pass.

### 3.1 Budgets Module — simple category limits (DEC-002 #6)
### 3.2 Recurring Rules — `REMIND_ONLY` / `AUTO_CREATE_DRAFT`
### 3.3 Calendar & Bills
### 3.4 Goals & Debts
### 3.5 Reports — cash flow, net worth, category breakdown, drill-down to source transactions
### 3.6 Notifications & Outbox — transactional outbox; in-app only (no per-member fan-out under DEC-007)
### 3.7 Phase 3 Tests

---

## Phase 4 — Privacy & Data Portability

> **Scope reduced by DEC-007.** Formerly "Family, Privacy & Data Portability."

### ~~4.1 Family Workspace Full Implementation~~ — ❌ **CANCELLED (DEC-007)**
> Invitation flow, role matrix, member audit, and workspace-level member settings are removed from
> scope entirely — not deferred. Re-introducing them later is an additive change (role values +
> invitations table + membership join in RLS); it does not reshape the ledger.

### 4.2 CSV Import/Export — upload, mapping, duplicate detection, batch import, group reversal, CSV + JSON export
### 4.3 Account & Workspace Deletion — request, impact explanation, 30-day retention (DEC-002 #10)
### 4.4 Receipt Pipeline — private bucket, allowlist, checksum, scan status, signed URLs, metadata stripping
### 4.5 Phase 4 Tests — DATA-01, DATA-02, attachment security

---

## Phase 5 — Production Hardening

### 5.1 Infrastructure — dev/staging/prod separation **within Free Tier limits** (DEC-011); Docker prod builds; CI/CD gates
### 5.2 Security Review — OWASP ASVS + MASVS; secret scanning (SEC-03); dependency scan; CSP headers
### 5.3 Backup & Recovery — restore rehearsal + ledger checksum (BACKUP-01)
### 5.4 Performance — load test, p95 ≤ 500ms, query plan review, pooler config
### 5.5 Accessibility — WCAG 2.2 AA, keyboard nav, screen reader, Bangla truncation at 200% zoom, reduced motion
### 5.6 Monitoring — structured logging, dashboards, alerting + runbooks, admin console (metadata-only, DEC-013)

---

## Phase 6 — Public Launch

- [ ] **Trademark clearance for "NoorixFin"** — owner/legal action (DEC-008 settles the working name, not the legal clearance)
- [ ] Store declarations (STORE-01) under the new name
- [ ] Privacy policy + terms matching actual behaviour — must state single-user workspaces (DEC-007)
- [ ] Staged rollout, incident/support process, metrics review
- [ ] V2 scope decision from measured usage — **family workspaces re-evaluated here**

---

## Dependency Graph

```
W1 Rename ──→ everything (land alone, first)
  │
  ├── W2 Scope cut ─────────────────┐
  ├── W3 Web session ───────────────┤
  ├── W6 Super-admin SQL ───────────┤
  │                                 │
  └── W5 Free-tier opt ──→ W4 Mobile offline-first
           (00004 cursors +          │
            sync endpoint)           │
                                     │
                    W7 UI/UX perf ←──┘ (needs W3 for web, W4 for mobile)
                         │
                         └──→ W8 Live verification ──→ PHASE 2 UNBLOCKED
```

---

## Assumptions Carried Forward

Owner decisions still open (Blueprint §26): launch countries, 18+ confirmation, login methods beyond
email/password, budget model, multi-currency, receipt-upload timing, business model, retention periods,
support-access policy. Defaults in DEC-002 remain in force until the owner rules otherwise.

**Closed this session:** product name (DEC-008), workspace sharing model (DEC-007), hosting tier (DEC-011).
