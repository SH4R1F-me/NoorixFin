# NoorixFin Deep System Audit — 2026-08-14

**Scope:** the complete NoorixFin monorepo on `main`, evaluated against the
Reading A commitment: a free, open-source, self-hostable personal/household
finance product built with enterprise-grade security, correctness, reliability,
performance, type safety, accessibility, and delivery discipline.

**Audited baseline:** local `main` at `0361739` before this report was added.

## 1. Executive verdict

NoorixFin is **not yet ready to be represented as a complete enterprise-grade
Reading A release**.

The API, database, and primary web product are substantially stronger than the
original audit baseline. The repository has real double-entry enforcement, RLS,
idempotency, MFA-gated operator APIs, rate limiting, security headers, health
probes, migration checks, restore drills, observability records, and meaningful
browser coverage. Those are genuine strengths, not scaffolding.

The release verdict nevertheless fails for five independent reasons:

1. Three admin Site Settings Server Actions perform service-role mutations
   without authenticating or authorizing the caller inside the action.
2. The mobile app has runtime API-contract mismatches on first launch, planning,
   profile, and export flows; its transfer and minor-unit entry paths are not
   financially correct.
3. A current production-dependency audit reports **11 known vulnerabilities:
   8 high and 3 moderate**.
4. The product claims MIT licensing and self-hostability, but the repository has
   no project LICENSE, the API declares `UNLICENSED`, and the documented Docker
   deployment files do not exist.
5. Phase 3 is declared complete even though the app-lock, encrypted local
   database, bilingual mobile UI, haptics, full planning/account screens, native
   release pipeline, and device-level acceptance evidence are absent.

The correct description today is: **a strong backend/web release candidate with
an incomplete and partially broken mobile product, plus security, supply-chain,
licensing, and deployment blockers.**

## 2. Audit method and inventory

The audit traced controller routes to web/mobile call sites and screens, read the
database migrations and security boundaries, inspected responsive and
accessibility implementation, reviewed test and CI configuration, searched for
dead controls and unused capabilities, and executed the local static gates.

| Inventory item                                                      | Observed |
| ------------------------------------------------------------------- | -------: |
| Source/config files under `apps`, `packages`, `supabase`, `.github` |      512 |
| NestJS controllers                                                  |       15 |
| OpenAPI paths / operations                                          | 90 / 116 |
| Next.js pages / route handlers                                      |   54 / 8 |
| Expo route files                                                    |       19 |
| Supabase migrations                                                 |       32 |
| Web Playwright specs                                                |       23 |
| API unit suites / tests                                             | 13 / 105 |
| Mobile suites / tests                                               |   2 / 16 |

### Verification run on 2026-08-14

| Command                                    | Result                                                                            |
| ------------------------------------------ | --------------------------------------------------------------------------------- |
| `pnpm typecheck`                           | **19/19 tasks passed**                                                            |
| `pnpm lint`                                | **9/9 tasks passed**                                                              |
| `pnpm test`                                | **14/14 tasks passed**; API 105 tests, mobile 16 tests, shared packages 104 tests |
| `pnpm build`                               | **10/10 tasks passed**; Next registered 62 routes                                 |
| `pnpm audit --prod --audit-level moderate` | **failed policy expectation:** 8 high, 3 moderate vulnerabilities                 |

A green compiler/build is not sufficient evidence of integration correctness in
this repository: the client transports accept an arbitrary string path and an
arbitrary caller-selected response type. Several invalid mobile calls therefore
type-check and bundle successfully.

This audit did not run a physical-device/simulator acceptance pass or a fresh
visual-regression capture. UI findings below are based on source inspection,
existing Playwright coverage, responsive rules, semantics, and reachable control
tracing. Those findings are concrete, but the absence of device and multi-browser
visual evidence is itself a test gap.

## 3. Priority definitions

- **P0 — release blocker:** resolve before any public production or mobile release.
- **P1 — enterprise blocker:** resolve before calling the system enterprise-ready.
- **P2 — product completeness/polish:** schedule immediately after the P0/P1 gate.
- **P3 — future enhancement:** valuable, but not required for the first honest
  Reading A release.

