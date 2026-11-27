import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const catalog = JSON.parse(
  readFileSync(new URL('../../../catalog/registry.json', import.meta.url), 'utf8'),
) as { families: { kind: string }[] };

/**
 * Component-doc TEMPLATE smoke — proves the reusable docs scaffold renders all
 * six sections from a single `ComponentDoc` config. Demoed on `lab-proof` (a
 * component-agnostic check), pinned via `?component=proof` so it does not depend
 * on which component is the registry default.
 *
 * The template is closed for modification; these checks guard the seam:
 *   1. Page renders from config — header (honest "Proof" status), all sections.
 *   2. Состояния is LIVE — it builds real <lab-proof> elements in every cell.
 *   3. Живой пример is interactive — a control flips a real attribute.
 *   4. Theme switch re-skins the documented element with zero element edits.
 *   5. Navigation is honest — unimplemented families have their own source detail.
 *   6. Unknown addresses preserve the requested identity.
 */

test('renders all six sections from the proof config with an honest status', async ({ page }) => {
  await page.goto('/components.html?component=proof');

  // Header: title carries the real tag and an HONEST "Proof" badge (not Stable).
  await expect(page.locator('#doc-title')).toContainText('lab-proof');
  const badge = page.locator('.status-badge');
  await expect(badge).toHaveAttribute('data-status', 'proof');
  await expect(badge).toContainText('Proof');

  // All six section headings are present and in order.
  const headings = page.locator('.doc-section > h2, .doc-header');
  await expect(page.getByRole('heading', { name: 'Состояния' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Анатомия' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Применение' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Живой пример' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Props / API' })).toBeVisible();
  // Sanity: the section container count matches the five doc sections.
  await expect(page.locator('.doc-section')).toHaveCount(5);
  await expect(headings.first()).toBeVisible();
});

test('states matrix renders REAL lab-proof elements in every cell', async ({ page }) => {
  await page.goto('/components.html?component=proof');

  // Two axes (State × Disabled) → a 2-column × 2-row grid = 4 live cells.
  const cells = page.locator('.matrix-cell lab-proof');
  await expect(cells).toHaveCount(4);

  // Each cell is the real upgraded element with its inner shadow button.
  await expect(cells.first().locator('button')).toBeVisible();

  // A disabled cell actually carries the disabled attribute (config → DOM).
  await expect(page.locator('.matrix-cell lab-proof[disabled]')).toHaveCount(2);
  // A pressed cell starts pressed via default-pressed (config → DOM).
  await expect(page.locator('.matrix-cell lab-proof[default-pressed]')).toHaveCount(2);
});

test('live example control flips a real attribute on the element', async ({ page }) => {
  await page.goto('/components.html?component=proof');

  const specimen = page.locator('.live-stage lab-proof');
  await expect(specimen).toBeVisible();
  await expect(specimen).not.toHaveAttribute('disabled', /.*/);

  await page.getByLabel('Disabled', { exact: true }).check();
  await expect(specimen).toHaveAttribute('disabled', '');
});

test('live control starts at the component value and changes its rendered spacing', async ({
  page,
}) => {
  await page.goto('/components.html?component=card');
  const card = page.locator('.live-stage lab-card');
  const spacing = page.getByRole('combobox', { name: 'Отступы', exact: true });
  await expect(spacing).toHaveValue('l');
  await expect(card.locator('.lab-card-content')).toHaveCSS('padding', '24px');
  await spacing.selectOption('none');
  await expect(card.locator('.lab-card-content')).toHaveCSS('padding', '0px');
});

test('theme switch re-skins the documented element with zero element edits', async ({ page }) => {
  await page.goto('/components.html?component=proof');

  const button = page.locator('.live-stage lab-proof button');
  const darkBorder = await button.evaluate((el) => getComputedStyle(el).borderTopColor);

  // The page's own Theme switcher flips [data-theme] on the root.
  await page.getByTestId('data-theme-select').selectOption('light');

  await expect
    .poll(() => button.evaluate((el) => getComputedStyle(el).borderTopColor))
    .not.toBe(darkBorder);
});

test('catalog navigation resolves an unimplemented family without substituting Button', async ({
  page,
}) => {
  await page.goto('/components.html');
  await expect(page.locator('#doc-title')).toHaveText('Каталог компонентов');
  expect(await page.evaluate(() => customElements.get('lab-button') === undefined)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('catalog-desktop.png') });
  await page
    .locator('.catalog-grid')
    .getByRole('link', { name: /^Calendar/ })
    .click();
  await expect(page.locator('#doc-title')).toHaveText('Calendar');
  await expect(page.getByRole('heading', { name: 'Реализация ещё не добавлена' })).toBeVisible();
  await expect(page.locator('main .catalog-capabilities')).toContainText('Web · нет API');
  await expect(page.locator('main lab-button')).toHaveCount(0);
  await page.getByText('Состав семейства и соответствие Figma', { exact: true }).click();
  await expect(page.getByRole('rowheader', { name: 'Calendar Calendar/Mini' })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('catalog-calendar.png') });
});

test('available API keeps its live example and does not claim all authored variants are ready', async ({
  page,
}) => {
  await page.goto('/components.html?component=button');
  await expect(page.locator('#doc-title')).toContainText('lab-button');
  await expect(page.locator('.live-stage lab-button')).toBeVisible();
  await expect(page.locator('.doc-header .catalog-capabilities')).toContainText('Web · есть API');
  await expect(page.locator('.doc-header .catalog-capabilities')).toContainText(
    'Compose · есть API',
  );
  await expect(page.locator('.status-badge')).toHaveCount(0);
  await page.screenshot({ path: test.info().outputPath('catalog-button.png') });
});

test('partly mapped family distinguishes circular progress from its linear API', async ({
  page,
}) => {
  await page.goto('/components.html?component=progress');
  await expect(page.locator('.live-stage lab-progress')).toBeVisible();
  await page.getByText('Состав семейства и соответствие Figma', { exact: true }).click();
  const circular = page.getByRole('row').filter({ hasText: 'Circular progress' });
  await expect(circular).toContainText('Не сопоставлено');
  const linear = page.getByRole('row').filter({ hasText: 'Linear progress' });
  await expect(linear).toContainText('Линейное представление progress.');
  await page.screenshot({ path: test.info().outputPath('catalog-progress.png') });
});

test('unknown component preserves its identity and provides a route back to the catalog', async ({
  page,
}) => {
  await page.goto('/components.html?component=does-not-exist');
  await expect(page.locator('#doc-title')).toHaveText('Компонент не найден');
  await expect(page.locator('main')).toContainText('does-not-exist');
  await expect(page.locator('main lab-button')).toHaveCount(0);
  await page.getByRole('link', { name: 'Открыть каталог компонентов' }).click();
  await expect(page.locator('#doc-title')).toHaveText('Каталог компонентов');
});

test('catalog fits a narrow viewport and every public family is reachable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/components.html');
  await expect(page.locator('#doc-title')).toBeVisible();
  await expect(page.locator('.catalog-item')).toHaveCount(
    catalog.families.filter((family) => family.kind !== 'internal').length,
  );
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
  await page.screenshot({ path: test.info().outputPath('catalog-mobile.png') });
  await page
    .locator('.catalog-grid')
    .getByRole('link', { name: /^Chip / })
    .click();
  await expect(page.locator('#doc-title')).toHaveText('Chip');
});
