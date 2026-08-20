# NoorixFin Deep System Audit — 2026-08-14

**Fresh re-analysis:** 2026-08-21

**Reading A:** enterprise-quality security, correctness, reliability,
accessibility, observability, and delivery discipline for a free,
open-source, self-hostable personal/household finance product. Reading B
commercial, SSO, billing, and shared-tenant scope remains excluded by DEC-025.

**Audited baseline:** local `main` at `c6493a9`, matching `origin/main`, before
this report revision.

## 1. Executive verdict

NoorixFin is **not yet a complete Reading A release**.

Recovery phases R0 and R1 materially improved the system. The unauthorised
Site Settings mutation boundary is closed; the known mobile launch/profile/
planning contract mismatches are fixed; currency-aware integer amount entry
replaced floating point; unsupported transfers are disabled; web and mobile
now depend on the generated API contract package; CI uses one API origin and
runs a real Nest application-boundary suite; the root MIT licence exists; and
the current static, build, database, restore, API-boundary, and mobile bundle
checks are green.

The remaining blockers are no longer the original emergency defects. They are
product-completeness, self-hosting, enforceability, accessibility, and
operational-hardening gaps:

1. The repository is still private and has no root README, CONTRIBUTING,
   SECURITY, or tested container/self-host deployment, despite the public
   open-source/fork/self-host claims.
2. The mobile product is still a preview: financial SQLite data is unencrypted,
   app lock/biometrics are absent, transfer is unavailable, major account/
   planning/report/transaction operations have no screen, export does not
   deliver a file, English/Bangla is not wired, and no native device acceptance
   suite exists.
3. The generated API contract is adopted but not authoritative: both transports
   retain a generic `apiFetch<T>` response override that lets callers invent a
   response type. The exact class of drift that caused the original mobile
   failures can still compile.
4. Accessibility evidence remains partial: nested `main` landmarks persist,
   Site Settings remains poorly labelled/non-responsive, many routes are absent
   from the axe matrix, there is no skip link, and Playwright runs Chromium
   desktop only.
5. Composite sync cursors, bounded export, multi-replica-safe notification
   delivery, a durable external error exporter, load targets, supply-chain
   automation, enforced coverage, and actually enforced branch protection are
   still open.

The honest current description is: **a strong API/database/web release
candidate with a green delivery pipeline, but an incomplete mobile product and
unfinished open-source/self-hosting, accessibility, and operational release
gates.**

## 2. Audit method and current inventory

This re-analysis did not assume the earlier findings were still true. It:

- reviewed all changes from the original report commit `347998b` through
  `c6493a9`;
- traced Nest controllers through generated OpenAPI types into web/mobile call
  sites;
- re-read the ledger, RLS, idempotency, sync, notification, import/export,
  storage, health, observability, and restore paths;
- inspected every mobile route and its local repositories/outbox;
- inspected web/admin navigation, route coverage, accessibility configuration,
  marketing claims, documentation, CI, and GitHub enforcement state;
- searched for dead controls, placeholders, skips, direct service-role use,
  missing deployment artifacts, and unconsumed capabilities; and
- executed fresh local verification against the current tree.

| Inventory item                                                      |  Current |
| ------------------------------------------------------------------- | -------: |
| Source/config files under `apps`, `packages`, `supabase`, `.github` |      539 |
| NestJS controllers                                                  |       15 |
| OpenAPI paths / operations                                          | 90 / 116 |
| Next.js pages / route handlers                                      |   54 / 8 |
| Expo route files                                                    |       19 |
| Supabase migrations                                                 |       32 |
| Web Playwright specs / declared tests                               | 25 / 107 |
| API unit suites / tests                                             | 13 / 105 |
| Mobile suites / tests                                               |   4 / 20 |

### Fresh verification on 2026-08-21

