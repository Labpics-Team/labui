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
 *   materials-flag.spec.ts — материал по флагу data-material, кросс-движковый
 *                       (ради него включён webkit; старый materials.spec.ts
 *                       снесён вместе с демо Ambient/Solid, #41)
 *   button.spec.ts    — базовый интерактивный компонент + axe-a11y
 *   input.spec.ts     — базовое поле формы + axe-a11y
 *   checkbox.spec.ts  — базовый контрол формы + axe-a11y
 *   pin-input.spec.ts — сегментированное поле + required/group a11y parity
 *
 * Всё, чего нет в SMOKE_SPECS, гоняется только в e2e-full (полное покрытие
 * не теряется — переносится на расписание).
 *
 * Активация: `E2E_SMOKE=1` (выставляется PR-джобом e2e в ci.yml). Без этой
 * переменной testMatch не задаётся → действует дефолт Playwright и запускается ВЕСЬ набор.
 */
const SMOKE_SPECS = [
  'smoke.spec.ts',
  'proof.spec.ts',
  'tokens.spec.ts',
  // z-шкала доезжает до DOM и держит порядок наложения (scrim<panel, dropdown<modal,
  // tooltip сверху). Дешёвый детерминированный smoke → в per-PR критический путь.
  'z-order.spec.ts',
  'materials-flag.spec.ts',
  // Acrylic v2 (ADR-0009): движок-контракт материала — конвейер держит
  // поверхность, пиксельный дифференциал зажима, честные деградации. Тот же
  // класс критического пути, что materials-flag.
  'acrylic-live.spec.ts',
  'button.spec.ts',
  'button-geometry.spec.ts',
  'button-anatomy.spec.ts',
  // Геометрия, шрифт и масштаб Switch сверяются с независимым эталоном.
  'switch-geometry.spec.ts',
  'input.spec.ts',
  'checkbox.spec.ts',
  'pin-input.spec.ts',
];

const smoke = process.env.E2E_SMOKE === '1';

/**
 * Порт preview-сервера. 8 self-hosted раннеров делят один хост (одно сетевое
 * пространство WSL-дистро), поэтому фиксированный порт коллидирует между
 * конкурентными job'ами и с осиротевшим сервером убитого прогона. CI задаёт
 * PW_PORT детерминированно per-runner (см. ci.yml); локально — дефолт 4321.
 */
const PORT = Number(process.env.PW_PORT ?? 4321);

export default defineConfig({
  testDir: './tests',
  // Per-PR smoke (E2E_SMOKE=1) сужает набор до критического пути. Полный
  // прогон (e2e-full) собирает ТОЛЬКО .spec.ts, не дефолтный testMatch:
  // node:test-харнессы (*.test.mjs: lg-*/pb-* фермы) гоняет отдельный CI-шаг
  // `node --test`, а импорт node:test-файла само-исполняет сьют во время
  // коллекции — фермы бежали бы второй раз внутри e2e-джоба (минуты
  // дубль-нагрузки, вне worker/timeout модели Playwright).
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
    // vite явно, не через preview-скрипт: у того захардкожен --port 4321,
    // а поведение повторного флага у CLI — деталь реализации, не контракт.
    command: `pnpm run build && pnpm exec vite preview --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
