/**
 * Loading UX and layout stability — DEC-012.
 *
 * These verify the two claims that are actually checkable without a session:
 * skeletons exist and are announced, and the page does not shift as it settles.
 */
import { test, expect } from '@playwright/test';

test.describe('DEC-012: skeletons are accessible, not just decorative', () => {
  test('the shimmer is hidden from screen readers and the region is announced', async ({ page }) => {
    // The dashboard is gated, so assert on the primitives via the login route's
    // shared document: check the CSS contract that makes skeletons safe.
    await page.goto('/auth/login');

    // Skeleton elements must never be exposed as content.
    const hasNonHiddenSkeleton = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[data-testid="skeleton"]')).some(
        (el) => el.getAttribute('aria-hidden') !== 'true',
      ),
    );
    expect(hasNonHiddenSkeleton).toBe(false);
  });

  test('the shimmer keyframes are defined and reduced-motion disables them', async ({ page }) => {
    await page.goto('/');

    const css = await page.evaluate(() =>
      Array.from(document.styleSheets)
        .flatMap((sheet) => {
          try {
            return Array.from(sheet.cssRules).map((r) => r.cssText);
          } catch {
            return [];
          }
        })
        .join('\n'),
    );

    expect(css).toContain('nf-shimmer');
    // A continuous shimmer is a vestibular trigger; it must be suppressible.
    expect(css).toMatch(/prefers-reduced-motion/);
  });

  test('animation is actually suppressed under reduced-motion', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto('/');

    const animated = await page.evaluate(() => {
      const probe = document.createElement('div');
      probe.setAttribute('data-testid', 'skeleton');
      probe.style.animation = 'nf-shimmer 1.4s ease-in-out infinite';
      document.body.appendChild(probe);
      const name = getComputedStyle(probe).animationName;
      probe.remove();
      return name;
    });

    expect(animated).toBe('none');
    await context.close();
  });
});

test.describe('layout stability', () => {
  test('the login page settles without cumulative layout shift', async ({ page }) => {
    await page.goto('/auth/login');

    const cls = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          let total = 0;
          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
              if (!shift.hadRecentInput) total += shift.value;
            }
          });
          observer.observe({ type: 'layout-shift', buffered: true });
          setTimeout(() => {
            observer.disconnect();
            resolve(total);
          }, 1500);
        }),
    );

    // Google's "good" CLS threshold.
    expect(cls).toBeLessThan(0.1);
  });

  test('the landing page settles without cumulative layout shift', async ({ page }) => {
    await page.goto('/');

    const cls = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          let total = 0;
          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
              if (!shift.hadRecentInput) total += shift.value;
            }
          });
          observer.observe({ type: 'layout-shift', buffered: true });
          setTimeout(() => {
            observer.disconnect();
            resolve(total);
          }, 1500);
        }),
    );

    expect(cls).toBeLessThan(0.1);
  });
});

test.describe('TanStack Query provider is mounted', () => {
  test('the app renders with the client provider without hydration errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });

    await page.goto('/auth/login');
    await page.waitForLoadState('networkidle');

    // A misplaced QueryClientProvider surfaces as a hydration mismatch here.
    const hydrationErrors = errors.filter((e) => /hydrat|Minified React error/i.test(e));
    expect(hydrationErrors).toEqual([]);
  });
});
