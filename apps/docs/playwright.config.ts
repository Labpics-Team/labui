import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright harness for LabUI.
 *
 * Today: one smoke test (page renders, --lab-* token applied). Tomorrow
 * (`qa-playwright` chapter): the full per-component state matrix and visual
 * regression suite plug into this same config.
 *
 * Visual snapshot strategy:
 *   - Snapshots live next to their spec in `tests/__screenshots__/`
 *     (Playwright default, keyed by test + project + platform).
 *   - Update with `pnpm --filter @labpics/ui-docs test:e2e:update`.
 *   - `maxDiffPixelRatio` keeps anti-aliasing noise from flaking the suite;
 *     tighten per-test when pixel-exact checks are needed.
 *   - WebKit is enabled (materials-system): backdrop-filter and the Ambient
 *     material must read the same across engines, so the materials smoke runs
 *     on Chromium AND WebKit.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.01 },
  },
  use: {
    baseURL: 'http://127.0.0.1:4321',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  webServer: {
    command: 'pnpm run build && pnpm run preview',
    url: 'http://127.0.0.1:4321',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
