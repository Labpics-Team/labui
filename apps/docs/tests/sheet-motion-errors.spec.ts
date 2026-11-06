import { type Page, expect, test } from '@playwright/test';
import { modalFocus } from './helpers/modal-focus.js';

interface SheetMotionErrorProbe {
  readonly primary: unknown;
  readonly errors: unknown[];
  attempts: number;
  cleanupAttempts: number;
  pointer?: number;
  restore(): void;
}

declare global {
  interface Window {
    sheetMotionErrorProbe: SheetMotionErrorProbe;
  }
}

const host = (page: Page, id = 'sheet') => page.getByTestId(id);
const portal = (page: Page, id = 'sheet') => page.locator(`[data-portal-for="${id}"]`);
const content = (page: Page, id = 'sheet') => portal(page, id).locator('.content');

async function focusedInside(page: Page, id = 'sheet'): Promise<void> {
  await expect
    .poll(() =>
      portal(page, id)
        .evaluate(modalFocus)
        .then((focus) => focus.inside),
    )
    .toBe(true);
}

async function frames(page: Page): Promise<void> {
  await page.evaluate(async () => {
    for (let index = 0; index < 2; index++) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
  });
}

async function installFault(
  page: Page,
  kind: 'error' | 'object',
  cleanupFault: boolean,
  failUnchanged = false,
): Promise<void> {
  await portal(page)
    .locator('.sheet-frame')
    .evaluate(
      (frame, { kind, cleanupFault, failUnchanged }) => {
        const style = (frame as HTMLElement).style;
        const handle = (frame.getRootNode() as ShadowRoot).querySelector<HTMLElement>('.handle');
        const initial = style.getPropertyValue('--_sheet-top');
        const setProperty = CSSStyleDeclaration.prototype.setProperty;
        const removeProperty = CSSStyleDeclaration.prototype.removeProperty;
        const primary =
          kind === 'error'
            ? new Error('Sheet: внешний отказ записи скаляра')
            : Object.freeze({ reason: 'Sheet: внешний отказ записи скаляра' });
        const pointerDown = (event: PointerEvent) => {
          probe.pointer = event.pointerId;
        };
        const probe: SheetMotionErrorProbe = {
          primary,
          errors: [],
          attempts: 0,
          cleanupAttempts: 0,
          restore: () => {
            CSSStyleDeclaration.prototype.setProperty = setProperty;
            CSSStyleDeclaration.prototype.removeProperty = removeProperty;
            handle?.removeEventListener('pointerdown', pointerDown, true);
          },
        };
        window.sheetMotionErrorProbe = probe;
        handle?.addEventListener('pointerdown', pointerDown, true);
        document.getElementById('sheet')?.addEventListener('motion-error', (event) => {
          probe.errors.push((event as CustomEvent<{ error: unknown }>).detail.error);
        });
        // Отказ затрагивает только DOM-запись скаляра этой рамки; Motion,
        // его планировщик и Zag сохраняют штатное поведение.
        CSSStyleDeclaration.prototype.setProperty = function (property, value, priority) {
          if (
            this === style &&
            property === '--_sheet-top' &&
            (failUnchanged || value !== initial)
          ) {
            probe.attempts++;
            throw primary;
          }
          setProperty.call(this, property, value, priority);
        };
        if (cleanupFault) {
          CSSStyleDeclaration.prototype.removeProperty = function (property) {
            if (this === style && property === '--_sheet-top') {
              probe.cleanupAttempts++;
              throw new Error('Sheet: вторичный отказ восстановления CSS');
            }
            return removeProperty.call(this, property);
          };
        }
      },
      { kind, cleanupFault, failUnchanged },
    );
}

async function state(page: Page) {
  return portal(page).evaluate((element) => {
    const probe = window.sheetMotionErrorProbe;
    const sheet = document.getElementById('sheet') as HTMLElement & { open: boolean };
    const panel = element.shadowRoot?.querySelector<HTMLElement>('.content');
    const handle = element.shadowRoot?.querySelector<HTMLElement>('.handle');
    return {
      attempts: probe.attempts,
      cleanupAttempts: probe.cleanupAttempts,
      errors: probe.errors.length,
      primaryPreserved: probe.errors[0] === probe.primary,
      open: sheet.open,
      visible: panel != null && getComputedStyle(panel).display !== 'none',
      locked: getComputedStyle(document.body).overflow === 'hidden',
      pointerCaptured:
        probe.pointer !== undefined && handle?.hasPointerCapture(probe.pointer) === true,
      dragging: handle?.hasAttribute('data-dragging') === true,
      motionOwned:
        element.shadowRoot?.querySelector('.sheet-frame')?.hasAttribute('data-lab-motion') === true,
    };
  });
}

