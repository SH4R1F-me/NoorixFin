/**
 * WCAG 2.2 AA — audit item 10 and §6.6.
 *
 * §5.5 names WCAG 2.2 AA as a target, and the audit found it unmet: no `scope`
 * on any table, `alt` used once, and no reduced-motion handling on the landing
 * page's animations.
 *
 * ── WHY AN AUTOMATED SCAN, AND WHAT IT IS NOT ────────────────────────────────
 * axe finds roughly a third of WCAG issues. It cannot judge whether alt text is
 * MEANINGFUL, whether a focus order makes sense, or whether an error message
 * helps. So this file does two things: it runs axe as a floor that cannot
 * regress, and it asserts a handful of specific properties by hand where the
 * automated check has a known blind spot — table header association, which axe
 * only flags in some shapes, and reduced-motion, which it does not test at all.
 *
 * Deliberately not asserted here: colour contrast on the landing page's
 * decorative gradients. axe reports those, and the fix is a design decision
 * about the brand palette rather than a code change — recording it as a known
 * exclusion is more honest than suppressing the rule silently.
 */
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
  LIVE,
  createOperator,
  seedWorkspace,
  setLocale,
  totpCode,
  type Fixture,
  type Operator,
} from './support/fixture';

let fixture: Fixture;
let operator: Operator;

/** The tags that make this WCAG 2.2 AA rather than "whatever axe ships". */
const WCAG_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/**
 * ── WHY EVERY SCAN EMULATES REDUCED MOTION ──────────────────────────────────
 * The dashboard cards fade in, so axe measured them MID-ANIMATION and reported
 * contrast failures against a colour nobody ever sees: one card was scanned at
 * 13% opacity, turning #94a3b8 into a computed #78869b at 4.15:1. Those are
 * artefacts of when the screenshot was taken, not of what a user reads — and
 * chasing them would have meant "fixing" colours that were already compliant.
 *
 * Reduced motion collapses every animation to its END state, which is both the
 * state being asserted about and a configuration real users browse in. The
 * separate reduced-motion test below is what proves the collapse actually
 * happens, so this is not assuming the thing it relies on.
 */
async function scan(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  return new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
}

/** Readable failure output — a bare object dump is unusable in CI logs. */
function describe(violations: Awaited<ReturnType<typeof scan>>['violations']) {
  return violations
    .map(
      (v) =>
        `${v.id} (${v.impact}): ${v.help}\n  ${v.nodes
          .slice(0, 3)
          .map((n) => n.target.join(' '))
          .join('\n  ')}`,
    )
    .join('\n');
}

test.describe('accessibility — signed out', () => {
  for (const [name, path] of [
    ['landing', '/'],
    ['login', '/auth/login'],
    ['forgot password', '/auth/forgot-password'],
    ['not found', '/this-route-does-not-exist'],
  ] as const) {
    test(`${name} has no WCAG 2.2 AA violations`, async ({ page }) => {
      await page.goto(path);
      const { violations } = await scan(page);
      expect(describe(violations)).toBe('');
    });
  }

  test('the landing page honours prefers-reduced-motion', async ({ page }) => {
    // axe does not test this at all, and the landing page is where it matters:
    // three infinite float loops, a pulse-glow and a bounce. Continuous motion
    // is a vestibular-discomfort trigger, not a preference.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');

    const animated = await page.evaluate(() => {
      const results: { selector: string; duration: string; iterations: string }[] = [];
      for (const element of Array.from(document.querySelectorAll('*'))) {
        const style = getComputedStyle(element);
        if (style.animationName !== 'none' && style.animationName !== '') {
          results.push({
            selector: element.className?.toString().slice(0, 40) ?? element.tagName,
            duration: style.animationDuration,
            iterations: style.animationIterationCount,
          });
        }
      }
      return results;
    });

    // Not "no animations" — the rule neutralises them rather than removing the
    // declarations, which is what keeps the layout identical.
    for (const entry of animated) {
      expect(
        parseFloat(entry.duration) < 0.05,
        `${entry.selector} still animates for ${entry.duration}`,
      ).toBe(true);
      expect(
        entry.iterations,
        `${entry.selector} still repeats (${entry.iterations})`,
      ).not.toBe('infinite');
    }
  });
});

