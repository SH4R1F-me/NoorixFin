/**
 * Runs focused browser checks against the developer-owned live server.
 *
 * The default config owns a production `next start` process on port 3100.
 * This config deliberately owns no process: it lets a developer keep `next
 * dev` on port 3000 visible while a focused spec exercises that exact app.
 */
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  reporter: [['list']],
  use: {
    baseURL: process.env.PLAYWRIGHT_LIVE_URL ?? 'http://127.0.0.1:3000',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
