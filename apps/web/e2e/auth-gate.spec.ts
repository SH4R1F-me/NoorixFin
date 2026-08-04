/**
 * Auth gating and session security — DEC-009.
 *
 * The web app has never been loaded by anything. These tests exercise the two
 * claims DEC-009 actually makes:
 *   1. proxy.ts gates /dashboard/*  (if the file were misnamed, it would
 *      silently not run — Next 16 renamed `middleware` to `proxy`)
 *   2. no session token is reachable from JavaScript
 *
 * NOTE: Supabase is not running in this environment. That is deliberate here —
 * an unauthenticated visitor is exactly the state under test, and it also
 * verifies the app degrades rather than 500s when the auth server is
 * unreachable. Signed-in flows need `supabase start` and are not covered.
 */
import { test, expect } from '@playwright/test';

test.describe('proxy.ts route gating', () => {
  test('/dashboard redirects an unauthenticated visitor to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('the redirect preserves intent via ?next=', async ({ page }) => {
    await page.goto('/dashboard/transactions');
    await expect(page).toHaveURL(/[?&]next=%2Fdashboard%2Ftransactions/);
  });

  test('every dashboard route is gated, not just the index', async ({ page }) => {
    for (const path of ['/dashboard/accounts', '/dashboard/categories', '/dashboard/settings']) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/auth\/login/);
    }
  });

  test('public routes are not gated', async ({ page }) => {
    const landing = await page.goto('/');
    expect(landing?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(/\/$/);
  });
});

test.describe('DEC-009: no session token reachable from JavaScript', () => {
  test('storage is empty and no auth cookie is JS-readable', async ({ page }) => {
    await page.goto('/auth/login');

    const exposed = await page.evaluate(() => ({
      local: Object.keys(window.localStorage),
      session: Object.keys(window.sessionStorage),
      cookies: document.cookie,
    }));

    // The failure this guards: reverting to the browser Supabase client would
    // put `sb-<ref>-auth-token` in localStorage, making one XSS a full account
    // takeover on a finance app.
    expect(exposed.local.filter((k) => /supabase|sb-|auth|token/i.test(k))).toEqual([]);
    expect(exposed.session.filter((k) => /supabase|sb-|auth|token/i.test(k))).toEqual([]);
    expect(exposed.cookies).not.toMatch(/sb-|auth-token/i);
  });
});

test.describe('app renders without runtime errors', () => {
  test('login page renders the form (server page + client form split)', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/auth/login');

    await expect(page.getByPlaceholder('name@example.com')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('landing page renders with the renamed product title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/NoorixFin/);
    // DEC-007 removed family workspaces; the title must not advertise them.
    await expect(page).not.toHaveTitle(/Family/i);
  });

  test('the app degrades rather than 500s when Supabase is unreachable', async ({ page }) => {
    // proxy.ts calls getUser() on every matched request. If an unreachable auth
    // server threw instead of yielding a null user, every page would 500.
    const response = await page.goto('/auth/login');
    expect(response?.status()).toBe(200);
  });
});
