import { type Page, expect, test } from '@playwright/test';
import type { ContextScope } from '../src/_fixtures/material-context';

// Сравниваем PNG одного и того же участка: computed url() ещё не доказывает paint.
async function raster(page: Page, index: number): Promise<number[]> {
  const { rect } = await page.evaluate((i) => window.__materialContext.snapshot(i), index);
  const png = await page.screenshot({ clip: rect, animations: 'disabled' });
  return page.evaluate(async (data) => {
    const image = new Image();
    image.src = `data:image/png;base64,${data}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Нет 2D-контекста');
    context.drawImage(image, 0, 0);
    // Обходим border-radius, сохраняя край линзы и большую центральную область.
    return Array.from(context.getImageData(20, 20, image.width - 40, image.height - 40).data);
  }, png.toString('base64'));
}

function difference(a: number[], b: number[]): number {
  expect(a.length).toBe(b.length);
  return a.reduce((sum, value, index) => sum + Math.abs(value - (b[index] ?? 0)), 0) / a.length;
}

async function load(page: Page, scope: ContextScope, mode = 'acrylic'): Promise<void> {
  await page.goto(`/_fixtures/material-context.html?scope=${scope}&mode=${mode}`);
  await page.waitForFunction(() => !!window.__materialContext);
}

async function mount(page: Page): Promise<void> {
  await page.evaluate(() => window.__materialContext.mount());
  for (const index of [0, 1]) {
    await expect
      .poll(() => page.evaluate((i) => window.__materialContext.snapshot(i).backdrop, index))
      .toContain('url(');
  }
  await page.evaluate(() => window.__materialContext.settle());
}

test.beforeEach(({ browserName }) => {
  test.skip(browserName !== 'chromium', 'SVG backdrop runtime заявлен для Chromium');
});

for (const scope of ['light', 'open', 'closed'] as const) {
  test(`acrylic: собственные цвета поверхности в ${scope} DOM`, async ({ page }) => {
    await load(page, scope);
    const plain = await raster(page, 0);
    await mount(page);
    const bright = await raster(page, 0);
    const dark = await raster(page, 1);
    expect(
      difference(bright, plain),
      'положительный контроль: фильтр меняет реальные пиксели',
    ).toBeGreaterThan(20);
    expect(
      difference(bright, dark),
      'две поверхности используют разные локальные токены',
    ).toBeGreaterThan(50);

    await page.evaluate(() => window.__materialContext.ancestorToken('rgb(255 255 255)'));
    await page.evaluate(() => window.__materialContext.settle());
    expect(
      difference(await raster(page, 0), bright),
      'родитель не перекрашивает закреплённый локальный цвет',
    ).toBeLessThan(1);
    await page.evaluate(() => window.__materialContext.token(0, 'rgb(30 30 30)'));
    await page.evaluate(() => window.__materialContext.settle());
    expect(
      difference(await raster(page, 0), dark),
      'токен поверхности живо доходит до фильтра без remount',
    ).toBeLessThan(1);
  });
}

for (const mode of ['acrylic', 'glass'] as const) {
  test(`${mode}: фильтр переносится между деревьями, release сохраняет соседнюю поверхность`, async ({
    page,
  }) => {
    await load(page, 'light', mode);
    const plain = await raster(page, 0);
    await mount(page);
    const live = await raster(page, 0);
    const neighbor = await raster(page, 1);
    expect(difference(live, plain), 'здоровый light DOM control: эффект виден').toBeGreaterThan(2);

    for (const scope of ['open', 'closed', 'light'] as const) {
      await page.evaluate((scope) => window.__materialContext.move(0, scope), scope);
      await page.evaluate(() => window.__materialContext.settle());
      expect(
        difference(await raster(page, 0), live),
        `paint сохранён после переноса в ${scope}`,
      ).toBeLessThan(1);
    }
    await page.evaluate(() => window.__materialContext.dispose(0));
    await page.evaluate(() => window.__materialContext.settle());
    expect(difference(await raster(page, 0), plain)).toBeLessThan(1);
    expect(
      difference(await raster(page, 1), neighbor),
      'release не удаляет чужой фильтр',
    ).toBeLessThan(1);
    expect(await page.evaluate(() => window.__materialContext.snapshot(0).ownedSvg)).toBe(0);
    await page.evaluate(() => window.__materialContext.dispose(0));
    expect(difference(await raster(page, 1), neighbor)).toBeLessThan(1);
  });

  for (const operation of ['textContent', 'replaceChildren'] as const) {
    test(`${mode}: обновление содержимого через ${operation} сохраняет материал`, async ({
      page,
    }) => {
      await load(page, 'closed', mode);
      const plain = await raster(page, 0);
      await mount(page);
      const live = await raster(page, 0);
      const neighbor = await raster(page, 1);
      const backdrop = await page.evaluate(() => window.__materialContext.snapshot(0).backdrop);
      expect(difference(live, plain), 'положительный контроль: материал виден').toBeGreaterThan(2);

      for (let i = 0; i < 2; i++) {
        await page.evaluate(
          (operation) => window.__materialContext.replaceContent(0, operation),
          operation,
        );
        await page.evaluate(() => window.__materialContext.settle());
        expect(
          difference(await raster(page, 0), live),
          'содержимое обновилось, эффект сохранился',
        ).toBeLessThan(1);
        expect(
          await page.evaluate(() => window.__materialContext.snapshot(0).backdrop),
          'фильтр не пересоздаётся',
        ).toBe(backdrop);
        expect(
          difference(await raster(page, 1), neighbor),
          'соседняя поверхность не затронута',
        ).toBeLessThan(1);
      }

      await page.evaluate(() => window.__materialContext.dispose(0));
      await page.evaluate(
        (operation) => window.__materialContext.replaceContent(0, operation),
        operation,
      );
      await page.evaluate(() => window.__materialContext.settle());
      expect(
        difference(await raster(page, 0), plain),
        'после release DOM-update не оживляет эффект',
      ).toBeLessThan(1);
      expect(await page.evaluate(() => window.__materialContext.snapshot(0))).toMatchObject({
        backdrop: 'none',
        ownedSvg: 0,
      });
      expect(difference(await raster(page, 1), neighbor)).toBeLessThan(1);
      await page.evaluate(() => window.__materialContext.dispose(1));
      expect(await page.evaluate(() => window.__materialContext.snapshot(1).ownedSvg)).toBe(0);
    });
  }
}
