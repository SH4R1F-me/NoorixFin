# NoorixFin — RESUME HERE

**Written:** 2026-08-05, end of Session 24
**Branch:** `feat/noorixfin-foundation` · **HEAD:** `980e99a`
**On "continue": read this file first, then §"Next action".**

---

## 1. Where the audit stands

`SYSTEM_AUDIT.md` (Session 19) is the work list. Every numbered item below is
its numbering.

### Tier 1 — Blockers ✅ ALL CLOSED (before this session)

| # | Item | Commit | Evidence it holds |
|---|---|---|---|
| 1 | Ledger CRUD (finding A) | `9f42193` | `ledger-crud.spec.ts` green |
| 2 | i18n (finding B) | `9f42193` | `i18n.spec.ts` green; parity a CI gate at 358 keys |
| 3 | Error boundaries + `apiFetch` (finding C) | `253578d` | **Re-verified live this session:** API stopped → all 4 dashboard routes return **200**, not the 500 the audit measured |
| 4 | Onboarding §5.2 | `7ffb1b4` | `onboarding.spec.ts` green |

### Tier 2 ✅ CLOSED

5–9 (budgets, calendar, goals/debts, reports, drill-down) — `0299328`,
`cfddfa4`. **10 (accessibility)** closed this session — see below.

### Tier 3

| # | Item | Status |
|---|---|---|
| 11 | Supabase schema types | ✅ `18937c0` |
| 12 | Scheduler | ✅ `3281dce` |
| 13 | **CI pipeline** | ✅ `3e47ade` |
| 14 | Rate-limit tiers | ✅ `3281dce`, **corrected** `3e47ade` |
| 15 | Request tracing | ✅ `3281dce` |
| 16 | **Admin idempotency** | ✅ `b233311` |
| 17 | **Backup runbook + data export** | ✅ `3e47ade` |
| 18 | **Operator MFA/TOTP** | ✅ `ac07900` |
| 19 | Alerting | ✅ `3281dce` |

### §6 "Other defects"

| # | Item | Status |
|---|---|---|
| 1 | React ref during render | ✅ `18937c0` |
| 2 | Dashboard drill-down | ✅ `cfddfa4` |
| 3 | **tags / journal_entry_tags have no UI** | ❌ **PENDING** |
| 4 | **`POST /transactions/:id/reverse` unreachable from UI** | ❌ **PENDING** |
| 5 | Lint errors (205 API / 14 web) | ✅ 0 / 0, enforced by CI |
| 6 | WCAG 2.2 AA | ✅ this session |
| 7 | **Mobile sync engine has no UI** | ❌ **PENDING** |
| 8 | Scheduler | ✅ |
| 9 | Google OAuth | 🟡 **Configured + verified to the boundary**, see §4 |

### §2.3 never-built

- Quick-add `+` flow — ✅ covered by Tier-1 CRUD
- Family/Workspace page — correctly absent (DEC-007)
- **Recurring rules UI** — ❌ **PENDING** (table `recurring_rules` exists since 00015)
- Split categories, receipts — marked *optional* in the audit; not started
- Transaction detail / drill-down — ✅
- Error boundaries — ✅

---

## 2. What Session 24 shipped (5 commits)

