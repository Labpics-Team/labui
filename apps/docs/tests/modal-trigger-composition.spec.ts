import { type ElementHandle, type Page, expect, test } from '@playwright/test';

type Consumer =
  | 'core'
  | 'native'
  | 'vue'
  | 'solid'
  | 'react'
  | 'react-sheet'
  | 'react-alert'
  | 'behavior'
  | 'behavior-null';
const refusal = /interactive children|неинтерактивную подпись/;
const state = (page: Page) => page.evaluate(() => window.modalTriggerComposition.state());
const opener = (page: Page) =>
  page
    .locator('#app')
    .getByRole('button', { name: /Настроить цвет/, includeHidden: true })
    .first();

async function retainFocusedOpener(page: Page): Promise<ElementHandle<HTMLElement | SVGElement>> {
  const target = await opener(page).elementHandle();
  if (!target) throw new Error('Не найден исходный opener');
  await target.focus();
  // Проверяем тот же измеритель на положительном случае до отзыва.
  expect(await target.evaluate((node) => node.matches(':focus'))).toBe(true);
  return target;
}

async function expectRevokedOpenerUnfocused(target: ElementHandle<HTMLElement | SVGElement>) {
  // role у подписи меняет accessible name. Проверяем сохранённую DOM-цель,
  // а не заново ищем её по прежнему имени; исчезновение кнопки не считается успехом.
  // Deactivation возвращает фокус в timer task; ждём её после кадра закрытия.
  await expect
    .poll(() =>
      target.evaluate(async (node) => {
        await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
        return { connected: node.isConnected, focused: node.matches(':focus') };
      }),
    )
    .toEqual({ connected: true, focused: false });
}

async function load(page: Page, consumer: Consumer, parameters = '') {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`/_fixtures/modal-trigger-composition.html?consumer=${consumer}${parameters}`);
  await expect(page.locator('html')).toHaveAttribute('data-trigger-ready', 'true');
  return errors;
}

async function assertRefusal(page: Page, errors: string[]) {
  await expect.poll(async () => (await state(page)).controls).toBe(0);
  await expect
    .poll(async () =>
      [...errors, ...(await state(page)).failures].some((error) => refusal.test(error)),
    )
    .toBe(true);
  expect([...errors, ...(await state(page)).failures].every((error) => refusal.test(error))).toBe(
    true,
  );
}

