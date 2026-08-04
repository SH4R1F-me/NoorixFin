# NoorixFin — TEST RESULTS

**Last updated:** 2026-08-04 (Session 17 — dashboard summary on real data via server-side aggregation)

---

## Critical Acceptance Matrix (from Blueprint §21.2)

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| SEC-01 | User A cannot access User B personal workspace | ✅ **PASS (live)** | Bob (plain USER) sees 0 of Alice's workspaces, 0 memberships, 0 ledger rows; sees exactly 1 workspace (his own) |
| SEC-02 | **(re-scoped, DEC-014)** (a) non-owner blocked via direct PostgREST; (b) `USER` cannot perform `SUPER_ADMIN` actions; (c) `SUPER_ADMIN` cannot read another user's ledger | ✅ **(a) and (c) PASS (live)** | (a) Bob's INSERT into Alice's workspace → RLS violation. (c) Alice (SUPER_ADMIN) sees **0** journal_entries, **0** journal_postings, **0** ledger_accounts of Bob's while still seeing workspace metadata — DEC-013's core requirement, confirmed. (b) needs API-layer tests |
| SEC-03 | Service key absent from clients | ⬜ Not tested | Needs a bundle grep after a production build |
| — | **Table privileges present for `authenticated`** | ✅ **PASS (live)** | Added by migration 00008 after a total-outage 42501 was found |
| FIN-01 | Every posted journal balanced | ✅ **PASS (live)** | `chk_posting_sides` rejects debit+credit both positive; `chk_posting_nonzero` rejects zero-only. Plus 44/44 `validateBalance` unit tests |
| FIN-02 | Retry cannot duplicate — **incl. mobile queue replay after app kill** (DEC-010) | ✅ **PASS (mobile side)** | Same key twice → 1 server entry; enqueue dedupes; **reclaimed after kill cannot double-post**. API-side cross-request dedup still needs `supabase start` |
| FIN-03 | Correction preserves history | ⬜ Not tested | Schema supports `reverses_entry_id` |
| SYNC-01 | Web and Mobile show same committed data — **incl. offline→online convergence** (DEC-010) | ⬜ Not tested | Mobile app is still a scaffold |
| SYNC-02 | Stale edit detected — **incl. queued mobile mutation → 409 surfaced** (DEC-010) | ✅ **PASS (mobile side)** | 409 parks as NEEDS_ATTENTION with the reason preserved, never silently merged; does not block later writes. API-side 409 emission still untested |
| I18N-01 | Bangla and English complete | 🟡 Partial | Parity 186/186 verified by script each session; still no CI check |
| TIME-01 | Timezone boundary correct | ⬜ Not tested | All timestamps are `TIMESTAMPTZ` |
| DATA-01 | Export complete and scoped | ⬜ Not tested | |
| DATA-02 | Deletion flow works | ⬜ Not tested | |
| BACKUP-01 | Restore is usable | ⬜ Not tested | |
| STORE-01 | Store privacy declarations accurate | ⬜ Not tested | Must be filed under the new name `NoorixFin` (DEC-008) |
| A11Y-01 | Core flow accessible | ⬜ Not tested | |

---

## Test Execution Log

### TEST-001: @noorixfin/money Unit Tests
- **Date:** 2026-08-01
- **Runner:** vitest 3.2.7
- **Result:** ✅ 44/44 PASS
- **Duration:** 600ms (tests: 49ms)
- **Categories tested:**
  - getCurrency: 4 tests (known, unknown, zero-exponent, three-exponent)
  - toMinorUnits: 6 tests (BDT, JPY, KWD, zero, negative, float artifact)
  - toMajorUnits: 2 tests
  - parseMinorUnits: 6 tests (valid, negative, zero, float reject, NaN reject, empty reject)
  - serializeMinorUnits: 4 tests (integer, zero, negative, non-integer reject)
  - addMinorUnits: 4 tests (multi, single, empty, negative)
  - subtractMinorUnits: 2 tests
  - negateMinorUnits: 3 tests
  - validateBalance: 8 tests (expense, income, transfer, imbalanced, both-positive, both-zero, negative, split)
  - formatMoney: 4 tests (BDT, USD, JPY, zero)
  - formatAmount: 1 test
