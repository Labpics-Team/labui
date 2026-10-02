import { type Page, expect, test } from '@playwright/test';

/**
 * Live engine suite — рантайм-провайдер поверх опубликованного @labpics/colors.
 *
 * Фикстура (`engine-live.html`) поднимает WASM-движок В БРАУЗЕРЕ (npm-алиас
 * `@labpics/colors`), грузит паспорт labui и отдаёт поверхность watchTheme.
 * Это browser-side definition of done канала провайдера:
 *   1. Boot — движок загрузился, переменные легли на поверхность inline
 *      (единая oklch-форма, минуя статический contract.css).
 *   2. Закон фона — смена фона поверхности пересчитывает роли от нового
 *      ФАКТИЧЕСКОГО цвета (не от имени темы).
 *   3. Тема — переключение light/dark меняет резолв.
 *   4. Кастомизация — конфиг «acme» (чужой бренд) перекрашивает бренд-роли
 *      без единой правки компонентов: «взял → закастомил → внедрил».
 */

function surfaceVar(page: Page, name: string): Promise<string> {
  return page
    .getByTestId('live-surface')
    .evaluate((el, varName) => getComputedStyle(el).getPropertyValue(varName).trim(), name);
}

async function setBg(page: Page, hex: string): Promise<void> {
  // input[type=color] не принимает keyboard-ввод в headless стабильно —
  // выставляем значение и шлём то же событие, что слушает демо.
  await page.getByTestId('live-bg').evaluate((el, value) => {
    (el as HTMLInputElement).value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, hex);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/engine-live.html');
  // Boot-гейт: провайдер написал статус и переменные легли на поверхность.
  await expect(page.getByTestId('live-status')).toContainText('фон', {
    timeout: 15_000,
  });
});

test('boot: живой движок кладёт oklch-переменные на поверхность', async ({ page }) => {
  const fill = await surfaceVar(page, '--lab-fill-primary');
  expect(fill, 'переменная провайдера — единая oklch-форма').toMatch(/^oklch\(/);
  const label = await surfaceVar(page, '--lab-label-primary');
  expect(label).toMatch(/^oklch\(/);
});

test('закон фона: смена фона поверхности пересчитывает роли', async ({ page }) => {
  const onWhite = await surfaceVar(page, '--lab-label-primary');
  await setBg(page, '#1a1030');
  await expect.poll(() => surfaceVar(page, '--lab-label-primary')).not.toBe(onWhite);
});

test('тема: light → dark меняет резолв при том же фоне', async ({ page }) => {
  // Средне-серый фон достижим в обеих темах — меняется только контекст VC.
  await setBg(page, '#808080');
  const light = await surfaceVar(page, '--lab-fill-primary');
  await page.getByTestId('live-theme').selectOption('dark');
  await expect.poll(() => surfaceVar(page, '--lab-fill-primary')).not.toBe(light);
});

test('кастомизация: конфиг acme перекрашивает бренд без правок компонентов', async ({ page }) => {
  const labuiBrand = await surfaceVar(page, '--lab-fill-brand-primary');
  const labuiSuccess = await surfaceVar(page, '--lab-fill-success-primary');
  await page.getByTestId('live-config').selectOption('acme');
  // Бренд уехал в фиолетовый…
  await expect.poll(() => surfaceVar(page, '--lab-fill-brand-primary')).not.toBe(labuiBrand);
  // …а сентимент-семья (унаследованная палитра) осталась той же.
  expect(await surfaceVar(page, '--lab-fill-success-primary')).toBe(labuiSuccess);
});
