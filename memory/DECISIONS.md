# MyFin — DECISIONS LOG

**Last updated:** 2026-08-01

---

## Decision Format

Each decision follows: **ID — Title — Decision — Rationale — Alternatives — Status**

---

## DEC-001: Greenfield Build

**Decision:** Start fresh — no existing code to reuse or preserve.
**Rationale:** Project directory contains only `MyFin_Production_Blueprint.md`. No prior implementation exists.
**Status:** Confirmed

---

## DEC-002: MVP Scope Defaults (Pending Owner Decisions)

**Decision:** Proceed with these defaults for the 12 open owner decisions (Blueprint §26):

| # | Question | Default for Build |
|---|----------|-------------------|
| 1 | Name | `MyFin` (working name) |
| 2 | Launch countries | Global (no country-specific features) |
| 3 | Age restriction | 18+ only |
| 4 | Login methods | Email/password for MVP |
| 5 | Admin export permissions | Admin can export (configurable) |
| 6 | Budget model | Simple category limit for MVP |
| 7 | Multi-currency | One workspace = one currency |
| 8 | Receipt upload | Deferred to Phase 4 |
| 9 | Business model | Free during beta |
| 10 | Data retention | 30-day soft delete retention |
| 11 | Hosting region | Local development initially |
| 12 | Support access | No finance-data access |

**Rationale:** Blueprint §26 states "foundation build করা যাবে" without these decisions. These defaults are safe, reversible, and don't block MVP.
**Status:** Active — awaiting owner confirmation

---

## DEC-003: Monorepo Package Manager

**Decision:** pnpm + Turborepo
**Rationale:** Blueprint §2.3 specifies this. pnpm's strict node_modules, disk efficiency, and Turborepo's caching make this optimal for a multi-app TypeScript monorepo.
**Alternatives:** yarn workspaces + nx, npm workspaces
**Status:** Confirmed (blueprint-specified)

---

## DEC-004: Money Representation

**Decision:** Minor-unit bigint integers, decimal string in API, ISO currency codes.
**Rationale:** Blueprint §8.1 mandates no floating-point money arithmetic. PostgreSQL `bigint` for storage, `"1025"` string in JSON (not number), `Intl.NumberFormat` for display.
**Status:** Confirmed (blueprint-specified)

---

## DEC-005: All Financial Writes Through NestJS

**Decision:** Clients never directly mutate financial tables. All writes go through NestJS API.
**Rationale:** Blueprint §2.4 core architecture rule. NestJS validates, authorizes, audits. RLS is defence-in-depth only.
**Status:** Confirmed (blueprint-specified)

---

## DEC-006: Balanced Journal Model

**Decision:** Every transaction creates balanced journal entries (debit = credit).
**Rationale:** Blueprint §8.2. User sees simple income/expense forms; backend creates double-entry postings. Prevents balance drift.
**Status:** Confirmed (blueprint-specified)