| Command/evidence                             | Result                                                                                                  |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`                             | **20/20 tasks passed**                                                                                  |
| API + web ESLint with `--max-warnings 0`     | **passed**                                                                                              |
| `pnpm test`                                  | **15/15 tasks passed**; API 105, mobile 20, shared packages 118 tests; i18n has no test files           |
| `pnpm build`                                 | **10/10 tasks passed**; Next produced 62 routes                                                         |
| Locale parity                                | **passed**; 1,628 checks across 780 common keys                                                         |
| OpenAPI, design-token, and DB-type freshness | **passed**                                                                                              |
| `pnpm db:check-drift:strict`                 | **passed**; 32/32 migrations applied                                                                    |
| `pnpm db:restore-drill`                      | **passed**; restored invariants and row counts match, zero unbalanced/posting-less posted entries       |
| Nest application-boundary E2E                | **3/3 passed** against the live local API                                                               |
| Expo export (`--platform all`)               | **passed** for web, Android, and iOS                                                                    |
| `pnpm audit --prod --audit-level moderate`   | **failed** with two high `image-size` advisories; covered by a temporary acceptance expiring 2026-09-14 |
| GitHub Actions at `c6493a9`                  | latest `main` run **passed**                                                                            |
| GitHub branch-protection API                 | **not enforced**; GitHub returned 403 because the private repository/plan does not support it           |

The audit did not claim physical-device, TestFlight/Play Internal, screen-reader,
Firefox, or WebKit acceptance. Those artifacts do not exist. The local
Supabase/API processes started for verification were stopped afterward.

## 3. Status of the original findings

| Original finding                                               | Current status                   | Evidence                                                                                                                                                                                                                                                                     |
| -------------------------------------------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SEC-01 unauthorised Site Settings actions                      | **Resolved**                     | Every action now checks authenticated profile, active super-admin, and AAL2 before creating the service client; negative browser coverage exists; uploads are byte-sniffed; mutations write audit events.                                                                    |
| MOB-01 invalid launch/planning/profile/export routes           | **Resolved for route contracts** | Workspace arrays, singular `/budget`, goals envelope/fields, `/me`, `/me/preferences`, and `GET /me/export` now match the API; a live mobile-contract smoke spec exists.                                                                                                     |
| MOB-02 floating money, broken transfer, zero optimistic amount | **Partially resolved**           | Currency exponents and string-to-minor conversion are correct; currency derives from the account; optimistic amount/currency columns exist; transfer is disabled rather than falsely offered as functional. Queue repair and the stale filtered-refresh closure remain open. |
| SUP-01 11 dependency advisories                                | **Reduced, risk accepted**       | The graph is down to two high build-tool `image-size` advisories. The acceptance is documented and unexpired, but no dependency bot exists to implement its stated alert control.                                                                                            |
| OSS-01 no licence/self-host path                               | **Partially resolved**           | Root/package MIT metadata is consistent. The repo remains private; root community/security docs and deployable Compose/container files remain absent.                                                                                                                        |
| INT-01 generated client unused                                 | **Partially resolved**           | Both apps depend on `@noorixfin/api-client`, route/method/body types and compile-time fixtures exist, but the generic response override remains.                                                                                                                             |
| INT-02 donation editor disconnected                            | **Open**                         | `getDonationOptions()` is still unused by `/support`, which remains static.                                                                                                                                                                                                  |
| INT-03 mobile surface incomplete                               | **Open**                         | Profile, notifications, and sessions improved, but the Phase 3 product surface remains materially incomplete.                                                                                                                                                                |
| INT-05 conflicting ports / stale Nest E2E                      | **Resolved**                     | Runtime and CI use 8080 through one environment contract; the Nest starter scaffold was replaced and is run in CI.                                                                                                                                                           |
| INT-06 misleading mobile/store claims                          | **Improved**                     | Store links are capability-gated and docs call the app a preview. Open-source/fork/contribution claims remain inaccurate while the repo is private and CONTRIBUTING is absent; production still renders the localhost Mailpit note.                                          |
| UI-01 hidden admin navigation                                  | **Resolved**                     | The admin menu button is wired to the shared responsive sidebar rules.                                                                                                                                                                                                       |
| UI-02 nested landmarks                                         | **Open**                         | Tags, Debts, and both Recurring branches still render `main` inside `DashboardShell.main`.                                                                                                                                                                                   |
| UI-03 Site Settings accessibility/reflow                       | **Open**                         | Fixed two-column inline grids, unassociated controls, unnamed remove buttons, non-live notices, hard-coded colours, and misleading SVG acceptance remain.                                                                                                                    |
| TEST-02 stale API E2E                                          | **Resolved**                     | The current suite asserts liveness/trace, auth error envelope, and removal of the starter route against the real process.                                                                                                                                                    |
| TEST-03/04 coverage/reproducibility                            | **Open**                         | No coverage floor, immutable action pins, SBOM/signing/provenance, dependency automation, or native release acceptance.                                                                                                                                                      |
| DOC-01 roadmap completion drift                                | **Open**                         | `audit_and_development.md` still declares Reading A and mobile complete despite the gaps below.                                                                                                                                                                              |

## 4. Remaining P0 release blockers

### P0-OSS — Open-source and self-hosting promises are not deliverable

The legal licence problem is fixed, but operational open source is not:

- GitHub reports branch protection is unavailable unless the private repository
  is upgraded or made public; the marketing site nevertheless says users can
  read and fork the repository.
- `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, Code of Conduct, and support
  policy are absent. `/contribute` links directly to the missing CONTRIBUTING
  file and promises a 48-hour review.
