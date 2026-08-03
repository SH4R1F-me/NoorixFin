# MyFin Supabase Tests

This directory will contain pgTAP tests for RLS policies and database constraints.

## Test files (to be created):
- `rls_workspace_isolation.test.sql` — SEC-01: User A cannot access User B's workspace
- `rls_role_enforcement.test.sql` — SEC-02: Viewer cannot mutate
- `ledger_constraints.test.sql` — FIN-01: Journal posting balance validation
- `idempotency.test.sql` — FIN-02: Duplicate prevention
