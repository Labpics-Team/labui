import { type Page, expect, test } from '@playwright/test';

async function openSheet(page: Page) {
  const sheet = page.getByTestId('sheet');
  await sheet.locator('.trigger').click();
  await expect(sheet).toHaveAttribute('open', '');
  await expect(sheet.locator('.handle')).toBeFocused();
  return sheet;
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

for (const kind of ['dialog', 'alert'] as const) {
  test(`Публичный ${kind} внутри Sheet принимает полезный клик без consumer hook`, async ({
    page,
  }) => {
    await page.goto('/_fixtures/modal-public-composition.html');
    const sheet = await openSheet(page);
    await sheet.getByRole('button', { name: `Открыть ${kind}`, exact: true }).click();
    const initial =
      kind === 'alert'
        ? page.locator('.lab-dialog-content[role="alertdialog"] .lab-dialog-close')
        : page.locator('#dialog-field');
    await expect(initial).toBeFocused();
    await page.locator(`#${kind}-apply`).click();
    await expect(page.locator(`#${kind}-result`)).toHaveText('Применено 1');
    await page.locator(`#${kind}-apply`).click();
    await expect(page.locator(`#${kind}-result`)).toHaveText('Применено 2');
    await page.keyboard.press('Escape');
    await expect(page.locator(`#${kind}-field`)).toBeHidden();
    await expect(sheet).toHaveAttribute('open', '');
    await expect(sheet.getByRole('button', { name: `Открыть ${kind}`, exact: true })).toBeFocused();
    await page.locator('#sheet-apply').click();
    expect(await page.evaluate(() => window.modalPublicComposition.actions)).toEqual([
      kind,
      kind,
      'sheet',
    ]);
  });
}

for (const scenario of ['sheet', 'shadow', 'triple'] as const) {
  test(`${scenario}: верхняя поверхность скрывает фон и возвращает оставшийся modal`, async ({
    page,
  }, testInfo) => {
    const errors: string[] = [];
    const consoleErrors: string[] = [];
    const snapshots: Array<{ phase: string; tree: string }> = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    const snapshot = async (phase: string) => {
      snapshots.push({ phase, tree: await page.locator('body').ariaSnapshot() });
      if (scenario === 'triple' && (phase === 'sheet-open' || phase === 'alert-open')) {
        await testInfo.attach(`${phase}.png`, {
          body: await page.screenshot(),
          contentType: 'image/png',
        });
      }
    };
    const background = page.getByRole('button', { name: 'Действие страницы', exact: true });
    const sheetField = page.getByRole('textbox', { name: 'Поле Sheet', exact: true });
    const outerField = page.getByRole('textbox', { name: 'Поле родителя', exact: true });
    await page.goto(`/_fixtures/modal-public-composition.html?scenario=${scenario}`);
    await expect(background).toBeVisible();
    if (scenario === 'triple') {
      await page.getByRole('button', { name: 'Открыть родителя', exact: true }).click();
      await expect(page.locator('#outer-field')).toBeFocused();
      await expect(background).toHaveCount(0);
      await page.locator('#outer-apply').click();
      await snapshot('outer-open');
    }
    const sheet = await openSheet(page);
    await expect(background).toHaveCount(0);
    await expect(outerField).toHaveCount(0);
    await expect(sheetField).toBeVisible();
    if (scenario === 'shadow') {
      await expect(page.getByRole('button', { name: /Фон оболочки/ })).toHaveCount(0);
    }
    await snapshot('sheet-open');
    await page.locator('#sheet-apply').click();

    for (const kind of ['dialog', 'alert', 'dialog'] as const) {
      await sheet.getByRole('button', { name: `Открыть ${kind}`, exact: true }).click();
      const initial =
        kind === 'alert'
          ? page.locator('.lab-dialog-content[role="alertdialog"] .lab-dialog-close')
          : page.locator('#dialog-field');
      await expect(initial).toBeFocused();
      await expect(background).toHaveCount(0);
      await expect(outerField).toHaveCount(0);
      await expect(sheetField).toHaveCount(0);
      await expect(page.getByRole('textbox', { name: `Поле ${kind}`, exact: true })).toBeVisible();
      await page.locator(`#${kind}-apply`).click();
      await snapshot(`${kind}-open`);
      await page.keyboard.press('Escape');
      await expect(page.locator(`#${kind}-field`)).toBeHidden();
      await expect(
        sheet.getByRole('button', { name: `Открыть ${kind}`, exact: true }),
      ).toBeFocused();
      await expect(background).toHaveCount(0);
      await expect(outerField).toHaveCount(0);
      await expect(sheetField).toBeVisible();
      await page.locator('#sheet-apply').click();
      await snapshot(`${kind}-closed`);
    }
    await page.keyboard.press('Escape');
    await expect(sheet).not.toHaveAttribute('open', '');
    await expect(sheet.locator('.trigger')).toBeFocused();
    if (scenario === 'triple') {
      await expect(background).toHaveCount(0);
      await expect(outerField).toBeVisible();
      await page.locator('#outer-apply').click();
      await page.keyboard.press('Escape');
      await expect(page.locator('#outer-field')).toBeHidden();
    }
    await expect(background).toBeVisible();
    if (scenario === 'shadow') {
      await expect(page.getByRole('button', { name: /Фон оболочки/ })).toHaveCount(2);
    }
    await expect(page.locator('.lab-dialog-portal-plane:popover-open')).toHaveCount(0);
    await expect
      .poll(() => page.evaluate(() => getComputedStyle(document.body).overflow))
      .not.toBe('hidden');
    await snapshot('all-closed');
    expect(errors).toEqual([]);
    expect(consoleErrors).toEqual([]);
    await testInfo.attach('public-modal-accessibility.json', {
      body: JSON.stringify({ scenario, snapshots, errors, consoleErrors }, null, 2),
      contentType: 'application/json',
    });
  });
}

test('Удаление Sheet из Alert portal освобождает ребёнка и сохраняет React parent', async ({
  page,
}) => {
  await page.goto('/_fixtures/modal-public-composition.html?scenario=triple');
  await page.getByRole('button', { name: 'Открыть родителя', exact: true }).click();
  await expect(page.locator('#outer-field')).toBeFocused();
  const sheet = await openSheet(page);
  await sheet.getByRole('button', { name: 'Открыть alert', exact: true }).click();
  await expect(
    page.locator('.lab-dialog-content[role="alertdialog"] .lab-dialog-close'),
  ).toBeFocused();
  await page.locator('#alert-remove').click();
  await expect(sheet).toHaveCount(0);
  await expect(page.locator('#alert-field')).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Поле родителя', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Действие страницы', exact: true })).toHaveCount(0);
  await page.locator('#outer-apply').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#outer-field')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Действие страницы', exact: true })).toBeVisible();
  await expect(page.locator('.lab-dialog-portal-plane:popover-open')).toHaveCount(0);
});