- **Fix applied:** Empty string edge case in `parseMinorUnits` (Number('') returns 0)

### TEST-002: @noorixfin/money TypeScript Build
- **Date:** 2026-08-01
- **Result:** ✅ PASS — clean compilation (strict mode)

### TEST-003: @noorixfin/domain TypeScript Build
- **Date:** 2026-08-01
- **Result:** ✅ PASS — clean compilation (strict mode)

### TEST-004: @noorixfin/design-tokens TypeScript Build
- **Date:** 2026-08-01
- **Result:** ✅ PASS — clean compilation (strict mode)

### TEST-005: W1 Rename Verification (NoorixFin)
- **Date:** 2026-08-04
- **Result:** see PROGRESS.md Session 4 — build/typecheck/test evidence recorded there

---

## Standing Caveat

**No item in the matrix above has been executed against a live Supabase instance.** Migrations exist
but have never been applied to a running database. Written schema constraints are not evidence that
they hold. When the suite is run (W8 / plan §1.18), RLS tests must execute as `authenticated` with a
real JWT — running them as `postgres` bypasses RLS and produces a false pass.


---

## TEST-006: First Live Database Run — 2026-08-04

**This is the first time any of this schema has been executed.** Six migrations had accumulated
without ever touching a running database.

- **Runner:** `./supabase/tests/run-local.sh` — throwaway PostgreSQL 18 cluster, no Docker required.
  `supabase/tests/_local_shim.sql` supplies the `auth` schema, `auth.users`, `auth.uid()`, and the
  `anon`/`authenticated`/`service_role` roles.
- **Method:** RLS tests run as the **`authenticated`** role with `request.jwt.claim.sub` set. Running
  them as `postgres` would bypass RLS and produce a false pass — the single most common way an RLS
  suite lies.
- **Result:** all 7 migrations apply cleanly; every acceptance check below passes.

### 🔴 The run immediately found a total-outage bug: 42P17 on `workspace_members`

```
ERROR:  infinite recursion detected in policy for relation "workspace_members"
```

The policy from migration 00001 read the table it guards:

```sql
CREATE POLICY "Members can view workspace members" ON workspace_members
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE ... ));
```

**Blast radius was total, not partial.** The `workspaces`, `ledger_accounts`, `journal_entries`,
`journal_postings`, `categories`, and `audit_events` policies all join `workspace_members`, so *every*
authenticated read failed. The API would have returned 500s on every endpoint from day one.

Migration `00004` had fixed the analogous recursion on `profiles`; this was a different table and a
different policy, and it was missed. Fixed in **`00007_fix_member_policy_recursion.sql`** — under
DEC-007 a workspace has exactly one member, so the check reduces to `user_id = auth.uid()` with no
subquery at all. Re-run after the fix: green.

An audit for the same self-reference pattern across all policies found no other instance.

### Passing checks (live)

| Check | Result |
|---|---|
| All 7 migrations apply in order | ✅ |
| 42P17 absent on `profiles` (00004 fix) | ✅ 2 profiles visible to super admin |
| 42P17 absent on `workspace_members` (00007 fix) | ✅ |
| SEC-01 — plain user isolated from other workspace/membership/ledger | ✅ 0 / 0 / 0 |
| SEC-02(a) — cross-workspace INSERT rejected | ✅ RLS violation |
| SEC-02(c) — SUPER_ADMIN sees metadata, **0 ledger rows** | ✅ DEC-013 confirmed |
| Positive control — owner sees own 1 entry, 2 postings | ✅ |
| FIN-01 — debit+credit both positive rejected | ✅ `chk_posting_sides` |
| FIN-01 — zero-only posting rejected | ✅ `chk_posting_nonzero` |
| DEC-010 — `derive_workspace_from_entry()` fills `workspace_id` on postings | ✅ |
| DEC-007 — second member per workspace rejected | ✅ unique index |
| DEC-007 — second active personal workspace rejected | ✅ partial unique index |
| DEC-015 — category kind must equal account class | ✅ trigger raises |
| DEC-015 — matching kind accepted (positive control) | ✅ |
| DEC-015 — cross-workspace category/account pairing rejected | ✅ trigger raises |
| 00006 — unnameable category rejected | ✅ `chk_categories_nameable` |

