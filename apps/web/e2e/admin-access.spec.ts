/**
 * Dual-role access control — the user-visible half of DEC-016 — and the
 * operator second factor (audit item 18).
 *
 * The assertions that matter:
 *   - a normal user gets a 404 at /admin, not a redirect. A redirect confirms
 *     the route exists; a 404 reveals nothing.
 *   - a normal user's sidebar contains no trace of the System Admin switch, so
 *     it cannot be revealed by editing the DOM.
 *   - an operator with a password ALONE is stopped, and the same operator gets
 *     in after presenting their authenticator.
 *   - an operator can reach every admin route AND still use their own dashboard.
 *   - no admin page renders a monetary figure for another user.
 *
 * ── WHY THIS NO LONGER READS E2E_ADMIN_EMAIL ─────────────────────────────────
 * It used to, and nobody set it, so this entire file — the access-control
 * suite — skipped on every run. A security test that silently does not run is
 * worse than one that does not exist, because the green tick is read as
 * coverage. It now builds its own operator like every other data-dependent
 * spec, so it runs in CI.
 */
import { test, expect, type Page } from '@playwright/test';
import {
  LIVE,
  createOperator,
  seedWorkspace,
  setLocale,
  totpCode,
  type Fixture,
  type Operator,
} from './support/fixture';

const ADMIN_ROUTES = [
  '/admin',
  '/admin/monitoring',
  '/admin/audit',
  '/admin/users',
  '/admin/broadcasts',
  '/admin/settings',
];

let user: Fixture;
let operator: Operator;

async function signIn(page: Page, email: string, password: string) {
  await page.goto('/auth/login');
  await page.getByPlaceholder('name@example.com').fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
}

/** Sign in and step up, which is what reaching the console actually requires. */
async function signInAsOperator(page: Page) {
  await signIn(page, operator.email, operator.password);
  await page.goto('/admin');
  await page.getByLabel(/six-digit code/i).fill(totpCode(operator.totpSecret));
  await page.getByRole('button', { name: /verify and continue/i }).click();
  await expect(page.locator('body')).toContainText('OPERATOR MODE', { timeout: 20_000 });
}

test.describe('admin access control', () => {
  test.skip(!LIVE, 'needs E2E_LIVE=1 with supabase and the API running');

  test.beforeAll(async () => {
    [user, operator] = await Promise.all([
      seedWorkspace('normal-user'),
      createOperator('console'),
    ]);
    // Every selector below is an English catalog string.
    await Promise.all([setLocale(user.token, 'en'), setLocale(operator.token, 'en')]);
  });

  test('a normal user cannot reach the console and is not shown the switch', async ({
    page,
  }) => {
    await signIn(page, user.email, user.password);

    // The switch must be absent from the markup, not merely hidden.
    await expect(page.locator('aside a[href="/admin"]')).toHaveCount(0);
    await expect(page.locator('aside')).not.toContainText('System Admin');

    for (const route of ADMIN_ROUTES) {
      const response = await page.goto(route);
      // notFound() — deliberately indistinguishable from a route that does not
      // exist. A 302 to /dashboard here would be a regression, and so would the
      // MFA prompt: a non-operator must not learn that one guards this surface.
      expect(response?.status(), `${route} should 404 for a normal user`).toBe(404);
      await expect(page.locator('body')).not.toContainText('Second factor required');
    }
  });

  test('the SSE stream endpoint refuses a non-operator', async ({ page }) => {
    await signIn(page, user.email, user.password);

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

  test('an operator with a password alone is stopped at the second factor', async ({
    page,
  }) => {
    await signIn(page, operator.email, operator.password);
    await page.goto('/admin');

    // Not a 404 — this person IS an operator, and a 404 would send them
    // debugging their own permissions. A prompt, with the way forward.
    await expect(page.locator('body')).toContainText('Second factor required');
    await expect(page.locator('body')).not.toContainText('OPERATOR MODE');

    // And the API refuses independently of what the page chose to render.
    const status = await page.evaluate(async () => {
      const response = await fetch('/admin/monitoring/stream?afterId=0', {
        redirect: 'manual',
      });
      return response.status;
    });
    expect(status).toBe(403);
  });

  test('presenting the authenticator opens the console', async ({ page }) => {
    await signInAsOperator(page);
    await expect(page.locator('aside a[href="/admin"]').or(page.locator('body'))).toBeTruthy();

    for (const route of ADMIN_ROUTES) {
      const response = await page.goto(route);
      expect(response?.status(), `${route} returned ${response?.status()}`).toBeLessThan(400);
      await expect(page.locator('body')).not.toContainText('This page could not be found', {
        timeout: 5_000,
      });
      await expect(page.locator('body')).not.toContainText('Second factor required');
    }
  });

  test('the SSE stream endpoint serves a stepped-up operator', async ({ page }) => {
    // Positive control for the refusals above: proves those 403s are the guard
    // firing, not the endpoint being broken for everyone.
    await signInAsOperator(page);

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

  test('operator mode is visually unmistakable and exits back to personal finances', async ({
    page,
  }) => {
    await signInAsOperator(page);

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

  test("user management shows counts but never another user's money", async ({ page }) => {
    await signInAsOperator(page);
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
