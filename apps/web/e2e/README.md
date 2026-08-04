# Web E2E (Playwright)

```bash
pnpm --filter @noorixfin/web test:e2e     # or: pnpm exec turbo test:e2e
```

Runs against a **production build** (`next start`), not `next dev` — `proxy.ts` and the
server/client component split behave differently in dev, and production is what ships.

First run needs the browser: `pnpm --filter @noorixfin/web exec playwright install chromium`.

Deliberately **not** part of `pnpm test`: it needs a build and starts a server, and `pnpm test` should
stay fast.

## What is covered

| Area | Assertion |
|---|---|
| `proxy.ts` gating | `/dashboard/*` redirects an unauthenticated visitor to `/auth/login` |
| **proxy is actually running** | The redirect carries `?next=<path>`. The dashboard layout's fallback redirect goes to a *bare* `/auth/login`, so `?next=` can only come from `proxy.ts`. This is the check that would catch the file being misnamed — Next.js 16 renamed `middleware` to `proxy`, and a `middleware.ts` compiles fine while silently never running |
| DEC-009 | No `supabase`/`sb-`/`auth`/`token` key in `localStorage` or `sessionStorage`, and no auth cookie readable via `document.cookie` |
| Rendering | Login page renders (server page + client form split works), no uncaught page errors |
| DEC-008 / DEC-007 | Title contains "NoorixFin" and does **not** contain "Family" |
| Resilience | `/auth/login` returns 200 with Supabase unreachable — `proxy.ts` calls `getUser()` on every matched request, so a throw there would 500 every page |

## Not covered

Anything requiring a session: sign-in, sign-up, dashboard content, sign-out, token refresh, and the
`Secure`/`httpOnly`/`SameSite` cookie flags themselves — asserting those needs a real cookie to inspect.
All of it needs `supabase start`, which is blocked (see BLOCKERS.md).
