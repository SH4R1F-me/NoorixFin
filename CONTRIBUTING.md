# Contributing to NoorixFin

Thank you for helping make private, self-hostable personal finance software
better. Contributions of code, documentation, translations, accessibility
evidence, threat analysis, and reproducible bug reports are welcome.

By participating, you agree to the [Code of Conduct](CODE_OF_CONDUCT.md). Do not
submit security vulnerabilities through public issues; use
[SECURITY.md](SECURITY.md).

## Before opening a change

1. Search existing issues and discussions to avoid duplicate work.
2. Open an issue for changes that alter a database contract, public API,
   cryptography, authentication, data retention, or the Reading A boundary.
3. Keep changes focused. Reading B commercial, billing, SSO, and shared-tenant
   features are intentionally out of scope.

## Development workflow

```sh
corepack enable
pnpm install --frozen-lockfile
DO_NOT_TRACK=1 pnpm exec supabase start
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Database changes must be additive migrations in `supabase/migrations`; never
edit a migration already merged to `main`. Regenerate and commit DB and OpenAPI
types when their source contracts change. UI changes need keyboard, narrow
viewport, English/Bangla, light/dark, and accessible-name checks appropriate to
the surface. Financial calculations use integer minor units through
`@noorixfin/money`, never floating point.

## Pull requests

- Branch from current `main`; use a descriptive `feat/`, `fix/`, `docs/`, or
  `chore/` branch.
- Explain the user impact, risk, migration/rollback path, and tests performed.
- Include screenshots only for visual changes and redact all personal data.
- Add tests that fail before the fix and pass afterward where practical.
- Resolve all required checks and review comments. Maintainers do not promise a
  fixed response time; see [SUPPORT.md](SUPPORT.md).

All contributions are accepted under the repository's MIT licence. You confirm
that you have the right to submit the work.
