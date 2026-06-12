import { expect, test } from '@playwright/test';

/**
 * Tokens smoke — proves the @labpics/ui-tokens contract is wired into the docs
 * and, crucially, that the fluid typography is a real continuous gradient:
 *   - the display step grows with viewport width (no media-query steps);
 *   - the base step is immovable at 16px on every width;
 *   - a fixed spacing token resolves to its expected px.
 */

function fontSizePx(page: import('@playwright/test').Page, testId: string): Promise<number> {
  return page
    .getByTestId(testId)
    .evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize));
}

test('tokens.css contract is loaded (--lab-space-0 defined as the zero token)', async ({
  page,
}) => {
  await page.goto('/');
  const space0 = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--lab-space-0').trim(),
  );
  expect(space0).toBe('0rem');
});

test('a fixed spacing token resolves to its expected px (32px = --lab-space-8)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1000, height: 800 });
  await page.goto('/');
  const width = await page
    .getByTestId('space-probe')
    .evaluate((el) => Number.parseFloat(getComputedStyle(el).width));
  // 2rem on a 16px root = 32px.
  expect(width).toBeCloseTo(32, 1);
});

test('fluid display step interpolates: 400px viewport renders SMALLER than 1400px', async ({
  page,
}) => {
  await page.goto('/');

  await page.setViewportSize({ width: 400, height: 900 });
  const displayNarrow = await fontSizePx(page, 'display-step');

  await page.setViewportSize({ width: 1400, height: 900 });
  const displayWide = await fontSizePx(page, 'display-step');

  // The whole point of the gradient: the display step is meaningfully larger on
  // a wide viewport. A media-query step would also pass >, but the damping
  // magnitude (≈57px → ≈112px) is what we assert.
  expect(displayWide).toBeGreaterThan(displayNarrow + 20);
  expect(displayNarrow).toBeGreaterThan(50); // ~57px floor
  expect(displayNarrow).toBeLessThan(70);
  expect(displayWide).toBeGreaterThan(100); // ~112px ceiling
  expect(displayWide).toBeLessThan(120);
});

test('base step is immovable at 16px across viewport widths', async ({ page }) => {
  await page.goto('/');

  await page.setViewportSize({ width: 400, height: 900 });
  const baseNarrow = await fontSizePx(page, 'base-step');

  await page.setViewportSize({ width: 1400, height: 900 });
  const baseWide = await fontSizePx(page, 'base-step');

  expect(baseNarrow).toBeCloseTo(16, 1);
  expect(baseWide).toBeCloseTo(16, 1);
  expect(baseNarrow).toBeCloseTo(baseWide, 1);
});

test('display step is continuous: an intermediate width sits strictly between the anchors', async ({
  page,
}) => {
  await page.goto('/');

  await page.setViewportSize({ width: 400, height: 900 });
  const narrow = await fontSizePx(page, 'display-step');

  await page.setViewportSize({ width: 880, height: 900 });
  const mid = await fontSizePx(page, 'display-step');

  await page.setViewportSize({ width: 1400, height: 900 });
  const wide = await fontSizePx(page, 'display-step');

  // No discrete jump: the mid-width value lands between the two anchors.
  expect(mid).toBeGreaterThan(narrow);
  expect(mid).toBeLessThan(wide);
});
