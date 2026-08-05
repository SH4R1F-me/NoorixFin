# NoorixFin — PROGRESS LOG

**Last updated:** 2026-08-05 — Session 24
**HEAD:** `980e99a` on `feat/noorixfin-foundation`

> ➡️ **For "what do I do next", read `memory/SESSION_STATE.md`.** It is the
> resume file. This log is the historical record and reads oldest-last.

---

## Session 24 — 2026-08-05 — Closing the audit's Tier 3 and the a11y pass

Five commits. Every item in the audit's Tier 1, Tier 2 and Tier 3 lists is now
closed; four items from its §2.3/§6 tables remain (see SESSION_STATE §5).

| Commit | Audit items | What landed |
|---|---|---|
| `3e47ade` | 13, 17, 14 | CI pipeline · data export (DATA-01) · **rehearsed** backup/restore (BACKUP-01) · throttle re-keyed from IP to verified user |
| `b233311` | 16 | Idempotency for operator writes · migration `00018` |
| `ac07900` | 18 | Operator MFA/TOTP enforced on the `aal` claim · admin E2E suite un-skipped |
| `e3445eb` | — | The last 4 E2E specs CI never ran · API-down CI step |
| `980e99a` | 10, §6.6, §6.9 | WCAG 2.2 AA scan as a CI gate · the responsive shell it exposed · Google OAuth wired |

### Nine defects found by executing rather than reading

1. CI started the API from the repo root — `envFilePath` is cwd-relative, so it
   died on the first `getOrThrow`.
2. **The backup runbook restored ZERO tables.** Four separate corrections; see
   `supabase/BACKUP_RESTORE.md` §6 for the rehearsal log.
3. The rate-limit throttle was IP-keyed, so under a 3-per-minute tier one user
   429'd another from the same address. Measured, then fixed and re-measured.
4. `idempotency_records` had **RLS disabled** with a SELECT grant to
   `authenticated` — a latent tenant leak that using the table would have
   activated. Closed in `00018` *before* first use.
5. `ci-assertions.sql` failed on its own leftovers on a second run.
6. **10 E2E tests never ran** — including the entire operator access-control
   file. A skipped test reports as a pass.
7. **The app had no responsive CSS at all** — not one media query. 376px of
   horizontal scrolling at the reflow-equivalent of 200% zoom.
8. Contrast failed systemically: four colours, ~60 occurrences, worst 2.35:1.
9. A live Google client secret reached the staging area in a downloaded JSON.
   Caught in the staged diff; the pattern is now gitignored.

### Two of my own tests were wrong

Recorded because both would otherwise have produced "fixes" to things that were
never broken:

- The first Bangla-clipping check flagged every heading. `scrollHeight` exceeds
  `clientHeight` whenever a line box is taller than its box — with
  `overflow: visible` that text renders perfectly.
- The first axe run reported contrast failures against colours nobody sees:
  cards were scanned **mid-fade-in at 13% opacity**.

### Verification at `980e99a`

typecheck clean · lint 0/0 · **76 unit** · **78 E2E** (1 skipped by design) ·
18 migrations from scratch · `ci-assertions.sql` green on the source **and on a
restored database** · locale parity 358 keys · db types fresh.

### Acceptance matrix movement

- **BACKUP-01** — was "not tested". Now rehearsed end to end; see the rehearsal
  log in `supabase/BACKUP_RESTORE.md` §6.
- **DATA-01** — was "not tested". Export implemented and verified across 24 live
  checks plus an E2E download.

---

## Historical log (Sessions 1–18)

## Current Phase: 1 — Foundation
## Current Task: blocked — see "What needs you" below

> W1–W6 + categories rewrite done. **W8's DB layer verified live** (Session 10); API/client layers open.
> W7 pending. Realtime still blocked; dashboard RPC deferred to W7.

---

## Completed Work

### Session 1 — 2026-08-01

