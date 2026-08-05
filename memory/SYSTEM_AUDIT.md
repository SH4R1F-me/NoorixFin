# NoorixFin — System-Wide Audit

**Date:** 2026-08-04 (Session 19)
**Scope:** every route, the API surface, business logic, i18n, and resilience
**Method:** static inventory **plus live execution** against local Supabase (14 migrations), the NestJS
API on :8080, and the Next.js app on :3000. Every claim below that says "verified" was produced by
running the system, not by reading it.

---

## 1. Executive summary

The **platform layer is genuinely production-shaped**: double-entry ledger, RLS isolation, the operator
console, account lifecycle, observability, and auth all work and are covered by 55 API unit tests, 33 SQL
acceptance sections and 32 E2E tests — all green.

The **product layer is not finished**, and the gap is larger than the route list suggests. Three findings
dominate:

| # | Finding | Severity |
|---|---|---|
| **A** | **A user cannot create a transaction, account, or category from the UI.** The forms exist, the buttons exist, they have no `onClick` and persist nothing. The API supports all of it. | 🔴 **Blocker** |
| **B** | **i18n is entirely unwired.** 440 translation keys with 186/186 bn↔en parity exist and *nothing imports them*. Language "switching" changes the sidebar and nothing else, and does not survive a reload. | 🔴 **Blocker** |
| **C** | **Any API outage 500s the whole dashboard.** `apiFetch` converts HTTP errors to `ApiError` but lets network failures escape as raw `TypeError`, which the layout re-throws. There are no error boundaries anywhere. | 🟠 **High** |

Finding A is the same class of defect that Profile Settings had before session 18 — UI that looks
functional and writes nothing. It was fixed there; it remains in the three ledger views.

---

## 2. Page inventory

### 2.1 Built and working (real data, verified live)

| Route | State |
|---|---|
| `/` landing | ✅ complete (bilingual, own locale toggle) |
| `/auth/login` | ✅ sign-in + register, bilingual |
| `/auth/forgot-password` | ✅ works, mail caught by Mailpit |
| `/auth/callback` | ✅ code exchange + OAuth error handling |
| `/dashboard` | ✅ real summary from `workspace_summary()` — verified ৳5,745.00 from 4 seeded entries |
| `/dashboard/transactions` | 🟡 **list is real**, create form is dead (finding A) |
| `/dashboard/accounts` | 🟡 **list is real**, create form is dead (finding A) |
| `/dashboard/categories` | 🟡 **list is real**, create form is dead (finding A) |
| `/dashboard/settings` | ✅ rewritten session 18 — preferences, password, identities, deletion all persist |
| `/admin` (6 pages) | ✅ complete — overview, monitoring, audit, users, broadcasts, settings |

### 2.2 Stubs — render `NotYetAvailable`, no logic at all

| Route | Blueprint ref | Dashboard contract items it blocks |
|---|---|---|
| `/dashboard/budgets` | §5.1 #4 | "Budget used/remaining progress" |
| `/dashboard/calendar` | §5.1 #5 | "Upcoming bills, overdue items, expected income" |
| `/dashboard/goals` | §5.1 #6 | "Savings-goal progress", "Debt summary" |
| `/dashboard/reports` | §5.1 #7 | "Category spending chart" |

Because these four are stubs, **5 of the 10 items in the blueprint's §5.3 dashboard contract cannot be
delivered.** `/dashboard/page.tsx` passes `upcomingBills={[]}` unconditionally — honest, but empty.

### 2.3 Never built — no route, no component

| Missing | Blueprint ref | Notes |
|---|---|---|
| **Onboarding flow (all 10 steps)** | §5.2 | `profiles.onboarding_status` has 7 states and a CHECK constraint; **nothing in the web app ever reads or advances it.** Every user is stuck at `ACCOUNT_CREATED` forever. Language select, persona select, opening balance, starter budget, first-transaction guidance — none exist. |
| **Quick-add transaction flow** | §5.4 | The `+` central action. See finding A. |
| **Family/Workspace page** | §5.1 #8 | **Correctly absent** — DEC-007 dropped family workspaces. The blueprint is stale here, not the code. |
| **Split categories, receipts, recurring rules, tags UI** | §5.4 optional | `tags` and `journal_entry_tags` tables exist and are unused by any UI. |
| **Transaction detail / drill-down** | §5.3 | "কোনো metric শুধু aggregate number দেখাবে না" — every dashboard metric is currently a dead number; clicking does nothing. |
| **Error boundaries** | — | **Zero** `error.tsx` / `global-error.tsx` / `not-found.tsx` in the entire app. |