- `infra/docker/README.md` names `Dockerfile.api` and `docker-compose.yml`; neither
  exists. There is no tested clean-clone deployment, upgrade/rollback, production
  secret, SMTP/push, worker, storage-backup, or disaster-recovery procedure.
- `/docs` now honestly says the guide is unfinished, but `/open-source` and
  `/download` still call the private tree open source.

**Exit gate:** make the repository accessible under the MIT licence; add the
missing community/security documents; ship and test a pinned self-host stack
from a clean clone; document migrations, upgrades, rollback, secrets,
notification providers, storage backups, and recovery; align marketing with
that verified state.

### P0-MOB — Mobile financial data and the advertised mobile boundary are not release-ready

- `apps/mobile/src/db/index.ts` explicitly records that Expo SQLite is not
  encrypted. Ledger entries, postings, payees, notes, notifications, and the
  durable mutation queue are plaintext at rest.
- `expo-local-authentication` is installed and configured but unused. There is no
  biometric/PIN app lock or lock-on-resume flow.
- Transfer is safely disabled, not implemented. Account create/edit/archive,
  transaction detail/reversal/tags/receipts, budget/goal management,
  calendar/recurring management, and reports have no mobile screens.
- `/settings/data` fetches the full JSON export then discards it and tells the
  user file sharing is for a later phase.
- `@noorixfin/i18n`, i18next, and Expo localization are installed but unused by
  mobile screens; UI and formatting remain hard-coded English.
- No rendered-screen, simulator/device, offline kill/relaunch, push/deep-link,
  SecureStore, biometric, or store-upgrade acceptance suite exists.

**Exit gate:** encrypted local storage plus tested app lock; complete or remove
every advertised mobile operation; downloadable/shareable export; bilingual
UI and locale-aware formatting; queue-repair UX; and recorded iOS/Android device
acceptance before release metadata is marked live.

## 5. Remaining P1 enterprise-quality gaps

### P1-CONTRACT — The generated contract can still be bypassed

Both `apps/web/src/lib/api-client.ts` and `apps/mobile/src/lib/api.ts` expose:

```ts
apiFetch<T>(path: ApiRuntimePath, options?: TransportOptions): Promise<T>
```

This is labelled temporary, but it is used throughout web and in mobile Plan.
It constrains the route string while allowing the caller to invent the response
envelope. Remove the override after completing Swagger response DTOs, migrate
call sites to inferred generated responses, and add negative compile fixtures
that prove a false response field fails.

### P1-MOB-UX — Mobile offline, accessibility, and interaction completion

- `listNeedingAttention()` and `discard()` have no screen; parked financial
  writes cannot be repaired or abandoned. `discard()` itself only deletes the
  queue row, so a future UI must also reconcile the optimistic entry.
- Transactions refresh calls `load()` and then filters the pre-refresh `rows`
  closure, leaving filtered results one refresh behind.
- Most screens still import React Native `SafeAreaView`; the installed
  safe-area-context is unused, and the tab bar has a fixed 64 px height.
- Touch targets/semantics are incomplete; the Add button, filter chips, revoke
  controls, and other icon/link controls often lack explicit accessible names,
  roles, states, or 44–48 px targets.
- Plan “See all,” Recurring, Calendar, and More → Category Report remain dead
  controls. Haptics are not installed/wired.
- Mobile has no lint task. Its Jest config explicitly excludes React Native
  rendering and covers only repositories/sync/release/workspace logic.

### P1-WEB — Web/admin integration and accessibility are incomplete

- Donation settings still bypass NestJS and mutate with a service-role Server
  Action. Authorization is now sound, but this path remains outside API
  throttling/idempotency/error-catalogue/telemetry. Audit failure is not atomic
  with the already-applied mutation.
- `/support` never calls `getDonationOptions()`, so the privileged editor still
  controls nothing visible.
- Site Settings accepts `.svg` in the browser while the server rejects SVG;
  payment inputs are primarily placeholder-labelled, the icon-only delete has
  no accessible name, notices lack live status roles, and the 120 px + 1fr grid
  has no narrow override.
- Tags, Debts, and Recurring still nest `main` landmarks. No skip-to-content
  link was found.
- The axe matrix covers 9 of 17 dashboard pages and 6 of 20 admin pages. It omits
  imports, recurring, tags, debts, notifications, several settings pages, jobs,
  performance, alerts, security subpages, notification administration,
  releases, and Site Settings.