test.describe('accessibility — signed in', () => {
  test.skip(!LIVE, 'needs E2E_LIVE=1 with supabase and the API running');

  test.beforeAll(async () => {
    fixture = await seedWorkspace('a11y');
    await setLocale(fixture.token, 'en');
  });

  async function signIn(page: Page) {
    await page.goto('/auth/login');
    await page.getByPlaceholder('name@example.com').fill(fixture.email);
    await page.locator('input[type="password"]').first().fill(fixture.password);
    await page.locator('form button[type="submit"]').click();
    await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
  }

  const ROUTES = [
    '/dashboard',
    '/dashboard/transactions',
    '/dashboard/accounts',
    '/dashboard/categories',
    '/dashboard/budgets',
    '/dashboard/goals',
    '/dashboard/calendar',
    '/dashboard/reports',
    '/dashboard/settings',
  ];

  test('every dashboard route has no WCAG 2.2 AA violations', async ({ page }) => {
    // Nine full axe scans in one test. Raised rather than split so a failure
    // reports EVERY offending route at once — fixing contrast one route per
    // run is how a palette change takes nine iterations.
    test.setTimeout(180_000);
    await signIn(page);
    const failures: string[] = [];
    for (const route of ROUTES) {
      await page.goto(route);
      const { violations } = await scan(page);
      if (violations.length) failures.push(`── ${route}\n${describe(violations)}`);
    }
    expect(failures.join('\n\n')).toBe('');
  });

  test('every table header is associated with its column', async ({ page }) => {
    test.setTimeout(120_000);
    // The audit's finding was `scope=` absent from all six tables. Asserted
    // directly because axe only reports missing scope in some table shapes, so
    // a green axe run is not evidence this holds.
    await signIn(page);
    for (const route of ROUTES) {
      await page.goto(route);
      const unscoped = await page.evaluate(() =>
        Array.from(document.querySelectorAll('th'))
          .filter((th) => !th.getAttribute('scope') && (th.textContent ?? '').trim() !== '')
          .map((th) => th.textContent?.trim() ?? '?'),
      );
      expect(unscoped, `${route} has headers with no scope`).toEqual([]);
    }
  });

  /**
   * WCAG 1.4.4 (Resize Text) and 1.4.10 (Reflow) — §5.5 names 200% zoom, and
   * the audit named Bangla truncation alongside it because the two failures
   * look identical from a screenshot and have different causes.
   *
   * Emulated as a 640×540 viewport rather than a CSS zoom: 1.4.10 is defined in
   * terms of a 320 CSS-pixel-wide viewport at 400% zoom, and halving a 1280
   * desktop width to 640 reproduces 200% on the same content. What must not
   * happen is HORIZONTAL scrolling of the page — that is the specific failure
   * reflow prohibits, because it makes every line require two-axis scrolling.
   */
  test('survives 200% zoom without forcing horizontal scrolling', async ({ page }) => {
    await signIn(page);
    await page.setViewportSize({ width: 640, height: 540 });

    for (const route of ['/dashboard', '/dashboard/transactions', '/dashboard/reports']) {
      await page.goto(route);
      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      // A few pixels of rounding is not a reflow failure; a scrollbar is.
      expect(
        overflow.scrollWidth - overflow.clientWidth,
        `${route} scrolls horizontally at 200% zoom`,
      ).toBeLessThanOrEqual(2);
    }
  });

  test('Bangla text is not truncated or clipped', async ({ page }) => {
    // Bangla renders taller and wider than the equivalent English, so a box
    // sized around English copy hides part of it — and because the visible
    // glyphs still look like text, it reads as a rendering quirk rather than as
    // missing content.
    //
    // Only elements that actually HIDE the overflow count. The first version of
    // this test flagged every Bangla heading, because `scrollHeight` exceeds
    // `clientHeight` whenever a line box is taller than its declared height —
    // which with `overflow: visible` means the text renders outside the box and
    // is perfectly readable. Chasing those would have meant "fixing" text that
    // was never broken.
    await setLocale(fixture.token, 'bn');
    await signIn(page);

    try {
      for (const route of ['/dashboard', '/dashboard/transactions', '/dashboard/settings']) {
        await page.goto(route);
        const clipped = await page.evaluate(() =>
          Array.from(document.querySelectorAll('span, p, a, button, h1, h2, h3, label'))
            .filter((el) => {
              const text = (el.textContent ?? '').trim();
              if (!/[\u0980-\u09FF]/.test(text) || el.children.length > 0) return false;

              const style = getComputedStyle(el);
              // Scrollable on purpose — the content is reachable.
              if (/auto|scroll/.test(style.overflow + style.overflowX + style.overflowY)) {
                return false;
              }
              // The only ways text actually disappears.
              const hides =
                style.overflow === 'hidden' ||
                style.overflowX === 'hidden' ||
                style.overflowY === 'hidden' ||
                style.textOverflow === 'ellipsis' ||
                style.webkitLineClamp !== 'none';
              if (!hides) return false;

              return el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1;
            })
            .map((el) => (el.textContent ?? '').trim().slice(0, 40)),
        );
        expect(clipped, `${route} hides part of its Bangla text`).toEqual([]);
      }
    } finally {
      // Restore, or every later test renders in Bangla and matches English
      // selectors against Bangla copy.
      await setLocale(fixture.token, 'en');
    }
  });

  test('the app is usable from the keyboard alone', async ({ page }) => {
    await signIn(page);
    await page.goto('/dashboard');

    // Tab until something in the sidebar has focus, then follow it. The
    // assertion is that focus lands on a real, visible control — a focus trap
    // or an invisible tab stop is the failure this catches.
    const reached: string[] = [];
    for (let i = 0; i < 12; i += 1) {
      await page.keyboard.press('Tab');
      const focused = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        const rect = el.getBoundingClientRect();
        return {
          tag: el.tagName,
          visible: rect.width > 0 && rect.height > 0,
          // A focused element with no accessible name is a control a screen
          // reader announces as nothing.
          name:
            el.getAttribute('aria-label') ??
            el.textContent?.trim().slice(0, 30) ??
            '',
        };
      });
      if (!focused) continue;
      expect(focused.visible, `${focused.tag} takes focus while invisible`).toBe(true);
      expect(focused.name.length, `${focused.tag} has no accessible name`).toBeGreaterThan(0);
      reached.push(focused.tag);
    }
    expect(reached.length).toBeGreaterThan(3);
  });
});


