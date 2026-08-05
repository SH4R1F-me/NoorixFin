/**
 * Signed-in flow against a live Supabase — the path that was blocked until the
 * Docker group fix.
 *
 * ── WHY THIS NO LONGER READS E2E_EMAIL ──────────────────────────────────────
 * It did, and nobody sets it, so the two tests that pin DEC-009's central
 * claim — that the session token is unreachable from page scripts — skipped on
 * every CI run. It creates its own account now, like every other live spec.
 */
import { test, expect } from '@playwright/test';
import { LIVE, seedWorkspace, type Fixture } from './support/fixture';

let user: Pick<Fixture, 'email' | 'password'>;

test.describe('sign-in against live Supabase', () => {
  test.skip(!LIVE, 'needs E2E_LIVE=1 with supabase running');

  test.beforeAll(async () => {
    // An ESTABLISHED user, deliberately. A bare `createUser` has no workspace,
    // and the onboarding gate correctly redirects such a user to /onboarding —
    // so "the session survived a reload" failed on a page that proved the
    // session had survived perfectly well. The subject here is the COOKIE, and
    // a redirect belonging to another feature must not decide the result.
    const created = await seedWorkspace('session');
    user = { email: created.email, password: created.password };
  });

  test('signing in reaches the dashboard and sets an httpOnly session cookie', async ({ page, context }) => {
    await page.goto('/auth/login');

    await page.getByPlaceholder('name@example.com').fill(user.email);
    await page.locator('input[type="password"]').first().fill(user.password);
    await page.locator('form button[type="submit"]').click();

    // The Server Action redirects on success (DEC-009).
    await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
    await expect(page).toHaveURL(/\/dashboard/);

    // DEC-009's core claim, now testable with a real session: the token exists
    // as a cookie but is invisible to JavaScript.
    const cookies = await context.cookies();
    const authCookies = cookies.filter((c) => /^sb-/.test(c.name));
    expect(authCookies.length).toBeGreaterThan(0);
    for (const cookie of authCookies) {
      expect(cookie.httpOnly, `${cookie.name} must be httpOnly`).toBe(true);
      expect(cookie.sameSite).toBe('Lax');
    }

    // ...and confirm it really is unreachable from page scripts.
    const jsVisible = await page.evaluate(() => ({
      cookie: document.cookie,
      local: Object.keys(window.localStorage),
    }));
    expect(jsVisible.cookie).not.toMatch(/sb-/);
    expect(jsVisible.local.filter((k) => /sb-|supabase/.test(k))).toEqual([]);
  });

  test('the session survives a full page reload', async ({ page }) => {
    await page.goto('/auth/login');
    await page.getByPlaceholder('name@example.com').fill(user.email);
    await page.locator('input[type="password"]').first().fill(user.password);
    await page.locator('form button[type="submit"]').click();
    await page.waitForURL(/\/dashboard/, { timeout: 20_000 });

    await page.reload();
    // proxy.ts must refresh and re-admit, not bounce to login.
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
