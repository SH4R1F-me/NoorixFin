/**
 * Playwright config — web E2E.
 *
 * Runs against a production build (`next start`), not `next dev`: proxy.ts and
 * the server/client component split behave differently in dev, and it is the
 * production behaviour that ships.
 */
import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,

  /**
   * ── WHY THESE TWO ARE SET, AND WHY NOT `retries` ──────────────────────────
   * The suite has grown from 32 tests to 90, and it does not run alone: the
   * same machine is also running eleven Supabase containers, the NestJS API and
   * a production Next server. At Playwright's defaults, three consecutive full
   * runs failed a DIFFERENT random three tests each time, and every failure was
   * a timeout — `page.goto('/auth/login')` exceeding 30 seconds on a page that
   * renders in well under one. That is saturation, not a defect in the product,
   * and it would have behaved the same way on a 2-core CI runner.
   *
   * `workers: 2` stops the suite oversubscribing a 4-core box, and 60s gives a
   * page load room when the database is busy serving another worker's fixture.
   *
   * `retries` stays at 0 deliberately. A retry would have turned those three
   * failures green while leaving the cause in place, and the next thing it hid
   * would have been a real intermittent bug — which is the one class of bug
   * this suite exists to catch and the hardest to find later.
   */
  workers: 2,
  timeout: 60_000,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}/auth/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
