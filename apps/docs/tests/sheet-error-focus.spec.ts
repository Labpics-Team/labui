import { type Page, expect, test } from '@playwright/test';
import { modalFocus } from './helpers/modal-focus.js';

const host = (page: Page, id = 'sheet') => page.getByTestId(id);
const portal = (page: Page, id = 'sheet') => page.locator(`[data-portal-for="${id}"]`);
const content = (page: Page, id = 'sheet') => portal(page, id).locator('.content');
const pageErrors = new WeakMap<Page, string[]>();

test.beforeEach(({ page }) => {
  const errors: string[] = [];
  pageErrors.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
});
test.afterEach(({ page }) => {
  expect(pageErrors.get(page)).toEqual([]);
});

interface FocusErrorProbe {
  primary: Error;
  errors: unknown[];
  triggerId: string;
  newOwnerFocused: boolean;
  focusAfterNewOwner: string[];
  restore(): void;
}

declare global {
  interface Window {
    sheetFocusErrorProbe: FocusErrorProbe;
  }
}

async function inside(page: Page, id = 'sheet'): Promise<boolean> {
  return (await portal(page, id).evaluate(modalFocus)).inside;
}

async function setup(page: Page, active = false): Promise<void> {
  const epoch = new Date('2026-11-04T00:00:00Z');
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install({ time: epoch });
  await page.goto('/_fixtures/sheet.html');
  await expect(page.locator('html')).toHaveAttribute('data-sheet-fixture-ready', 'true');
  await expect
    .poll(() =>
      portal(page)
        .locator('.sheet-frame')
        .evaluate((frame) => (frame as HTMLElement).style.getPropertyValue('--_sheet-top')),
    )
    .toBe('812px');
  await page.clock.pauseAt(epoch.getTime() + 60_000);
  await page.locator('#background').focus();
  if (active) {
    await host(page)
      .locator('.trigger')
      .evaluate((element) => (element as HTMLElement).click());
    await page.clock.runFor(64);
    expect(await inside(page)).toBe(true);
  }
}

async function install(
  page: Page,
  target: 'keep' | 'remove' | 'disable' = 'keep',
  action: 'none' | 'reopen' | 'neighbor' | 'disconnect' = 'none',
): Promise<void> {
  await portal(page)
    .locator('.sheet-frame')
    .evaluate(
      (element, options) => {
        const sheet = document.getElementById('sheet') as HTMLElement & { open: boolean };
        const neighbor = document.getElementById('empty') as HTMLElement & { open: boolean };
        const trigger = sheet.shadowRoot?.querySelector<HTMLButtonElement>('.trigger');
        const style = (element as HTMLElement).style;
        const baseline = style.getPropertyValue('--_sheet-top');
        const setProperty = CSSStyleDeclaration.prototype.setProperty;
        const neighborContent = neighbor.shadowRoot
          ?.querySelector('[data-portal-for="empty"]')
          ?.shadowRoot?.querySelector('.content');
        let changed = false;
        const focus = (event: FocusEvent): void => {
          const path = event.composedPath();
          if (neighborContent && path.includes(neighborContent)) probe.newOwnerFocused = true;
          if (probe.newOwnerFocused) {
            const node = path[0] as HTMLElement;
            probe.focusAfterNewOwner.push(node.id || node.className);
          }
        };
        const failed = (event: Event): void => {
          probe.errors.push((event as CustomEvent<{ error: unknown }>).detail.error);
          if (options.action === 'none') return;
          probe.restore();
          if (options.action === 'reopen') sheet.open = true;
          else {
            if (options.action === 'disconnect') sheet.remove();
            neighbor.open = true;
          }
        };
        const probe: FocusErrorProbe = {
          primary: new Error('Sheet: отказ записи до завершения focus lifetime'),
          errors: [],
          triggerId: trigger?.id ?? '',
          newOwnerFocused:
            neighborContent?.contains(
              (neighborContent.getRootNode() as ShadowRoot).activeElement,
            ) ?? false,
          focusAfterNewOwner: [],
          restore: () => {
            CSSStyleDeclaration.prototype.setProperty = setProperty;
          },
        };
        window.sheetFocusErrorProbe = probe;
        document.addEventListener('focusin', focus, true);
        sheet.addEventListener('motion-error', failed);
        // Сохраняется настоящая sync граница scalar writer. RAF заморожен Clock,
        // поэтому первый open не может случайно создать trap до отказа.
        CSSStyleDeclaration.prototype.setProperty = function (property, value, priority) {
          if (this === style && property === '--_sheet-top' && value !== baseline) {
            if (!changed) {
              changed = true;
              if (options.target === 'remove') trigger?.remove();
              else if (options.target === 'disable' && trigger) trigger.disabled = true;
            }
            throw probe.primary;
          }
          setProperty.call(this, property, value, priority);
        };
      },
      { target, action },
    );
}

