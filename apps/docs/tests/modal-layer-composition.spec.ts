import { expect, test } from '@playwright/test';
import { modalFocus } from './helpers/modal-focus.js';

for (const kind of ['popup', 'dialog', 'alert'] as const) {
  test(`Sheet и native React ${kind}: внешний portal делит dismiss и focus runtime`, async ({
    page,
  }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize({ width: 375, height: 812 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/_fixtures/modal-layer-composition.html');
    await expect(page.locator('html')).toHaveAttribute('data-modal-layer-ready', 'true');
    const sheet = page.getByTestId('sheet');
    const panel = page.locator('[data-portal-for="sheet"]');
    await sheet.locator('.trigger').click();
    await expect.poll(() => panel.evaluate(modalFocus)).toMatchObject({ inside: true });
    await expect(panel.getByRole('dialog')).toBeVisible();
    const trigger = sheet.locator(`#react-${kind} button`);
    await trigger.click();
    const field = page.locator(`#${kind}-field`);
    await expect(field).toBeVisible();
    if (kind !== 'popup') {
      // Штатный initialFocus завершается до отдельного пользовательского ввода.
      const initialFocus =
        kind === 'alert'
          ? page.locator('.lab-dialog-content[role="alertdialog"] .lab-dialog-close')
          : field;
      await expect(initialFocus).toBeFocused();
    }
    await field.focus();
    await expect(field).toBeFocused();
    await expect(page.getByRole('textbox', { name: kind, exact: true })).toBeVisible();
    expect(await field.evaluate((element) => element.closest('lab-sheet'))).toBeNull();
    await field.fill('Несохранённые параметры');
    await page.keyboard.press('Tab');
    await expect(page.locator(`#${kind}-second`)).toBeFocused();
    await expect(sheet).toHaveAttribute('open', '');
    await page.keyboard.press('Escape');
    await expect(field).toBeHidden();
    await expect(sheet).toHaveAttribute('open', '');
    await expect(trigger).toBeFocused();
    await expect(panel.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(panel.locator('.content')).toBeHidden();
    await expect(sheet.locator('.trigger')).toBeFocused();
    await expect(page.getByRole('button', { name: 'Действие на странице' })).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => getComputedStyle(document.body).overflow))
      .not.toBe('hidden');
    const events = await page.evaluate(() => window.modalLayerComposition.events);
    expect(events).toEqual([
      { kind, open: true },
      { kind, open: false },
    ]);
    expect(errors).toEqual([]);
    await testInfo.attach('layer-ownership.json', {
      body: JSON.stringify({ kind, events, errors }, null, 2),
      contentType: 'application/json',
    });
  });

  test(`Закрытие Sheet завершает настоящий native React ${kind} descendant`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/_fixtures/modal-layer-composition.html');
    await expect(page.locator('html')).toHaveAttribute('data-modal-layer-ready', 'true');
    const sheet = page.getByTestId('sheet');
    const panel = page.locator('[data-portal-for="sheet"]');
    await sheet.locator('.trigger').click();
    await expect.poll(() => panel.evaluate(modalFocus)).toMatchObject({ inside: true });
    await sheet.locator(`#react-${kind} button`).click();
    const field = page.locator(`#${kind}-field`);
    await expect(field).toBeVisible();
    if (kind !== 'popup') {
      const initialFocus =
        kind === 'alert'
          ? page.locator('.lab-dialog-content[role="alertdialog"] .lab-dialog-close')
          : field;
      await expect(initialFocus).toBeFocused();
    }
    await field.focus();
    await expect(field).toBeFocused();
    await expect(page.getByRole('textbox', { name: kind, exact: true })).toBeVisible();
    // Публичное controlled закрытие parent должно завершить его portal descendant.
    await sheet.evaluate((element) => {
      (element as HTMLElement & { open: boolean }).open = false;
    });
    await expect(field).toBeHidden();
    await expect(panel.locator('.content')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Действие на странице' })).toBeVisible();
    expect(await page.evaluate(() => window.modalLayerComposition.events)).toEqual([
      { kind, open: true },
      { kind, open: false },
    ]);
  });
}
