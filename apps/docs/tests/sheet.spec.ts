import AxeBuilder from '@axe-core/playwright';
import { type Page, expect, test } from '@playwright/test';
import { modalFocus } from './helpers/modal-focus.js';

const host = (page: Page, id = 'sheet') => page.getByTestId(id);
const portal = (page: Page, id = 'sheet') => page.locator(`[data-portal-for="${id}"]`);
const content = (page: Page, id = 'sheet') => portal(page, id).locator('.content');
const handle = (page: Page, id = 'sheet') => portal(page, id).locator('.handle');

async function top(page: Page, id = 'sheet'): Promise<number> {
  return content(page, id).evaluate((element) => element.getBoundingClientRect().top);
}

async function settled(page: Page, expected: number, id = 'sheet'): Promise<void> {
  await expect.poll(() => top(page, id)).toBeCloseTo(expected, 1);
}

async function focusedInside(page: Page, id = 'sheet'): Promise<void> {
  await expect
    .poll(() =>
      portal(page, id)
        .evaluate(modalFocus)
        .then((focus) => focus.inside),
    )
    .toBe(true);
}

async function open(page: Page, id = 'sheet'): Promise<void> {
  await host(page, id).locator('.trigger').click();
  await expect(content(page, id)).toBeVisible();
  await focusedInside(page, id);
}

async function close(page: Page, id = 'sheet'): Promise<void> {
  await page.keyboard.press('Escape');
  await expect(content(page, id)).toBeHidden();
  await expect(host(page, id).locator('.trigger')).toBeFocused();
}

async function setPosition(page: Page, position: string, id = 'sheet'): Promise<void> {
  await host(page, id).evaluate(
    (element, value) => element.setAttribute('position', value),
    position,
  );
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/_fixtures/sheet.html');
  await expect(page.locator('html')).toHaveAttribute('data-sheet-fixture-ready', 'true');
});

test('опубликованный HTML содержит вход и именованный content slot', async ({ request }) => {
  const response = await request.get('/_fixtures/sheet.html');
  const html = await response.text();
  expect(html).toContain('<lab-sheet');
  expect(html).toContain('slot="content"');
});

for (const [position, expected] of [
  ['full', 36],
  ['two-thirds', 272],
  ['half', 390],
  ['one-third', 542],
  ['flex', 772],
] as const) {
  test(`${position}: геометрия независимого эталона 375 × 812`, async ({ page }) => {
    await setPosition(page, position, 'empty');
    await open(page, 'empty');
    await settled(page, expected, 'empty');
    const box = await content(page, 'empty').boundingBox();
    expect(box?.x).toBe(0);
    expect(box?.width).toBe(375);
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeCloseTo(812, 1);
    await close(page, 'empty');
  });
}

test('модальность, достижимая форма и open → close → reopen сохраняют ввод', async ({ page }) => {
  await open(page);
  await expect(content(page)).toHaveAttribute('role', 'dialog');
  await expect(content(page)).toHaveAttribute('aria-modal', 'true');
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.body).overflow))
    .toBe('hidden');
  let reachedInput = false;
  let reachedApply = false;
  for (let index = 0; index < 8; index++) {
    await page.keyboard.press('Tab');
    const focus = await portal(page).evaluate(modalFocus);
    expect(focus.inside).toBe(true);
    reachedInput ||= focus.id === 'name';
    reachedApply ||= focus.id === 'apply';
  }
  expect(reachedInput).toBe(true);
  expect(reachedApply).toBe(true);
  await host(page).locator('#name').fill('Несохранённое имя');
  await close(page);
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.body).overflow))
    .not.toBe('hidden');
  await open(page);
  await expect(host(page).locator('#name')).toHaveValue('Несохранённое имя');
  await host(page).locator('#apply').click();
  await expect(content(page)).toBeHidden();
});

test('фон блокируется, нажатие на подложку закрывает панель', async ({ page }) => {
  await open(page);
  const button = await page.locator('#background').boundingBox();
  if (!button) throw new Error('Нет фонового действия');
  await page.mouse.click(button.x + button.width / 2, button.y + button.height / 2);
  await expect(content(page)).toBeHidden();
  await expect(page.locator('#background-count')).toHaveText('0');
});

