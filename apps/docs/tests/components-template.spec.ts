import { expect, test } from '@playwright/test';

/**
 * Component-doc TEMPLATE smoke — proves the reusable docs scaffold renders all
 * six sections from a single `ComponentDoc` config. Demoed on `lab-proof` (a
 * component-agnostic check), pinned via `?component=proof` so it does not depend
 * on which component is the registry default.
 *
 * The template is closed for modification; these checks guard the seam:
 *   1. Page renders from config — header (honest "Proof" status), all sections.
 *   2. States matrix is LIVE — it builds real <lab-proof> elements in every cell.
 *   3. Live example is interactive — a control flips a real attribute.
 *   4. Theme switch re-skins the documented element with zero element edits.
 *   5. Navigation is honest — the planned (Input) entry is not a clickable link.
 *   6. Unknown ?component= falls back to the first documented component (Button).
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
  await expect(page.getByRole('heading', { name: 'States matrix' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Anatomy' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Meaning & usage' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Live example' })).toBeVisible();
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

test('navigation is honest: the planned component is not a clickable link', async ({ page }) => {
  await page.goto('/components.html?component=proof');

  // Real components are links; the planned (Date Picker) one is a disabled marker.
  await expect(page.getByRole('link', { name: 'Proof' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Button' })).toBeVisible();
  // Input is now a real, documented component — it must be a clickable link, not a
  // planned marker (its doc shipped in the forms batch).
  await expect(page.getByRole('link', { name: 'Input', exact: true })).toBeVisible();
  // Slider and NumberInput shipped in the numeric batch — both must be clickable links
  // now (Slider replaced the old planned marker), not planned markers.
  await expect(page.getByRole('link', { name: 'Slider', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Number Input', exact: true })).toBeVisible();
  // Combobox shipped in this batch (it replaced the old planned marker) — a clickable
  // link now; Date Picker is the new planned marker.
  await expect(page.getByRole('link', { name: 'Combobox', exact: true })).toBeVisible();
  await expect(page.locator('.nav-planned')).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByRole('link', { name: /planned/i })).toHaveCount(0);
});

test('unknown ?component= falls back to the first documented component', async ({ page }) => {
  await page.goto('/components.html?component=does-not-exist');
  // No crash, no blank shell — the first documented component (Button) renders.
  await expect(page.locator('#doc-title')).toContainText('lab-button');
});
