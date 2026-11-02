import { type Locator, type Page, expect, test } from '@playwright/test';

/**
 * Полосы с периодом 16px должны исчезнуть под blur(48px). Oracle не использует
 * цветовую математику материалов: сравнивает соседние полупериоды реальных пикселей.
 * Цветной сигнал отличает потерю blur от одного лишь изменения яркости/насыщенности.
 * Среднее 64 строк гасит зерно; 3 байта — предел остаточного рисунка, 8 байт —
 * обязательный видимый сигнал без фильтра. Дополнительно требуется подавление ≥80%.
 */
async function stripeSignal(page: Page, png: Buffer): Promise<number> {
  return page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Нет canvas 2d');
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, image.width, image.height).data;
    const columns = Array.from({ length: image.width }, () => [0, 0, 0]);
    for (let x = 0; x < image.width; x++) {
      for (let y = 0; y < image.height; y++) {
        for (let c = 0; c < 3; c++) {
          const column = columns[x];
          if (column)
            column[c] =
              (column[c] ?? 0) + (pixels[(y * image.width + x) * 4 + c] ?? 0) / image.height;
        }
      }
    }
    let difference = 0;
    for (let x = 0; x < image.width - 8; x++) {
      for (let c = 0; c < 3; c++) {
        difference += Math.abs((columns[x]?.[c] ?? 0) - (columns[x + 8]?.[c] ?? 0));
      }
    }
    return difference / ((image.width - 8) * 3);
  }, png.toString('base64'));
}

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

async function filterValue(surface: Locator): Promise<string> {
  return surface.evaluate((element) => getComputedStyle(element).backdropFilter);
}

for (const renderer of ['core', 'react'] as const) {
  for (const theme of ['light', 'dark'] as const) {
    test(`${renderer} ${theme}: Card размывает внешний фон и сохраняет scroll-контейнер`, async ({
      page,
      browserName,
    }, testInfo) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(String(error)));
      await page.goto('/_fixtures/card-backdrop.html');
      await page.evaluate((value) => {
        document.documentElement.dataset.theme = value;
      }, theme);
      const card = page.locator(renderer === 'core' ? '#core-card article' : '#react-card');
      const surface = page.locator(
        renderer === 'core' ? '#core-card [part="content"]' : '#react-card .lab-card-content',
      );
      await expect(surface).toBeVisible();
      await expect
        .poll(() => filterValue(surface))
        .toContain(browserName === 'chromium' ? 'url(' : 'blur(');
      await page.evaluate(() => document.fonts.ready);
      const originalStyle = await surface.getAttribute('style');
      const box = await surface.boundingBox();
      if (!box) throw new Error('Нет геометрии Content');
      expect(box.width).toBeGreaterThan(256);
      expect(box.height).toBeGreaterThan(128);
      const clip = {
        x: Math.round(box.x + box.width / 2 - 64),
        y: Math.round(box.y + box.height / 2 - 32),
        width: 128,
        height: 64,
      };
      const capture = () => page.screenshot({ clip, animations: 'disabled', scale: 'css' });
      const restore = () =>
        surface.evaluate((element, value) => {
          if (value === null) element.removeAttribute('style');
          else element.setAttribute('style', value);
        }, originalStyle);
      // Chromium проверяет и SVG runtime, и штатный CSS-рецепт; WebKit — свою CSS-ветку.
      for (const path of browserName === 'chromium' ? ['runtime', 'css'] : ['css']) {
        await restore();
        if (path === 'css') {
          await surface.evaluate((element) => {
            (element as HTMLElement).style.removeProperty('backdrop-filter');
            (element as HTMLElement).style.removeProperty('-webkit-backdrop-filter');
          });
        }
        await expect
          .poll(() => filterValue(surface))
          .toContain(path === 'runtime' ? 'url(' : 'blur(');
        const enabledStyle = await surface.getAttribute('style');
        await settle(page);
        const enabled = await capture();
        await surface.evaluate((element) => {
          (element as HTMLElement).style.setProperty('backdrop-filter', 'none', 'important');
          (element as HTMLElement).style.setProperty(
            '-webkit-backdrop-filter',
            'none',
            'important',
          );
        });
        await expect.poll(() => filterValue(surface)).toBe('none');
        await settle(page);
        const disabled = await capture();
        const on = await stripeSignal(page, enabled);
        const off = await stripeSignal(page, disabled);
        await testInfo.attach(`${path}-signal`, {
          body: JSON.stringify({ on, off, clip }),
          contentType: 'application/json',
        });
        await testInfo.attach(`${path}-on`, { body: enabled, contentType: 'image/png' });
        await testInfo.attach(`${path}-off`, { body: disabled, contentType: 'image/png' });
        expect(off, `${path}: рисунок действительно виден без фильтра`).toBeGreaterThan(8);
        expect(on, `${path}: мелкий рисунок подавлен`).toBeLessThan(3);
        expect(on, `${path}: пространственное подавление ≥80%`).toBeLessThan(off * 0.2);
        await surface.evaluate((element, value) => {
          if (value === null) element.removeAttribute('style');
          else element.setAttribute('style', value);
        }, enabledStyle);
        await settle(page);
        expect((await capture()).equals(enabled), `${path}: точное восстановление пикселей`).toBe(
          true,
        );
        expect(await surface.boundingBox()).toEqual(box);
        await expect(card).toHaveCSS('overflow-x', 'auto');
        await expect(card).toHaveCSS('overflow-y', 'auto');
      }
      await restore();
      expect(errors).toEqual([]);
    });
  }
}