## 4. P0 findings — release blockers

### SEC-01 — Site Settings actions bypass the application authorization boundary

**Evidence**

- `apps/web/src/app/admin/site-settings/actions.ts:14-19` constructs a Supabase
  service-role client.
- `uploadLogoAction`, `clearLogoAction`, and `saveDonationOptionAction` are
  exported Server Actions and contain no current-user, `is_super_admin`, account
  status, or AAL2 check.
- The file comment relies on the admin route being protected. A rendered layout
  is not an authorization boundary for a mutation endpoint.
- These writes bypass `SuperAdminGuard`, API throttling, idempotency, request
  telemetry, the error catalogue, and operator audit events.

**Impact**

Any path that can invoke or replay one of these action references reaches a
service-role operation without an action-local authorization decision. The
blast radius includes public site assets, global site settings, and donation
configuration. This violates the repository's own rule that NestJS is the
primary write boundary.

**Required remediation**

Move these mutations behind authenticated NestJS admin endpoints guarded by
`SuperAdminGuard`, or enforce verified user + active super-admin + AAL2 inside
every action before constructing the service client. Add negative tests for
anonymous, normal-user, suspended-operator, and AAL1 sessions. Record the
mutation in the operator audit trail. Validate content by decoded bytes and
disallow or sanitize SVG uploads.

### MOB-01 — Authenticated first launch and multiple core mobile screens call nonexistent contracts

**Evidence**

| Mobile code                  | Client expectation                            | Actual API                                                                  |
| ---------------------------- | --------------------------------------------- | --------------------------------------------------------------------------- |
| `src/lib/workspace.ts:49-52` | `GET /workspaces` → `{ items: [...] }`        | returns a bare workspace array                                              |
| `(tabs)/plan.tsx:85`         | `GET /workspaces/:id/budgets`                 | route is singular `/budget`                                                 |
| `(tabs)/plan.tsx:86-88`      | goals response `{ items }`                    | returns a goals overview containing `goals`, `debts`, totals and visibility |
| `(tabs)/plan.tsx:29-35`      | `target_amount_minor`, `current_amount_minor` | fields are `target_minor`, `current_minor`                                  |
| `settings/profile.tsx:28,44` | `GET/PATCH /profiles/me`                      | routes are `GET /me`, `PATCH /me/preferences`                               |
| `settings/data.tsx:19`       | `POST /profiles/me/export`, queued email      | route is synchronous `GET /me/export` returning a download                  |

`workspace-select.tsx:37-42` immediately reads `ws.length`. Because
`fetchWorkspaces()` returns `result.items` from an array response, authenticated
first launch can fail before a workspace is selectable. The planning screen's
two requests cannot populate successfully. Profile and export actions cannot
reach their controllers.

**Impact**

The critical-path mobile foundation is not functional end to end despite passing
typecheck, build, and the two mobile unit suites. The current Phase 3 completion
claim is false.

**Required remediation**

Correct all paths and response types, then add live contract tests that execute
fresh sign-in → workspace selection → home, profile read/write, plan read, and
data export against the real API. Do not close this finding with typecheck alone.

### MOB-02 — Mobile transaction entry can create rejected or misleading financial records

**Evidence**

- `add-transaction.tsx:23-29` offers `TRANSFER`, but the UI never captures a
  destination account and `handleSave` never supplies `transfer_to_account_id`.
  The server correctly rejects such a transfer.
- `add-transaction.tsx:74-81` uses `parseFloat`, `Math.round(float * 100)`, and a
  hard-coded two-decimal assumption despite the comment claiming integer-only
  arithmetic. JPY and three-decimal currencies are wrong; binary floating point
  is reintroduced on the most sensitive entry path.
- The entry UI hard-codes the Bangladeshi taka symbol at lines 135 and 170 rather
  than the selected account/workspace currency.
- `repositories/transactions.ts:80-84` says a pending row shows the typed amount,
  but only a journal entry is inserted locally. `listRecent` derives the amount
  exclusively from postings and therefore returns zero until the server pull.