### 2.4 Mobile

3 screens (`index`, `sign-in`, `_layout`) against a fully-built offline sync engine (16 source files,
SQLite mirror, mutation queue, tested). **The engine has no UI to drive it.** Effectively a scaffold.

---

## 3. Finding A — ledger CRUD is non-functional (🔴 Blocker)

**Verified live.** Signed in, opened `/dashboard/transactions`, filled the amount field with `99999`,
clicked **Save Transaction**, reloaded:

```
TX_LIST_SHOWS_REAL_DATA  true      <- the list is genuinely wired
SAVE_BUTTON_EXISTS       true
SAVED_ANYTHING           false     <- nothing persisted
```

The button has **no `onClick` handler at all** (`transactions-view.tsx:120`), the inputs are
uncontrolled, and the dropdowns are hardcoded fiction:

```tsx
<select style={s.inp}><option>bKash</option><option>DBBL Bank</option><option>Cash</option><option>Nagad</option></select>
```

Same in `accounts-view.tsx:96–100` and `categories-view.tsx`.

**The API is not the problem.** These endpoints exist, are guarded, and are exercised by tests:
`POST /workspaces/:id/transactions`, `POST .../accounts`, `POST .../categories`,
`PATCH .../accounts/:id`, `PATCH .../categories/:id`, `POST .../transactions/:id/reverse`.

**Not one of them is called from the web app.** The only mutating calls in the entire web codebase are
workspace-create, the admin actions, and the settings actions added in session 18.

**Consequence:** every transaction in this system was created with `curl`. A user who signs up today can
look at an empty dashboard and has no way to put anything in it.

---

## 4. Finding B — i18n is wired to nothing (🔴 Blocker)

### 4.1 What exists

- `packages/i18n` — 186 `common` + 34 `errors` keys per language, **186/186 bn↔en parity confirmed**.
- `apps/web/src/lib/i18n.ts` — a complete, correct i18next + `LanguageDetector` setup with
  `caches: ['localStorage']`.

### 4.2 What uses it

**Nothing.** `useTranslation` appears **zero times** in the app. The only file that imports
`lib/i18n.ts` is `lib/i18n.ts` itself.

### 4.3 What actually happens (verified live)

Signed in, measured Bangla word counts, clicked the sidebar language toggle:

```
BEFORE   sidebar bnWords=15   main bnWords=56
AFTER    sidebar bnWords=1    main bnWords=52     <- main barely moved
PERSISTED=false                                    <- reload reverts to Bangla
LOCALSTORAGE []                                    <- detector cache never written
TRANSACTIONS main bnWords=12  (after choosing English)
SETTINGS     main bnWords=7   (after choosing English)
```

The toggle changes the **sidebar nav labels and the version footer**. That is all. The dashboard body,
transactions, accounts, categories and settings stay Bangla regardless.

### 4.4 Why — four disconnected locale states

Instead of one shared source of truth, four components each hold a private `useState`:

| Component | Scope of its toggle |
|---|---|
| `app/page.tsx` (landing) | that page only |
| `auth/login/login-form.tsx` | that form only |
| `dashboard/dashboard-shell.tsx` | the sidebar only |
| `admin/admin-shell.tsx` | the admin sidebar only |
| `dashboard/settings/settings-view.tsx` | unused locally |

Everything else is either **hardcoded Bangla** (14 components — `dashboard-view`, `transactions-view`,
`accounts-view`, `categories-view`, the 4 stubs, `broadcast-banner`, …) or **English-only** (25
components — the entire admin console, all `loading.tsx`, `not-yet-available`).

There is also a **persistence contradiction**: the shell seeds from `profiles.locale` (the saved
preference), but the toggle never writes back, so a reload silently discards the user's choice. The user
*can* change the language durably in Settings → Preferences; the sidebar toggle beside it does something
different and temporary. Two controls, same apparent purpose, different behaviour.

### 4.5 Visible bug: raw translation keys leak to users

The category dropdown renders:

```
["All","cat.food_dining","cat.transport","cat.housing","cat.utilities","cat.healthcare"]
```

`categoryLabel(category, translate?)` falls back to the raw key when no translator is passed — and
**both call sites pass none** (`categories/page.tsx:21`, `transactions/page.tsx:40`). The translations
exist and are correct in both languages (`cat.food_dining` → "Food & Dining" / "খাবার ও ডাইনিং"). They
are simply never applied.

### 4.6 Number and date localisation

`dashboard/page.tsx:35` hardcodes the formatting locale:

```ts
return `${getCurrency(currency).symbol} ${formatAmount(minor, currency, 'en-BD')}`;
```

Amounts render with Latin digits and Western grouping in both languages. Bangladeshi users in Bangla
mode arguably expect `৫,৭৪৫.০০` and lakh/crore grouping (`১,২৫,৪৮০`). At minimum this should follow the
active locale rather than a constant. Dates are `toISOString().slice(0,10)` — no locale awareness.

---

## 5. Finding C — no resilience layer (🟠 High)

**Verified:** stopped the API, then loaded four dashboard routes as a signed-in user:

```
/dashboard              status=500  "This page couldn't load. A server error occurred."
/dashboard/transactions status=500
/dashboard/settings     status=500
/dashboard/accounts     status=500
```

**Root cause.** `apiFetch` (`lib/api-client.ts:63`) wraps `fetch` with no try/catch. A non-2xx response
becomes a tidy `ApiError`; a *connection refusal* escapes as a raw `TypeError`. `getSessionContext`
catches `ApiError` and re-throws everything else — and it runs in `dashboard/layout.tsx`, so it takes
every child page down with it.

This is backwards: "the API returned 500" degrades gracefully, "the API is unreachable" crashes hard.

Compounding it, there are **no error boundaries at all** — no `error.tsx`, no `global-error.tsx`, no
custom `not-found.tsx`. Users see Next's raw framework error page, unbranded and untranslated.

---

## 6. Other defects found

| # | Issue | Severity | Location |
|---|---|---|---|
| 1 | React ref accessed during render — a genuine correctness bug flagged by `react-hooks/refs`, not a style nit | 🟠 | `app/page.tsx:506–507` |
| 2 | `/dashboard` metrics are dead numbers; blueprint §5.3 requires drill-down to source transactions | 🟡 | `dashboard-view.tsx` |
| 3 | `tags` / `journal_entry_tags` tables and API support exist with no UI | 🟡 | — |
| 4 | `POST /transactions/:id/reverse` implemented, tested, unreachable from the UI — so FIN-03 ("correction preserves history") can't be exercised by a user | 🟡 | — |
| 5 | 205 API lint errors / 14 web errors. ~170 are the pre-existing untyped-Supabase-client class; 18 are from session 18 | 🟡 | repo-wide |
| 6 | `scope=` absent from all 6 tables; `alt=` used once; no `prefers-reduced-motion` in `landing.css` — WCAG 2.2 AA (§5.5) is a stated target and is not met | 🟡 | web |
| 7 | Mobile sync engine complete but has no UI | 🟡 | `apps/mobile` |
| 8 | No scheduler for `purge_expired_deletions()` / `prune_system_events()` — operator-triggered only | 🟢 | documented DEC-017/018 |
| 9 | Google OAuth wired but never executed against Google | 🟢 | needs credentials |

**Note on severity:** nothing in this audit contradicts the session-18 security work. The privacy
boundary (operator cannot read user finances) was re-verified during this audit at the API, RLS, and
response-content levels and holds.

---

## 7. What is genuinely solid

Worth stating plainly, because the findings above are concentrated in the product layer:

- **Double-entry ledger** — balanced postings enforced by CHECK constraints; 44 `validateBalance` unit tests.
- **Tenant isolation** — SEC-01/SEC-02 pass live; a super admin sees 0 rows of another user's ledger at the RLS layer.
- **Idempotency** — same key twice yields one entry.
- **Auth** — httpOnly cookies, local JWKS verification, no token reachable from JS (verified by test).
- **Admin console** — 17 endpoints, 3 independent gates, every mutation audited.
- **Observability** — bounded buffered writer that cannot break a request, with an overflow record so truncation is never silent.
- **Migrations** — 14 apply cleanly from scratch, 0 failures, 33 acceptance sections.

