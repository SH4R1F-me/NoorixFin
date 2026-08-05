/**
 * Audit finding C — the app must not 500 when the API is unreachable.
 *
 * The regression this guards: `apiFetch` wrapped `fetch` with no try/catch, so
 * an HTTP error became a tidy `ApiError` while a *connection refusal* escaped
 * as a raw `TypeError`. That throw happened inside `getSessionContext()`, which
 * runs in `dashboard/layout.tsx` — so it took every child route down with it.
 * The audit measured status=500 on /dashboard, /transactions, /accounts and
 * /settings with the API stopped.
 *
 * These tests run with NO API on the configured port, which is the normal state
 * for the E2E suite. That is the point: the failure mode under test IS "nothing
 * is listening", so it needs no fixture to reproduce.
 */
import { test, expect } from '@playwright/test';

const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;

test('an unmatched URL renders the branded 404, not a framework page', async ({ page }) => {
  const response = await page.goto('/this-route-does-not-exist');
  expect(response?.status()).toBe(404);

  // Copy comes from the catalog, so asserting it also proves not-found.tsx is
  // reached rather than Next's built-in page (which says "404 This page could
  // not be found" and is not translated).
  //
  // Scoped by heading rather than `getByRole('alert')` alone: Next renders its
  // own empty `role="alert"` route announcer on every page, so the bare role
  // matches two elements and fails strict mode for a reason unrelated to the
  // thing under test.
  await expect(page.getByRole('heading', { name: /not found|পাওয়া যায়নি/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /dashboard|ড্যাশবোর্ড/i })).toBeVisible();

  // A retry button here would be a control that provably cannot help.
  await expect(page.getByRole('button', { name: /try again/i })).toHaveCount(0);
});

test('the landing page survives an unreachable API', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.status(), 'landing must not 500 without the API').toBe(200);
});

test('the login page survives an unreachable API', async ({ page }) => {
  const response = await page.goto('/auth/login');
  expect(response?.status()).toBe(200);
  await expect(page.getByPlaceholder('name@example.com')).toBeVisible();
});

test.describe('signed-in degraded mode', () => {
  test.skip(!EMAIL || !PASSWORD, 'needs supabase running (the API deliberately is not)');

  test('dashboard routes render 200 and explain themselves with the API down', async ({
    page,
  }) => {
    await page.goto('/auth/login');
    await page.getByPlaceholder('name@example.com').fill(EMAIL!);
    await page.locator('input[type="password"]').first().fill(PASSWORD!);
    await page.locator('form button[type="submit"]').click();
    await page.waitForURL(/\/dashboard/, { timeout: 20_000 });

    for (const path of [
      '/dashboard',
      '/dashboard/transactions',
      '/dashboard/accounts',
      '/dashboard/settings',
    ]) {
      const response = await page.goto(path);
      expect(response?.status(), `${path} must not 500 when the API is down`).toBe(200);

      // Not just "it didn't crash": an empty finance dashboard with no
      // explanation reads as "my data is gone". The banner is the fix.
      await expect(
        page.getByRole('alert').filter({ hasText: /cannot contact|সংযোগ করতে পারছে না/i }),
        `${path} should say why it is empty`,
      ).toBeVisible();
    }
  });
});
