import { type Page, expect, test } from '@playwright/test';

const pageErrors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  pageErrors.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const time = new Date('2026-11-17T12:00:00Z');
  await page.clock.install({ time });
  await page.clock.pauseAt(time);
  await page.goto('/snackbar.html');
  await expect.poll(() => page.evaluate(() => !!window.snackbarControls?.react)).toBe(true);
});
test.afterEach(async ({ page }) => {
  expect(pageErrors.get(page)).toEqual([]);
});

for (const renderer of ['lit', 'react'] as const) {
  test(`${renderer}: авторская геометрия, сообщение и пять шагов без перехвата фокуса`, async ({
    page,
  }) => {
    const parent = page.getByTestId(`${renderer}-snackbar`);
    const trigger = parent.getByRole('button', {
      name: `Показать ${renderer === 'lit' ? 'Lit' : 'React'}`,
    });
    await trigger.focus();
    await trigger.press('Enter');
    const panel = parent.locator('[data-lab-snackbar]');
    await expect(panel).toBeVisible();
    await expect(trigger).toBeFocused();
    await expect(parent.getByRole('status')).toHaveText('The file.png was deleted');
    await expect(panel.locator('.lab-snackbar-count')).toHaveText('5');
    const geometry = await panel.evaluate((element) => {
      const css = getComputedStyle(element);
      return [
        element.getBoundingClientRect().height,
        css.paddingLeft,
        css.paddingRight,
        css.gap,
        element.querySelector('.lab-snackbar-timer')?.getBoundingClientRect().width,
      ];
    });
    expect(geometry).toEqual([52, '12px', '8px', '24px', 32]);
    for (const seconds of [4, 3, 2, 1]) {
      await page.clock.runFor(1000);
      await expect(panel.locator('.lab-snackbar-count')).toHaveText(String(seconds));
      await expect(parent.getByRole('status')).toHaveText('The file.png was deleted');
      expect(await panel.locator('.lab-snackbar-timer').getAttribute('data-warning')).toBe(
        seconds <= 2 ? '' : null,
      );
    }
    await page.clock.runFor(1000);
    await expect(panel).toBeHidden();
    expect(await page.evaluate((name) => window.snackbarControls[name]?.closed, renderer)).toBe(1);
  });

  test(`${renderer}: hover и focus приостанавливают общий остаток времени`, async ({ page }) => {
    await page.evaluate((name) => window.snackbarControls[name]?.show(), renderer);
    const parent = page.getByTestId(`${renderer}-snackbar`);
    const panel = parent.locator('[data-lab-snackbar]');
    await expect(panel).toBeVisible();
    await page.clock.runFor(2000);
    await panel.hover();
    await page.clock.runFor(10000);
    await expect(panel.locator('.lab-snackbar-count')).toHaveText('3');
    await parent.getByRole('button', { name: 'Undo' }).focus();
    await page.mouse.move(0, 0);
    await page.clock.runFor(10000);
    await expect(panel).toBeVisible();
    await page.locator('#outside').focus();
    await page.clock.runFor(2990);
    await expect(panel).toBeVisible();
    await page.clock.runFor(10);
    await expect(panel).toBeHidden();
  });

  test(`${renderer}: повторный результат, действие и постоянное сообщение`, async ({ page }) => {
    const parent = page.getByTestId(`${renderer}-snackbar`);
    const panel = parent.locator('[data-lab-snackbar]');
    await page.evaluate((name) => window.snackbarControls[name]?.show(), renderer);
    await expect(panel).toBeVisible();
    await page.clock.runFor(4000);
    await page.evaluate((name) => window.snackbarControls[name]?.show(), renderer);
    await expect(panel.locator('.lab-snackbar-count')).toHaveText('5');
    await parent.getByRole('button', { name: 'Undo' }).click();
    await expect(panel).toBeHidden();
    expect(await page.evaluate((name) => window.snackbarControls[name]?.actions, renderer)).toBe(1);
    await page.evaluate(
      (name) => window.snackbarControls[name]?.show(0, 'Сообщение остаётся'),
      renderer,
    );
    await expect(panel).toBeVisible();
    await expect(panel.locator('.lab-snackbar-timer')).toBeHidden();
    await page.clock.runFor(60000);
    await expect(panel).toBeVisible();
    await page.evaluate((name) => window.snackbarControls[name]?.hide(), renderer);
    await expect(panel).toBeHidden();
  });

  test(`${renderer}: действие возвращает фокус, скрытый документ приостанавливает время, dispose снимает deadline`, async ({
    page,
  }) => {
    const parent = page.getByTestId(`${renderer}-snackbar`);
    const panel = parent.locator('[data-lab-snackbar]');
    const outside = page.locator('#outside');
    await outside.focus();
    await page.evaluate((name) => window.snackbarControls[name]?.show(), renderer);
    const action = parent.getByRole('button', { name: 'Undo' });
    await action.focus();
    await action.press('Enter');
    await expect(panel).toBeHidden();
    await expect(outside).toBeFocused();
    await page.evaluate((name) => window.snackbarControls[name]?.show(), renderer);
    await expect(panel).toBeVisible();
    await page.clock.runFor(2000);
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.clock.runFor(30000);
    await expect(panel.locator('.lab-snackbar-count')).toHaveText('3');
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: false });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.clock.runFor(1000);
    await expect(panel.locator('.lab-snackbar-count')).toHaveText('2');
    await page.evaluate((name) => window.snackbarControls[name]?.dispose(), renderer);
    await page.clock.runFor(10000);
    expect(await page.evaluate((name) => window.snackbarControls[name]?.closed, renderer)).toBe(1);
  });
}

test('обе реализации сохраняют длинный текст на узкой ширине', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => {
    for (const control of Object.values(window.snackbarControls))
      control?.show(0, 'Настройки рабочего пространства сохранены. Изменения видны всей команде.');
  });
  for (const renderer of ['lit', 'react']) {
    const panel = page.getByTestId(`${renderer}-snackbar`).locator('[data-lab-snackbar]');
    await expect(panel).toBeVisible();
    expect(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
      true,
    );
    await expect(panel.getByRole('button', { name: 'Undo' })).toBeVisible();
  }
});