| # | Task | Status | Evidence |
|---|------|--------|----------|
| 0.1 | Read full blueprint (1330 lines) | ✅ Done | All 29 sections parsed |
| 0.2 | Audit existing project | ✅ Done | Only the blueprint existed — greenfield |
| 0.3 | Create memory/ tracking files | ✅ Done | 5 files created |
| 1.1a | Root monorepo config | ✅ Done | package.json, pnpm-workspace.yaml, turbo.json, tsconfig.base.json |
| 1.1b | Code quality config | ✅ Done | .prettierrc, .gitignore, .nvmrc, .env.example |
| 1.1c | pnpm + Turborepo installed | ✅ Done | pnpm 11.18.0, turbo 2.10.7 |
| 1.7a | `money` package | ✅ Done | 44/44 tests pass — currency, minor-unit arithmetic, balance validation, formatting |
| 1.7b | `domain` package | ✅ Done | 25+ types/interfaces/enums from blueprint §9 — builds clean |
| 1.7c | `i18n` package | 🟡 Partial | ~~full key parity~~ — **claim was inaccurate**: `en/errors.json` was never created and the package did not compile. Corrected in Session 4 |
| 1.7d | `design-tokens` package | ✅ Done | Colors, spacing, typography, shadows, animations |
| 1.7e | `test-fixtures` package | ✅ Done | 2 users, 3 workspaces, memberships |
| 1.7f | `api-client` package | ✅ Done | Placeholder for OpenAPI generation — still a stub |
| 1.2a | Supabase migrations | ✅ Done | 00001 (identity/access) + 00002 (ledger schema) with full RLS |
| 1.8a | Next.js web scaffolded | ✅ Done | App Router + TypeScript |
| 1.9a | Expo mobile scaffolded | ✅ Done | blank-typescript template — **still the default template** |
| 1.3a | NestJS API scaffolded | ✅ Done | Strict TypeScript |

### Session 2 — 2026-08-01

| # | Task | Status | Evidence |
|---|------|--------|----------|
| 1.3b–k | NestJS foundation | ✅ Done | Bootstrap, Supabase module, auth guard, membership guard, health, exception filter, request ID, throttler, build clean |
| 1.4a | Profiles module | ✅ Done | GET /v1/me, PATCH /v1/me/preferences with auto-create |
| 1.5a | Workspaces module | ✅ Done | Create/list + (now-obsolete) invitation and member endpoints |
| 1.8b–g | Web foundation | ✅ Done | Design system, auth pages, dashboard layout + page, landing, build clean |
| — | Accounts / Categories / Transactions modules | ✅ Done | API services + DTOs + web pages (ahead of plan — Phase 2 work) |
| — | Migration 00003 | ✅ Done | Role simplification — **applied without a recorded justification** (fixed in Session 3) |

### Session 3 — 2026-08-04 — Architecture & Planning

| # | Task | Status | Evidence |
|---|------|--------|----------|
| 3.1 | Resolve naming collision | ✅ Decided | **DEC-008** — `MyFin` → `NoorixFin`, npm scope `@myfin/*` → `@noorixfin/*`. Rename scoped to ~38 files; SQL identifiers explicitly excluded. Closes BLK-001 item #1. |
| 3.2 | Resolve DEC-007 scope discrepancy | ✅ Decided | **DEC-007** written with full justification — family workspaces dropped, two roles (`SUPER_ADMIN`, `USER`). Documents the reasoning migration 00003 referenced but never recorded. Cancels Phase 4.1. |
| 3.3 | Web session management design | ✅ Decided | **DEC-009** — httpOnly cookie sessions via `@supabase/ssr`, middleware refresh, `getUser()` over `getSession()`, single-flight refresh. |
| 3.4 | Mobile offline-first design | ✅ Decided | **DEC-010** — SQLite mirror + durable mutation queue; **push routed through NestJS, not direct to Supabase** (resolves the conflict with DEC-005/DEC-006); SecureStore session. |
| 3.5 | Free-tier optimization strategy | ✅ Decided | **DEC-011** — 9 optimization rules; single payload-free Realtime channel; local JWKS verification replacing per-request `getUser()`; delta sync endpoint. |
| 3.6 | UI/UX performance model | ✅ Decided | **DEC-012** — TanStack Query, optimistic writes with mandatory rollback, layout-matched skeletons; balances/reports explicitly excluded from optimism. |
| 3.7 | Super-admin bootstrap design | ✅ Decided | **DEC-013** — `promote_super_admin()` function + raw first-boot block; idempotent, audited, password via psql variable. |
| 3.8 | Acceptance matrix re-scope | ✅ Decided | **DEC-014** — SEC-02, SYNC-01/02, FIN-02 rewritten for two-role + offline model; live run is a Phase 2 gate. |
| 3.9 | Update MASTER_PLAN.md | ✅ Done | Rewritten — sections 1.11–1.18 (W1–W8), Phase 4.1 marked cancelled, real status on 1.1–1.10 |
| 3.10 | Update DECISIONS.md | ✅ Done | DEC-007 through DEC-014 added; DEC-002 table annotated with what's now closed |
| 3.11 | Update PROGRESS.md | ✅ Done | This entry |

