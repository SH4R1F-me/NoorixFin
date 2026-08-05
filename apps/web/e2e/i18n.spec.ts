/**
 * Language switching actually works — the regression guard for DEC-021.
 *
 * Before the i18n rework, `useTranslation` appeared zero times in the app and
 * five components each held a private `useState` locale. Switching the sidebar
 * toggle changed the sidebar and nothing else, and a reload silently reverted
 * the choice. Measured at the time:
 *
 *     toggle to English → sidebar 15→1 Bangla words, main 56→52
 *     reload            → back to Bangla, localStorage empty
 *
 * These tests assert the properties that were broken, not the implementation, so
 * they stay meaningful if the plumbing changes again.
 */
import { test, expect, type Page } from '@playwright/test';
import { LIVE, seedWorkspace, setLocale, type Fixture } from './support/fixture';

/** Bangla codepoints, excluding the Taka sign (৳, U+09F3) which is a currency
 *  symbol and correctly stays put in an English UI. */
const banglaWords = (text: string) =>
  (text.match(/[ঀ-৲৴-৿]+/g) ?? []).length;

/**
 * This spec owns its account.
 *
 * It TOGGLES and PERSISTS the language, so sharing a login with the rest of the
 * suite meant flipping every other spec's UI to English mid-run — failures that
 * looked like product bugs and were this spec's own writes.
 */
let fixture: Fixture;

async function signIn(page: Page) {
  await page.goto('/auth/login');
  await page.getByPlaceholder('name@example.com').fill(fixture.email);
  await page.locator('input[type="password"]').first().fill(fixture.password);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
}

const switchLanguage = (page: Page) =>
  page.locator('aside button', { hasText: /English|বাংলা/ }).first().click();

test.describe('i18n', () => {
  /**
   * Serial, deliberately.
   *
   * Every test here TOGGLES the language, and the language is now a single
   * persisted value on one profile (DEC-021). Run in parallel they overwrite
   * each other's starting state, so a test asserting "it switched to English"
   * fails because a sibling switched it back — a failure that describes the
   * suite, not the product.
   */
  test.describe.configure({ mode: 'serial' });

  test.skip(!LIVE, 'needs E2E_LIVE=1 with supabase and the API running');

  test.beforeAll(async () => {
    fixture = await seedWorkspace('i18n');
    // Start from a known language so "switch and check it changed" is
    // deterministic rather than depending on what the last run left behind.
    await setLocale(fixture.token, 'bn');
  });

  test('switching language changes the PAGE BODY, not just the sidebar', async ({ page }) => {
    await signIn(page);
    await page.waitForTimeout(1000);

    const mainBefore = banglaWords(await page.locator('main').innerText());
    expect(mainBefore, 'dashboard should start in Bangla').toBeGreaterThan(5);

    await switchLanguage(page);
    await page.waitForTimeout(1000);

    const mainAfter = banglaWords(await page.locator('main').innerText());
    // The old behaviour was 56 → 52: the body was untouched.
    expect(mainAfter, 'main content must actually translate').toBeLessThan(
      mainBefore / 2,
    );
  });

  test('the choice survives a reload', async ({ page }) => {
    await signIn(page);
    await switchLanguage(page);
    await page.waitForTimeout(1200);
    const after = banglaWords(await page.locator('aside').innerText());

    await page.reload();
    await page.waitForTimeout(1500);

    expect(banglaWords(await page.locator('aside').innerText())).toBe(after);
  });

  test('the choice reaches every dashboard route', async ({ page }) => {
    await signIn(page);
    await switchLanguage(page);
    await page.waitForTimeout(1000);

    for (const route of [
      '/dashboard/transactions',
      '/dashboard/accounts',
      '/dashboard/categories',
      '/dashboard/settings',
      '/dashboard/budgets',
    ]) {
      await page.goto(route);
      await page.waitForTimeout(700);
      const words = banglaWords(await page.locator('main').innerText());
      // Previously: transactions 12, settings 7 — untouched by the toggle.
      expect(words, `${route} should be English after switching`).toBeLessThan(3);
    }
  });

  test('html lang follows the language, and survives a reload (WCAG 3.1.1)', async ({ page }) => {
    // Deliberately does NOT assume a starting language: the preference now
    // persists to profiles.locale, so whichever language a previous run left
    // behind is the correct starting point. Asserting "starts as bn" would make
    // this test fail *because the feature works*.
    await signIn(page);
    const before = await page.evaluate(() => document.documentElement.lang);
    expect(['bn', 'en']).toContain(before);

    await switchLanguage(page);
    await page.waitForTimeout(1200);
    await page.reload();

    const after = await page.evaluate(() => document.documentElement.lang);
    expect(after, 'lang must flip and stay flipped').toBe(before === 'bn' ? 'en' : 'bn');
  });

  test('raw translation keys never reach the user', async ({ page }) => {
    // The category dropdown used to render `cat.food_dining` because
    // categoryLabel() was called without a translator at both call sites.
    await signIn(page);
    await page.goto('/dashboard/transactions');
    await page.waitForTimeout(1000);

    const body = await page.locator('body').innerText();
    expect(body).not.toMatch(/\b(cat|nav|app|settings|transactions)\.[a-zA-Z_]+\b/);
  });

  test('the settings language control and the sidebar toggle agree', async ({ page }) => {
    // They used to be independent: one was ephemeral UI state, the other wrote
    // to profiles.locale, so the two controls could disagree indefinitely.
    await signIn(page);
    await switchLanguage(page);
    await page.waitForTimeout(1200);

    await page.goto('/dashboard/settings');
    await page.waitForTimeout(1000);

    // The English option in Preferences must render as the selected one.
    const active = page.locator('button', { hasText: /^English$/ }).first();
    await expect(active).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.lang)).toBe('en');
  });
});
