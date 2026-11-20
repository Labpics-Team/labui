import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/_fixtures/dialog-family.html');
});
for (const renderer of ['Lit', 'React']) {
  test(`${renderer}: IME Escape preserves the panel; outside input keeps focus`, async ({
    page,
  }) => {
    await page.getByRole('button', { name: `${renderer} popover`, exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toHaveAttribute('aria-modal', 'false');
    const input = page.getByRole('textbox', {
      name: renderer === 'Lit' ? 'Popover draft' : 'React popover draft',
      exact: true,
    });
    await input.focus();
    await input.evaluate(async (el) => {
      el.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Escape',
          isComposing: true,
          keyCode: 229,
          bubbles: true,
          composed: true,
          cancelable: true,
        }),
      );
      await new Promise<void>((done) =>
        requestAnimationFrame(() => requestAnimationFrame(() => done())),
      );
    });
    await expect(dialog).toBeVisible();
    const outside = page.getByRole('textbox', { name: 'Outside input', exact: true });
    await outside.click();
    await expect(dialog).toBeHidden();
    await expect(outside).toBeFocused();
  });
}

test('top-layer Popover uses the viewport when its trigger has a clipped ancestor', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '32px';
    const popover = document.querySelector('#lit-popover') as HTMLElement & { placement: string };
    popover.placement = 'right';
  });
  await page.getByRole('button', { name: 'Lit popover', exact: true }).click();
  const content = page.getByRole('dialog').locator('.lab-dialog-content');
  await expect
    .poll(async () => {
      const bounds = await content.boundingBox();
      return (
        !!bounds &&
        bounds.x >= 16 &&
        bounds.x + bounds.width <= 374 &&
        bounds.height > 150 &&
        bounds.y >= 16 &&
        bounds.y + bounds.height <= 828
      );
    })
    .toBe(true);
});
