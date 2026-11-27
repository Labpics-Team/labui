import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('настройки: проверка ввода, отмена, сохранение, фокус и повторное открытие', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/experience.html');
  const trigger = page.getByRole('button', { name: 'Изменить настройки' });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Настройки пространства' });
  await expect(dialog).toBeVisible();
  const name = dialog.getByRole('textbox', { name: 'Название пространства' });
  await name.fill('   ');
  await dialog.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(name).toBeFocused();
  await expect(name).toHaveAttribute('aria-invalid', 'true');
  await expect(dialog.getByText('Введите название пространства')).toBeVisible();
  await name.fill('Лаборатория ✨');
  await dialog.getByRole('button', { name: 'Отмена' }).click();
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(name).toHaveValue('Labpics');
  await name.fill('Лаборатория ✨');
  await dialog.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(page.getByRole('status')).toHaveText('Настройки сохранены');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Лаборатория ✨' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('мобильная панель: тема, положение, Escape и доступность', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/experience.html');
  const dark = page.getByRole('switch', { name: 'Тёмная тема' });
  await expect(dark).toBeEnabled();
  await dark.focus();
  await dark.press('Space');
  await expect(dark).toBeChecked();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Изменить настройки' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const handle = dialog.getByRole('button', { name: 'Изменить высоту панели' });
  await handle.press('Home');
  await expect(page.locator('.lab-sheet-positioner')).toHaveAttribute('data-position', 'full');
  await expect.poll(async () => (await dialog.boundingBox())?.y).toBeCloseTo(68, 0);
  const axe = await new AxeBuilder({ page }).analyze();
  expect(
    axe.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) })),
  ).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: 'Изменить настройки' })).toBeFocused();
});

test('reduced motion сохраняет конечное положение и быстрый обратный ход', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/experience.html');
  const trigger = page.getByRole('button', { name: 'Изменить настройки' });
  await trigger.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Изменить высоту панели' }).press('ArrowUp');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await trigger.click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('textbox', { name: 'Название пространства' })).toHaveValue(
    'Labpics',
  );
});

