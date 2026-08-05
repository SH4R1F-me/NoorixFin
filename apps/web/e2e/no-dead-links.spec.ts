/**
 * Every navigable route resolves — regression guard.
 *
 * Four sidebar entries (Budgets, Calendar, Goals, Reports) and the login page's
 * "Forgot password?" link pointed at routes that did not exist, so they 404'd.
 * Categories was the inverse: a working page with no way to reach it.
 *
 * This test walks the actual sidebar rather than a hardcoded list, so adding a
 * nav entry without its page fails here instead of in someone's browser.
 */
import { test, expect } from '@playwright/test';
import { LIVE, seedWorkspace, type Fixture } from './support/fixture';

let user: Fixture;

test('public auth routes resolve', async ({ page }) => {
  for (const path of ['/', '/auth/login', '/auth/forgot-password']) {
    const response = await page.goto(path);
    expect(response?.status(), `${path} should not error`).toBeLessThan(400);
  }
});

test('the login page\'s forgot-password link is not dead', async ({ page }) => {
  await page.goto('/auth/login');
  const link = page.locator('a[href="/auth/forgot-password"]').first();
  await expect(link).toBeVisible();
  const response = await page.goto('/auth/forgot-password');
  expect(response?.status()).toBe(200);
  await expect(page.getByPlaceholder('name@example.com')).toBeVisible();
});

test.describe('authenticated navigation', () => {
  test.skip(!LIVE, 'needs E2E_LIVE=1 with supabase and the API running');

  // Seeded rather than bare: several of these pages render differently with no
  // data, and an empty state is not what "the link resolves" should be
  // measuring.
  test.beforeAll(async () => {
    user = await seedWorkspace('nav');
  });

  test('every sidebar link resolves without a 404', async ({ page }) => {
    await page.goto('/auth/login');
    await page.getByPlaceholder('name@example.com').fill(user.email);
    await page.locator('input[type="password"]').first().fill(user.password);
    await page.locator('form button[type="submit"]').click();
    await page.waitForURL(/\/dashboard/, { timeout: 20_000 });

    // Read the hrefs the sidebar actually renders.
    const hrefs = await page.locator('aside a[href^="/dashboard"]').evaluateAll((els) =>
      Array.from(new Set(els.map((e) => (e as HTMLAnchorElement).getAttribute('href')!))),
    );
    expect(hrefs.length).toBeGreaterThan(5);

    for (const href of hrefs) {
      const response = await page.goto(href);
      expect(response?.status(), `${href} returned ${response?.status()}`).toBeLessThan(400);
      // Next renders its 404 page with a 200 in some streaming cases, so also
      // assert the not-found text is absent.
      await expect(page.locator('body')).not.toContainText('This page could not be found', {
        timeout: 5_000,
      });
    }
  });
});
