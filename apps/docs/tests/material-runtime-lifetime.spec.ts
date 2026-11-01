import { type Page, expect, test } from '@playwright/test';
import type { RuntimeScope } from '../src/_fixtures/material-runtime-lifetime';

const snapshot = (page: Page) => page.evaluate(() => window.__materialLifetime.snapshot());
const settle = (page: Page) => page.evaluate(() => window.__materialLifetime.settle());
const mount = (page: Page, scope: RuntimeScope) =>
  page.evaluate((scope) => window.__materialLifetime.mount(scope), scope);
const dispose = (page: Page, id: number) =>
  page.evaluate((id) => window.__materialLifetime.dispose(id), id);

declare global {
  interface Window {
    __materialObserverProbe: {
      active(): number;
      pendingFrames(): number;
      deliverRetired(): number;
    };
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto('/_fixtures/material-runtime-lifetime.html');
  await page.waitForFunction(() => !!window.__materialLifetime);
});

for (const first of ['document', 'surface'] as const) {
  test(`пересекающиеся mount: ${first} первым, ресурс живёт до последнего release`, async ({
    page,
    browserName,
  }) => {
    const baseline = await snapshot(page);
    const initial = await mount(page, first);
    await settle(page);
    const live = await snapshot(page);
    expect(live.strips.length).toBeGreaterThan(0);
    if (browserName === 'chromium') {
      expect(live.filters).toHaveLength(1);
      expect(live.backdrop).toContain(live.filters[0]);
    }

    const second = await mount(page, first === 'document' ? 'surface' : 'document');
    const third = await mount(page, 'container');
    await settle(page);
    expect(await snapshot(page), 'второй mount сохраняет идентичность живых ресурсов').toEqual(
      live,
    );
    await dispose(page, initial);
    await dispose(page, third);
    await settle(page);
    expect(await snapshot(page), 'оставшийся mount продолжает держать поверхность').toEqual(live);
    await dispose(page, second);
    await settle(page);
    expect(await snapshot(page), 'последний release восстанавливает исходный inline-стиль').toEqual(
      baseline,
    );

    const successor = await mount(page, 'surface');
    await settle(page);
    const successorLive = await snapshot(page);
    await dispose(page, initial);
    await dispose(page, second);
    await page.evaluate(() => window.dispatchEvent(new Event('resize')));
    await settle(page);
    expect(await snapshot(page), 'поздние release не стирают нового владельца').toEqual(
      successorLive,
    );
    await page.evaluate(async (id) => {
      window.__materialLifetime.mode('glass');
      // MutationObserver успевает поставить sync в rAF до release.
      await Promise.resolve();
      window.__materialLifetime.dispose(id);
      window.dispatchEvent(new Event('resize'));
    }, successor);
    await settle(page);
    expect(await snapshot(page), 'после очистки resize не оживляет движок').toEqual(baseline);
  });
}

test('смена material и media не даёт старому mount стереть новый фильтр', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'SVG backdrop движки применимы только в Chromium');
  const baseline = await snapshot(page);
  const app = await mount(page, 'document');
  const local = await mount(page, 'surface');
  await settle(page);
  const strips = (await snapshot(page)).strips;

  for (const mode of ['glass', 'acrylic', 'glass', 'acrylic'] as const) {
    await page.evaluate((mode) => window.__materialLifetime.mode(mode), mode);
    const prefix = mode === 'glass' ? 'lab-lg-' : 'lab-acrylic-';
    await expect.poll(async () => (await snapshot(page)).backdrop).toContain(prefix);
    await settle(page);
    const current = await snapshot(page);
    expect(current.filters).toHaveLength(1);
    expect(current.backdrop).toContain(current.filters[0]);
    expect(current.strips, 'veil остаётся самостоятельным эффектом').toEqual(strips);
  }

  await page.evaluate(() =>
    document.querySelector('#surface')?.classList.add('lab-material--soft'),
  );
  await expect
    .poll(() => page.locator('.lab-acrylic-defs feFlood').getAttribute('style'))
    .toContain('--lab-bg-material-soft-01');
  await page.emulateMedia({ forcedColors: 'active' });
  await expect.poll(async () => (await snapshot(page)).filters.length).toBe(0);
  await page.emulateMedia({ forcedColors: null });
  await expect.poll(async () => (await snapshot(page)).backdrop).toContain('lab-acrylic-');
  const beforeRelease = await snapshot(page);
  await dispose(page, app);
  await settle(page);
  expect(await snapshot(page)).toEqual(beforeRelease);
  await dispose(page, local);
  await settle(page);
  expect(await snapshot(page)).toEqual(baseline);
});