| Commit | Summary |
|---|---|
| `3e47ade` | CI pipeline (#13), data export (#17), **rehearsed restore** (#17), throttle keyed on user not IP (#14 correction) |
| `b233311` | Admin idempotency (#16) + migration `00018` |
| `ac07900` | Operator MFA/TOTP (#18); admin E2E suite un-skipped |
| `e3445eb` | The last 4 E2E specs CI never ran; API-down job step |
| `980e99a` | WCAG 2.2 AA (#10, §6.6) + the responsive shell it exposed; Google OAuth wiring |

### Bugs found by doing the work, not by reading it

1. **CI started the API from the repo root** — `envFilePath` is cwd-relative, so
   it died on the first `getOrThrow`. Reproduced locally before fixing.
2. **The backup runbook restored ZERO tables.** `--schema=public --schema=auth`
   omits `extensions`, and every table's id defaults to
   `extensions.uuid_generate_v4()`. Three more corrections followed
   (`--no-privileges` leaves a database no role can read; the migration history
   needs its own schema; pg_cron lives in exactly one database per cluster).
3. **The throttle was IP-keyed.** Under a 3-per-minute tier that meant one
   user's export 429'd a *different* user from the same address. Measured.
4. **`idempotency_records` had RLS DISABLED** with a SELECT grant to
   `authenticated` — wiring it naively would have made one user's API
   responses readable by every other. Fixed in `00018` before use.
5. **`ci-assertions.sql` failed on its own leftovers** on a second run.
6. **10 E2E tests never ran**, including the whole operator access-control file.
7. **The app had no responsive CSS at all.** Not one media query; both shells
   shipped a mobile design that was never connected. 376px of horizontal
   scrolling at the reflow-equivalent of 200% zoom.
8. **Contrast failed systemically** — four colours, ~60 occurrences.
9. **A live Google client secret** was sitting in `supabase/` and reached the
   staging area. Caught in the staged diff; `client_secret_*.json` now ignored.

---

## 3. Verification state (all green at `980e99a`)

```
typecheck        clean (13 packages)
lint             API 0 errors · web 0 errors (--max-warnings 0)
unit             76 passed / 7 suites
E2E              78 passed, 1 skipped
locale parity    358 keys, bn ↔ en
migrations       18 apply from scratch
ci-assertions    green on source AND on a restored database
db types         fresh (check:fresh)
```

The 1 skipped E2E is `resilience.spec.ts` signed-in group — it needs the API
**stopped**, so it has its own step in the `e2e` CI job. Verified locally under
that condition: 4/4 pass.

**How to reproduce the full run:**

```bash
npx supabase start
cd apps/api && node dist/main.js &          # from apps/api — NOT the repo root
cd apps/web && E2E_LIVE=1 npx playwright test
```

---

## 4. Google OAuth (§6.9) — read before touching

**Configured and working up to Google's consent screen.**

- Credentials live in **`supabase/.env`** (gitignored). `config.toml` reads them
  via `env()`.
- `apps/web/.env.local` has `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true`.
- Verified: GoTrue holds the client id · `/authorize` 302s to Google with the
  registered client and callback · Google returns its **sign-in page**, not
  `redirect_uri_mismatch` · the UI renders the button · the callback route
  refuses a forged code. `e2e/google-oauth.spec.ts`, 3 tests.

> ⚠️ **The client secret was pasted into a chat transcript.** Treat it as
> disclosed. Rotate it in Google Cloud Console → Credentials → Reset secret,
> then update `supabase/.env` and `npx supabase stop && npx supabase start`.

The only unverified step is a human consenting with a real Google account —
untestable by any agent, and not a code path this repo owns.

Minor, non-blocking: the client's `javascript_origins` is
`https://127.0.0.1:3000` (HTTPS) while dev runs on `http://localhost:3000`.
Irrelevant to the server-side redirect flow used here; would matter only for
Google One Tap / GSI.

---

## 5. Next action — start here on "continue"

Remaining audit items, in the order I would do them:

### A. §6.4 — transaction reverse UI (smallest, highest value)
`POST /workspaces/:id/transactions/:id/reverse` is implemented, guarded and
tested, and **no UI calls it**, so acceptance item FIN-03 ("correction preserves
history") cannot be exercised by a user. Add a Reverse action to the
transaction row/detail in `apps/web/src/app/dashboard/transactions/`, going
through a server action in `ledger-actions.ts` like every other write. The
reversal must read as a *new balancing entry*, never as an edit — that is the
whole point of FIN-03.

### B. §6.3 — tags UI
`tags` and `journal_entry_tags` exist (00002), the API accepts tags on
transactions (`transactions.service.ts`, `dto/transaction.dto.ts`), the export
includes them, and nothing in the UI reads or writes them. Needs: tag chips on
the transaction form, and a filter on the list.

### C. §2.3 — recurring rules UI
`recurring_rules` (00015) has schema and API and no screen. The calendar view is
where it belongs.

### D. §2.4 / §6.7 — mobile UI
16 source files of offline sync engine (SQLite mirror, durable mutation queue,
tested) driving **3 screens**. This is the largest remaining item and the one
most likely to need its own session. Note `apps/mobile` has its own jest mocks
under `src/__tests__/mocks/`.

### E. Final sweep
Update `SYSTEM_AUDIT.md` with a closure column, refresh `PROGRESS.md` (its
header still says "Last updated Session 6" and it has no entries past Session
18), and record Session 24 in `TEST_RESULTS.md` — including **BACKUP-01 and
DATA-01, which both moved off "not tested" this session**.

---

## 6. Traps and conventions worth knowing

- **`apps/web/AGENTS.md`**: this is Next.js 16 with breaking changes. Read
  `node_modules/next/dist/docs/` before writing web code. The middleware file
  convention is `proxy.ts`, and the export is `proxy`, not `middleware`.
- **Start the API from `apps/api/`**, never the repo root — `envFilePath` is
  cwd-relative. This bit CI and it will bite you.
- **`pnpm` is not on PATH.** Use `npx pnpm`.
- **Playwright's `page.request` does NOT carry the httpOnly session cookie.**
  A spec that uses it lands on the login redirect while the product works
  perfectly. Drive the page, or `page.evaluate(() => fetch(...))`.
- **A new migration means regenerating db types**, or `check:fresh` fails CI:
  `npx pnpm --filter @noorixfin/db-types generate`.
- **`jose` is ESM-only**; unit tests stub it at `apps/api/test/stubs/jose.ts`.
  The stub THROWS by design — no unit test should reach real JWT crypto.
- **axe scans emulate reduced motion.** Without it, cards are measured
  mid-fade-in and report contrast failures against colours nobody sees.
- **Every live spec builds its own fixture** (`e2e/support/fixture.ts`).
  Do not add `E2E_EMAIL`-style gating — that is exactly what silently disabled
  10 tests. `createOperator()` promotes via psql and enrols a TOTP factor.
- **Ad-hoc live check scripts** used this session are in the session scratchpad
  and are NOT committed. The durable equivalents are the E2E specs and
  `supabase/tests/ci-assertions.sql`.

---

## 7. Honest status

The audit's Tier 1, Tier 2 and Tier 3 lists are **complete**. What remains is
four items from the audit's §2.3/§6 "other defects" tables — three small web
features (reverse, tags, recurring rules) and one large one (mobile UI) — plus
the documentation sweep.

"Production-ready" is not yet a claim I would make, for two reasons that are
outside the code: no deployment has ever happened, and the acceptance matrix
still has rows that only a real deployment can close. The platform layer is
genuinely solid and now has a CI pipeline that will keep it that way.
