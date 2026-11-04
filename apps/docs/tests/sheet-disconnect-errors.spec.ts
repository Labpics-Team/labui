import { expect, test } from '@playwright/test';

test('отказ Motion dispose не удерживает портал, форму или модальность после disconnect', async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/_fixtures/sheet.html');
  await expect(page.locator('html')).toHaveAttribute('data-sheet-fixture-ready', 'true');
  const host = page.getByTestId('sheet');
  const portal = page.locator('[data-portal-for="sheet"]');
  await host.locator('.trigger').click();
  await expect(portal.locator('.content')).toBeVisible();
  await expect
    .poll(() => portal.locator('.content').evaluate((panel) => panel.getBoundingClientRect().top))
    .toBe(390);
  await portal.locator('#name').fill('Сохранённая форма');

  const result = await portal.evaluate(async (portal) => {
    const element = document.getElementById('sheet');
    if (!element) throw new Error('Нет Sheet');
    const frame = portal.shadowRoot?.querySelector<HTMLElement>('.sheet-frame');
    if (!frame) throw new Error('Нет рамки движения');
    const style = frame.style;
    const removeProperty = CSSStyleDeclaration.prototype.removeProperty;
    const setProperty = CSSStyleDeclaration.prototype.setProperty;
    let writes = 0;
    let cleanupAttempts = 0;
    CSSStyleDeclaration.prototype.setProperty = function (property, value, priority) {
      if (this === style && property === '--_sheet-top') writes++;
      setProperty.call(this, property, value, priority);
    };
    CSSStyleDeclaration.prototype.removeProperty = function (property) {
      if (this === style && property === '--_sheet-top') {
        cleanupAttempts++;
        throw new Error('Sheet: отказ очистки CSS при disconnect');
      }
      return removeProperty.call(this, property);
    };
    try {
      element.remove();
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      const restored = element.querySelector<HTMLInputElement>('#name');
      const snapshot = {
        cleanupAttempts,
        writes,
        motionOwned: frame.hasAttribute('data-lab-motion'),
        restoredValue: restored?.value,
        locked: getComputedStyle(document.body).overflow === 'hidden',
        portalConnected: portal.isConnected,
      };
      document.getElementById('local-context')?.append(element);
      return snapshot;
    } finally {
      CSSStyleDeclaration.prototype.removeProperty = removeProperty;
      CSSStyleDeclaration.prototype.setProperty = setProperty;
    }
  });

  console.info(JSON.stringify({ phase: 'disconnect при отказе очистки', ...result }));
  expect(result).toEqual({
    cleanupAttempts: 1,
    writes: 0,
    motionOwned: false,
    restoredValue: 'Сохранённая форма',
    locked: false,
    portalConnected: false,
  });
  // Custom Elements сообщает exception lifecycle callback через pageerror;
  // сохранённая ошибка не мешает обязательной очистке остальных владельцев.
  await expect.poll(() => pageErrors).toEqual(['Sheet: отказ очистки CSS при disconnect']);
  await expect(portal).toHaveCount(1);
  await expect(portal.locator('.content')).toBeVisible();
  await expect(portal.locator('#name')).toHaveValue('Сохранённая форма');
  await expect
    .poll(() => portal.locator('.content').evaluate((panel) => panel.getBoundingClientRect().top))
    .toBe(390);
  await expect
    .poll(() =>
      portal.evaluate((element) => element.shadowRoot?.activeElement?.closest('.content') != null),
    )
    .toBe(true);
  await page.keyboard.press('Escape');
  await expect(portal.locator('.content')).toBeHidden();
  await expect(host.locator('.trigger')).toBeFocused();
  await page.locator('#background').click();
  await expect(page.locator('#background-count')).toHaveText('1');
});
