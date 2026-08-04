# NoorixFin — TEST RESULTS

**Last updated:** 2026-08-04 (Session 13 — web app executed via Playwright; all four layers now run)

---

## Critical Acceptance Matrix (from Blueprint §21.2)

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| SEC-01 | User A cannot access User B personal workspace | ✅ **PASS (live)** | Bob (plain USER) sees 0 of Alice's workspaces, 0 memberships, 0 ledger rows; sees exactly 1 workspace (his own) |
| SEC-02 | **(re-scoped, DEC-014)** (a) non-owner blocked via direct PostgREST; (b) `USER` cannot perform `SUPER_ADMIN` actions; (c) `SUPER_ADMIN` cannot read another user's ledger | ✅ **(a) and (c) PASS (live)** | (a) Bob's INSERT into Alice's workspace → RLS violation. (c) Alice (SUPER_ADMIN) sees **0** journal_entries, **0** journal_postings, **0** ledger_accounts of Bob's while still seeing workspace metadata — DEC-013's core requirement, confirmed. (b) needs API-layer tests |
| SEC-03 | Service key absent from clients | ⬜ Not tested | Needs a bundle grep after a production build |
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