async function fail(page: Page, active = false): Promise<void> {
  if (active) {
    await portal(page).locator('.handle').focus();
    await page.keyboard.press('Home');
  } else {
    await host(page)
      .locator('.trigger')
      .evaluate((element) => (element as HTMLElement).click());
  }
  await page.clock.runFor(64);
  await expect.poll(() => page.evaluate(() => window.sheetFocusErrorProbe.errors.length)).toBe(1);
  expect(
    await page.evaluate(
      () => window.sheetFocusErrorProbe.errors[0] === window.sheetFocusErrorProbe.primary,
    ),
  ).toBe(true);
}

test('отказ до активации trap возвращает заданный finalFocusEl', async ({ page }) => {
  await setup(page);
  await install(page);
  try {
    await fail(page);
    await expect(content(page)).toBeHidden();
    await expect(host(page).locator('.trigger')).toBeFocused();
    expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe('hidden');
  } finally {
    await page.evaluate(() => window.sheetFocusErrorProbe.restore());
  }
});

for (const target of ['remove', 'disable'] as const) {
  for (const active of [false, true]) {
    test(`${target}: отсутствующая точка возврата ${active ? 'активного' : 'раннего'} trap сохраняет доступный фон`, async ({
      page,
    }) => {
      await setup(page, active);
      await install(page, target);
      try {
        await fail(page, active);
        await expect(content(page)).toBeHidden();
        await expect(page.locator('#background')).toBeFocused();
        expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe(
          'hidden',
        );
        const background = await page.locator('#background').boundingBox();
        if (!background) throw new Error('Нет доступного действия на фоне');
        await page.mouse.click(
          background.x + background.width / 2,
          background.y + background.height / 2,
        );
        await expect(page.locator('#background-count')).toHaveText('1');
      } finally {
        await page.evaluate(() => window.sheetFocusErrorProbe.restore());
      }
    });
  }
}

for (const action of ['reopen', 'neighbor', 'disconnect'] as const) {
  test(`${action}: обработчик motion-error открывает новое поколение без позднего возврата фокуса`, async ({
    page,
  }) => {
    await setup(page);
    await install(page, 'keep', action);
    try {
      await fail(page);
      const id = action === 'reopen' ? 'sheet' : 'empty';
      await expect(content(page, id)).toBeVisible();
      expect(await inside(page, id)).toBe(true);
      expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).toBe('hidden');
      await page.clock.runFor(128);
      expect(await inside(page, id)).toBe(true);
      const probe = await page.evaluate(() => ({
        events: window.sheetFocusErrorProbe.errors.length,
        oldTriggerFocused: window.sheetFocusErrorProbe.focusAfterNewOwner.includes(
          window.sheetFocusErrorProbe.triggerId,
        ),
      }));
      expect(probe).toEqual({ events: 1, oldTriggerFocused: false });
      if (action === 'disconnect') await expect(portal(page)).toHaveCount(0);
      await page.keyboard.press('Escape');
      await page.clock.runFor(64);
      await expect(content(page, id)).toBeHidden();
      await expect(host(page, id).locator('.trigger')).toBeFocused();
    } finally {
      await page.evaluate(() => window.sheetFocusErrorProbe.restore());
    }
  });
}