- Playwright has only Desktop Chrome; there are no Firefox, WebKit, mobile
  viewport, visual-regression, or manual screen-reader gates.

### P1-DATA — Sync and export are not bounded at scale

- Delta sync still pages only by `updated_at`. More than the limit at one
  timestamp raises `SYNC_CURSOR_STALLED`; the client cannot raise its default
  limit and caps itself at 50 pages without an explicit incomplete-sync error.
  Use a versioned `(updated_at, stable_primary_key)` cursor and acceptance tests
  for large same-timestamp batches.
- Full account export selects every table into memory, constructs one object,
  then web/mobile parse it again. Use a bounded streamed or asynchronous export
  artifact with integrity metadata, expiry, and deletion.

### P1-WORKER — Notification delivery is not multi-replica safe

Campaign claiming is conditional and safe, but pending delivery rows are read
without a durable claim/lease. Two API replicas can select and send the same
push/email/web-push before either marks it sent. Retries also have no persisted
backoff timestamp. Add an atomic `FOR UPDATE SKIP LOCKED`/RPC claim, lease
recovery, next-attempt scheduling, poison/dead-letter visibility, and
multi-worker crash/concurrency tests.

### P1-OBS — Error reporting is a no-op outside the primary process/database

`@noorixfin/observability` provides good release identity, fingerprints,
redaction, and W3C trace context, but the registered default reporter does
nothing and no application calls `setErrorReporter`. Mobile failures therefore
remain on the handset, process crashes can be lost, and there is no optional
self-hosted OTLP/Sentry-compatible sink or dependency spans. Provide and test a
privacy-preserving exporter while retaining the internal `system_events` feed.

### P1-SUPPLY — Accepted advisories and missing supply-chain controls

The previous 11 advisories are reduced to two high `image-size` denial-of-service
advisories reachable through Expo/Metro build tooling. The documented temporary
acceptance expires 2026-09-14 and reasonably limits reachability, but its stated
dependency-automation control does not exist. GitHub Actions use mutable major
tags, Supabase CLI uses `latest`, and there is no Dependabot/Renovate, CodeQL,
secret scan, SBOM, signing, checksums workflow, or provenance attestation.

### P1-CI — Green CI is not the same as enforced release policy

- The latest `main` workflow is green and contains four well-separated jobs.
- `.github/branch-protection.json` lists those jobs, but GitHub confirmed that
  protection is not active for this private repository/plan. Direct pushes to
  `main` are possible; the JSON file does not enforce anything.
- No coverage thresholds exist. API coverage is optional; mobile has no screen
  coverage; web relies on E2E only.
- The mobile job exports bundles but does not build/sign/install native
  artifacts or run device E2E.

### P1-DOC — Roadmap and architecture status still overstate completion

- `audit_and_development.md` says Reading A and Phase 3 are complete even though
  its own recovery phases R2–R5 remain undone in the tree.
- `ARCHITECTURE.md` still documents port 3001 while the API fallback,
  `.env.example`, clients, tests, and CI consistently use 8080.
- The forgot-password success UI always renders the localhost Mailpit note,
  including production.
- Completion claims are not linked to native/device, accessibility-matrix,
  self-host-clean-clone, dependency, load, or release-artifact evidence.

## 6. P2 product and maintainability backlog

- Add intentional UI classifications for account/category/goal updates, budget
  deletion/history, transaction detail, admin broadcast editing, tracing
  controls/detail, and direct admin user detail.
- Continue migrating high-risk forms, tables, dialogs, and feedback from inline
  styles/hard-coded colours to shared tokens and UI primitives.
- Add user-configurable dashboards/report ranges, encrypted backup bundles,
  OFX/QIF export, accessibility preference profiles, and documented performance
  budgets only after P0/P1 gates.
- Keep household-oriented UX within DEC-025's one-owner/no-shared-tenant model.

## 7. Reading A readiness by dimension

