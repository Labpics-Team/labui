import { defineConfig, devices } from '@playwright/test';

/**
 * Smoke harness for proto-B (Mitosis → React → Next 15).
 *
 * Mirrors apps/docs/playwright.config.ts (Chromium-only, prod build + start) so
 * the criterion is measured the same way as the repo's real harness. It boots
 * the Next fixture, which SSR-renders the Mitosis-compiled Button. The Astro
 * SSR path is verified separately in FINDINGS (Astro 5.1.1 standalone-node
 * runtime hits an `astro:` ESM scheme bug on Node 24 — unrelated to Mitosis).
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4322',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node ./scripts/serve-next.mjs',
    url: 'http://127.0.0.1:4322',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
