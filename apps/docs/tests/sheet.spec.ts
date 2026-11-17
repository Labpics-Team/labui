import type { LabSheet } from '@labpics/ui-core/sheet';
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1000, height: 812 });
  await page.goto('/_fixtures/sheet.html');
});

test('Lit Sheet сохраняет slots, тему, ввод и focus после закрытия', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const trigger = page.getByRole('button', { name: 'Изменить настройки', exact: true });
  const input = page.getByRole('textbox', { name: 'Название пространства' });
  const dialog = page.getByRole('dialog', { name: 'Настройки пространства' });
  await trigger.click();
  await expect(dialog).toBeVisible();
  await input.fill('Лаборатория ✨');
  expect(
    await page
      .locator('#sheet-form')
      .evaluate((el) => el.parentElement === document.querySelector('#sheet')),
  ).toBe(true);
  const colors = await page.locator('lab-sheet').evaluate((host) => {
    const panel = host.shadowRoot?.querySelector('.lab-sheet-content');
    if (!panel) throw new Error('Missing sheet content');
    return { host: getComputedStyle(host).color, panel: getComputedStyle(panel).color };
  });
  expect(colors.panel).toBe(colors.host);
  const content = page.locator('.lab-sheet-content');
  await expect.poll(async () => (await content.boundingBox())?.x).toBe(0);
  await expect.poll(async () => (await content.boundingBox())?.y).toBeCloseTo(390, 0);
  await page.locator('#outside').evaluate((button: HTMLButtonElement) => button.focus());
  expect(await page.locator('#outside').evaluate((el) => el === document.activeElement)).toBe(
    false,
  );
  await input.focus();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(input).toHaveValue('Лаборатория ✨');
  await page.getByRole('button', { name: 'Отмена', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  expect(errors).toEqual([]);
});

test('пять положений, outside close и reconnect не теряют содержимое', async ({ page }) => {
  const trigger = page.getByRole('button', { name: 'Изменить настройки', exact: true });
  await trigger.click();
  const sheet = page.locator('lab-sheet');
  const content = page.locator('.lab-sheet-content');
  for (const [position, top] of [
    ['full', 36],
    ['two-thirds', 272],
    ['half', 390],
    ['one-third', 542],
  ] as const) {
    await sheet.evaluate((host: LabSheet, next) => {
      host.position = next;
    }, position);
    await expect.poll(async () => (await content.boundingBox())?.y).toBeCloseTo(top, 0);
  }
  await page.getByRole('button', { name: 'Изменить высоту панели' }).press('End');
  await expect(sheet).toHaveAttribute('position', 'flex');
  await sheet.evaluate((host) => {
    const parent = host.parentElement;
    if (!parent) throw new Error('Missing sheet parent');
    host.remove();
    parent.append(host);
  });
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Название пространства' })).toHaveValue('Labpics');
  await page.mouse.click(5, 5);
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('немодальная панель остаётся в top layer и не блокирует внешний control', async ({ page }) => {
  await page.locator('lab-sheet').evaluate((host: LabSheet) => {
    host.modal = false;
  });
  await page.getByRole('button', { name: 'Изменить настройки', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate((el) => el.matches(':popover-open'))).toBe(true);
  const outside = page.getByRole('button', { name: 'Внешнее действие' });
  await outside.focus();
  await expect(outside).toBeFocused();
  await page.getByRole('textbox', { name: 'Название пространства' }).focus();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await page.getByRole('button', { name: 'Изменить настройки', exact: true }).click();
  const outsideInput = page.getByRole('textbox', { name: 'Внешний ввод' });
  await outsideInput.click();
  await expect(dialog).toBeHidden();
  await expect(outsideInput).toBeFocused();
});

test('повторное открытие во время native close продолжает видимую панель', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const trigger = page.getByRole('button', { name: 'Изменить настройки', exact: true });
  const dialog = page.getByRole('dialog');
  await trigger.click();
  await expect
    .poll(async () => (await page.locator('.lab-sheet-content').boundingBox())?.y)
    .toBeCloseTo(390, 0);
  await dialog.evaluate((element: HTMLDialogElement) => element.close());
  await expect(page.locator('lab-sheet')).not.toHaveAttribute('open', '');
  await trigger.click();
  await expect(dialog).toBeVisible();
  await expect
    .poll(async () => (await page.locator('.lab-sheet-content').boundingBox())?.y)
    .toBeCloseTo(390, 0);
  await expect(page.getByRole('textbox', { name: 'Название пространства' })).toHaveValue('Labpics');
});

test('native close освобождает scroll lock и не открывает панель повторно', async ({ page }) => {
  const trigger = page.getByRole('button', { name: 'Изменить настройки', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.evaluate((element: HTMLDialogElement) => element.close());
  await expect(dialog).toBeHidden();
  await expect(page.locator('lab-sheet')).not.toHaveAttribute('open', '');
  await expect(trigger).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe('');
  const outside = page.getByRole('button', { name: 'Внешнее действие' });
  await outside.focus();
  await page.locator('lab-sheet').evaluate((host: LabSheet) => host.requestUpdate());
  await expect(outside).toBeFocused();
});

test('закрытие родителя завершает вложенную модальность и освобождает страницу', async ({
  page,
}) => {
  await page.locator('#sheet-form').evaluate((content) => {
    const nested = document.createElement('lab-sheet');
    nested.id = 'nested-sheet';
    nested.heading = 'Вложенная панель';
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.slot = 'trigger';
    trigger.textContent = 'Открыть вложенную панель';
    nested.append(trigger);
    content.append(nested);
  });
  const trigger = page.getByRole('button', { name: 'Изменить настройки', exact: true });
  const nested = page.locator('#nested-sheet');
  for (const nativeClose of [false, true]) {
    await trigger.click();
    await page.getByRole('button', { name: 'Открыть вложенную панель', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Вложенная панель', exact: true })).toBeVisible();
    await page.locator('#sheet').evaluate((host: LabSheet, nativeClose) => {
      if (nativeClose) host.shadowRoot?.querySelector('dialog')?.close();
      else host.open = false;
    }, nativeClose);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(nested).not.toHaveAttribute('open', '');
    expect(await nested.evaluate((host) => host.shadowRoot?.querySelector('dialog')?.open)).toBe(
      false,
    );
    expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe('');
    await expect(trigger).toBeFocused();
    const outside = page.getByRole('textbox', { name: 'Внешний ввод' });
    await outside.focus();
    await expect(outside).toBeFocused();
  }
});