- A permanent failure is parked in `NEEDS_ATTENTION`; `listNeedingAttention()`
  and `discard()` exist only in the queue/tests and are not used by any screen.
- `transactions.tsx:69-74` applies filters using the pre-refresh `rows` closure
  after `load()`, so a filtered list can lag one refresh behind.

**Impact**

Transfers reliably park, currencies can be mis-scaled, optimistic transactions
appear as zero, and rejected money writes have no repair/discard UI. These are
financial correctness and data-trust failures, not cosmetic mobile gaps.

**Required remediation**

Use `@noorixfin/money` currency exponents and string-to-minor conversion with no
floating point; derive the currency from the selected account; require and
validate a distinct destination account for transfers; store an explicit local
optimistic amount or locally balanced provisional postings; add a queue-repair
screen; and test the flows offline and after reconnect on a real device.

### SUP-01 — Current production dependency graph contains known high-severity vulnerabilities

`pnpm audit --prod --audit-level moderate` reported **8 high and 3 moderate**
advisories. High findings include vulnerable transitive versions of:

- `sharp` / libvips through Next.js;
- `postcss` through Next.js;
- `js-yaml` through Nest Swagger and Expo tooling;
- `image-size` through Metro;
- `nanoid` through Expo/Metro.

Moderate findings include additional PostCSS issues and `uuid`. Some Expo paths
are build tooling and require exploitability review, but a blanket “dev only”
acceptance is not justified: `sharp` is in the web runtime path and the API's
Swagger dependency is deployed unless production packaging excludes it.

**Required remediation**

Upgrade direct frameworks to versions that resolve the transitive graph, use
audited overrides only when upstream compatibility is demonstrated, rerun unit,
native export, production build, and E2E, and require zero critical/high
advisories or a written, time-bounded risk acceptance for unreachable code.

### OSS-01 — The repository does not currently satisfy its legal or operational self-hosting promise

**Evidence**

- There is no root `LICENSE` file.
- `apps/api/package.json` explicitly declares `"license": "UNLICENSED"`.
- `apps/mobile/LICENSE` is Expo's own MIT notice, not a NoorixFin project license.
- There is no root README, CONTRIBUTING, SECURITY, or Code of Conduct file.
- `infra/docker/README.md` claims `Dockerfile.api` and `docker-compose.yml`
  exist; the directory contains only that README.
- The marketing site repeatedly states “MIT Licensed” and links to a missing
  `CONTRIBUTING.md`.
- `/docs` claims a self-hosting guide but does not contain installation,
  provisioning, upgrade, rollback, backup, SMTP, push, or secret-management
  procedures.

**Impact**

Public source code without a granted license is not legally open source. A user
cannot reproduce the advertised deployment from the repository. Reading A's
“100% free, open-source, and self-hostable” requirement is therefore unmet even
before product defects are considered.

**Required remediation**

Obtain owner approval for the intended license, add the actual project license
and consistent package metadata, publish a root README/CONTRIBUTING/SECURITY
policy, and provide a tested self-host deployment with pinned images, migrations,
health checks, SMTP/push configuration, backup/restore, and upgrades. Correct
marketing claims until this exists.

## 5. Integration gap analysis

### INT-01 (P1) — Generated OpenAPI types are fresh but unused at application call sites

`@noorixfin/api-client` generates useful `ApiPath`, `ApiResponse`, request body,
path-param, and query-param helpers, but neither web nor mobile declares it as a
dependency. Both transports remain `apiFetch<T>(path: string, body: unknown)`.
The caller can invent both the path and `T`; the compiler then certifies the
invention. MOB-01 is the observed consequence.

Preserve the platform-specific transports, but make their public signatures
generic over generated paths/methods and derive request/response types from the
OpenAPI schema. Add a compile-time fixture proving `/budgets`, `/profiles/me`,
and invalid response envelopes fail to build.

### INT-02 (P1) — Donation settings editor is disconnected from the public support page

