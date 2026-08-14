/**
 * Token-driven appearance preference — system, light and dark.
 *
 * The profile is the cross-device source of truth; the cookie only lets a
 * signed-out browser keep its choice. These tests exercise the signed-in path
 * through the UI so a green run proves the migration, API, server layout and
 * client provider agree on the same value.
 */
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { LIVE, seedWorkspace, setLocale, type Fixture } from './support/fixture';
import { E2E_API_URL } from './support/runtime';

let fixture: Fixture;
const API_URL = E2E_API_URL;

async function signIn(page: Page) {
  await page.goto('/auth/login');
  await page.getByPlaceholder('name@example.com').fill(fixture.email);
  await page.locator('input[type="password"]').first().fill(fixture.password);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
}

async function chooseTheme(page: Page, label: 'System' | 'Light' | 'Dark') {
  await page.goto('/dashboard/settings');
  const button = page.getByRole('button', { name: label, exact: true });
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
}

async function storedTheme() {
  const response = await fetch(`${API_URL}/v1/me`, {
    headers: { Authorization: `Bearer ${fixture.token}` },
  });
  if (!response.ok) throw new Error(`GET /v1/me failed: ${await response.text()}`);
  return ((await response.json()) as { theme_preference: string }).theme_preference;
}

async function bodyColours(page: Page) {
  return page.evaluate(() => {
    const style = getComputedStyle(document.body);
    return { background: style.backgroundColor, color: style.color };
  });
}

test.describe('appearance preference', () => {
  test.describe.configure({ mode: 'serial' });
  test.skip(!LIVE, 'needs E2E_LIVE=1 with Supabase and the API running');

  test.beforeAll(async () => {
    fixture = await seedWorkspace('theme');
    await setLocale(fixture.token, 'en');
  });

  test('SYSTEM follows the operating system without an explicit override', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await signIn(page);
    await chooseTheme(page, 'System');

    await expect(page.locator('html')).not.toHaveAttribute('data-theme');
    expect(await bodyColours(page)).toEqual({
      background: 'rgb(248, 250, 252)',
      color: 'rgb(15, 23, 42)',
    });

    await page.emulateMedia({ colorScheme: 'dark' });
    await expect
      .poll(() => bodyColours(page))
      .toEqual({
        background: 'rgb(15, 23, 42)',
        color: 'rgb(248, 250, 252)',
      });
  });

  for (const [label, attribute, background, color] of [
    ['Light', 'light', 'rgb(248, 250, 252)', 'rgb(15, 23, 42)'],
    ['Dark', 'dark', 'rgb(15, 23, 42)', 'rgb(248, 250, 252)'],
  ] as const) {
    test(`${label} override persists and remains WCAG 2.2 AA clean`, async ({ page }) => {
      test.setTimeout(label === 'Light' ? 180_000 : 60_000);
      await signIn(page);
      await chooseTheme(page, label);
      await expect(page.locator('html')).toHaveAttribute('data-theme', attribute);
      expect(await bodyColours(page)).toEqual({ background, color });

      // Wait for the actual cross-device source of truth. Reloading while the
      // Server Action is still in flight would cancel the browser request and
      // test navigation timing, not persistence.
      await expect.poll(storedTheme).toBe(label.toUpperCase());

      await page.reload();
      await expect(page.locator('html')).toHaveAttribute('data-theme', attribute);
      expect(await bodyColours(page)).toEqual({ background, color });

      await page.emulateMedia({ reducedMotion: 'reduce' });
      const routes =
        label === 'Light'
          ? [
              '/dashboard',
              '/dashboard/transactions',
              '/dashboard/accounts',
              '/dashboard/categories',
              '/dashboard/budgets',
              '/dashboard/goals',
              '/dashboard/calendar',
              '/dashboard/reports',
              '/dashboard/import',
              '/dashboard/settings',
            ]
          : ['/dashboard/settings'];
      const failures: string[] = [];
      for (const route of routes) {
        await page.goto(route);
        const { violations } = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
          .analyze();
        if (!violations.length) continue;
        failures.push(
          `${route}\n${violations
            .map(
              (violation) =>
                `${violation.id}: ${violation.help}\n${violation.nodes
                  .map((node) => `  ${node.target.join(' ')} — ${node.failureSummary ?? ''}`)
                  .join('\n')}`,
            )
            .join('\n')}`,
        );
      }
      expect(
        failures.join('\n\n'),
      ).toBe('');
    });
  }

  test('the API rejects an unknown appearance value', async ({ request }) => {
    const response = await request.patch(`${API_URL}/v1/me/preferences`, {
      headers: { Authorization: `Bearer ${fixture.token}` },
      data: { theme_preference: 'SEPIA' },
    });
    expect(response.status()).toBe(400);
  });
});
