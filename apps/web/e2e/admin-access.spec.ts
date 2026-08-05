/**
 * Dual-role access control — the user-visible half of DEC-016.
 *
 * The assertions that matter:
 *   - a normal user gets a 404 at /admin, not a redirect. A redirect confirms
 *     the route exists; a 404 reveals nothing.
 *   - a normal user's sidebar contains no trace of the System Admin switch, so
 *     it cannot be revealed by editing the DOM.
 *   - an operator can reach every admin route AND still use their own dashboard.
 *   - no admin page renders a monetary figure for another user.
 *
 * Needs Supabase + the API running, and two accounts:
 *   E2E_EMAIL / E2E_PASSWORD        — a normal user
 *   E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD — a super admin
 */
import { test, expect, type Page } from '@playwright/test';

const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD;

const ADMIN_ROUTES = [
  '/admin',
  '/admin/monitoring',
  '/admin/audit',
  '/admin/users',
  '/admin/broadcasts',
  '/admin/settings',
];

async function signIn(page: Page, email: string, password: string) {
  await page.goto('/auth/login');
  await page.getByPlaceholder('name@example.com').fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
}

test.describe('normal user', () => {
  test.skip(!EMAIL || !PASSWORD, 'needs supabase + API running');

  test('cannot reach the admin console and is not shown the switch', async ({ page }) => {
    await signIn(page, EMAIL!, PASSWORD!);

    // The switch must be absent from the markup, not merely hidden.
    await expect(page.locator('aside a[href="/admin"]')).toHaveCount(0);
    await expect(page.locator('aside')).not.toContainText('System Admin');

    for (const route of ADMIN_ROUTES) {
      const response = await page.goto(route);
      // notFound() — deliberately indistinguishable from a route that does not
      // exist. A 302 to /dashboard here would be a regression.
      expect(response?.status(), `${route} should 404 for a normal user`).toBe(404);
    }
  });

  test('the SSE stream endpoint refuses a non-operator', async ({ page }) => {
    await signIn(page, EMAIL!, PASSWORD!);

    // Fetched from INSIDE the page, not via page.request: the session lives in
    // httpOnly cookies that Playwright's APIRequestContext does not carry, so a
    // page.request call is rejected by proxy.ts as anonymous and would pass this
    // test without ever reaching the handler being tested.
    const status = await page.evaluate(async () => {
      const response = await fetch('/admin/monitoring/stream?afterId=0', {
        redirect: 'manual',
      });
      return response.status;
    });

    // Route handlers are not covered by the layout gate, so this is its own
    // check: the handler forwards the caller's token and surfaces the API's 403.
    expect(status).toBe(403);
  });
});

test.describe('super admin', () => {
  test.skip(
    !ADMIN_EMAIL || !ADMIN_PASSWORD,
    'needs E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD',
  );

  test('the SSE stream endpoint serves an operator', async ({ page }) => {
    // Positive control for the test above: proves the 403 there is the guard
    // firing, not the endpoint being broken for everyone.
    await signIn(page, ADMIN_EMAIL!, ADMIN_PASSWORD!);

    const result = await page.evaluate(async () => {
      const response = await fetch('/admin/monitoring/stream?afterId=0', {
        redirect: 'manual',
      });
      return {
        status: response.status,
        contentType: response.headers.get('content-type'),
      };
    });

    expect(result.status).toBe(200);
    expect(result.contentType).toContain('text/event-stream');
  });

  test('sees the switch and can reach every admin route', async ({ page }) => {
    await signIn(page, ADMIN_EMAIL!, ADMIN_PASSWORD!);

    const adminSwitch = page.locator('aside a[href="/admin"]');
    await expect(adminSwitch).toBeVisible();

    for (const route of ADMIN_ROUTES) {
      const response = await page.goto(route);
      expect(response?.status(), `${route} returned ${response?.status()}`).toBeLessThan(400);
      await expect(page.locator('body')).not.toContainText('This page could not be found', {
        timeout: 5_000,
      });
    }
  });

  test('operator mode is visually unmistakable and exits back to personal finances', async ({
    page,
  }) => {
    await signIn(page, ADMIN_EMAIL!, ADMIN_PASSWORD!);
    await page.goto('/admin');

    // The whole point of the dual-role design: you always know which mode you
    // are in, and the way out is always visible.
    await expect(page.locator('body')).toContainText('OPERATOR MODE');
    const exit = page.locator('a[href="/dashboard"]').first();
    await expect(exit).toBeVisible();

    await exit.click();
    await page.waitForURL(/\/dashboard$/, { timeout: 15_000 });
    // Back in their OWN finances — the dual-role requirement.
    await expect(page.locator('aside')).toContainText('NoorixFin');
    await expect(page.locator('body')).not.toContainText('OPERATOR MODE');
  });

  test('user management shows counts but never another user\'s money', async ({ page }) => {
    await signIn(page, ADMIN_EMAIL!, ADMIN_PASSWORD!);
    await page.goto('/admin/users');
    await expect(page.locator('body')).toContainText('User Management');

    const body = (await page.locator('body').innerText()).toLowerCase();
    // Column headers that would only exist if finances had leaked in.
    for (const forbidden of ['balance', 'payee', 'transaction amount', 'net worth']) {
      expect(body, `admin users page must not surface "${forbidden}"`).not.toContain(
        forbidden,
      );
    }
    // The counts it SHOULD show.
    expect(body).toContain('entries');
    expect(body).toContain('accounts');
  });
});