test('handle drag выбирает ближайший пресет; прокрутка body сохраняет position', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await settled(page, 390);
  const box = await handle(page).boundingBox();
  if (!box) throw new Error('Нет ручки');
  await page.mouse.move(box.x + box.width / 2, box.y + 14);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y - 130, { steps: 5 });
  await page.mouse.up();
  await settled(page, 272);
  await expect(host(page)).toHaveAttribute('position', 'two-thirds');
  await portal(page)
    .locator('.panel-body')
    .evaluate((element) => {
      element.scrollTop = 200;
    });
  await expect(host(page)).toHaveAttribute('position', 'two-thirds');
});

test.describe('touch', () => {
  test.use({ hasTouch: true });

  test('нативный tap открывает панель и меняет позицию ручкой', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await host(page).locator('.trigger').tap();
    await settled(page, 390);
    await focusedInside(page);
    await handle(page).tap();
    await settled(page, 272);
    await expect(host(page)).toHaveAttribute('position', 'two-thirds');
  });

  test('нативный Chromium swipe и touchCancel сохраняют выбранную позицию', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'CDP touch input предоставляется Chromium.');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await host(page).locator('.trigger').tap();
    await settled(page, 390);
    const session = await page.context().newCDPSession(page);
    try {
      const drag = async (delta: number, cancel: boolean): Promise<void> => {
        const box = await handle(page).boundingBox();
        if (!box) throw new Error('Нет ручки');
        const x = box.x + box.width / 2;
        const y = box.y + 14;
        await session.send('Input.dispatchTouchEvent', {
          type: 'touchStart',
          touchPoints: [{ x, y, id: 1 }],
        });
        for (let step = 1; step <= 5; step++) {
          await session.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x, y: y + (delta * step) / 5, id: 1 }],
          });
        }
        await session.send('Input.dispatchTouchEvent', {
          type: cancel ? 'touchCancel' : 'touchEnd',
          touchPoints: [],
        });
      };
      await drag(-144, false);
      await settled(page, 272);
      await expect(host(page)).toHaveAttribute('position', 'two-thirds');
      await drag(100, true);
      await settled(page, 272);
      await expect(host(page)).toHaveAttribute('position', 'two-thirds');
      await expect(handle(page)).not.toHaveAttribute('data-dragging', '');
      expect(await page.evaluate(() => scrollY)).toBe(0);
    } finally {
      await session.detach();
    }
  });
});

for (const cancellation of ['pointercancel', 'lostpointercapture'] as const) {
  test(`${cancellation} возвращает выбранную позицию и освобождает захват`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page);
    await settled(page, 390);
    const grip = handle(page);
    await grip.evaluate((element) =>
      element.addEventListener(
        'pointerdown',
        (event) => {
          (element as HTMLElement).dataset.pointer = String((event as PointerEvent).pointerId);
        },
        { once: true },
      ),
    );
    const box = await grip.boundingBox();
    if (!box) throw new Error('Нет ручки');
    await page.mouse.move(box.x + box.width / 2, box.y + 14);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + 100, { steps: 3 });
    await grip.evaluate((element, kind) => {
      const pointerId = Number((element as HTMLElement).dataset.pointer);
      if (kind === 'lostpointercapture') element.releasePointerCapture(pointerId);
      else element.dispatchEvent(new PointerEvent(kind, { pointerId, isPrimary: true }));
    }, cancellation);
    if (cancellation === 'lostpointercapture')
      await page.mouse.move(box.x + box.width / 2, box.y + 101);
    await settled(page, 390);
    await page.mouse.up();
    await expect(grip).not.toHaveAttribute('data-dragging', '');
    expect(
      await grip.evaluate((element) =>
        element.hasPointerCapture(Number((element as HTMLElement).dataset.pointer)),
      ),
    ).toBe(false);
    await expect(host(page)).toHaveAttribute('position', 'half');
  });
}