test('Одиночный публичный React Dialog скрывает фон и возвращает действие страницы', async ({
  page,
}) => {
  await page.goto('/_fixtures/modal-public-composition.html?scenario=react');
  await page.getByRole('button', { name: 'Открыть родителя', exact: true }).click();
  await expect(page.locator('#outer-field')).toBeFocused();
  await expect(page.getByRole('button', { name: 'Действие страницы', exact: true })).toHaveCount(0);
  await page.locator('#outer-apply').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#outer-field')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Действие страницы', exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.modalPublicComposition.actions)).toEqual(['outer']);
});

for (const kind of ['dialog', 'alert'] as const) {
  test(`Controlled закрытие Sheet в shadow root завершает его React ${kind} portal`, async ({
    page,
  }) => {
    await page.goto('/_fixtures/modal-public-composition.html?scenario=shadow');
    const sheet = await openSheet(page);
    await sheet.getByRole('button', { name: `Открыть ${kind}`, exact: true }).click();
    const initial =
      kind === 'alert'
        ? page.locator('.lab-dialog-content[role="alertdialog"] .lab-dialog-close')
        : page.locator('#dialog-field');
    await expect(initial).toBeFocused();
    await page.locator(`#${kind}-apply`).click();
    await sheet.evaluate((element) => {
      (element as HTMLElement & { open: boolean }).open = false;
    });
    await expect(sheet).not.toHaveAttribute('open', '');
    await expect(page.locator(`#${kind}-field`)).toBeHidden();
    await expect(sheet.locator('.trigger')).toBeFocused();
    await expect(
      page.getByRole('button', { name: 'Действие страницы', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /Фон оболочки/ })).toHaveCount(2);
    await expect(page.locator('.lab-dialog-portal-plane:popover-open')).toHaveCount(0);
    expect(await page.evaluate(() => window.modalPublicComposition.events)).toEqual([
      { kind, open: true },
      { kind, open: false },
    ]);
  });
}