### Session 4 — 2026-08-04 — W1 Rename Executed

| # | Task | Status | Evidence |
|---|------|--------|----------|
| 1.11.1 | Package identity | ✅ Done | All 9 workspace packages + root renamed. `pnpm ls -r` confirms `noorixfin`, `@noorixfin/{api,api-client,design-tokens,domain,i18n,mobile,money,test-fixtures,web}` |
| 1.11.2 | Code references | ✅ Done | Only one real cross-package import existed (`test-fixtures` → `domain`); rest were doc comments. `packages/test-fixtures/node_modules/@noorixfin/domain` symlink relinked by install |
| 1.11.3 | User-facing text | ✅ Done | i18n catalogs (both copies), landing/login/dashboard, Swagger title, `app.json` (name/slug/scheme + `com.noorixfin.app` bundle ids, validated against installed `@expo/config-types@57.0.2`) |
| 1.11.4 | Infrastructure & docs | ✅ Done | `.env.example`, both READMEs, SQL comments only, blueprint `git mv`'d, all 5 memory files |
| 1.11.5 | Verify | ✅ Done | build 7/7 · test 4/4 · typecheck 7/7 · lockfile regenerated |

**Judgement calls made during the rename:**

| Case | Decision |
|------|----------|
| Blueprint §1.1 (the naming-warning section) | **Not** blind-replaced — it documents the *real* MyFin products we collided with. Rewritten to record the collision as resolved while preserving the historical sources, with an explicit note that trademark clearance is still unperformed |
| Blueprint §26 items 1, 5, 11 | Struck through and annotated CLOSED, pointing at DEC-008 / DEC-007 / DEC-011 |
| `layout.tsx` SEO metadata | Title was "Personal & Family Finance" — dropped "Family" per DEC-007 rather than shipping a title advertising a cancelled feature |
| Repository *directory* name | **Left as `MyFin/`** — renaming the working directory would break the active session cwd and any local tooling paths. Cosmetic only; needs an owner decision |
| Remaining family-branded UI | Left for W2 (see findings below) — half-removing it in a rename commit would have been worse than leaving it coherent |

---

## Pre-Existing Defects Found During W1 Verification

The rename could not be verified until the repo built. `pnpm build` and `pnpm test` had **never passed
at the workspace level**. Four defects, none introduced by the rename (all confirmed against `git status`):

| # | Defect | Fix applied |
|---|--------|-------------|
| 1 | `packages/i18n/locales/en/errors.json` **missing** — `src/index.ts` imported it, so `@noorixfin/i18n` never compiled. Never committed (confirmed via `git log`). Contradicts the Session 1 claim of "full key parity" | Created by translating the bn catalog. Parity verified: `common` 174/174, `errors` 34/34, zero keys missing in either direction |
| 2 | `workspace-member.guard.ts:73` — TS2322, `request.params` is `string \| string[]` under Express 5 types | Collapsed to the first value with an explanatory comment |
| 3 | `apps/api` `test` script failed on **zero** `.spec.ts` files (37 source files, 0 tests) | Added `--passWithNoTests`. **The API has no test suite at all** — W8 must build one from scratch |
| 4 | `packages/i18n` `test` script failed on zero test files; `check:keys` script points at `scripts/check-keys.mjs`, which **does not exist** | Added `--passWithNoTests`. The key-parity CI check (I18N-01) still needs writing in W8 |

### 🔴 Security finding — deferred to W2, not fixed here

`apps/api/src/auth/guards/workspace-member.guard.ts` short-circuits the membership check for any
`is_super_admin` profile and attaches a **synthetic `role: 'OWNER'` membership**, giving a platform
operator full read *and write* access to any user's workspace and ledger.

This contradicts DEC-002 #12 ("no support staff finance-data access") and the DEC-013 safety
requirement. It is a deliberate design choice in existing code, not a typo — changing it alters
authorization behaviour, so it belongs in W2 where the whole role surface is reworked, not in a
rename commit. Flagged as the highest-priority W2 item in the plan (§1.12).

### Session 5 — 2026-08-04 — W2 Two-Role Cleanup Executed

Most of W2 turned out to be already done — domain types, the workspaces controller/service/DTOs,
`@RequireSuperAdmin`, and `SuperAdminGuard` were all cleaned alongside migration `00003` in Session 2.
The plan had assumed four-role code was still present throughout. Real remaining work was four items.