for (const veil of [true, false]) {
  test(`удалённая поверхность ${veil ? 'с veil' : 'без veil'} освобождается и повторно подключается`, async ({
    page,
    browserName,
  }) => {
    test.skip(!veil && browserName !== 'chromium', 'Без veil нужен SVG backdrop движок');
    if (!veil) {
      await page.evaluate(() => document.querySelector('#surface')?.removeAttribute('data-veil'));
    }
    const baseline = await snapshot(page);
    const app = await mount(page, 'document');
    const local = await mount(page, 'surface');
    await settle(page);
    if (veil) expect((await snapshot(page)).strips.length).toBeGreaterThan(0);
    await page.evaluate(() => window.__materialLifetime.connect(false));
    await settle(page);
    expect(await snapshot(page)).toEqual(baseline);
    await page.evaluate(() => window.__materialLifetime.connect(true));
    await settle(page);
    const reconnected = await snapshot(page);
    if (veil) expect(reconnected.strips.length).toBeGreaterThan(0);
    if (browserName === 'chromium') expect(reconnected.filters).toHaveLength(1);
    await dispose(page, app);
    await settle(page);
    expect(await snapshot(page)).toEqual(reconnected);
    await dispose(page, local);
    await settle(page);
    expect(await snapshot(page)).toEqual(baseline);
  });
}

test('общие эффекты держат по одному observer; поздний callback не планирует работу', async ({
  page,
  browserName,
}) => {
  await page.evaluate(() => {
    const NativeObserver = ResizeObserver;
    const requestFrame = requestAnimationFrame;
    const cancelFrame = cancelAnimationFrame;
    const active = new Set<ResizeObserver>();
    const retired = new Map<ResizeObserver, ResizeObserverCallback>();
    const frames = new Set<number>();
    let requests = 0;
    globalThis.requestAnimationFrame = (callback) => {
      requests++;
      const id = requestFrame((time) => {
        frames.delete(id);
        callback(time);
      });
      frames.add(id);
      return id;
    };
    globalThis.cancelAnimationFrame = (id) => {
      frames.delete(id);
      cancelFrame(id);
    };
    globalThis.ResizeObserver = class extends NativeObserver {
      private readonly targets = new Set<Element>();
      constructor(private readonly callback: ResizeObserverCallback) {
        super(callback);
      }
      override observe(target: Element, options?: ResizeObserverOptions): void {
        super.observe(target, options);
        this.targets.add(target);
        active.add(this);
        retired.delete(this);
      }
      override unobserve(target: Element): void {
        super.unobserve(target);
        this.targets.delete(target);
        if (this.targets.size === 0) active.delete(this);
      }
      override disconnect(): void {
        super.disconnect();
        this.targets.clear();
        active.delete(this);
        retired.set(this, this.callback);
      }
    };
    window.__materialObserverProbe = {
      active: () => active.size,
      pendingFrames: () => frames.size,
      deliverRetired: () => {
        const before = requests;
        // Инъекция задержанной доставки; реальные observe/disconnect выше сохранены.
        for (const [observer, callback] of retired) callback([], observer);
        return requests - before;
      },
    };
  });
  const baseline = await snapshot(page);
  const app = await mount(page, 'document');
  await settle(page);
  const observers = browserName === 'chromium' ? 2 : 1;
  expect(await page.evaluate(() => window.__materialObserverProbe.active())).toBe(observers);
  const local = await mount(page, 'surface');
  await settle(page);
  expect(await page.evaluate(() => window.__materialObserverProbe.active())).toBe(observers);
  await page.evaluate(() => window.__materialLifetime.mode('glass'));
  if (browserName === 'chromium') {
    await expect.poll(async () => (await snapshot(page)).backdrop).toContain('lab-lg-');
  }
  await settle(page);
  expect(await page.evaluate(() => window.__materialObserverProbe.active())).toBe(observers);
  await dispose(page, app);
  expect(await page.evaluate(() => window.__materialObserverProbe.active())).toBe(observers);
  await dispose(page, local);
  await settle(page);
  expect(await page.evaluate(() => window.__materialObserverProbe.active())).toBe(0);
  expect(await page.evaluate(() => window.__materialObserverProbe.pendingFrames())).toBe(0);
  expect(await page.evaluate(() => window.__materialObserverProbe.deliverRetired())).toBe(0);
  await settle(page);
  expect(await snapshot(page)).toEqual(baseline);
});