### Still NOT covered

Supabase Auth, Storage, Realtime, PostgREST behaviour, and every API-layer test — idempotency replay
(FIN-02), stale-version 409 (SYNC-02), the mobile sync round trip (SYNC-01), export/deletion
(DATA-01/02), backup restore, store declarations, and accessibility. Those need `supabase start`
and/or a running API and simulator.


---

## TEST-007: API Ledger Engine Tests — 2026-08-04

`apps/api` had **37 source files and zero tests**. The double-entry engine — the one piece that must
never be wrong — had never been executed by anything.

- **File:** `apps/api/src/transactions/transactions.service.spec.ts` — 23 tests, all passing
- **Method:** the real `TransactionsService` driven against a mocked Supabase query builder, so posting
  construction, validation, category resolution, and the idempotency short-circuit all execute for real.
  Assertions are made on the rows the service *tried to write* to `journal_postings`.
- **Not covered here** (needs PostgREST, so `supabase start`): RLS, the DB CHECK constraints, and true
  cross-request idempotency. Those are covered at the DB layer by `supabase/tests/run-local.sh`.

| Group | Coverage |
|---|---|
| FIN-01 | EXPENSE / INCOME / TRANSFER all balance; holds across amounts 1 → 999,999,999; no posting has both sides positive; no zero-only posting |
| DEC-015 | Postings reference the category's **backing account**, never the category id — the FK-violating regression is explicitly asserted against |
| DEC-004 | `12.7`, `10abc`, `''`, `abc`, `NaN`, `1e3` rejected; `0`, `-1`, `-5000` rejected as non-positive |
| Required fields | EXPENSE without category, TRANSFER without destination, unknown type |
| FIN-02 | Replay returns the existing entry and writes **no** new postings |
| Direction | TRANSFER credits source, debits destination |

### 🔴 Bug found by these tests: `parseMinorUnits` was far too permissive

The `1e3` case failed — it returned `1000` instead of throwing. Investigating showed the validator used
bare `Number()`, which also accepted:

| Input | Was parsed as |
|---|---|
| `"0x10"` | **16** (hexadecimal) |
| `"1e3"` | 1000 (scientific notation) |
| `" 100 "`, `"100\n"` | 100 (whitespace tolerated) |
| `"+100"` | 100 |
| `"1.0"` | 1 |

A client sending `"0x10"` would have had **16 minor units** silently recorded. This is a core money
primitive (DEC-004) used by every write path. Fixed with a strict `/^-?\d+$/` test; 9 regression cases
added to `@noorixfin/money` (44 → 57 tests).

### Dependency removed

`uuid@14` is ESM-only and Jest cannot transform it out of `node_modules`, which blocked the whole suite.
Replaced with Node's built-in `crypto.randomUUID()` across all five API call sites — the project already
requires Node ≥20. That removes a dependency rather than adding transform configuration to work around one.


---

## TEST-008: Mobile Sync Engine Executed — 2026-08-04

The engine built in W4 had never run. It holds financial writes in a durable queue, so a defect there
loses user data rather than erroring — the highest-risk unrun surface in the project.

- **File:** `apps/mobile/src/sync/engine.test.ts` — 13 tests, all passing
- **Harness:** `src/__tests__/mocks/expo-sqlite.ts` implements expo-sqlite's async API over Node's
  built-in `node:sqlite`. **The real schema, the real queue SQL, and the real upsert logic execute** —
  only the native binding and the network call are substituted.
- **Why not a simulator:** device tests need a build and a live API. This harness reaches the logic
  where data is actually at risk, today, and runs in CI without a device.

### 🔴 Bug found and fixed: mutations stranded `IN_FLIGHT` were lost silently

