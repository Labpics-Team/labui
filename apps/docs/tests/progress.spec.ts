import { expect, test } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  await page.goto('/progress.html');
});
for (const renderer of ['lit', 'react']) {
  test(`${renderer}: visible task names, measured range and completion`, async ({ page }) => {
    for (const [name, label, value, status] of [
      ['determinate', 'Uploading', '60', 'loading'],
      ['complete', 'Done', '100', 'complete'],
      ['ranged', 'Ranged', '30', 'loading'],
    ] as const) {
      const bar = page.getByTestId(`${renderer}-${name}`).getByRole('progressbar');
      await expect(bar).toHaveAccessibleName(label);
      await expect(bar).toHaveAttribute('aria-valuenow', value);
      await expect(bar).toHaveAttribute('data-state', status);
    }
    const ranged = page.getByTestId(`${renderer}-ranged`);
    await expect(ranged.getByRole('progressbar')).toHaveAttribute('aria-valuemin', '10');
    await expect(ranged.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '50');
    await expect(ranged.locator('.lab-progress-value-text')).toHaveText('50%');
  });
  test(`${renderer}: unknown omits numeric value and percent`, async ({ page }) => {
    const bar = page.getByTestId(`${renderer}-indeterminate`).getByRole('progressbar');
    await expect(bar).toHaveAccessibleName('Working');
    await expect(bar).not.toHaveAttribute('aria-valuenow', /.*/);
    await expect(bar).not.toHaveAttribute('aria-valuetext', /.*/);
    await expect(bar).toHaveAttribute('data-state', 'indeterminate');
  });
}
test('both renderers inherit the same authored track and its theme', async ({ page }) => {
  const tracks = ['lit', 'react'].map((r) =>
    page.getByTestId(`${r}-determinate`).getByRole('progressbar'),
  );
  const color = () =>
    Promise.all(tracks.map((t) => t.evaluate((el) => getComputedStyle(el).backgroundColor)));
  const before = await color();
  expect(before[0]).toBe(before[1]);
  await page.evaluate(() =>
    document.documentElement.style.setProperty('--lab-label-brand-quaternary', 'rgba(1,2,3,.32)'),
  );
  for (const track of tracks)
    await expect
      .poll(() => track.evaluate((el) => getComputedStyle(el).backgroundColor))
      .toBe('rgba(1, 2, 3, 0.32)');
});