| # | Task | Status | Evidence |
|---|------|--------|----------|
| 1.12.1 | 🔴 Remove SUPER_ADMIN workspace bypass | ✅ Done | `workspace-member.guard.ts` — membership is now the only path through. Also deletes a `profiles` query that ran on **every** workspace-scoped request (DEC-011 win) |
| 1.12.2 | Migration `00004_two_role_cleanup.sql` | ✅ Written | 4 changes (below). **Not applied** — no live database exists |
| 1.12.3 | Web family surface removed | ✅ Done | Sidebar **Family** nav item (dead link — `/dashboard/family` has no page), login "Family Workspace" feature bullet → "Goals & Debt Tracking" (bn + en), unused `Users` import |
| 1.12.4 | i18n family keys removed | ✅ Done | `nav.family`, `workspace.family`, `workspace.createFamily`, `onboarding.personaFamily` from all 4 catalogs. Parity re-verified 170/170 en/bn in both copies |
| 1.12.5 | Verify | ✅ Done | build 7/7 · typecheck 7/7 · test 4/4 |

**Migration `00004_two_role_cleanup.sql` — renumbered from the planned `00005`.** W2 lands before W5,
and since no database has ever been migrated, taking 00004 now avoids inserting a lower-numbered
migration later (which Supabase applies out of order or skips). W5's sync-cursor migration becomes 00005.

Its four changes:

1. **RLS recursion fix (latent runtime break).** Migration `00003` defined *"Super admins can view all
   profiles"* `ON profiles` with `USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() ...))`.
   The subquery reads `profiles`, so evaluating the policy re-invokes it — PostgreSQL raises
   `42P17: infinite recursion detected in policy for relation "profiles"`. The other three super-admin
   policies query `profiles` from a different table, but that subquery is still subject to `profiles`'
   RLS, so they inherit the recursion. Replaced with a `SECURITY DEFINER` `public.is_super_admin()`
   helper (pinned `search_path`, `EXECUTE` granted to `authenticated` only). **Unverified — Docker is
   not running and the Supabase CLI is not installed, so this is reasoned from the policy definitions,
   not observed. W8 must confirm.**
2. **`INVITED` status removed.** `workspace_members.status` still defaulted to `'INVITED'` — a state
   deleted with the invitation system — while `WorkspaceMemberGuard` requires `'ACTIVE'`. Any INSERT
   omitting status would silently create a membership locked out of its own workspace. `WorkspacesService`
   sets it explicitly today, so nothing is broken *yet*; W6's bootstrap SQL would have been the second
   write path and the one to hit it.
3. **One member per workspace** — unique index on `workspace_members(workspace_id)`. DEC-007 states this
   but nothing enforced it; the PK `(workspace_id, user_id)` permits many members.
4. **One active personal workspace per user** — partial unique index closing a TOCTOU race in
   `WorkspacesService.createWorkspace()`, which checks-then-inserts with no constraint behind it.

**Security scope confirmed clean (the DEC-013 audit item):** the four SUPER_ADMIN policies cover
`workspaces`, `profiles`, `workspace_members`, and `audit_events` — metadata only. **No ledger table
has a super-admin policy**, and `getServiceClient()` is never called by any service, so every read runs
RLS-enforced under the caller's own JWT. Migration `00004` carries an explicit comment to keep it that way.

**Revised severity of the Session 4 security finding.** The guard bypass did *not* leak ledger data,
because RLS has no super-admin policy on ledger tables. What it did was invert the security model:
Blueprint §2.4 makes NestJS the primary authorization layer with RLS as defence-in-depth, and the bypass
left RLS as the *only* barrier. It would have become a live leak the moment any endpoint used
`getServiceClient()` — which W5's sync endpoint and W6's admin work both plausibly would.

### Session 6 — 2026-08-04 — Package Integration + W3 Web Sessions

**Package-integration pass** (details in plan §1.12b): root cause was that all four shared packages
emitted ESM into `dist/index.js` with no `"type": "module"` — Node would have thrown
`SyntaxError: Unexpected token 'export'` on first import, but nothing had ever imported them. Switched
to a CommonJS emit, verified by `require()` from real Node and from inside `apps/api`. Then wired
api→money+domain, web→i18n+money, replaced `parseInt` with `parseMinorUnits`, deleted the duplicated
web catalogs (verified identical first), and fixed the hardcoded `/100` formatters.

**W3 web session management** (plan §1.13). Two version-specific findings changed the design:

| Finding | Consequence |
|---------|-------------|
| **Next.js 16 renamed `middleware.ts` → `proxy.ts`** (function `proxy()`, not `middleware()`); `cookies()` and `searchParams` are async | Read from `node_modules/next/dist/docs/` per the app's AGENTS.md rather than from memory. Build output confirms `ƒ Proxy (Middleware)`. Writing `middleware.ts` would have silently done nothing |
| **httpOnly is incompatible with `@supabase/ssr`'s browser client**, which reads `document.cookie` | Honouring DEC-009 required moving sign-in/up/out to Server Actions. Bigger than "add a middleware", and it cascades: client components can no longer call Supabase or NestJS directly |
| **`setAll` takes a second `headers` argument** carrying no-store cache headers | Applied. Dropping them lets a CDN cache a response carrying one user's session cookie and serve it to another user |
| **Client `useSearchParams()` fails the production build** without a Suspense boundary | Login page split into server `page.tsx` (reads `searchParams`) + client `login-form.tsx` |

**Deliberately not built:** the single-flight refresh from DEC-009. It prevents N concurrent *browser*
requests each firing a refresh; `proxy.ts` refreshes once per request before any handler runs, so that
race cannot occur here. Building it would have been a lock guarding nothing. DEC-009 amended in the plan.

**Still open in W3:** the auth callback route handler (needed when email verification / password reset
land, plan §1.4), and every test — nothing in W3 is verified against a running Supabase.

**Forward risk logged for W5:** browser Realtime needs a JS-readable token, which httpOnly now prevents.
Three options noted in `lib/supabase/client.ts`.

**Process note:** while checking whether lint failures were pre-existing, I ran `turbo lint` against a
stashed tree. `apps/api`'s lint script is `eslint --fix`, so it rewrote source files and blocked the
stash pop. Recovered with `git checkout -- apps/api/src` then `git stash pop`; nothing was lost and the
tree was re-verified green. **`apps/api`'s `lint` script mutates files — do not run it speculatively.**

**Lint status:** 103 errors at HEAD before any of my changes — pre-existing, mostly unused imports,
`any`, and "cannot access refs during render" in the landing page. Not addressed; `lint` is not part of
the build/typecheck/test gate. Worth its own cleanup pass.

### Session 7 — 2026-08-04 — W5 Free-Tier Optimization

build 7/7 · typecheck 9/9 · test 6/6. Plan §1.14 has the full checklist; the parts worth reading:

| # | Item | Outcome |
|---|------|---------|
| 1 | Migration `00005_sync_cursors.sql` | `updated_at`+triggers on the 4 tables lacking them; **`workspace_id` denormalised onto `journal_postings`/`journal_entry_tags`** via a derive-from-parent trigger; `deleted_at` tombstones; 6 sync indexes + a partial index for system categories |
| 2 | `GET /workspaces/:id/sync` | One round trip, all six tables, explicit columns. At-least-once by design (`gte` not `gt`) — client must upsert |
| 3 | Local JWT verification | `JwtVerifierService` (`jose`), JWKS with in-memory key cache + HS256 fallback. Removes an Auth-server round trip from **every** authenticated request |
| 4 | N+1 removed | Tag handling went from up to 3 queries *per tag* to 3 total |
| 5 | Explicit columns | Accounts + transactions list paths |
| 6 | Supavisor pooling | Documented in `.env.example`; wiring is a deploy step |

**Design decisions inside the sync endpoint** (W4 depends on these):
- **At-least-once delivery.** Boundary rows repeat rather than being skipped. Losing a financial row to
  an off-by-one cursor is unacceptable; a duplicate upsert is free.
- **Cursor safety under truncation.** If any table hits the row limit, the cursor returned is the
  *earliest* watermark among truncated tables, so untruncated tables get re-scanned. Redundant, never lossy.
- **Guarded limitation.** If more than `limit` rows share one `updated_at`, the cursor cannot advance.
  Detected and rejected with `SYNC_CURSOR_STALLED` instead of looping forever. Proper fix — a composite
  `(updated_at, id)` cursor — is worth doing before CSV import (Phase 4) makes identical timestamps likely.

**JWT trade-off, accepted deliberately:** local verification cannot know a user was banned or deleted
after the token was issued, so a token stays usable for up to one access-token TTL (Supabase default 1h).
Global sign-out revokes refresh tokens, capping the window. Documented in `jwt-verifier.service.ts`. The
fix if it ever matters is a short deny-list, not a return to per-request `getUser()`.