`drain()` marks a row `IN_FLIGHT` before sending. If the app is killed before the reply arrives,
**nothing ever moved it back to `PENDING`** — it sat in the queue forever:

- never retried (`claimNext` only selects `PENDING`)
- never surfaced (`listNeedingAttention` only returns `NEEDS_ATTENTION`)
- still counted by `countPending`, so the UI showed a pending badge that never cleared

A user adding a transaction as their phone died would see it saved, then never see it reach the server,
with no error. Precisely the failure the durable queue exists to prevent.

Fixed with `reclaimStranded()`, called at the start of every drain: any `IN_FLIGHT` row is returned to
`PENDING`. Safe to replay because every mutation carries a stable Idempotency-Key — verified by a test
asserting that a reclaimed mutation the server *had* already received does not create a second entry.

### The four W4 tests

| # | Test | Result |
|---|------|--------|
| W4-1 | Airplane mode → 5 transactions → reconnect | ✅ exactly 5 delivered, no dupes, no drops |
| W4-2 | App killed mid-queue → relaunch | ✅ all 3 delivered incl. the interrupted one; reclaimed row cannot double-post |
| W4-3 | Idempotency replay | ✅ same key twice → 1 entry; enqueue dedupes |
| W4-4 | Rejected push surfaces | ✅ 409 parks with reason; doesn't block later writes; 5xx defers rather than parks |

Plus: push runs before pull (verified by call ordering), OFFLINE reported distinctly from ERROR, cursor
persisted after pull, at-least-once upserts don't duplicate, `is_pending` cleared on confirmation.

### Still not covered
Real device/simulator behaviour, SecureStore on hardware, Realtime, and the API side of FIN-02/SYNC-02.


---

## TEST-009: Web App Executed (Playwright) — 2026-08-04

The web app had never been loaded by anything. 8 tests, all passing.

- **Files:** `apps/web/playwright.config.ts`, `apps/web/e2e/auth-gate.spec.ts`, `apps/web/e2e/README.md`
- **Run:** `pnpm --filter @noorixfin/web test:e2e` (Chromium; `playwright install chromium` first)
- **Against a production build** (`next start`), not `next dev` — `proxy.ts` and the server/client split
  behave differently in dev, and production is what ships.
- Kept **out** of `pnpm test` (needs a build, starts a server); wired as a separate `test:e2e` turbo task.

### The assertion that matters most

`proxy.ts` is **proven to be executing**, not assumed. Next.js 16 renamed the `middleware` file
convention to `proxy`, and a `middleware.ts` compiles cleanly while silently never running — sessions
would simply stop refreshing and `/dashboard` would stop being gated, with nothing failing loudly.

The discriminator is `?next=`: the dashboard layout's fallback redirect targets a **bare**
`/auth/login`, so a redirect carrying `?next=%2Fdashboard%2Ftransactions` can only have come from
`proxy.ts`. That test passes.

### Results

| Area | Result |
|---|---|
| `/dashboard` unauthenticated → `/auth/login` | ✅ |
| Redirect preserves `?next=` (proves proxy ran) | ✅ |
| All dashboard sub-routes gated, not just the index | ✅ |
| Public routes not gated | ✅ |
| DEC-009: no `supabase`/`sb-`/`auth`/`token` key in localStorage or sessionStorage; no JS-readable auth cookie | ✅ |
| Login page renders (server page + client form split), zero uncaught page errors | ✅ |
| Title contains "NoorixFin", does not contain "Family" (DEC-008 / DEC-007) | ✅ |
| Returns 200 with Supabase unreachable — `proxy.ts` calls `getUser()` per request, so a throw would 500 every page | ✅ |

### No bug found — the first layer where that is true

The DB, API, and mobile layers each produced a real defect on first execution. The web app did not.
That is a genuine result, not an absence of looking: the same session that wrote these tests found the
42P17 outage, the hex-parsing money bug, and the mobile data-loss bug in the other three layers.

### Not covered

