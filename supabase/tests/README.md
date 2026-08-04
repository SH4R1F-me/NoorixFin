# NoorixFin Database Tests

## `run-local.sh` — schema, constraints, triggers, RLS

Spins up a throwaway PostgreSQL cluster, applies every migration in order, seeds
two users in two workspaces, and runs the acceptance suite.

```bash
./supabase/tests/run-local.sh
```

Requires a local PostgreSQL install (`/usr/lib/postgresql/<v>/bin`), **not** Docker.
`_local_shim.sql` supplies the pieces of a Supabase project the migrations depend
on: the `auth` schema, `auth.users`, `auth.uid()`, and the `anon` /
`authenticated` / `service_role` roles.

RLS tests run as the **`authenticated`** role with `request.jwt.claim.sub` set —
never as `postgres`, which bypasses RLS and turns the whole suite into a false pass.

### Covered
| ID | Test |
|----|------|
| SEC-01 | A plain user sees neither another user's workspace, membership, nor ledger |
| SEC-02(a) | A user cannot INSERT into another user's workspace |
| SEC-02(c) | `SUPER_ADMIN` sees workspace/profile **metadata** but **zero** ledger rows |
| FIN-01 | debit+credit both positive rejected; zero-only posting rejected |
| — | 42P17 recursion absent on `profiles` (00004) and `workspace_members` (00007) |
| DEC-007 | second member per workspace rejected; second active personal workspace rejected |
| DEC-015 | category kind must equal account class; cross-workspace pairing rejected; unnameable category rejected |
| DEC-010 | `derive_workspace_from_entry()` populates `workspace_id` on postings |

### NOT covered — still needs `supabase start`
Supabase Auth, Storage, Realtime, PostgREST behaviour, and every API-layer test
(idempotency replay, 409 on stale version, the mobile sync round trip).
