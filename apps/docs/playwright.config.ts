import { defineConfig, devices } from '@playwright/test';

const SMOKE_SPECS = [
  'smoke.spec.ts',
  'proof.spec.ts',
  'tokens.spec.ts',
  'z-order.spec.ts',
  'materials-flag.spec.ts',
  'acrylic-live.spec.ts',
  'button.spec.ts',
  'input.spec.ts',
  'checkbox.spec.ts',
  'pin-input.spec.ts',
];

const smoke = process.env.E2E_SMOKE === '1';

const PORT = Number(process.env.PW_PORT ?? 4321);

export default defineConfig({
  testDir: './tests',
  // Node suites запускаются отдельно; FULL включает все Playwright specs.
  testMatch: smoke ? SMOKE_SPECS.map((f) => `**/${f}`) : /.*\.spec\.ts$/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.01 },
  },
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
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
    command: `pnpm run build && pnpm exec vite preview --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