Everything requiring a session — sign-in, sign-up, dashboard content, sign-out, token refresh — and the
`Secure`/`httpOnly`/`SameSite` cookie flags themselves, which need a real cookie to inspect. All blocked
on `supabase start`.


---

## TEST-010: First Run Against Real Supabase — 2026-08-04

`supabase start` (Docker group fix applied). All 8 migrations applied to genuine Supabase
PostgreSQL 17 via the CLI's own runner.

### 🔴 Total API outage found: no table privileges were ever granted

Every PostgREST request returned:

```
42501: permission denied for table <name>
```

Migrations 00001–00007 create tables, enable RLS, and write policies — but issue **no `GRANT`**.
These are two separate permission systems: `GRANT` decides whether a role may touch a table at all;
RLS decides which rows once it may. PostgreSQL checks `GRANT` first, so **the RLS policies were never
evaluated** and every authenticated read and write failed. Not degraded — dead.

**Why every earlier test missed it.** `supabase/tests/_local_shim.sql` contained
`ALTER DEFAULT PRIVILEGES ... TO authenticated`, so the local suite granted the privileges the real
migrations forgot. The shim was compensating for the bug it existed to expose. That line has been
removed; the shim now carries a comment saying a 42501 means the migration is wrong, not the shim.

Fixed in **`00008_grant_table_privileges.sql`**, which also sets `ALTER DEFAULT PRIVILEGES` so the next
migration that forgets cannot reproduce the outage. `anon` is deliberately granted nothing.

### Verified live against real Supabase

| Check | Result |
|---|---|
| All 8 migrations apply via the Supabase CLI runner | ✅ |
| Operator created through GoTrue admin API; `create_super_admin.sql` Path A promotes | ✅ |
| Real password-grant sign-in issues an access token | ✅ |
| **SEC-02(c)** — super admin sees 1 workspace + 1 profile, **0** ledger_accounts / journal_entries / journal_postings | ✅ |
| Audit row written for the grant | ✅ |
| `GET /dashboard` unauthenticated → 307 → `/auth/login?next=%2Fdashboard` | ✅ |

### Signed-in E2E (previously blocked, now passing) — `e2e/signed-in.spec.ts`

| Check | Result |
|---|---|
| Sign-in via the UI reaches `/dashboard` | ✅ |
| `sb-*` cookies are `httpOnly` **and** `SameSite=Lax` | ✅ |
| Token unreachable from `document.cookie` and `localStorage` | ✅ |
| Session survives a full page reload (proxy.ts refreshes) | ✅ |

**DEC-009's central claim is now demonstrated with a real session**, not inferred from an empty page.

Web e2e total: **16 passed**. The signed-in specs self-skip when `E2E_EMAIL`/`E2E_PASSWORD` are unset,
so the suite stays green without Docker.

### Note on the login selector
The bilingual form defaults to Bangla, so `getByRole('button', {name: /sign in/i})` never matched.
Tests now target `form button[type="submit"]` — locale-independent.


---

## TEST-011: API Running + Dashboard on Real Data — 2026-08-04

Starting the NestJS API against live Supabase and wiring the dashboard to it surfaced **three more
outage-class defects**, all in code paths that had never executed.

### 🔴 1. Category seeding used ON CONFLICT against a PARTIAL index

```
there is no unique or exclusion constraint matching the ON CONFLICT specification
```

Migration 00006 created the uniqueness guarantees as **partial** indexes
(`WHERE subtype = 'CATEGORY'`, `WHERE translation_key IS NOT NULL`). PostgreSQL will not accept a
partial index as an `ON CONFLICT` target unless the statement repeats the predicate — which PostgREST's
`on_conflict` parameter cannot express. My own DEC-015 seeder used `upsert`, so it could never run.

Rewritten as insert-only, treating unique violation (23505) as a concurrent seeder winning the race.
Verified: 16 categories + 16 backing accounts seeded, and a second call adds nothing.

### 🔴 2. Five tables had RLS enabled with no write policy (migration 00009)