**Deferred, with reasons:** dashboard summary RPC → W7 (the dashboard renders mock data; there is nothing
to aggregate yet). Keepalive job → when a hosted project exists. Free Tier quota confirmation → still open,
deliberately not guessed at.

**Blocked:** Realtime. httpOnly cookies (DEC-009) leave the browser with no readable token to authenticate
a subscription. Mobile is unaffected (SecureStore), so this can land with W4 for mobile while web waits on
the token decision. Payload-free hints also need `realtime.broadcast_changes()` triggers, which want a live
DB to validate — I'd rather defer than write untestable SQL.

### Session 8 — 2026-08-04 — Categories Rewrite (DEC-015)

build 7/7 · typecheck 9/9 · test 6/6. Full rationale in **DEC-015**.

**The design question resolved itself from the schema.** I had flagged "are system categories global or
per-workspace?" as needing your call. It turns out only one answer is possible: a category must
reference a ledger account (`ledger_account_id` NOT NULL), and ledger accounts are workspace-scoped
(`workspace_id` NOT NULL). A global category would have to point at one specific workspace's account —
incoherent — or have none, in which case nothing could post against it. So Blueprint §9.3's
`workspace_id nullable (system category হলে null)` is not implementable as written. Per-workspace
materialisation it is; the nullable column stays but is never used.

**Three runtime-fatal bugs fixed:**

| # | Bug | Effect |
|---|-----|--------|
| 1 | `categories.service.ts` read/wrote `is_system`, `name`, `type` — none are columns | `GET /categories` returned 400 every time |
| 2 | `seedSystemCategories()` inserted phantom columns and omitted NOT NULL `ledger_account_id` | Every seed insert failed |
| 3 | **`buildPostings()` passed `category_id` as `ledger_account_id`** | Different tables with an FK between them — every income/expense insert violated it |

Bug 3 was the one I had not seen when I first reported this finding: it lives in
`transactions.service.ts`, not the categories module, and it means the **transaction engine could never
have created an income or expense entry**. Now resolved through
`CategoriesService.resolveLedgerAccountId()`, with `TransactionsModule` importing `CategoriesModule`.

**Model now (DEC-015):** system-ness is `translation_key IS NOT NULL`; display name is
`custom_name ?? t(translation_key)` so one row renders in both languages; `kind` replaces `type`; each
category owns a subtype-`CATEGORY` ledger account and postings reference that.

**Migration `00006_categories_alignment.sql`:** partial unique indexes making seeding idempotent under
concurrent first requests; a CHECK that every row is nameable; and a trigger enforcing that a category's
`kind` equals its account's `class` **and** both share a workspace — a mismatch would silently invert the
sign of every transaction using it, and a cross-workspace pairing would breach SEC-01.

**i18n:** the 16 `cat.*` keys the seeder writes did not exist in either catalog — system categories would
have rendered as raw keys. Added to bn and en; parity re-verified 186/186, and all 16 seeded keys confirmed
present.

**Security fix found in passing:** `PATCH /categories/:id` had no `WorkspaceMemberGuard` and no workspace
in its path — cross-workspace writes were stopped by RLS alone, contrary to DEC-005. Now
`PATCH /workspaces/:workspaceId/categories/:id` with the guard.

> **⚠️ Same pattern still present in two other modules, not fixed (out of scope):**
> `PATCH /accounts/:id` (accounts.controller.ts:74) and `GET /transactions/:id`
> (transactions.controller.ts:86) are likewise unguarded and not workspace-scoped. They rely on RLS
> alone. Worth one small follow-up task covering both.

**Still unverified:** none of this has run against a live database. The categories module is now
*coherent* with its schema, which is not the same as *proven* — that is W8.

---

## ✅ RESOLVED — Categories Module Did Not Match Its Schema

Found while auditing hot paths in W5. **Not fixed — out of W5's scope and needs a design decision.**

`categories.service.ts` reads and writes `is_system`, `name`, and `type`. Migration 00002 defines none of
them — the real columns are `translation_key`, `custom_name`, and `kind` — and it requires a NOT NULL
`ledger_account_id` that `seedSystemCategories()` never supplies. Consequences:

- `listCategories()` orders by `is_system` and `name` → query fails, endpoint 400s
- `seedSystemCategories()` inserts unknown columns and omits a NOT NULL FK → every insert fails
- `createCategory()` selects `type` on the parent lookup → fails