test('Snackbar отменяет последнее сохранение и сохраняет отмену после reload', async ({ page }) => {
  await page.goto('/experience.html');
  await page.getByRole('button', { name: 'Изменить настройки' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: 'Название пространства' }).fill('Новая лаборатория');
  await dialog.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Новая лаборатория' })).toBeVisible();
  await page.getByRole('button', { name: 'Отменить', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Labpics', exact: true })).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('Изменения отменены');
  await expect(page.getByRole('button', { name: 'Изменить настройки' })).toBeFocused();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Labpics', exact: true })).toBeVisible();
});

for (const width of [320, 390]) {
  test(`масштаб 200% при ${width}px сохраняет подписи и весь путь сохранения`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/experience.html');
    await page.evaluate(async () => {
      document.documentElement.style.fontSize = '32px';
      await document.fonts.ready;
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    const trigger = page.getByRole('button', { name: 'Изменить настройки' });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Настройки пространства' });
    await dialog.getByRole('button', { name: 'Изменить высоту панели' }).press('Home');
    const name = dialog.getByRole('textbox', { name: 'Название пространства' });
    await name.scrollIntoViewIfNeeded();
    for (const label of await dialog.locator('.lab-field-label').all()) {
      expect(
        await label.evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
      ).toBe(true);
      expect(await label.evaluate((element) => getComputedStyle(element).textOverflow)).not.toBe(
        'ellipsis',
      );
    }
    const heading = dialog.getByRole('heading');
    expect(
      await heading.evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
    ).toBe(true);
    await name.fill('Новая лаборатория');
    const notifications = dialog.getByRole('switch', { name: 'Уведомления команды' });
    await notifications.focus();
    await notifications.press('Space');
    await expect(notifications).not.toBeChecked();
    await dialog.getByRole('button', { name: 'Сохранить', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Новая лаборатория' })).toBeVisible();
    await expect(page.getByText('Выключены', { exact: true })).toBeVisible();
  });
}

test('асинхронная запись сохраняет ширину, исключает повтор и удерживает панель до результата', async ({
  page,
}) => {
  await page.goto('/experience.html');
  await page.getByRole('button', { name: 'Изменить настройки' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: 'Название пространства' }).fill('После записи');
  const save = dialog.getByRole('button', { name: 'Сохранить', exact: true });
  const before = await save.boundingBox();
  await page.evaluate(() => {
    const completion = Object.getOwnPropertyDescriptor(IDBTransaction.prototype, 'oncomplete');
    if (!completion?.set) throw new Error('Missing IndexedDB completion event');
    Object.defineProperty(IDBTransaction.prototype, 'oncomplete', {
      ...completion,
      set(callback: ((event: Event) => void) | null) {
        if (this.mode !== 'readwrite') return completion.set?.call(this, callback);
        completion.set?.call(this, (event: Event) => {
          Reflect.set(window, 'releaseWorkspaceCommit', () => {
            Object.defineProperty(IDBTransaction.prototype, 'oncomplete', completion);
            callback?.call(this, event);
          });
        });
      },
    });
  });
  await save.click();
  await expect(save).toHaveAttribute('aria-busy', 'true');
  expect((await save.boundingBox())?.width).toBeCloseTo(before?.width ?? 0, 1);
  await expect(dialog.getByRole('textbox', { name: 'Название пространства' })).toHaveAttribute(
    'readonly',
    '',
  );
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await dialog.locator('form').evaluate((form: HTMLFormElement) => form.requestSubmit());
  await expect
    .poll(() => page.evaluate(() => typeof Reflect.get(window, 'releaseWorkspaceCommit')))
    .toBe('function');
  await page.evaluate(() => Reflect.get(window, 'releaseWorkspaceCommit')());
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('heading', { name: 'После записи' })).toBeVisible();
  await page.getByRole('button', { name: 'Отменить', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Labpics', exact: true })).toBeVisible();
});

test('ошибка записи оставляет ввод и действие; повтор сохраняет все поля', async ({
  page,
  context,
}) => {
  await page.goto('/experience.html');
  await page.getByRole('button', { name: 'Изменить настройки' }).click();
  const dialog = page.getByRole('dialog');
  const name = dialog.getByRole('textbox', { name: 'Название пространства' });
  await name.fill('Сохранённая студия');
  await dialog
    .getByRole('textbox', { name: 'Описание', exact: true })
    .fill('Заметки о работе команды');
  await dialog.getByRole('textbox', { name: 'Почта для уведомлений' }).fill('team@example.com');
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = () => {
      IDBObjectStore.prototype.put = put;
      throw new DOMException('Injected browser quota failure', 'QuotaExceededError');
    };
  });
  const save = dialog.getByRole('button', { name: 'Сохранить', exact: true });
  await save.click();
  await expect(dialog.getByRole('alert')).toHaveText(
    'Не удалось сохранить изменения. Попробуйте ещё раз.',
  );
  await expect(save).toBeFocused();
  await expect(save).toBeEnabled();
  await expect(name).toHaveValue('Сохранённая студия');
  const other = await context.newPage();
  await other.goto('/experience.html');
  await expect(other.getByRole('heading', { name: 'Labpics', exact: true })).toBeVisible();
  await other.close();
  await save.click();
  await expect(dialog).toBeHidden();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Сохранённая студия' })).toBeVisible();
  await expect(page.getByText('Заметки о работе команды', { exact: true })).toBeVisible();
  await expect(page.getByText('team@example.com', { exact: true })).toBeVisible();
});

test('отмена не затирает более новое сохранение из другой вкладки', async ({ page, context }) => {
  await page.goto('/experience.html');
  await page.getByRole('button', { name: 'Изменить настройки' }).click();
  await page.getByRole('textbox', { name: 'Название пространства' }).fill('Первая запись');
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  // Hold the actual action, which pauses its countdown, while the other tab writes.
  await page.getByRole('button', { name: 'Отменить', exact: true }).focus();
  const other = await context.newPage();
  await other.goto('/experience.html');
  await other.getByRole('button', { name: 'Изменить настройки' }).click();
  await other.getByRole('textbox', { name: 'Название пространства' }).fill('Вторая запись');
  await other.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(other.getByRole('dialog')).toBeHidden();
  await page.getByRole('button', { name: 'Отменить', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Настройки уже изменились');
  await expect(page.getByRole('heading', { name: 'Вторая запись' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Вторая запись' })).toBeVisible();
  await other.close();
});

test('недоступное хранилище допускает повтор чтения', async ({ page }) => {
  await page.addInitScript(() => {
    const open = IDBFactory.prototype.open;
    IDBFactory.prototype.open = () => {
      throw new DOMException('Storage unavailable', 'UnknownError');
    };
    Reflect.set(window, 'restoreWorkspaceStorage', () => {
      IDBFactory.prototype.open = open;
    });
  });
  await page.goto('/experience.html');
  await expect(page.getByRole('alert')).toHaveText('Не удалось прочитать настройки.');
  await expect(page.getByRole('button', { name: 'Изменить настройки' })).toHaveCount(0);
  await page.evaluate(() => Reflect.get(window, 'restoreWorkspaceStorage')());
  await page.getByRole('button', { name: 'Повторить', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Labpics', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Изменить настройки' })).toBeEnabled();
});
