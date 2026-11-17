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
  const dark = page.getByRole('checkbox', { name: 'Тёмная тема' });
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
  await expect(dialog.getByRole('textbox')).toHaveValue('Labpics');
});

test('Snackbar отменяет последнее сохранение и сохраняет отмену после reload', async ({ page }) => {
  await page.goto('/experience.html');
  await page.getByRole('button', { name: 'Изменить настройки' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox').fill('Новая лаборатория');
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
