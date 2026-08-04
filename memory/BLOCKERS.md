# NoorixFin — BLOCKERS

**Last updated:** 2026-08-04 (Session 3/4)

---

## Blocker Format

**ID — Title — Blocking Task — Description — Impact — Owner Action Required — Status**

---

## Active Blockers

### BLK-001: Open Owner Decisions (Blueprint §26)

**Blocking:** Phase 5+ (Production Hardening & Launch)
**Not blocking:** Phase 1-4 (Foundation through Privacy & Data Portability)

**Description:** 12 decisions listed in Blueprint §26 need owner sign-off before public production.
**3 of 12 are now closed** (see DECISIONS.md):

1. ~~Final product name~~ — **CLOSED (DEC-008):** renamed to `NoorixFin`. Legal trademark clearance remains a Phase 6 owner action.
2. Initial launch countries
3. 18+ age restriction confirmation
4. Login methods for launch (email/password, magic link, Google, Apple)
5. ~~Admin export/member permissions specifics~~ — **CLOSED (DEC-007):** family workspaces dropped; no workspace permission matrix exists
6. Budget model selection (simple vs envelope vs both)
7. Multi-currency in MVP or single-currency workspaces
8. Receipt upload timing (MVP vs V1)
9. Business model (free/premium/family tiers)
10. Data retention periods
11. ~~Production hosting region and data residency~~ — **CLOSED (DEC-011):** Supabase Free Tier is the design constraint; region still an owner choice at Phase 5
12. Support staff finance-data access policy

**Impact:** Can build through Phase 4 with safe defaults. Cannot finalize production deployment, store listings, or privacy policy without the remaining 9 decisions.

**Owner Action:** Review defaults in DECISIONS.md DEC-002 and confirm or adjust.

**Status:** 🟡 Non-blocking for current work — will block Phase 5+

---

## Resolved Blockers

### BLK-002: Naming Collision (resolved 2026-08-04)

**Was:** `MyFin` collided with a Bulgarian digital wallet, `MyFin Budget`, and App Store expense trackers
(Blueprint §1.1), risking store rejection and forced post-launch rename.
**Resolution:** Renamed to `NoorixFin` across the monorepo — npm scope `@noorixfin/*`, UI text, Expo
identifiers, docs (DEC-008, plan §1.11). Database identifiers untouched (none contained the old name).
**Residual:** Trademark clearance is still unperformed — a rename removes a *known* collision, it does
not establish ownership. Phase 6 owner/legal action.

### BLK-003: Undocumented Scope Cut in Migration 00003 (resolved 2026-08-04)

**Was:** `00003_simplify_roles.sql` collapsed the four-role family model to two roles citing "DEC-007",
but no such decision existed — plan and schema disagreed with no recorded rationale.
**Resolution:** DEC-007 written with full justification (RLS surface area, free-tier cost, privacy blast
radius, scope honesty, reversibility). MASTER_PLAN Phase 4.1 marked CANCELLED.
**Residual:** none — W2 completed 2026-08-04 (plan §1.12). Migration `00004_two_role_cleanup.sql`
enforces the two-role model at the database level.

---

## Potential Future Blockers

| Risk | Phase | Mitigation |
|------|-------|-----------|

| ~~`supabase start` unavailable~~ | — | **RESOLVED 2026-08-04.** Docker group applied; local stack runs. First run found a total API outage (missing GRANTs, fixed in 00008) and unblocked signed-in E2E |
| Signed-in web flows | — | **RESOLVED 2026-08-04.** `e2e/signed-in.spec.ts` verifies sign-in, httpOnly+SameSite cookie flags, JS-unreachability, and reload survival |
| Supabase Free Tier limits (Realtime connections, egress, 7-day project pause) | Phase 2+ | Now an explicit design constraint, not a risk — see DEC-011 optimization rules (plan §1.14) |
| ~~Acceptance matrix never run live~~ | — | **PARTIALLY RESOLVED 2026-08-04.** DB layer now verified via `./supabase/tests/run-local.sh` (local PostgreSQL, no Docker). It immediately found a total-outage 42P17 recursion on `workspace_members`, fixed in 00007. API/Auth/Realtime/client layers still unverified |
| Mobile app is still an Expo scaffold | Phase 2 | W4 (plan §1.15) builds the real app on the offline-first stack |
| Shared `packages/*` consumed by no app; i18n catalogs duplicated in web; API parses money with `parseInt` | Phase 2 | See "Open Findings" in PROGRESS.md — drift and correctness risk, needs scheduling |
| ~~RLS recursion fix in `00004` reasoned, not observed~~ | — | **RESOLVED 2026-08-04** — observed correct, but it was incomplete: a second recursion on `workspace_members` broke every authenticated read. Fixed in 00007 |
| ~~Categories module contradicts its own schema~~ | — | **RESOLVED 2026-08-04** (DEC-015). Also fixed a third bug found during the rewrite: `buildPostings()` passed a category id where a ledger account id was required, so the transaction engine could never create an income or expense entry |
| ~~`PATCH /accounts/:id` and `GET /transactions/:id` unguarded~~ | — | **RESOLVED 2026-08-04.** A third was found in the same pass: `POST /transactions/:id/reverse`, which mutates the ledger. All three now workspace-scoped + guarded; every route audited |
| ~~Mobile sync engine never executed~~ | — | **RESOLVED 2026-08-04.** 13 tests run the real schema/queue/engine over `node:sqlite`. Found and fixed silent data loss: mutations stranded `IN_FLIGHT` after an app kill were never retried and never surfaced. Device/simulator behaviour still untested |
| Mobile local DB unencrypted (no SQLCipher) | Phase 5 | Needs a development build; Expo Go cannot load SQLCipher |
| Mobile workspace id hardcoded via `EXPO_PUBLIC_DEV_WORKSPACE_ID` | Phase 2 | Wire `GET /v1/workspaces` on first launch + local cache |
| Web Realtime has no readable token after DEC-009 (httpOnly) | W5/W7 | Pick one: short-lived token minted server-side, server-side subscribe relayed over SSE, or anonymous subscribe under RLS. Mobile unaffected (SecureStore) |
| Sync cursor cannot advance if >`limit` rows share one `updated_at` | Phase 4 | Guarded with `SYNC_CURSOR_STALLED` rather than looping. Fix with a composite `(updated_at, id)` cursor before CSV import lands |
| Expo Go limitations (SQLCipher) | Phase 2 | Use development build for SQLCipher features |
| Node.js / pnpm version compatibility | Phase 1 | Pin versions in `.nvmrc` and `package.json engines` |