The admin editor writes `donation_options` and promises “The /support page is
updated.” `getDonationOptions()` exists, but no page imports it. The public
support page is entirely static and links only to Buy Me a Coffee. Operator
changes therefore have no user-visible effect.

This should either be completed through a guarded API and rendered on `/support`,
or removed. Leaving a privileged editor that appears to succeed but controls
nothing is an operational defect.

### INT-03 (P1) — Mobile Phase 3 surface coverage is materially incomplete

The roadmap requires add/edit transaction, accounts, budgets, goals, calendar,
reports, profile, preferences, security/sessions, and data screens. Current
mobile implementation has a transaction list/add modal, read-only account list,
broken read-only plan screen, dead report row, and partial settings.

Specific gaps:

- no account create/edit/archive screen;
- no budget create/edit/delete screen;
- no goal create/edit/delete screen;
- no calendar or recurring management screen;
- no functional reports screen (`More` uses `onPress={() => {}}`);
- no transaction detail/edit/reverse/receipt/tag UI;
- preferences are hard-coded to English, BDT, and Sunday;
- workspace name is not persisted with the ID, so cold start displays
  “My Workspace” instead of the selected name.

### INT-04 (P2) — API capabilities with no corresponding user-facing operation

The following endpoints are valid and guarded, but no matching operation was
found in the relevant current UI:

- account update/archive (`PATCH .../accounts/:id`);
- category update (`PATCH .../categories/:id`);
- goal update (`PATCH .../goals/:id`);
- budget delete (`DELETE .../budget/:id`);
- transaction detail (`GET .../transactions/:id`);
- broadcast edit (`PATCH /admin/broadcasts/:id`);
- tracing enable/disable/status and correlated trace detail;
- direct user-detail endpoint in the admin console.

Not every endpoint requires a separate page, but each should be classified as
intentional API capability, scheduled UI, or dead API. Today that classification
is undocumented.

### INT-05 (P1) — CI uses conflicting API ports and contains hard-coded live test URLs

The documented runtime contract and both production clients default to port 3001. The CI E2E job writes port 8080 and its shared fixture defaults to 8080.
`data-portability.spec.ts:81,98,113` bypasses the fixture and hard-codes port 3001. In the declared CI environment those requests target a port where CI did
not start the API.

Use one `E2E_API_URL`/`NEXT_PUBLIC_API_URL` source in every fixture and direct
request. Add a preflight assertion that the configured API URL matches the
health endpoint before any browser test seeds data.

### INT-06 (P2) — Marketing and runtime behavior disagree

- `/download` advertises biometric protection and Bangla/English mobile UI;
  neither is implemented.
- The dashboard advertises “unlock with biometrics.”
- `/docs` directs users to App Store, Google Play, and verified APK flows even
  though the release metadata defaults to Coming Soon and no tagged native
  release workflow exists.
- The forgot-password success screen always exposes a localhost Mailpit link,
  including production builds.
- The contribution CTA points to a file that does not exist.

Marketing must be driven by verified release capability flags or remain explicit
about preview status.

## 6. UI, responsive-layout, and accessibility findings

### What is working

- The web shell has explicit 900 px and 600 px responsive rules, flex min-width
  protection, long-string wrapping, and single-column fallbacks.
- Marketing grids reflow across 1024/768/640/480 px breakpoints.
- Reduced-motion rules exist for marketing, skeleton, and shared UI animations.
- The shared components include focus-visible styles, labelled errors, dialog
  semantics, responsive table wrappers, and safe-area-aware bottom sheets.
- Existing axe coverage and targeted tests cover important desktop dashboard,
  login, MFA gate, table-header, Bangla clipping, and 200% zoom cases.

### UI-01 (P1) — Admin navigation is inaccessible below the shell breakpoint

At `max-width: 900px`, `.nf-sidebar` is translated off canvas. The dashboard
mobile header exposes a menu button, but the admin shell's menu button has
inline `display: none` and no class/media override. The operator sidebar is
therefore hidden with no control to open it on mobile/narrow windows.

### UI-02 (P1) — Nested main landmarks exist on omitted accessibility routes

