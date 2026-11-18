import { expect, test } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  await page.goto('/loader.html');
});
test('both renderers expose a named unknown progress indicator', async ({ page }) => {
  for (const id of ['lit-l', 'react-l']) {
    const host = page.getByTestId(id);
    const bar = id.startsWith('lit') ? host.getByRole('progressbar') : host;
    await expect(bar).toHaveRole('progressbar');
    await expect(bar).toHaveAccessibleName('Saving changes');
    await expect(bar).not.toHaveAttribute('aria-valuenow', /.*/);
  }
});
test('authored sizes and eight visible spokes agree across renderers', async ({ page }) => {
  for (const [size, diameter] of [
    ['s', 16],
    ['m', 24],
    ['l', 48],
  ] as const) {
    const lit = page.getByTestId(`lit-${size}`).locator('.lab-loader');
    const react = page.getByTestId(`react-${size}`);
    for (const root of [lit, react]) {
      await expect(root).toBeVisible();
      expect(await root.evaluate((el) => Number.parseFloat(getComputedStyle(el).width))).toBe(
        diameter,
      );
      await expect(root.locator('rect')).toHaveCount(8);
    }
  }
});
test('consumer color reaches both drawings', async ({ page }) => {
  for (const id of ['lit-m', 'react-m'])
    await page.getByTestId(id).evaluate((el) => {
      (el as HTMLElement).style.color = 'rgb(4, 5, 6)';
    });
  for (const id of ['lit-m', 'react-m'])
    await expect
      .poll(() =>
        page
          .getByTestId(id)
          .locator('rect')
          .first()
          .evaluate((el) => getComputedStyle(el).fill),
      )
      .toBe('rgb(4, 5, 6)');
});