for (const { name, reducedMotion, kind, cleanupFault, directInput } of [
  {
    name: 'синхронный отказ reduced motion сохраняет Error и освобождает модальность',
    reducedMotion: 'reduce',
    kind: 'error',
    cleanupFault: false,
    directInput: false,
  },
  {
    name: 'отказ на RAF сохраняет исходный объект и завершает владение движением',
    reducedMotion: 'no-preference',
    kind: 'object',
    cleanupFault: false,
    directInput: false,
  },
  {
    name: 'вторичная ошибка очистки не подменяет первичный отказ Motion',
    reducedMotion: 'reduce',
    kind: 'error',
    cleanupFault: true,
    directInput: false,
  },
  {
    name: 'отказ прямого ввода освобождает указатель без повторного захвата',
    reducedMotion: 'reduce',
    kind: 'error',
    cleanupFault: false,
    directInput: true,
  },
] as const) {
  test(name, async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.setViewportSize({ width: 375, height: 812 });
    await page.emulateMedia({ reducedMotion });
    await page.goto('/_fixtures/sheet.html');
    await expect(page.locator('html')).toHaveAttribute('data-sheet-fixture-ready', 'true');
    await expect
      .poll(() =>
        portal(page)
          .locator('.sheet-frame')
          .evaluate((frame) => (frame as HTMLElement).style.getPropertyValue('--_sheet-top')),
      )
      .toBe('812px');
    if (directInput) {
      await host(page).locator('.trigger').click();
      await expect(content(page)).toBeVisible();
      await expect
        .poll(() => content(page).evaluate((panel) => panel.getBoundingClientRect().top))
        .toBe(390);
    }
    await installFault(page, kind, cleanupFault, directInput);
    let pointerDown = false;
    try {
      if (directInput) {
        const box = await portal(page).locator('.handle').boundingBox();
        if (!box) throw new Error('Нет ручки открытой панели');
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        pointerDown = true;
      } else {
        await host(page).locator('.trigger').click();
      }
      await expect.poll(async () => (await state(page)).attempts).toBeGreaterThan(0);
      await frames(page);
      console.info(
        JSON.stringify({ name, phase: 'после отказа', ...(await state(page)), pageErrors }),
      );
      await expect.poll(async () => (await state(page)).errors).toBe(1);
      expect((await state(page)).primaryPreserved).toBe(true);
      await expect(host(page)).not.toHaveAttribute('open');
      await expect(content(page)).toBeHidden();
      await expect(host(page).locator('.trigger')).toBeFocused();
      await expect.poll(async () => (await state(page)).locked).toBe(false);
      expect((await state(page)).pointerCaptured).toBe(false);
      expect((await state(page)).dragging).toBe(false);
      if (cleanupFault) expect((await state(page)).cleanupAttempts).toBe(1);
      if (pointerDown) {
        await page.mouse.up();
        pointerDown = false;
      }

      const attempts = (await state(page)).attempts;
      await page.setViewportSize({ width: 375, height: 780 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await frames(page);
      console.info(
        JSON.stringify({ name, phase: 'после resize', ...(await state(page)), pageErrors }),
      );
      expect((await state(page)).attempts).toBe(attempts);
      expect((await state(page)).errors).toBe(1);
      expect((await state(page)).motionOwned).toBe(false);
      await page.locator('#background').click();
      await expect(page.locator('#background-count')).toHaveText('1');

      // Соседняя панель использует тот же опубликованный Motion без отказа.
      await host(page, 'empty').locator('.trigger').click();
      await expect(content(page, 'empty')).toBeVisible();
      await focusedInside(page, 'empty');
      await page.keyboard.press('Escape');
      await expect(content(page, 'empty')).toBeHidden();
      await expect(host(page, 'empty').locator('.trigger')).toBeFocused();

      // После устранения отказа новое явное открытие получает новый scope.
      await page.evaluate(() => window.sheetMotionErrorProbe.restore());
      await host(page).locator('.trigger').click();
      await expect(content(page)).toBeVisible();
      await focusedInside(page);
      await expect.poll(async () => (await state(page)).locked).toBe(true);
      const before = await content(page).evaluate((panel) => panel.getBoundingClientRect().top);
      await portal(page).locator('.handle').press('Home');
      await expect(host(page)).toHaveAttribute('position', 'full');
      await expect
        .poll(() => content(page).evaluate((panel) => panel.getBoundingClientRect().top))
        .toBeLessThan(before);
      await page.keyboard.press('Escape');
      await expect(content(page)).toBeHidden();
      await expect(host(page).locator('.trigger')).toBeFocused();
      await expect.poll(async () => (await state(page)).locked).toBe(false);
      expect((await state(page)).errors).toBe(1);
      expect(pageErrors).toEqual([]);
      console.info(
        JSON.stringify({
          name,
          phase: 'после соседней панели и явного восстановления',
          ...(await state(page)),
        }),
      );
    } finally {
      if (pointerDown) await page.mouse.up();
      await page.evaluate(() => window.sheetMotionErrorProbe.restore());
    }
  });
}