---

## 8. Recommended next steps

Ordered by "what makes this a usable product" before "what makes it an impressive one".

### Tier 1 — required before anyone can use the app (~1–2 weeks)

1. **Wire ledger CRUD (finding A).** Server actions for create/edit transaction, account, category,
   plus the `+` quick-add of §5.4. Populate dropdowns from real `getAccounts()` / `getCategories()`
   instead of `bKash`/`DBBL` fiction. Use the existing `useOptimisticMutation` helper — it is already
   written and unused. **Without this the product does not function.**
2. **Wire i18n properly (finding B).** One `LocaleProvider` reading `profiles.locale`; replace all four
   private `useState` toggles; make the sidebar toggle persist via `PATCH /me/preferences`; pass a
   translator into `categoryLabel`; drive `formatAmount` from the active locale. Then add a CI check for
   bn↔en key parity **and** for hardcoded user-facing strings.
3. **Add error boundaries + fix `apiFetch` (finding C).** Wrap `fetch` so network failures become
   `ApiError(503, 'API_UNREACHABLE')`; add `error.tsx` per segment and a branded `not-found.tsx`.
4. **Build the onboarding flow (§5.2).** The state machine already exists in the database and is inert.

### Tier 2 — completes the blueprint (~3–4 weeks)

5. **Budgets** — envelope vs simple is still an open owner decision (BLK-001 #6); pick one.
6. **Calendar & Bills** — recurring rules, upcoming/overdue, expected income.
7. **Goals & Debts** — savings progress, debt payoff.
8. **Reports** — category chart with the text/table alternative §5.5 requires.
9. **Transaction drill-down** so dashboard metrics stop being dead ends.
10. **Accessibility pass to WCAG 2.2 AA** — table `scope`, focus-visible, reduced-motion, 200% zoom and
    Bangla truncation testing.

### Tier 3 — enterprise hardening (the "advanced" layer)

11. **Generate Supabase schema types** (`supabase gen types typescript`). Retires ~190 `no-unsafe-*` lint
    errors *and* converts a whole class of runtime bug into compile errors — the `category_id` vs
    `ledger_account_id` mix-up that once broke every transaction write would not have compiled.
12. **Scheduler** — pg_cron or an Edge scheduled function for purge + prune; both functions are ready.
13. **CI pipeline** — none exists. Run typecheck, lint, 55 unit + 33 SQL + 32 E2E on every push, with a
    migration-applies-from-scratch gate. All the tests exist; nothing runs them automatically.
14. **Rate-limit tiers per endpoint** — the throttler is global; auth and admin deserve stricter buckets.
15. **Structured request tracing** — `X-Request-ID` exists; propagate it into `system_events` for every
    request, not just failures, so an operator can follow one user's request end to end.
16. **Idempotency for admin mutations** — user writes are idempotent; operator writes are not.
17. **Backup/restore runbook** (BACKUP-01 untested) and **data export** (DATA-01 untested) — both are
    acceptance-matrix items still at "not tested", and export is a GDPR sibling of the deletion flow
    already built.
18. **MFA/TOTP for operators.** A super-admin account protected only by a password is the weakest link in
    an otherwise careful authorization design.
19. **Alerting on `system_events`** — the data is collected but nobody is told. A threshold on
    `errors_1h` → email/webhook closes the loop from "we record incidents" to "we notice them".

### Recommended immediate order

**2 → 1 → 3** — do i18n first. It touches every component that Tier-1 CRUD work will also touch, and
doing CRUD first means writing new hardcoded strings that then have to be torn out again.

---

## 9. Verification appendix

| Check | Result |
|---|---|
| API unit tests | 55 passed / 5 suites |
| SQL acceptance | 33 sections, 0 migration failures |
| Web E2E | 32 passed |
| `tsc --noEmit` api + web | clean |
| `next build` | clean, 23 routes |
| Migrations from scratch | 14/14 apply |
| API lint | 205 errors (≈170 pre-existing class) |
| Web lint | 14 errors, 7 warnings |
| Source size | API 59 files/7,105 lines · Web 70 files/8,655 lines · SQL 14 files/2,233 lines |

**Reproduction commands** for the three headline findings are in §3, §4.3 and §5; each was produced by a
temporary Playwright spec run against `localhost:3000` with the live API and Supabase.