So the categories module has never worked against the real schema, and the web categories page is mock
data sitting on top of a broken API. It went unnoticed for the same reason as everything else: nothing
has ever run against a live database.

**The design call needed:** are system categories global (`workspace_id IS NULL`, which is what the schema
implies, since that column is nullable *only* for them) or seeded per workspace (what the service assumes)?
The sync endpoint deliberately handles **both** shapes, so it is safe either way and does not force the
decision.

~~Recommend a dedicated task~~ — **done in Session 8, see above and DEC-015.**

---

## Open Findings — ✅ RESOLVED in the Session 6 package-integration pass

All three fixed on 2026-08-04 (plan §1.12b). Root cause of why they went unnoticed: the shared packages
emitted **ESM** into `dist/index.js` with no `"type": "module"`, so Node would have thrown
`SyntaxError: Unexpected token 'export'` on first import — but **no app had ever imported one**, so it
never surfaced. Fixed by switching the four packages to a CommonJS emit, verified by `require()`-ing
each from real Node and from inside `apps/api`. Then: API wired to `money`+`domain`, web wired to
`i18n`+`money`, `parseInt` → `parseMinorUnits`, duplicated web catalogs deleted (verified identical
first), and the hardcoded formatters replaced. `design-tokens` remains unconsumed — deferred to W7.

### Original finding list (kept for the record)

| Finding | Detail |
|---------|--------|
| **No app consumes any shared package** | `apps/web`, `apps/api`, `apps/mobile` declare **zero** `@noorixfin/*` dependencies. `money`, `domain`, `i18n`, and `design-tokens` build but nothing imports them; the only workspace dependency edge is `test-fixtures → domain`. |
| **i18n catalogs are duplicated** | `apps/web/src/lib/locales/` is a hand-copy of `packages/i18n/locales/`. Both had to be edited in W1 and again in W2 — they will drift. Web also has no `errors.json` at all. |
| **API re-implements money parsing** | `transactions.service.ts` uses `parseInt(dto.amount, 10)` instead of `@noorixfin/money`'s `parseMinorUnits`, which rejects floats, `NaN`, and empty strings. `parseInt('12.7')` returns `12` silently. Directly relevant to DEC-004 and FIN-01. |
| **`SuperAdminGuard` / `@RequireSuperAdmin` unused** | Defined, wired to nothing. W6 will be their first consumer. |

~~Suggest folding the first three into W7~~ — done as a dedicated pass immediately after W2.

---

## Architectural Conflicts Resolved in Session 3