| Dimension                | Current assessment                                                                                                                                                                                   |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ledger/data integrity    | **Strong core** — append-only double entry, DB constraints, reversal semantics, minor units, RLS, and restore proof are credible. Mobile transfer remains unavailable and sync/export limits remain. |
| Authorization/privacy    | **Strong with one architectural exception** — API/RLS/admin AAL2 are strong; Site Settings is now authorised but still a separate service-role write boundary.                                       |
| Reliability/recovery     | **Good foundation** — health/readiness, graceful drain, idempotency, migrations, and restore pass; composite sync, bounded export, worker leasing, and external RPO/RTO remain.                      |
| Type safety              | **Strong internally, partial at clients** — generated DB/OpenAPI types are fresh, but the response override defeats full transport authority.                                                        |
| Web product              | **Substantial release candidate** — core finance and admin surfaces are broad; integration/a11y route completion remains.                                                                            |
| Mobile product           | **Preview / release blocker** — bundles and core sync logic pass, but security, surface coverage, localization, accessibility, and native acceptance are incomplete.                                 |
| Accessibility            | **Partial** — useful axe/keyboard/reflow foundations, not a complete WCAG 2.2 AA claim.                                                                                                              |
| Observability            | **Useful internal telemetry, incomplete incident capture** — no durable client/crash exporter or distributed dependency tracing.                                                                     |
| Test/delivery            | **Broad and green, incompletely enforced** — real CI/database/browser/API evidence; no protected branch, coverage floor, all-browser/native matrix, or signed release proof.                         |
| Supply chain             | **Time-bounded exception** — two accepted high build-tool advisories plus missing automation/hardening.                                                                                              |
| Open source/self-hosting | **Fail** — licence exists, but repository access, community docs, and a reproducible deployment do not.                                                                                              |

## 8. Recommended remaining sequence

### Recovery R2 — Finish the mobile foundation

1. Encrypt the local database and implement/test app lock.
2. Complete transaction/transfer/queue-repair, accounts, planning, calendar,
   recurring, reports, profile/preferences, and real export delivery.
3. Wire English/Bangla, locale-aware dates/money, safe areas, touch semantics,
   and haptics/preferences.
4. Add component plus iOS/Android device acceptance, including offline
   kill/relaunch, SecureStore, push/deep links, and forced upgrades.

### Recovery R3 — Close web/admin integration and WCAG evidence

1. Move Site Settings behind the guarded API and render donation options on
   `/support` or remove the editor.
2. Fix landmark, label, live-region, reflow, touch-target, skip-link, and dead
   control defects.
3. Cover every route in Chromium, Firefox, WebKit, and narrow viewports; add
   focused visual and documented manual screen-reader checks.

### Recovery R4 — Operational and supply-chain hardening

1. Composite sync cursor, bounded export, notification delivery leases/backoff,
   load/query budgets, and multi-worker failure tests.
2. Optional durable privacy-preserving error/trace export.
3. Dependency automation, immutable action/CLI versions, secret/code scans,
   SBOM, signed artifacts, provenance, and enforcement of the temporary risk
   acceptance deadline.
4. Risk-based coverage floors and enforceable required checks.

### Recovery R5 — Honest open-source/self-host release

1. Public/accessibly distributed MIT source plus README, CONTRIBUTING,
   SECURITY, support, conduct, and versioned architecture/upgrade docs.
2. Tested pinned deployment, storage-aware backup/restore, production secrets,
   SMTP/push, migration, rollback, and clean-clone proof.
3. Signed Android/iOS release artifacts, checksums/notes, internal-store upgrade
   tests, and marketing/release flags that match shipped capability.

## 9. Final Reading A acceptance checklist

- [x] No known unauthorised service-role mutation in Site Settings.
- [ ] Service-role application mutations use one guarded/audited API boundary.
- [ ] Web/mobile responses cannot bypass generated API contracts.
- [ ] Mobile core flows are complete on iOS and Android and financial data is
      encrypted behind tested app lock.
- [ ] English/Bangla, offline, push, export, transfer, store, and self-host
      claims are real and acceptance-tested.
- [ ] No expired/unaccepted critical/high dependency findings.
- [ ] Full web/admin route matrix passes WCAG/reflow gates across supported
      engines and narrow viewports, plus documented manual checks.
- [ ] Composite sync, large export, notification worker recovery, graceful
      shutdown, load targets, and RPO/RTO are executable and passing.
- [ ] CI checks and review policy are actually enforced on `main`, with signed
      and traceable release artifacts.
- [ ] A clean clone can legally fork, build, deploy, upgrade, back up, and
      restore NoorixFin using version-pinned documentation and artifacts.

## 10. Conclusion

The recovery work succeeded at its intended first objective: the known P0
authorization and mobile contract failures are no longer present, financial
amount conversion is correct, the contract/CI/database drift guards are real,
and the current codebase is green under a substantial verification set.

That progress does not make the entire Reading A roadmap complete. The next
work should not expand into Reading B features; it should finish R2–R5 and turn
the current strong backend/web foundation into a secure mobile product, a fully
accessible system, an enforceable supply/release process, and a genuinely
forkable and reproducibly self-hostable open-source release.
