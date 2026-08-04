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
