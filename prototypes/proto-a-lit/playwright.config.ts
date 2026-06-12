import { defineConfig, devices } from '@playwright/test';

/**
 * Mirrors the apps/docs harness (Chromium, vite preview) but scoped to this
 * throwaway sandbox on port 4400 — so it never touches apps/docs (shared with
 * proto-B) and can't collide with the docs harness on :4321 OR with proto-B,
 * which uses the 43xx range — proto-A owns 44xx.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4400',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm run demo:build && pnpm run demo:preview',
    url: 'http://127.0.0.1:4400',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