async function recoverAndUse(page: Page) {
  await page.evaluate(() => window.modalTriggerComposition.recover());
  await expect.poll(async () => (await state(page)).controls).toBe(1);
  await opener(page).click();
  await expect(page.locator('#field')).toBeVisible();
  await page.locator('#apply').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#field')).toBeHidden();
  await expect(opener(page)).toBeFocused();
  expect((await state(page)).actions).toBe(1);
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

for (const consumer of [
  'core',
  'native',
  'vue',
  'solid',
  'react',
  'react-sheet',
  'react-alert',
] as const) {
  test(`${consumer}: одна rich Button сохраняет ARIA, loading, обработчик и возврат фокуса`, async ({
    page,
  }) => {
    const errors = await load(page, consumer);
    await expect.poll(async () => (await state(page)).controls).toBe(1);
    expect((await state(page)).buttonType).toBe('button');
    await expect(
      page.locator('#app').getByRole('button', { name: 'Настроить цвет', exact: true }),
    ).toHaveCount(1);
    await expect(opener(page)).toHaveAttribute('aria-haspopup', 'dialog');
    if (consumer.startsWith('react')) expect((await state(page)).userRefMatches).toBe(true);
    await page.evaluate(() => window.modalTriggerComposition.setInactive(true));
    await expect(opener(page)).toBeDisabled();
    await opener(page).click({ force: true });
    expect((await state(page)).events).toEqual([]);
    await page.evaluate(() => window.modalTriggerComposition.setInactive(false));
    await expect(opener(page)).toBeEnabled();
    await opener(page).click();
    await expect(page.locator('#field')).toBeVisible();
    await page.locator('#apply').click();
    await page.keyboard.press('Escape');
    await expect(page.locator('#field')).toBeHidden();
    await expect(opener(page)).toBeFocused();
    expect((await state(page)).clicks).toBe(1);
    expect((await state(page)).actions).toBe(1);
    expect((await state(page)).events).toEqual([true, false]);
    expect(errors).toEqual([]);
    expect((await state(page)).failures).toEqual([]);
  });
}

for (const consumer of ['core', 'native', 'vue', 'solid', 'react'] as const) {
  test(`${consumer}: initial nested control отклоняется, та же кнопка восстанавливается`, async ({
    page,
  }) => {
    const errors = await load(page, consumer, '&invalid=input');
    await assertRefusal(page, errors);
    await opener(page).click();
    expect((await state(page)).events).toEqual([]);
    await expect(page.locator('#field')).toBeHidden();
    await recoverAndUse(page);
  });
}

for (const consumer of ['core', 'native', 'react'] as const) {
  for (const [part, kind] of [
    ['default', 'role'],
    ['icon', 'input'],
    ['end', 'button'],
  ] as const) {
    test(`${consumer}: ${part} nested ${kind} не открывает modal в том же turn и допускает recovery`, async ({
      page,
    }) => {
      const errors = await load(page, consumer);
      await expect.poll(async () => (await state(page)).controls).toBe(1);
      await page.evaluate(
        ({ part, kind }) => window.modalTriggerComposition.appendAndActivate(kind, part),
        { part, kind },
      );
      expect((await state(page)).events).toEqual([]);
      await assertRefusal(page, errors);
      await expect(page.locator('#field')).toBeHidden();
      await recoverAndUse(page);
    });
  }
}

for (const consumer of ['core', 'react'] as const) {
  test(`${consumer}: отозванный opener не возвращается через captured focus`, async ({ page }) => {
    const errors = await load(page, consumer);
    const originalOpener = await retainFocusedOpener(page);
    await opener(page).click();
    await expect(page.locator('#field')).toBeVisible();
    // Изменяется атрибут существующей подписи, а не assignment/тип/кнопка.
    await page
      .locator('#app [data-trigger-part="default"]')
      .evaluate((label) => label.setAttribute('role', 'combobox'));
    await assertRefusal(page, errors);
    await page.keyboard.press('Escape');
    await expect(page.locator('#field')).toBeHidden();
    await expectRevokedOpenerUnfocused(originalOpener);
    expect((await state(page)).events).toEqual([true, false]);
    await page
      .locator('#app [data-trigger-part="default"]')
      .evaluate((label) => label.removeAttribute('role'));
    await recoverAndUse(page);
  });

  test(`${consumer}: captured focus исключает same-turn отзыв до активации trap`, async ({
    page,
  }) => {
    const errors = await load(page, consumer);
    await expect.poll(async () => (await state(page)).controls).toBe(1);
    const originalOpener = await retainFocusedOpener(page);
    await page.evaluate(() => window.modalTriggerComposition.openAndRevoke());
    await assertRefusal(page, errors);
    await expect(page.locator('#field')).toBeVisible();
    await expect(page.locator(consumer === 'core' ? '#app .handle' : '#field')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator('#field')).toBeHidden();
    await expectRevokedOpenerUnfocused(originalOpener);
    expect((await state(page)).events).toEqual([true, false]);
    await page
      .locator('#app [data-trigger-part="default"]')
      .evaluate((label) => label.removeAttribute('role'));
    await recoverAndUse(page);
  });

  test(`${consumer}: замена opener возвращает новую цель и исключает старую из modal`, async ({
    page,
  }) => {
    const errors = await load(page, consumer);
    await opener(page).click();
    await expect(page.locator('#field')).toBeVisible();
    await page.evaluate(() => window.modalTriggerComposition.replaceTrigger());
    await expect(page.locator('#app [data-fixture-trigger]')).toHaveAttribute('data-revision', '1');
    await expect.poll(async () => (await state(page)).controls).toBe(1);
    expect((await state(page)).retiredConnected).toBe(true);
    await page.keyboard.press('Escape');
    await expect(page.locator('#field')).toBeHidden();
    await expect(opener(page)).toBeFocused();
    const retired = page
      .locator('#retired')
      .getByRole('button', { name: 'Настроить цвет', exact: true });
    await expect(retired).not.toBeFocused();
    await expect(retired).not.toHaveAttribute('aria-controls');
    await retired.click();
    expect((await state(page)).events).toEqual([true, false]);
    await opener(page).click();
    await expect(page.locator('#field')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#field')).toBeHidden();
    expect((await state(page)).events).toEqual([true, false, true, false]);
    expect(errors).toEqual([]);
  });
}

test('Core native: same-turn смена type отзывает opener и допускает recovery', async ({ page }) => {
  const errors = await load(page, 'native');
  await expect.poll(async () => (await state(page)).controls).toBe(1);
  await opener(page).evaluate((target) => {
    if (!(target instanceof HTMLButtonElement)) throw new Error('Не найден native opener');
    target.type = 'submit';
    target.click();
  });
  expect((await state(page)).events).toEqual([]);
  await expect(page.locator('#field')).toBeHidden();
  await expect.poll(async () => (await state(page)).controls).toBe(0);
  await expect.poll(() => errors.some((error) => /native .*type="button"/.test(error))).toBe(true);
  await opener(page).evaluate((target) => target.setAttribute('type', 'button'));
  await recoverAndUse(page);
});

for (const replaced of [false, true]) {
  test(`Core ждёт настоящий lazy upgrade${replaced ? ' и отменяет старое assignment' : ''}`, async ({
    page,
  }) => {
    const errors = await load(page, 'core', '&lazy=1');
    expect((await state(page)).buttonType).toBe(null);
    expect((await state(page)).controls).toBe(0);
    if (replaced) await page.evaluate(() => window.modalTriggerComposition.replaceTrigger());
    await page.evaluate(() => window.modalTriggerComposition.upgradeButton());
    await expect.poll(async () => (await state(page)).controls).toBe(1);
    expect((await state(page)).buttonType).toBe('button');
    if (replaced) {
      await expect.poll(async () => (await state(page)).retiredConnected).toBe(true);
      const retired = page
        .locator('#retired')
        .getByRole('button', { name: 'Настроить цвет', exact: true });
      await expect(retired).not.toHaveAttribute('aria-haspopup');
      await retired.click();
      expect((await state(page)).events).toEqual([]);
    }
    await opener(page).click();
    await expect(page.locator('#field')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#field')).toBeHidden();
    await expect(opener(page)).toBeFocused();
    expect(errors).toEqual([]);
  });
}

test('Core сохраняет captured background при отзыве controlled opener', async ({ page }) => {
  const errors = await load(page, 'core');
  await expect.poll(async () => (await state(page)).controls).toBe(1);
  await page.locator('#background').focus();
  await page.evaluate(() => window.modalTriggerComposition.openControlled());
  await expect(page.locator('#field')).toBeVisible();
  await expect(page.locator('#app .handle')).toBeFocused();
  await page.evaluate(() => window.modalTriggerComposition.insertControl('input', 'icon'));
  await assertRefusal(page, errors);
  await page.keyboard.press('Escape');
  await expect(page.locator('#field')).toBeHidden();
  await expect(page.locator('#background')).toBeFocused();
});

test('Core: отзыв opener сохраняет close button и завершает закрытие Sheet', async ({ page }) => {
  const errors = await load(page, 'core', '&closable=1');
  await opener(page).click();
  await expect(page.locator('#field')).toBeVisible();
  await page.evaluate(() => window.modalTriggerComposition.insertControl('input', 'icon'));
  await assertRefusal(page, errors);
  await expect(page.locator('#app [data-invalid-control]')).toHaveCount(1);
  await page.locator('#app').getByRole('button', { name: 'Закрыть', exact: true }).click();
  await expect(page.locator('#field')).toBeHidden();
  await expect(page.locator('#app .positioner')).toHaveAttribute('hidden', '');
  await expect(page.locator('#app .portal-plane:popover-open')).toHaveCount(0);
  await expect(opener(page)).not.toBeFocused();
  expect((await state(page)).events).toEqual([true, false]);
  await expect(page.locator('#app [data-invalid-control]')).toHaveCount(1);
  await recoverAndUse(page);
});

test('Core очищает opening origin перед новым unrelated captured background', async ({ page }) => {
  const errors = await load(page, 'core');
  await opener(page).click();
  await expect(page.locator('#field')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#field')).toBeHidden();
  await page.evaluate(() => window.modalTriggerComposition.replaceTrigger());
  await expect.poll(async () => (await state(page)).controls).toBe(1);
  await page.evaluate(() => window.modalTriggerComposition.insertControl('input', 'icon'));
  await assertRefusal(page, errors);
  const retired = page
    .locator('#retired')
    .getByRole('button', { name: 'Настроить цвет', exact: true });
  await retired.focus();
  await page.evaluate(() => window.modalTriggerComposition.openControlled());
  await expect(page.locator('#field')).toBeVisible();
  await expect(page.locator('#app .handle')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#field')).toBeHidden();
  await expect(retired).toBeFocused();
  expect((await state(page)).events).toEqual([true, false, false]);
});

test('Публичный behavior без getter сохраняет DOM opener и штатный final focus', async ({
  page,
}) => {
  const errors = await load(page, 'behavior');
  await opener(page).click();
  await expect(page.locator('#field')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#field')).toBeHidden();
  await expect(opener(page)).toBeFocused();
  expect((await state(page)).events).toEqual([true, false]);
  expect(errors).toEqual([]);
});

test('Публичный behavior explicit null сохраняет unrelated captured focus', async ({ page }) => {
  const errors = await load(page, 'behavior-null');
  await page.locator('#background').focus();
  await page.evaluate(() => window.modalTriggerComposition.openControlled());
  await expect(page.locator('#field')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#background')).toBeFocused();
  expect((await state(page)).events).toEqual([true, false]);
  expect(errors).toEqual([]);
});

for (const consumer of ['behavior', 'behavior-null'] as const) {
  test(`Публичный ${consumer}: outside exclusion различает отсутствие getter и explicit null`, async ({
    page,
  }) => {
    const errors = await load(page, consumer, '&nonmodal=1');
    await page.evaluate(() => window.modalTriggerComposition.openControlled());
    await expect(page.locator('#field')).toBeVisible();
    // Реальное нажатие разделено: outside pointerdown не подменяется click → TOGGLE.
    await opener(page).hover();
    await page.mouse.down();
    expect((await state(page)).clicks).toBe(0);
    if (consumer === 'behavior') {
      await expect(page.locator('#field')).toBeVisible();
      expect((await state(page)).events).toEqual([true]);
      // Завершение обычного click того же trigger закрывает окно ровно один раз.
      await page.mouse.up();
      await expect(page.locator('#field')).toBeHidden();
      expect((await state(page)).events).toEqual([true, false]);
      expect((await state(page)).clicks).toBe(1);
    } else {
      await expect(page.locator('#field')).toBeHidden();
      expect((await state(page)).events).toEqual([true, false]);
      await page.mouse.up();
    }
    expect(errors).toEqual([]);
  });
}
