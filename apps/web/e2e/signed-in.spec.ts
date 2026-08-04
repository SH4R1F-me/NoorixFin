/**
 * Signed-in flow against a live Supabase — the path that was blocked until the
 * Docker group fix.
 *
 * Requires `supabase start` and the seeded operator account. Skipped
 * automatically when either is absent, so the suite stays green on a machine
 * without Docker.
 */
import { test, expect } from '@playwright/test';

const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;

test.describe('sign-in against live Supabase', () => {
  test.skip(!EMAIL || !PASSWORD, 'set E2E_EMAIL and E2E_PASSWORD with supabase running');

  test('signing in reaches the dashboard and sets an httpOnly session cookie', async ({ page, context }) => {
    await page.goto('/auth/login');

    await page.getByPlaceholder('name@example.com').fill(EMAIL!);
    await page.locator('input[type="password"]').first().fill(PASSWORD!);
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
    await page.getByPlaceholder('name@example.com').fill(EMAIL!);
    await page.locator('input[type="password"]').first().fill(PASSWORD!);
    await page.locator('form button[type="submit"]').click();
    await page.waitForURL(/\/dashboard/, { timeout: 20_000 });

    await page.reload();
    // proxy.ts must refresh and re-admit, not bounce to login.
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
