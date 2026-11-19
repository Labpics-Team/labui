import { expect, test } from '@playwright/test';

for (const [renderer, route] of [
  ['React', '/experience.html'],
  ['Lit', '/_fixtures/sheet.html'],
] as const) {
  test(`${renderer} Flex следует живому содержимому и повторному открытию без resize loop`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize({ width: 1000, height: 1000 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(route);
    const trigger = page.getByRole('button', { name: 'Изменить настройки', exact: true });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Настройки пространства', exact: true });
    const content = page.locator('.lab-sheet-content').first();
    const body = page.locator('.lab-sheet-body').first();
    const heading = page.locator('.lab-sheet-panel-heading').first();
    await dialog.getByRole('button', { name: 'Изменить высоту панели' }).press('End');
    const height = async () => (await content.boundingBox())?.height ?? 0;
    await expect.poll(height).toBeGreaterThan(150);
    const original = await height();

    // DOM changes after the renderer commit must still resize Flex, including
    // heading-only changes while the scroll area's own height is constrained.
    for (const [target, growth] of [
      [body, 64],
      [heading, 32],
    ] as const) {
      const before = await height();
      await target.evaluate((element, pixels) => {
        const extra = element.ownerDocument.createElement('div');
        extra.setAttribute('data-resize-content', '');
        extra.style.height = `${pixels}px`;
        extra.style.flex = 'none';
        element.append(extra);
      }, growth);
      await expect.poll(height).toBeGreaterThanOrEqual(before + growth - 1);
    }
    await page.locator('[data-resize-content]').evaluateAll((elements) => {
      for (const element of elements) element.remove();
    });
    await expect.poll(height).toBeCloseTo(original, 0);

    await body.evaluate((element) => {
      const extra = element.ownerDocument.createElement('div');
      extra.setAttribute('data-resize-content', '');
      extra.style.height = '1200px';
      element.append(extra);
    });
    await expect.poll(height).toBe(1000);
    const scrollArea = page.locator('.lab-sheet-panel-body').first();
    expect(
      await scrollArea.evaluate((element) => {
        element.scrollTop = element.scrollHeight;
        return element.scrollTop;
      }),
    ).toBeGreaterThan(0);
    await page.locator('[data-resize-content]').evaluate((element) => element.remove());
    await expect.poll(height).toBeCloseTo(original, 0);

    await page.setViewportSize({ width: 1000, height: 800 });
    await expect.poll(async () => (await content.boundingBox())?.y).toBeCloseTo(800 - original, 0);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    await trigger.click();
    await expect(dialog).toBeVisible();
    await expect.poll(height).toBeCloseTo(original, 0);
    expect(errors).toEqual([]);
  });
}
