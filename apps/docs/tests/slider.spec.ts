import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/slider.html');
});
for (const renderer of ['lit', 'react']) {
  test(`${renderer}: native value semantics and keyboard bounds`, async ({ page }) => {
    const host = page.getByTestId(`${renderer}-single`);
    const input = host.getByRole('slider', { name: 'Volume' });
    await expect(input).toHaveValue('40');
    await input.focus();
    await page.keyboard.press('ArrowRight');
    await expect(input).toHaveValue('41');
    await page.keyboard.press('Home');
    await expect(input).toHaveValue('0');
    await page.keyboard.press('End');
    await expect(input).toHaveValue('100');
    await expect(host.locator('.lab-slider-value-text')).toHaveText('100');
    const description = await input.getAttribute('aria-describedby');
    expect(description).toContain(await host.locator('.lab-slider-helper').getAttribute('id'));
  });
  test(`${renderer}: stable range thumbs cannot cross`, async ({ page }) => {
    const inputs = page.getByTestId(`${renderer}-range`).getByRole('slider');
    await expect(inputs).toHaveCount(2);
    await inputs.nth(0).focus();
    await page.keyboard.press('End');
    await expect(inputs.nth(0)).toHaveValue('80');
    await inputs.nth(1).focus();
    await page.keyboard.press('ArrowLeft');
    await expect(inputs.nth(1)).toHaveValue('80');
  });
  test(`${renderer}: disabled and invalid retain honest descriptions`, async ({ page }) => {
    await expect(page.getByTestId(`${renderer}-disabled`).getByRole('slider')).toBeDisabled();
    const invalid = page.getByTestId(`${renderer}-invalid`);
    await expect(invalid.getByRole('slider')).toHaveAttribute('aria-invalid', 'true');
    await expect(invalid.getByRole('alert')).toHaveText('Out of allowed range.');
    expect(await invalid.getByRole('slider').getAttribute('aria-errormessage')).toBe(
      await invalid.getByRole('alert').getAttribute('id'),
    );
  });
  test(`${renderer}: all three authored shapes are present`, async ({ page }) => {
    await expect(page.getByTestId(`${renderer}-single`).locator('.lab-slider-track')).toHaveCSS(
      'height',
      '4px',
    );
    await expect(page.getByTestId(`${renderer}-single`).locator('.lab-slider-thumb')).toHaveCSS(
      'width',
      '12px',
    );
    await expect(page.getByTestId(`${renderer}-circular`).locator('.lab-slider-control')).toHaveCSS(
      'width',
      '96px',
    );
    await expect(page.getByTestId(`${renderer}-large`).locator('.lab-slider-control')).toHaveCSS(
      'height',
      '56px',
    );
  });
}
