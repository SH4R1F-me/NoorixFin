import { expect, type Page } from '@playwright/test';

/**
 * Sign in through the real form.
 *
 * Not a cookie injection: `proxy.ts` and the httpOnly session cookies (DEC-009)
 * are part of what the suite exists to verify, and a fixture that sets the
 * cookie itself would skip them.
 */
export async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/auth/login');
  await page.getByPlaceholder('name@example.com').fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
}

/**
 * Wait for the dashboard's data to arrive.
 *
 * The page is a server component behind a Suspense boundary, so the skeleton
 * paints first and asserting on the URL alone races the stream.
 */
export async function waitForDashboard(page: Page): Promise<void> {
  await expect(page.getByText(/Loading dashboard|ড্যাশবোর্ড লোড/)).toBeHidden({
    timeout: 20_000,
  });
}