| Conflict | Resolution |
|----------|-----------|
| "Sync with Supabase" (req #4) vs DEC-005 "all financial writes through NestJS" | Push goes through the API with idempotency keys; Supabase handles pull + payload-free invalidation. Offline UX unchanged, ledger invariants preserved. A device inserting a `journal_entry` without its balancing postings would corrupt the ledger undetectably. |
| MASTER_PLAN four-role family model vs migration 00003 two-role schema | DEC-007 makes the two-role model official with recorded justification; plan and schema now agree; Phase 4.1 cancelled. |
| Acceptance matrix written against roles that no longer exist | DEC-014 re-scopes SEC-02, SYNC-01/02, FIN-02 before the live run. |
| `SUPER_ADMIN` bootstrap vs "no support staff finance-data access" (DEC-002 #12) | `SUPER_ADMIN` is platform/metadata only; RLS must not add a super-admin bypass on ledger tables. Called out as a verification item in W2 and W6. |

---

## Test Evidence

| Test Suite | Result | Details |
|-----------|--------|---------|
| money unit tests | ✅ 44/44 pass | Currency, arithmetic, balance validation, formatting, edge cases |
| money / domain / design-tokens builds | ✅ Clean | TypeScript strict compilation |
| NestJS API build | ✅ Clean | `nest build` — all modules, guards, filters |
| Next.js Web build | ✅ Clean | `next build` — routes compiled |
| **RLS / isolation / idempotency** | ❌ **Never run live** | Migrations written but never applied to a running instance. Schema constraints existing is not evidence they hold — this is the single largest risk in the project (W8). |

---

## Next Steps — Execution Order

1. ~~**W1 — Rename to NoorixFin** (1.11)~~ — ✅ **DONE 2026-08-04**
2. ~~**W2 — Two-role cleanup**~~ — ✅ **DONE 2026-08-04.** Was: (1.12). Strip `ADMIN`/`EDITOR`/`VIEWER` and invitation code from domain, guards, workspaces module, web UI, fixtures.
3. ~~**W3 — Web sessions** (1.13)~~ — ✅ **DONE 2026-08-04.** `server.ts`, `middleware.ts`, cookie flags, single-flight refresh.
4. **W6 — Super-admin SQL** (1.16). Independent of W3; can run in parallel.
5. ~~**W5 — Free-tier optimization** (1.14)~~ — 🟡 **MOSTLY DONE 2026-08-04** (Realtime blocked, dashboard RPC → W7). Migration `00004` (cursor columns + tombstones + indexes), the `/sync` endpoint, JWKS verification. **Must precede W4.**
6. ~~**W4 — Mobile offline-first** (1.15)~~ — 🟡 **CORE DONE 2026-08-04.** Engine built, unexercised; screens minimal. Real Expo structure, SecureStore session, SQLite mirror, mutation queue, sync engine.
7. **W6 — Super-admin SQL** (1.16) — *start here*, then **W7 — UI/UX performance** (1.17). TanStack Query, optimistic mutations, skeletons — web and mobile.
8. **W8 — Live acceptance verification** (1.18). `supabase start`, pgTAP as `authenticated` with a real JWT, record everything in `TEST_RESULTS.md`. **Gates Phase 2.**

### Documentation follow-up — ✅ done in Session 4

`BLOCKERS.md` and `TEST_RESULTS.md` were swept as part of W1 Step 4. BLK-001 items #1/#5/#11 are marked
CLOSED; BLK-002 (naming collision) and BLK-003 (undocumented scope cut in migration 00003) moved to
Resolved; the acceptance matrix now carries the DEC-014 wording for SEC-02, FIN-02, SYNC-01/02.

### Open question for the owner

The repository directory is still `~/Runing_Project/MyFin/`. Renaming it to `NoorixFin/` is cosmetic
but would break the current session's working directory and any absolute paths in local tooling —
left for you to decide and do outside a session.

---

## Session 18 — Enterprise Admin System (2026-08-04)

**Reverses the DEC-013 deferral.** `SUPER_ADMIN` previously existed as a flag, a guard, four RLS
policies and a bootstrap script that **nothing consumed** — an operator and a normal user saw
byte-identical dashboards. That is now a real dual-role system.

### Shipped

| Area | Delivered |
|---|---|
| **Migrations** | `00012_account_lifecycle` (profile status + deletion grace + FK repair + purge + the privilege-escalation fix), `00013_admin_platform` (app_settings, broadcasts, broadcast_receipts, system_events, 2 admin RPCs, prune), `00014_service_role_grants` |
| **API** | `admin/` (17 routes incl. SSE live feed), `account/` (deletion lifecycle, broadcasts, public settings), `observability/` (buffered system-events writer + audit service), request-telemetry interceptor, `SuperAdminGuard` status check, `/v1/me` extended |
| **Web** | `/admin` route group with its own amber operator shell + 6 pages + skeletons, SSE proxy route handler, System Admin switch in the user sidebar, broadcast banner + maintenance banner, **rewritten Profile Settings** (was 100% fake `useState`), Google OAuth wiring |
| **Config** | Google provider block, manual identity linking, `secure_password_change`, callback redirect URLs, `.env.example` |
| **Tests** | 55 API unit (5 suites), 16 new SQL acceptance cases, 10 new E2E — all green |
| **Docs** | DEC-016 … DEC-020, TEST_RESULTS session 18 |

### Decisions recorded

- **DEC-016** — console is metadata-only; the two `SECURITY DEFINER` count functions are the single
  audited aperture, and the return type is the security boundary.
- **DEC-017** — 30-day deletion grace; FK constraints deliberately left `RESTRICT` so only the purge
  function can destroy a ledger.
- **DEC-018** — `system_events` separate from `audit_events`; bounded buffered writer; SSE not Realtime.
- **DEC-019** — privilege escalation via blanket `UPDATE ON profiles` closed with column-level grants.
- **DEC-020** — `service_role` had no table privileges at all; the 00008 bug for the other role.

### Next

1. **Google OAuth live verification** — owner supplies credentials; everything else is wired.
2. **Scheduler** for `purge_expired_deletions()` and `prune_system_events()` (pg_cron or an Edge
   scheduled function). Both are operator-triggered today.
3. **W8 — Live acceptance verification** remains the Phase 2 gate; SEC-02(b) and DATA-02 moved forward
   this session (see TEST_RESULTS).
4. Optional: generate Supabase schema types to retire the `no-unsafe-*` lint class repo-wide.