test('уже открытый сосед сохраняет фокус при отказе прежнего modal', async ({ page }) => {
  await setup(page, true);
  await host(page, 'empty').evaluate((element) => {
    (element as HTMLElement & { open: boolean }).open = true;
  });
  await page.clock.runFor(64);
  expect(await inside(page, 'empty')).toBe(true);
  await install(page);
  try {
    await host(page).evaluate((element) => {
      (element as HTMLElement & { position: string }).position = 'full';
    });
    await page.clock.runFor(128);
    await expect(content(page)).toBeHidden();
    await expect(content(page, 'empty')).toBeVisible();
    expect(await inside(page, 'empty')).toBe(true);
    expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).toBe('hidden');
    const probe = await page.evaluate(() => ({
      events: window.sheetFocusErrorProbe.errors.length,
      primaryPreserved:
        window.sheetFocusErrorProbe.errors[0] === window.sheetFocusErrorProbe.primary,
      oldTriggerFocused: window.sheetFocusErrorProbe.focusAfterNewOwner.includes(
        window.sheetFocusErrorProbe.triggerId,
      ),
    }));
    expect(probe).toEqual({ events: 1, primaryPreserved: true, oldTriggerFocused: false });
    await page.keyboard.press('Escape');
    await page.clock.runFor(64);
    await expect(content(page, 'empty')).toBeHidden();
    await expect(host(page, 'empty').locator('.trigger')).toBeFocused();
    expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe('hidden');
  } finally {
    await page.evaluate(() => window.sheetFocusErrorProbe.restore());
  }
});

for (const action of ['close', 'disconnect'] as const) {
  test(`${action}: завершение прежнего owner сохраняет самостоятельный соседний Sheet`, async ({
    page,
  }) => {
    await setup(page, true);
    await host(page, 'empty').evaluate((element) => {
      (element as HTMLElement & { open: boolean }).open = true;
    });
    await page.clock.runFor(64);
    expect(await inside(page, 'empty')).toBe(true);
    await host(page).evaluate((element, action) => {
      if (action === 'disconnect') element.remove();
      else (element as HTMLElement & { open: boolean }).open = false;
    }, action);
    await page.clock.runFor(128);
    await expect(content(page, 'empty')).toBeVisible();
    expect(await inside(page, 'empty')).toBe(true);
    expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).toBe('hidden');
    await host(page, 'empty').evaluate((element) => {
      (element as HTMLElement & { open: boolean }).open = false;
    });
    await page.clock.runFor(64);
    await expect(content(page, 'empty')).toBeHidden();
    await expect(host(page, 'empty').locator('.trigger')).toBeFocused();
    expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe('hidden');
  });
}

for (const ancestry of ['direct', 'shadow', 'slot'] as const) {
  test(`${ancestry}: закрытие владельца каскадирует в настоящий вложенный Sheet`, async ({
    page,
  }) => {
    await setup(page);
    await host(page).evaluate(async (element, ancestry) => {
      const neighbor = document.getElementById('empty');
      if (!neighbor) throw new Error('Нет вложенного Sheet');
      const body = document.createElement('div');
      body.slot = 'content';
      if (ancestry === 'direct') body.append(neighbor);
      else {
        const shadow = body.attachShadow({ mode: 'open' });
        if (ancestry === 'shadow') shadow.append(neighbor);
        else {
          neighbor.slot = 'nested';
          const slot = document.createElement('slot');
          slot.name = 'nested';
          shadow.append(slot);
          body.append(neighbor);
        }
      }
      element.append(body);
      await (element as HTMLElement & { updateComplete: Promise<boolean> }).updateComplete;
      await (neighbor as HTMLElement & { updateComplete: Promise<boolean> }).updateComplete;
      const sheet = element as HTMLElement & { open: boolean; position: string };
      sheet.position = 'full';
      sheet.open = true;
    }, ancestry);
    await page.clock.runFor(64);
    expect(await inside(page)).toBe(true);
    await host(page, 'empty').evaluate((element) => {
      (element as HTMLElement & { open: boolean }).open = true;
    });
    await page.clock.runFor(64);
    expect(await inside(page, 'empty')).toBe(true);
    await host(page).evaluate((element) => {
      (element as HTMLElement & { open: boolean }).open = false;
    });
    await page.clock.runFor(128);
    await expect(content(page).first()).toBeHidden();
    await expect(content(page, 'empty')).toBeHidden();
    await expect(content(page, 'empty')).toHaveAttribute('data-state', 'closed');
    expect(
      await host(page, 'empty').evaluate(
        (element) => (element as HTMLElement & { open: boolean }).open,
      ),
    ).toBe(false);
    await expect(host(page).locator('.trigger').first()).toBeFocused();
    expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe('hidden');
  });
}
