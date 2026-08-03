# MyFin — TEST RESULTS

**Last updated:** 2026-08-01

---

## Critical Acceptance Matrix (from Blueprint §21.2)

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| SEC-01 | User A cannot access User B personal workspace | ⬜ Not tested | RLS policies written; needs running Supabase |
| SEC-02 | Viewer cannot mutate | ⬜ Not tested | RLS write policies written; needs running Supabase |
| SEC-03 | Service key absent from clients | ⬜ Not tested | .env.example documents restriction |
| FIN-01 | Every posted journal balanced | 🟡 Partial | DB constraints written; unit tests pass for `validateBalance` |
| FIN-02 | Retry cannot duplicate | ⬜ Not tested | Idempotency table + unique index created |
| FIN-03 | Correction preserves history | ⬜ Not tested | Schema supports `reverses_entry_id` |
| SYNC-01 | Web and Mobile show same committed data | ⬜ Not tested | |
| SYNC-02 | Stale edit detected | ⬜ Not tested | `version` column on all editable tables |
| I18N-01 | Bangla and English complete | 🟡 Partial | Key parity verified manually; CI check not yet |
| TIME-01 | Timezone boundary correct | ⬜ Not tested | All timestamps are `TIMESTAMPTZ` |
| DATA-01 | Export complete and scoped | ⬜ Not tested | |
| DATA-02 | Deletion flow works | ⬜ Not tested | |
| BACKUP-01 | Restore is usable | ⬜ Not tested | |
| STORE-01 | Store privacy declarations accurate | ⬜ Not tested | |
| A11Y-01 | Core flow accessible | ⬜ Not tested | |

---

## Test Execution Log

### TEST-001: @myfin/money Unit Tests
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

### TEST-002: @myfin/money TypeScript Build
- **Date:** 2026-08-01
- **Result:** ✅ PASS — clean compilation (strict mode)

### TEST-003: @myfin/domain TypeScript Build
- **Date:** 2026-08-01
- **Result:** ✅ PASS — clean compilation (strict mode)

### TEST-004: @myfin/design-tokens TypeScript Build
- **Date:** 2026-08-01
- **Result:** ✅ PASS — clean compilation (strict mode)