`audit_events`, `categories`, `journal_postings`, `tags`, `journal_entry_tags`. RLS denies by default,
so enabling it without an INSERT policy makes a table permanently read-only.

**`journal_postings` was the severe one:** a transaction is an entry PLUS its balancing postings
(DEC-006). The entry insert succeeded and the postings insert was denied — so recording a transaction,
the product's core action, could never work.

Why every earlier test missed it: `run-local.sh` seeds through `postgres` (which bypasses RLS) and
asserted only on SELECT isolation. It proved nobody could read another tenant's rows; it never proved
the owner could write their own.

### 🔴 3. Workspace creation blocked by its own SELECT policy (migration 00010)

```
42501: new row violates row-level security policy for table "workspaces"
```

The INSERT policy was fine — `created_by = auth.uid()` evaluated true. The failure was the RETURNING
clause: `INSERT ... RETURNING` also applies SELECT policies to the new row, and the only SELECT policy
required an active `workspace_members` row — which the service inserts *after* the workspace. The
creator could not read back the row they had just written.

Diagnosed by the asymmetry: a plain INSERT returned 201 while the same INSERT with
`Prefer: return=representation` returned 42501. Fixed by letting a creator see their own workspace
(under DEC-007 the creator IS the sole owner, so this grants nothing extra).

### Verified working end-to-end

| Check | Result |
|---|---|
| API boots with local JWKS verification | ✅ |
| `GET /v1/me`, `/v1/workspaces` with a real JWT | ✅ |
| Category seeding — 16 categories + 16 backing accounts, idempotent | ✅ |
| Account creation | ✅ |
| **Transaction creation: entry + balancing postings** | ✅ debits 23500 = credits 23500 |
| Signup → workspace → categories → accounts → transactions for a brand-new user | ✅ |
| **SEC-01 live through the API** — USER requesting the operator's workspace | ✅ 403 |
| `listTransactions` returns `amount_minor` derived from embedded postings (no N+1) | ✅ |
| Dashboard accounts / transactions / categories render from the database | ✅ |
| Web e2e | ✅ 16 passed |

Running total: **five for five** — every layer, on first real execution, contained a defect.


---

## TEST-012: Dashboard Summary on Real Data — 2026-08-04

Migration `00011_workspace_summary.sql` adds a single Postgres aggregation, per DEC-011 rule 6
("aggregate server-side, return one payload") — deferred from W7 because there was nothing to
aggregate. There is now.

**`SECURITY INVOKER`, stated explicitly in the function.** It runs with the caller's rights, so RLS
applies. A `SECURITY DEFINER` version would silently become a cross-tenant read of every user's
finances — the exact bypass SEC-01 exists to prevent.

| Check | Result |
|---|---|
| Arithmetic — user's 4 expenses sum correctly | ✅ 12500+450000+89000+23000 = 574500 |
| Month boundaries computed in the **workspace** timezone, not the server's (TIME-01) | ✅ Asia/Dhaka |
| **SEC-01 at the function level** — super admin calling summary on another user's workspace | ✅ all zeros, not their real figures |
| SEC-01 at the API level — `GET /workspaces/:other/summary` | ✅ 403 |
| Balances derived from postings, so a reversal is reflected with no cached number to drift | ✅ by construction |

### Fabricated percentages removed

The mock dashboard hardcoded change badges like `+12.5%`. Real month-over-month deltas are now
computed — and when the prior month is zero the badge is **omitted entirely** rather than showing
`+100%`. With no prior data the change is undefined, and inventing one on a finance dashboard is worse
than showing nothing. Asserted in e2e.

### Test-timing bug in my own spec

The first version of `dashboard-data.spec.ts` asserted on `innerText` immediately after
`waitForURL(/\/dashboard/)`. The dashboard is a server component behind a Suspense boundary, so the
`loading.tsx` skeleton paints first and the assertion raced the stream — one test passed, one failed,
for the same page. Fixed with auto-retrying `toBeVisible` assertions plus an explicit wait for the
skeleton to disappear. **A passing snapshot assertion against streamed RSC output is luck, not proof.**

Web e2e total: **19 passed**.