test('retarget и close → reopen в полёте продолжают текущую позу', async ({ page }) => {
  const epoch = new Date('2026-11-04T00:00:00Z');
  await page.clock.install({ time: epoch });
  await page.goto('/_fixtures/sheet.html');
  await expect(page.locator('html')).toHaveAttribute('data-sheet-fixture-ready', 'true');
  await page.clock.pauseAt(epoch.getTime() + 60_000);
  await page
    .locator('html')
    .evaluate((element) =>
      (element as HTMLElement).style.setProperty('--lab-motion-entrance-duration', '600ms'),
    );
  await host(page)
    .locator('.trigger')
    .evaluate((element) => (element as HTMLElement).click());
  await page.clock.runFor(96);
  await expect(content(page)).toBeVisible();
  await focusedInside(page);
  expect(await top(page)).toBeGreaterThan(390);
  expect(await top(page)).toBeLessThan(812);
  const deltas = await host(page).evaluate(async (element) => {
    const sheet = element as HTMLElement & {
      open: boolean;
      position: string;
      updateComplete: Promise<unknown>;
    };
    const root = element.shadowRoot?.querySelector('[data-portal-for="sheet"]')?.shadowRoot;
    const panel = root?.querySelector('.content');
    if (!panel) throw new Error('Нет панели');
    const before = panel.getBoundingClientRect().top;
    sheet.position = 'full';
    await sheet.updateComplete;
    const after = panel.getBoundingClientRect().top;
    sheet.open = false;
    await sheet.updateComplete;
    const afterClose = panel.getBoundingClientRect().top;
    sheet.open = true;
    await sheet.updateComplete;
    const afterReopen = panel.getBoundingClientRect().top;
    return [after - before, afterClose - after, afterReopen - afterClose].map(Math.abs);
  });
  // Один момент browser clock отличает скачок позы от допустимого хода времени.
  for (const delta of deltas) expect(delta).toBeLessThan(0.1);
  await page.clock.resume();
  await settled(page, 36);
  await expect(content(page)).toBeVisible();
  await expect(host(page)).toHaveAttribute('open', '');
});

test('resize во время движения удерживает нижний край и ограничивает высоту', async ({ page }) => {
  await setPosition(page, 'full');
  await open(page);
  await page.setViewportSize({ width: 400, height: 600 });
  await settled(page, 0);
  const box = await content(page).boundingBox();
  expect(box?.width).toBe(400);
  expect((box?.y ?? 0) + (box?.height ?? 0)).toBeCloseTo(600, 1);
});

test('системный reduced motion завершает уже начатое движение', async ({ page }) => {
  await page
    .locator('html')
    .evaluate((element) =>
      (element as HTMLElement).style.setProperty('--lab-motion-entrance-duration', '600ms'),
    );
  await open(page);
  await expect.poll(() => top(page)).toBeLessThan(750);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await settled(page, 390);
  await close(page);
});

test('disconnect отменяет движение, возвращает форму и позволяет reconnect', async ({ page }) => {
  await open(page);
  await host(page).locator('#name').fill('Сохранённый узел');
  await host(page).evaluate((element) => {
    const record = window as unknown as { detachedSheet: Element; retiredFrame: HTMLElement };
    record.detachedSheet = element;
    record.retiredFrame = element.shadowRoot
      ?.querySelector('[data-portal-for="sheet"]')
      ?.shadowRoot?.querySelector('.sheet-frame') as HTMLElement;
    element.remove();
  });
  await expect(portal(page)).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.body).overflow))
    .not.toBe('hidden');
  await page.evaluate(async () => {
    const record = window as unknown as { detachedSheet: Element; retiredFrame: HTMLElement };
    const value = record.retiredFrame.style.getPropertyValue('--_sheet-top');
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    if (record.retiredFrame.style.getPropertyValue('--_sheet-top') !== value)
      throw new Error('Отозванный animator продолжил запись');
    const input = record.detachedSheet.querySelector('input');
    if (input?.value !== 'Сохранённый узел') throw new Error('Форма потеряла состояние');
    document.getElementById('local-context')?.append(record.detachedSheet);
  });
  await expect(content(page)).toBeVisible();
  await settled(page, 390);
  await expect(host(page).locator('#name')).toHaveValue('Сохранённый узел');
  await close(page);
});