`DashboardShell` already renders `<main>`. The Tags and Debts views and both
branches of the Recurring page render another `<main>` inside it. These routes
are absent from the accessibility route list, so the automated landmark scan
does not see the invalid/nested document structure.

Use a single shell-level `main`; child screens should render sections. Add every
dashboard and admin route to the axe matrix.

### UI-03 (P1) — Site Settings is neither responsive nor accessibly labelled

The payment editor uses an inline `gridTemplateColumns: '120px 1fr'` inside
multiple padded panels with no narrow-screen override. It can exceed the content
width on small operator viewports. Labels are represented by placeholders or
unassociated `<label>` elements; the icon-only remove button has no accessible
name; success/error feedback has no live status role; and hard-coded dark colors
bypass theme/design tokens.

### UI-04 (P1) — Mobile safe areas, touch targets, state semantics, and dead controls need a full pass

- Screens import `SafeAreaView` from React Native while the installed
  `react-native-safe-area-context` is unused.
- The tab bar has fixed height/padding and does not incorporate bottom safe-area
  insets, risking overlap with home indicators/navigation areas.
- Many filter chips, link-like actions, revoke buttons, and icon controls are
  below a 44–48 px target and lack `accessibilityRole`, selected/disabled state,
  hints, or explicit labels.
- Dashboard mobile menu button lacks an accessible name.
- Plan's “See all”, Recurring, and Calendar controls are visually interactive
  but have no action.
- The plan “ProgressRing” draws a complete circular border and rotates it;
  rotating a circle does not display progress. Only the percentage text changes.
- Mobile status icons use emoji/Unicode arrows inconsistently with the installed
  icon system and without equivalent semantics.

### UI-05 (P2) — Design-system adoption is partial

The shared UI package is good but used by only a small set of web surfaces.
There are approximately **883 inline style objects across 69 TSX files**, plus
many hard-coded colors in admin, auth, marketing, and mobile code. This makes
responsive fixes, focus treatment, contrast, RTL/Bangla behavior, and theme
changes local exceptions instead of system guarantees.

Continue incremental adoption, prioritizing form controls, feedback, destructive
actions, data tables, dialogs, and admin pages. Do not attempt an unreviewed
mechanical rewrite of all styles.

### UI-06 (P1) — Accessibility coverage does not cover the product surface

The signed-in axe list covers 9 dashboard routes but omits imports, recurring,
tags, debts, notifications, session/mobile/notification settings, and all mobile
screens. The admin list covers 6 routes but omits jobs, performance, alerts,
security subpages, notification administration, releases, and Site Settings.
Reflow is checked on only three dashboard routes. Browser configuration includes
Desktop Chrome only; there is no WebKit, Firefox, mobile viewport, screen-reader,
or visual-regression gate. No skip-to-content link was found.

## 7. Enterprise-readiness assessment