test.describe('accessibility — operator console', () => {
  test.skip(!LIVE, 'needs E2E_LIVE=1 with supabase and the API running');

  /**
   * The admin console was the larger half of the audit's `scope=` finding —
   * five of the six tables it named live here. It is also the surface where a
   * missing header association hurts most: the user list is nine columns of
   * bare numbers, and "3" with no column name is not information.
   */
  test.beforeAll(async () => {
    operator = await createOperator('a11y');
    await setLocale(operator.token, 'en');
  });

  const ADMIN_ROUTES = [
    '/admin',
    '/admin/monitoring',
    '/admin/audit',
    '/admin/users',
    '/admin/broadcasts',
    '/admin/settings',
  ];

  async function enterConsole(page: Page) {
    await page.goto('/auth/login');
    await page.getByPlaceholder('name@example.com').fill(operator.email);
    await page.locator('input[type="password"]').first().fill(operator.password);
    await page.locator('form button[type="submit"]').click();
    await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
    await page.goto('/admin');
    await page.getByLabel(/six-digit code/i).fill(totpCode(operator.totpSecret));
    await page.getByRole('button', { name: /verify and continue/i }).click();
    await expect(page.locator('body')).toContainText('OPERATOR MODE', { timeout: 20_000 });
  }

  test('the step-up screen itself is accessible', async ({ page }) => {
    // Scanned BEFORE stepping up: a gate an operator cannot use is a lockout,
    // and it is the one screen they must get through to reach everything else.
    await page.goto('/auth/login');
    await page.getByPlaceholder('name@example.com').fill(operator.email);
    await page.locator('input[type="password"]').first().fill(operator.password);
    await page.locator('form button[type="submit"]').click();
    await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
    await page.goto('/admin');
    await expect(page.locator('body')).toContainText('Second factor required');

    const { violations } = await scan(page);
    expect(describe(violations)).toBe('');
  });

  test('every admin route has no WCAG 2.2 AA violations', async ({ page }) => {
    // As above, plus /admin/monitoring holds an open SSE connection, so the
    // page never reaches network idle and each scan there is slower.
    test.setTimeout(180_000);
    await enterConsole(page);
    const failures: string[] = [];
    for (const route of ADMIN_ROUTES) {
      await page.goto(route);
      const { violations } = await scan(page);
      if (violations.length) failures.push(`\u2500\u2500 ${route}\n${describe(violations)}`);
    }
    expect(failures.join('\n\n')).toBe('');
  });

  test('every admin table header is associated with its column', async ({ page }) => {
    test.setTimeout(120_000);
    await enterConsole(page);
    for (const route of ADMIN_ROUTES) {
      await page.goto(route);
      const unscoped = await page.evaluate(() =>
        Array.from(document.querySelectorAll('th'))
          .filter((th) => !th.getAttribute('scope') && (th.textContent ?? '').trim() !== '')
          .map((th) => th.textContent?.trim() ?? '?'),
      );
      expect(unscoped, `${route} has headers with no scope`).toEqual([]);
    }
  });
});
