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
/**
 * SMOKE-подмножество критического пути — гоняется на КАЖДЫЙ PR (быстро, стабильно).
 * Полный набор (все спеки × chromium+webkit) выведен на расписание в
 * `.github/workflows/e2e-full.yml`. Список курируемый — единая точка истины того,
 * что считается smoke: ядро-seam + контракт токенов/материала + представительные
 * интерактивные компоненты (каждый несёт свой axe-a11y-гейт).
 *
 * Включено в smoke (что проверяем per-PR):
 *   smoke.spec.ts     — страница рендерится + контракт цвета --lab-*
 *   proof.spec.ts     — сквозной seam ядра: SSR / render / toggle / токены / тема
 *   tokens.spec.ts    — контракт дизайн-токенов
 *   materials.spec.ts — стеклянный материал, кросс-движковый (ради него включён webkit)
 *   button.spec.ts    — базовый интерактивный компонент + axe-a11y
 *   input.spec.ts     — базовое поле формы + axe-a11y
 *   checkbox.spec.ts  — базовый контрол формы + axe-a11y
 *
 * НЕ включено в smoke (полное покрытие НЕ теряется — переносится на e2e-full по расписанию):
 *   accordion, alert-dialog, avatar, badge, breadcrumb, card, combobox,
 *   components-template, dialog, kbd, loader, menu, number-input, pagination,
 *   popover, progress, radio-group, select, shadow, slider, switch, tabs,
 *   textarea, tooltip.
 *
 * Активация: `E2E_SMOKE=1` (выставляется PR-джобом e2e в ci.yml). Без этой
 * переменной testMatch не задаётся → действует дефолт Playwright и запускается ВЕСЬ набор.
 */
const SMOKE_SPECS = [
  'smoke.spec.ts',
  'proof.spec.ts',
  'tokens.spec.ts',
  'materials.spec.ts',
  'button.spec.ts',
  'input.spec.ts',
  'checkbox.spec.ts',
];

const smoke = process.env.E2E_SMOKE === '1';

export default defineConfig({
  testDir: './tests',
  // Per-PR smoke сужает набор до критического пути; полный прогон (без E2E_SMOKE)
  // оставляет дефолтный testMatch → все *.spec.ts.
  ...(smoke ? { testMatch: SMOKE_SPECS.map((f) => `**/${f}`) } : {}),
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