test('portal следует локальным theme/material/contrast и role overrides', async ({ page }) => {
  await page.locator('#local-context').evaluate((element) => {
    element.setAttribute('data-theme', 'dark');
    element.setAttribute('data-material', 'solid');
    element.setAttribute('data-contrast', 'more');
    (element as HTMLElement).style.setProperty('--lab-label-primary', 'rgb(11 22 33)');
  });
  await open(page);
  await expect(portal(page)).toHaveAttribute('data-theme', 'dark');
  await expect(portal(page)).toHaveAttribute('data-material', 'solid');
  await expect(portal(page)).toHaveAttribute('data-contrast', 'more');
  await expect
    .poll(() => content(page).evaluate((element) => getComputedStyle(element).color))
    .toBe('rgb(11, 22, 33)');
  await page.locator('#local-context').evaluate((element) => {
    element.setAttribute('data-theme', 'light');
    (element as HTMLElement).style.setProperty('--lab-label-primary', 'rgb(44 55 66)');
  });
  await expect(portal(page)).toHaveAttribute('data-theme', 'light');
  await expect
    .poll(() => content(page).evaluate((element) => getComputedStyle(element).color))
    .toBe('rgb(44, 55, 66)');
});

test('Flex измеряет содержимое; клавиатура выбирает Full и Flex', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await setPosition(page, 'flex');
  await open(page);
  await expect.poll(() => top(page)).toBeGreaterThan(390);
  await expect.poll(() => top(page)).toBeLessThan(772);
  await handle(page).focus();
  await page.keyboard.press('Home');
  await settled(page, 36);
  await page.keyboard.press('End');
  await expect(host(page)).toHaveAttribute('position', 'flex');
  await expect.poll(() => top(page)).toBeGreaterThan(390);
});

test('изменение rem масштаба переносится в пресеты, overlap и пустой Flex', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('html').evaluate((element) => {
    (element as HTMLElement).style.fontSize = '20px';
  });
  await setPosition(page, 'two-thirds', 'empty');
  await open(page, 'empty');
  await settled(page, 137, 'empty');
  await setPosition(page, 'half', 'empty');
  await settled(page, 386, 'empty');
  await setPosition(page, 'flex', 'empty');
  await settled(page, 762, 'empty');
});

test('Flex пересчитывается при добавлении и изменении реального содержимого', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await setPosition(page, 'flex', 'empty');
  await open(page, 'empty');
  await settled(page, 772, 'empty');
  await host(page, 'empty').evaluate((element) => {
    const body = document.createElement('div');
    body.slot = 'content';
    body.id = 'dynamic-content';
    body.style.height = '100px';
    element.append(body);
  });
  await settled(page, 648, 'empty');
  await host(page, 'empty')
    .locator('#dynamic-content')
    .evaluate((element) => {
      (element as HTMLElement).style.height = '180px';
    });
  await settled(page, 568, 'empty');
});

test('Ghost отделён от Body; ручка и углы сохраняют геометрию', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page, 'empty');
  await settled(page, 390, 'empty');
  const indicator = await portal(page, 'empty').locator('.indicator').boundingBox();
  expect(indicator?.x).toBeCloseTo(170, 1);
  expect(indicator?.y).toBeCloseTo(404, 1);
  expect(indicator?.width).toBe(36);
  expect(indicator?.height).toBe(4);
  const ghost = await portal(page, 'empty').locator('.ghost').boundingBox();
  expect(ghost?.height).toBeCloseTo(422, 1);
  const corners = await content(page, 'empty').evaluate((element) => {
    const style = getComputedStyle(element);
    return [style.borderTopLeftRadius, style.borderBottomLeftRadius];
  });
  expect(corners).toEqual(['32px', '0px']);
  await testInfo.attach('sheet-half', { body: await page.screenshot(), contentType: 'image/png' });
});

test('открытая форма проходит WCAG AA', async ({ page }) => {
  await open(page);
  const report = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(report.violations).toEqual([]);
});
