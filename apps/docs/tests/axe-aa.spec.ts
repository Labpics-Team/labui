/**
 * WCAG 2.1 AA axe-core гейт — все фикстуры core-компонентов.
 *
 * Охватывает ОБА рендерера (Lit web components + нативный React) на каждой
 * фикстурной странице. Axe разрешает CSS custom properties (--lab-* роли)
 * через браузерный computed-styles API, поэтому color-contrast проверяется
 * реальными вычисленными значениями, а не именами переменных.
 *
 * label-over-own-surface: правило color-contrast axe читает computed
 * background-color элемента (в т.ч. кнопки, поля, поверхности), а не только
 * фон страницы — что покрывает сценарий «текст лейбла над своей поверхностью».
 * Дополнительная явная проверка assertLabelContrast — в блоке
 * «label-over-own-surface explicit».
 *
 * Reduced-motion: тест `axe AA · <компонент> · reduced-motion` эмулирует
 * prefers-reduced-motion: reduce перед сканом там, где анимации компонента
 * могут влиять на вычисленные стили (transitions отключаются и не искажают
 * color-contrast).
 */

import { expect, test } from '@playwright/test';
import { assertAxeAA, assertLabelContrast } from './support/axe.js';

// ---------------------------------------------------------------------------
// Список фикстур core-компонентов
// ---------------------------------------------------------------------------

const COMPONENT_FIXTURES = [
  { path: '/button.html', label: 'Button', hasReactIsland: true },
  { path: '/badge.html', label: 'Badge', hasReactIsland: true },
  { path: '/kbd.html', label: 'Kbd', hasReactIsland: true },
  { path: '/loader.html', label: 'Loader', hasReactIsland: true },
  { path: '/avatar.html', label: 'Avatar', hasReactIsland: true },
  { path: '/switch.html', label: 'Switch', hasReactIsland: true },
  { path: '/checkbox.html', label: 'Checkbox', hasReactIsland: true },
  { path: '/input.html', label: 'Input', hasReactIsland: true },
  { path: '/textarea.html', label: 'Textarea', hasReactIsland: true },
  { path: '/number-input.html', label: 'NumberInput', hasReactIsland: true },
  { path: '/slider.html', label: 'Slider', hasReactIsland: true },
  { path: '/tooltip.html', label: 'Tooltip', hasReactIsland: true },
  { path: '/popover.html', label: 'Popover', hasReactIsland: true },
  { path: '/dialog.html', label: 'Dialog', hasReactIsland: true },
  { path: '/alert-dialog.html', label: 'AlertDialog', hasReactIsland: true },
  { path: '/tabs.html', label: 'Tabs', hasReactIsland: true },
  { path: '/breadcrumb.html', label: 'Breadcrumb', hasReactIsland: true },
  { path: '/pagination.html', label: 'Pagination', hasReactIsland: true },
  { path: '/radio-group.html', label: 'RadioGroup', hasReactIsland: true },
  { path: '/accordion.html', label: 'Accordion', hasReactIsland: true },
  { path: '/card.html', label: 'Card', hasReactIsland: true },
  { path: '/progress.html', label: 'Progress', hasReactIsland: true },
  { path: '/select.html', label: 'Select', hasReactIsland: true },
  { path: '/menu.html', label: 'Menu', hasReactIsland: true },
  { path: '/combobox.html', label: 'Combobox', hasReactIsland: true },
  { path: '/pin-input.html', label: 'PinInput', hasReactIsland: true },
  { path: '/tags-input.html', label: 'TagsInput', hasReactIsland: true },
] as const;

// ---------------------------------------------------------------------------
// Утилита ожидания монтирования React-острова
// ---------------------------------------------------------------------------

/**
 * Дожидается монтирования React-острова (#react-root) на странице.
 * React-острова монтируются через client-side script после загрузки страницы.
 */
async function waitForReactIsland(page: import('@playwright/test').Page): Promise<void> {
  const reactRoot = page.locator('#react-root');
  if ((await reactRoot.count()) > 0) {
    // Ждём появления хотя бы одного child-элемента — знак, что React смонтировался.
    await expect(reactRoot).not.toBeEmpty({ timeout: 10_000 });
  }
}

// ---------------------------------------------------------------------------
// Основной скан — одна тема (dark, дефолт)
// ---------------------------------------------------------------------------

