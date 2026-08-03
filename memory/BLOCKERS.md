# MyFin — BLOCKERS

**Last updated:** 2026-08-01

---

## Blocker Format

**ID — Title — Blocking Task — Description — Impact — Owner Action Required — Status**

---

## Active Blockers

### BLK-001: Open Owner Decisions (Blueprint §26)

**Blocking:** Phase 5+ (Production Hardening & Launch)
**Not blocking:** Phase 1-4 (Foundation through Family/Privacy)

**Description:** 12 decisions listed in Blueprint §26 need owner sign-off before public production:

1. Final product name (trademark clearance)
2. Initial launch countries
3. 18+ age restriction confirmation
4. Login methods for launch (email/password, magic link, Google, Apple)
5. Admin export/member permissions specifics
6. Budget model selection (simple vs envelope vs both)
7. Multi-currency in MVP or single-currency workspaces
8. Receipt upload timing (MVP vs V1)
9. Business model (free/premium/family tiers)
10. Data retention periods
11. Production hosting region and data residency
12. Support staff finance-data access policy

**Impact:** Can build through Phase 4 with safe defaults. Cannot finalize production deployment, store listings, or privacy policy without these decisions.

**Owner Action:** Review defaults in DECISIONS.md DEC-002 and confirm or adjust.

**Status:** 🟡 Non-blocking for current work — will block Phase 5+

---

## Resolved Blockers

*None yet.*

---

## Potential Future Blockers

| Risk | Phase | Mitigation |
|------|-------|-----------|
| Supabase Free plan limitations | Phase 5 | Use local Supabase for dev; paid plan decision needed for production |
| Expo Go limitations (SQLCipher) | Phase 2 | Use development build for SQLCipher features |
| Node.js / pnpm version compatibility | Phase 1 | Pin versions in `.nvmrc` and `package.json engines` |