| Dimension                       | Assessment                                          | Evidence and remaining condition                                                                                                                                                                                       |
| ------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ledger/data integrity           | **Strong core; mobile fail**                        | Append-only double-entry, minor-unit storage, DB constraints and reversal semantics are strong. Mobile amount/transfer/pending behavior blocks an overall pass.                                                        |
| Authorization/privacy           | **Strong API/RLS; P0 exception**                    | RLS, workspace guard, no ambient operator ledger access, MFA/AAL2 admin API. Site Settings actions bypass this boundary.                                                                                               |
| Authentication/session security | **Strong with documented trade-off**                | Locally verified JWTs, httpOnly web cookies, SecureStore mobile tokens, device revocation. Suspension can leave an already-issued token usable until expiry by design.                                                 |
| Input/network security          | **Good, incomplete**                                | Strict DTO validation, bounded parsers, CORS allowlist, throttling, CSP/HSTS/security headers. SVG/site-setting validation and server-action authorization remain.                                                     |
| Reliability/recovery            | **Good foundation; conditional**                    | Health/readiness, graceful drain, idempotency, durable outbox, migration drift, restore drill. Sync timestamp cursor and unbounded JSON export require hardening.                                                      |
| Observability                   | **Useful internal system, not full APM**            | Request IDs, W3C trace context, events, latency/alerts, release/fingerprint/redaction library. The configured reporter is a no-op; there is no optional OTLP/Sentry-compatible sink or distributed dependency tracing. |
| Type safety                     | **Strong DB/API internals; client boundary fail**   | Generated DB types and typed Supabase calls are valuable. OpenAPI types do not constrain web/mobile paths, bodies, or responses.                                                                                       |
| Performance/scalability         | **Reasonable for personal use; unproven at limits** | Indexed core queries, cursor transaction paging, parallel report reads. Account JSON export loads all tables into memory; admin uses offset paging; no load or query-budget tests.                                     |
| Test rigor                      | **Strong web/API breadth; incomplete system proof** | Meaningful unit, SQL, and browser gates. No enforced coverage threshold, native UI/integration suite, device matrix, or current API contract suite.                                                                    |
| Accessibility                   | **Partial**                                         | Good web foundations and targeted tests, but omitted routes, nested landmarks, broken narrow admin navigation, and untested mobile semantics prevent WCAG conformance claim.                                           |
| Supply chain                    | **Fail**                                            | 8 high advisories, no dependency update automation found, actions are tag-pinned rather than commit-SHA-pinned, and Supabase CLI uses `latest`.                                                                        |
| Open source/self-hosting        | **Fail**                                            | No project license or reproducible deployment; published claims exceed repository reality.                                                                                                                             |

### Additional reliability and performance risks

1. **Composite sync cursor still missing.** The API uses `updated_at` only and
   explicitly throws `SYNC_CURSOR_STALLED` when more than the page limit shares
   a timestamp. The client cannot automatically recover by increasing its limit.
   Replace this with `(updated_at, stable_primary_key)` cursors before large
   imports/device rollouts.
2. **Full JSON export is unbounded and duplicated in memory.** The API selects
   every table without paging, builds an object, the web client parses it, and
   the route stringifies it again under the default 10-second API timeout. Use a
   paged/streamed export job with a bounded artifact and expiry for large data.
3. **Worker durability is process-local.** Notification scheduling and delivery
   are implemented inside the API process. Confirm multi-instance locking,
   retry/poison-message handling, and crash recovery under concurrent replicas
   before horizontal deployment.
4. **Operational reporter defaults to no-op.** The internal database feed is
   useful, but process crashes/client failures are not durably exported unless
   their call paths explicitly persist an event. Provide an optional self-hosted
   OTLP-compatible exporter to preserve Reading A.

## 8. Test and delivery gaps

### TEST-01 (P1) — The mobile tests validate the engine, not the product

The 16 tests cover sync/outbox and forced release behavior. No test renders a
mobile screen or checks an actual mobile API path. This is why first-launch,
profile, planning, export, transfer, dead-control, and optimistic-amount defects
all pass. Add repository tests, component tests, and Maestro/Detox-style native
acceptance against a local stack.

### TEST-02 (P1) — Nest's API E2E suite is stale and not in CI

`apps/api/test/app.e2e-spec.ts` is the default scaffold expecting `GET /` to
return “Hello World!”. The API has no such product controller, and CI does not
run `test:e2e`. Replace it with real health/auth/workspace/transaction contract
tests or remove the false suite.

### TEST-03 (P1) — Coverage has no enforceable floor

The API offers `test:cov`, but CI runs ordinary Jest and defines no coverage
threshold. Web has no component/unit coverage; mobile has no screen coverage.
Establish risk-based thresholds for services, guards, money transformations,
sync, and UI actions. Do not chase a single vanity percentage; require coverage
of every P0/P1 path and changed critical module.

### TEST-04 (P2) — CI/release reproducibility can improve

- GitHub Actions are pinned to major tags, not immutable commit SHAs.
- `supabase/setup-cli` installs `latest`.
- Root engines accept pnpm 9+ while `packageManager` and CI require 11.18.0.
- No Dependabot/Renovate config, SBOM generation, artifact signing, provenance,
  secret scanning, or CodeQL workflow was found.
- Mobile CI exports JS bundles but does not produce a signed native artifact on
  tags or run TestFlight/Play Internal smoke tests.