for (const { path, label, hasReactIsland } of COMPONENT_FIXTURES) {
  test(`axe AA · ${label}`, async ({ page }) => {
    await page.goto(path);
    if (hasReactIsland) await waitForReactIsland(page);
    await assertAxeAA(page);
  });
}

// ---------------------------------------------------------------------------
// Reduced-motion скан — ключевые анимированные компоненты
// ---------------------------------------------------------------------------

/**
 * prefers-reduced-motion: reduce отключает CSS-transitions в компонентах.
 * Убеждаемся, что в режиме reduced-motion нет новых a11y-нарушений
 * (часть компонентов скрывает/показывает контент через transition).
 */
const ANIMATED_FIXTURES = [
  { path: '/accordion.html', label: 'Accordion' },
  { path: '/dialog.html', label: 'Dialog' },
  { path: '/tooltip.html', label: 'Tooltip' },
  { path: '/popover.html', label: 'Popover' },
  { path: '/tabs.html', label: 'Tabs' },
] as const;

for (const { path, label } of ANIMATED_FIXTURES) {
  test(`axe AA · ${label} · reduced-motion`, async ({ page }) => {
    // Эмулируем prefers-reduced-motion: reduce ДО навигации, чтобы CSS
    // transitions были отключены с первого рендера.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(path);
    await waitForReactIsland(page);
    await assertAxeAA(page);
  });
}

// ---------------------------------------------------------------------------
// label-over-own-surface — явная проверка контраста
// ---------------------------------------------------------------------------

/**
 * Явная проверка «лейбл над своей поверхностью» для Button (самый критичный
 * компонент с solid fill surface в обоих темах). Дополняет автоматический
 * axe color-contrast скан прямым замером computed цветов через браузер.
 *
 * Lit: inner <button> в shadow DOM, React: нативный <button> в light DOM.
 * Оба должны проходить WCAG AA (4.5:1 для font-size 1rem, weight 600).
 */
test.describe('label-over-own-surface · Button', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/button.html');
    await waitForReactIsland(page);
  });

  test('Lit accent-fill: белый текст над синей поверхностью ≥ 4.5:1', async ({ page }) => {
    // inner <button> в shadow DOM Lit-элемента.
    const litButton = page.getByTestId('lit-accent-fill').locator('button');
    await litButton.waitFor();
    // Lit shadow DOM: передаём тот же локатор и как лейбл, и как поверхность
    // — computed color и background-color одного элемента дают полную пару.
    await assertLabelContrast(litButton, litButton);
  });

  test('React accent-fill: белый текст над синей поверхностью ≥ 4.5:1', async ({ page }) => {
    // React: нативный <button> в light DOM (testid прямо на кнопке).
    const reactButton = page.getByTestId('react-accent-fill');
    await reactButton.waitFor();
    await assertLabelContrast(reactButton, reactButton);
  });

  test('Lit neutral-fill: текст над нейтральной поверхностью ≥ 4.5:1', async ({ page }) => {
    // neutral kind=fill — PROVISIONAL цвет, проверяем и его.
    const litButton = page.getByTestId('lit-neutral-tinted').locator('button');
    await litButton.waitFor();
    await assertLabelContrast(litButton, litButton);
  });

  test('React neutral-fill: текст над нейтральной поверхностью ≥ 4.5:1', async ({ page }) => {
    const reactButton = page.getByTestId('react-neutral-tinted');
    await reactButton.waitFor();
    await assertLabelContrast(reactButton, reactButton);
  });
});

/**
 * label-over-own-surface для Input — критичен для форм.
 * Проверяем, что текст в поле ввода читаем на фоне control-bg поверхности.
 * (Textarea делит ту же control-bg роль и покрыта общим сканом `assertAxeAA`
 * выше — отдельного явного label-contrast теста для неё не заведено.)
 */
test.describe('label-over-own-surface · Input', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/input.html');
    await waitForReactIsland(page);
  });

  test('Lit input: текст в поле над control-bg ≥ 4.5:1', async ({ page }) => {
    // Shadow root содержит <input>; locator пробивает shadow DOM.
    const litInput = page.getByTestId('lit-neutral').locator('input');
    await litInput.waitFor();
    await assertLabelContrast(litInput, litInput);
  });

  test('React input: текст в поле над control-bg ≥ 4.5:1', async ({ page }) => {
    // React-остров: <span data-testid="react-neutral"> содержит <input>.
    const reactInput = page.getByTestId('react-neutral').locator('input');
    await reactInput.waitFor();
    await assertLabelContrast(reactInput, reactInput);
  });
});