## 9. Documentation and roadmap integrity

### DOC-01 (P1) — The master roadmap's completion statement is not supported by the tree

`audit_and_development.md` says the Reading A roadmap and Phase 3 are complete.
The same repository's `memory/BLOCKERS.md`, `memory/MASTER_PLAN.md`, and mobile DB
source still record unencrypted SQLite, absent device verification, incomplete
screens, and the timestamp cursor limitation. Current source confirms those
gaps remain.

Other drift:

- the roadmap says the generated API client is adopted; it is not a dependency
  of either application;
- it reports 51 OpenAPI paths; the generated document now has 90;
- it says EAS Build/TestFlight/Play internal work is part of completed Phase 3,
  but only `eas.json` and a bundle-export CI job exist;
- it says the design system is shared, but most UI surfaces still bypass it;
- historical docs alternate between ports 3001 and 8080.

Completion status should be generated from explicit acceptance criteria and
links to tests/artifacts, not commit presence alone.

## 10. Forward development roadmap

The sequence below preserves dependencies and excludes all Reading B billing,
commercial, SSO, and multi-tenant scope.

### Recovery Phase R0 — Contain release blockers (1–3 days)

1. Disable or secure the three service-role Site Settings actions; add negative
   authorization tests and audit events.
2. Correct the five mobile contract families and add a live fresh-install smoke
   test so authenticated launch is usable.
3. Disable mobile transfer until destination selection and accounting semantics
   are correct; replace floating-point amount conversion.
4. Upgrade/override vulnerable dependencies and record any bounded exceptions.
5. Add the owner-approved project license; remove inaccurate MIT/self-host and
   biometric/bilingual claims until their prerequisites ship.

**Exit gate:** no unauthenticated privileged mutation, fresh mobile login reaches
Home, money input passes currency exponent tests, and zero unaccepted
critical/high dependency advisories.

### Recovery Phase R1 — Make contracts and CI authoritative (about 1 week)

1. Wrap both transports with generated OpenAPI path/method/body/response types.
2. Add API-client contract tests for every mobile call and critical web action.
3. Unify all CI/runtime API URLs; eliminate literal ports in specs.
4. Replace the stale Nest E2E scaffold with real application tests and run it in
   CI.
5. Add branch-protection-required checks for static, database, E2E, and mobile.

**Exit gate:** an invalid route or response envelope is a compile failure, and a
single CI URL drives health, seeding, web, and direct API requests.

### Recovery Phase R2 — Finish the actual mobile foundation (2–4 weeks)

1. Implement accounts, transaction detail/reversal/tags/receipts, budgets,
   goals, calendar/recurring, and reports screens with honest loading, empty,
   offline, conflict, and error states.
2. Implement profile/preferences/export against real API contracts.
3. Add a queue repair/discard flow and preserve the optimistic typed amount.
4. Wire `@noorixfin/i18n` for English/Bangla and locale-aware money/date display.
5. Add biometric/PIN app lock, SQLCipher or a documented equivalent encrypted
   local store, haptics with reduced-motion/sensory preferences, and proper safe
   area handling.
6. Run iOS/Android device tests for SecureStore, notifications, deep links,
   offline kill/relaunch, large sync, and forced upgrade.

**Exit gate:** every Phase 3 item has a functional screen and device-level
acceptance artifact; no advertised mobile capability is simulated or dead.

### Recovery Phase R3 — Close web/admin integration and accessibility (1–2 weeks)

1. Route Site Settings through NestJS and either render donation configuration
   on `/support` or remove the editor.
2. Fix admin narrow navigation, Site Settings reflow, labels/live regions, nested
   landmarks, touch targets, mobile semantics, and dead controls.
3. Add a skip link and consistent page/title/landmark structure.
4. Expand axe/reflow/Bangla checks to every route; add 320/375 px mobile Chrome,
   WebKit, and Firefox projects plus focused visual regression.
5. Move high-risk forms/tables/actions onto shared UI primitives and tokens.

**Exit gate:** WCAG 2.2 AA automated floor across the complete web route matrix,
keyboard navigation on all operator/user flows, and documented manual screen-
reader/device checks.

### Recovery Phase R4 — Enterprise operations and supply chain (1–2 weeks)

1. Introduce composite sync cursors and a large-batch sync acceptance test.
2. Make full export paged/streamed or asynchronous with integrity metadata,
   expiry, and deletion.
3. Add load/query-budget tests for dashboard reports, search, import, sync,
   notifications, and admin metrics.
4. Provide optional OTLP/self-hosted error export and validate redaction end to
   end.
5. Add dependency automation, CodeQL/secret scan, SBOM, immutable action pins,
   signed artifacts, and provenance.
6. Define and test RPO/RTO, scheduled backup verification, and disaster-recovery
   ownership outside the primary database.

### Recovery Phase R5 — Honest self-hosting and release (about 1 week)

1. Add root README, LICENSE, CONTRIBUTING, SECURITY, support policy, architecture
   quick start, and versioned upgrade guide.
2. Provide tested Compose/container deployment for Supabase dependencies, API,
   web, worker/scheduler, and Mailpit development profile, with production secret
   and SMTP/push guidance.
3. Build signed Android/iOS artifacts from tags, publish checksums/release notes,
   and exercise internal-store upgrades before marking release metadata LIVE.
4. Re-run migrations from scratch, SQL invariants, restore drill, API contract,
   all-browser web E2E, native device E2E, dependency audit, and a clean-clone
   self-host install.

**Release gate:** all P0 and P1 findings closed with executable evidence and the
marketing/docs match the shipped capability exactly.

## 11. P2/P3 future enhancements after the release gate

These are appropriate only after the blockers above are closed:

- user-facing edit/archive flows for accounts and categories;
- goal editing, budget deletion/history, and transaction detail drill-down;
- operator broadcast editing and correlated trace drill-down;
- optional OFX/QIF export and encrypted backup bundles;
- household-oriented UX that stays within Reading A's one-owner/no-sharing
  security model;
- configurable dashboards and saved report ranges;
- local-only forecasting and anomaly insights with no paid/hosted dependency;
- accessibility preference profiles and larger-text/data-density modes;
- F-Droid packaging after reproducible-build and signing requirements are met;
- plugin/export interfaces that remain local and permission-scoped;
- performance budgets and visual-regression baselines per supported device class.

## 12. Final acceptance checklist

NoorixFin should call Reading A complete only when all of the following are true:

- [ ] No service-role operation is callable without action-local/API-local
      authentication, authorization, active-account, and MFA checks.
- [ ] Web and mobile calls are constrained by generated API contracts.
- [ ] A fresh installed mobile app completes sign-in, workspace selection,
      transaction/transfer, planning, profile, export, notification, offline,
      conflict, and sign-out flows on iOS and Android.
- [ ] Mobile financial data is encrypted at rest and protected by the advertised
      app-lock behavior.
- [ ] All advertised English/Bangla, biometric, offline, store, and self-host
      capabilities are real and tested.
- [ ] Dependency audit has no unaccepted critical/high findings.
- [ ] Complete web/admin route matrix passes accessibility and responsive tests
      across Chromium, WebKit, Firefox, and narrow viewports.
- [ ] CI uses one port contract and runs real API, SQL, web, and native/mobile
      integration gates.
- [ ] A clean clone can be legally forked and deployed from documented,
      version-pinned artifacts under the actual project license.
- [ ] Backup/restore, large export, large sync, graceful shutdown, and
      notification-worker recovery meet documented RPO/RTO and load targets.

## 13. Conclusion

The original roadmap delivered a credible enterprise foundation, especially in
the ledger, RLS model, web/API security, migration rigor, and operational
instrumentation. The present risk is not that NoorixFin has no foundation; it is
that green static gates and completion labels are being treated as proof of
cross-client behavior they do not exercise.

Closing the P0/P1 findings above—without adding any Reading B scope—would turn
the current strong core into the honest, free, self-hostable, enterprise-quality
personal finance product Reading A requires.
