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

async function comparePixels(page: Page, first: Buffer, second: Buffer) {
  return page.evaluate(
    async ([left, right]) => {
      const decode = async (base64: string) => {
        const image = new Image();
        image.src = `data:image/png;base64,${base64}`;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) throw new Error('Нет canvas 2d');
        context.drawImage(image, 0, 0);
        return context.getImageData(0, 0, image.width, image.height).data;
      };
      const [a, b] = await Promise.all([decode(left ?? ''), decode(right ?? '')]);
      if (a.length !== b.length) throw new Error('Размеры снимков различаются');
      let absolute = 0;
      const signed = [0, 0, 0];
      for (let i = 0; i < a.length; i += 4) {
        for (let c = 0; c < 3; c++) {
          const delta = (a[i + c] ?? 0) - (b[i + c] ?? 0);
          absolute += Math.abs(delta);
          signed[c] = (signed[c] ?? 0) + delta;
        }
      }
      const count = (a.length / 4) * 3;
      return {
        mae: absolute / count,
        meanDifference: signed.reduce((sum, value) => sum + Math.abs(value), 0) / count,
      };
    },
    [first.toString('base64'), second.toString('base64')],
  );
}

async function setFilter(surface: Locator, value: string): Promise<void> {
  await surface.evaluate((element, filter) => {
    (element as HTMLElement).style.setProperty('backdrop-filter', filter, 'important');
    (element as HTMLElement).style.setProperty('-webkit-backdrop-filter', filter, 'important');
  }, value);
}

for (const renderer of ['core', 'react'] as const) {
  for (const theme of ['light', 'dark'] as const) {
    for (const material of ['acrylic', 'glass', 'solid'] as const) {
      test(`${renderer} ${theme} ${material}: imageSrc обрабатывается под Content и остаётся чётким сверху`, async ({
        page,
        browserName,
      }, testInfo) => {
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(String(error)));
        const paths =
          material === 'solid'
            ? ['native']
            : browserName === 'chromium'
              ? ['runtime', 'css']
              : ['css'];
        for (const path of paths) {
          if (path === 'css') {
            // В новом документе Card сама выбирает штатный fallback без SVG url.
            await page.addInitScript(() => {
              const supports = CSS.supports.bind(CSS);
              CSS.supports = (property: string, value?: string): boolean => {
                if (
                  (property === 'backdrop-filter' || property === '-webkit-backdrop-filter') &&
                  value === 'url(#x)'
                )
                  return false;
                return value === undefined ? supports(property) : supports(property, value);
              };
            });
          }
          await page.goto(
            `/_fixtures/card-backdrop.html?image=1&material=${material}&theme=${theme}`,
          );
          await expect(page.locator('html')).toHaveAttribute('data-image-ready', 'true');
          const card = page.locator(renderer === 'core' ? '#core-card article' : '#react-card');
          const surface = page.locator(
            renderer === 'core' ? '#core-card [part="content"]' : '#react-card .lab-card-content',
          );
          const front = page.locator(
            renderer === 'core' ? '#core-card img.image' : '#react-card .lab-card-image',
          );
          await expect(surface).toBeVisible();
          if (material !== 'solid')
            await expect
              .poll(() => filterValue(surface))
              .toContain(path === 'runtime' ? 'url(' : 'blur(');
          await page.evaluate(() => document.fonts.ready);
          await settle(page);
          const box = await surface.boundingBox();
          const imageBox = await front.boundingBox();
          if (!box || !imageBox) throw new Error('Нет геометрии изображения/Content');
          expect(box.width).toBe(384);
          expect(box.height).toBeGreaterThan(128);
          expect(imageBox.width).toBe(384);
          expect(imageBox.height).toBeGreaterThan(64);
          const center = {
            x: Math.round(box.x + box.width / 2 - 64),
            y: Math.round(box.y + box.height / 2 - 32),
            width: 128,
            height: 64,
          };
          const upper = {
            x: Math.round(imageBox.x + imageBox.width / 2 - 64),
            y: Math.round(imageBox.y + imageBox.height / 2 - 32),
            width: 128,
            height: 64,
          };
          const edge = { x: Math.round(box.x + 8), y: center.y, width: 24, height: 64 };
          const capture = (clip: typeof center) =>
            page.screenshot({ clip, animations: 'disabled', scale: 'css' });
          const enabledStyle = await surface.getAttribute('style');
          const enabledFilter = await filterValue(surface);
          const restore = async () => {
            await surface.evaluate((element, style) => {
              if (style === null) element.removeAttribute('style');
              else element.setAttribute('style', style);
            }, enabledStyle);
            await settle(page);
          };
          const contentA = await capture(center);
          const frontA = await capture(upper);
          const frontSignalA = await stripeSignal(page, frontA);
          const signalA = await stripeSignal(page, contentA);
          await testInfo.attach(`${path}-A-content`, { body: contentA, contentType: 'image/png' });
          await testInfo.attach(`${path}-A-front`, { body: frontA, contentType: 'image/png' });
          expect(frontSignalA, `${path}: переднее A сохраняет мелкие полосы`).toBeGreaterThan(80);

          if (material !== 'solid') {
            await setFilter(surface, 'none');
            await expect.poll(() => filterValue(surface)).toBe('none');
            await settle(page);
            const disabled = await capture(center);
            const off = await stripeSignal(page, disabled);
            const unchangedFront = await capture(upper);
            await testInfo.attach(`${path}-off-content`, {
              body: disabled,
              contentType: 'image/png',
            });
            await testInfo.attach(`${path}-spatial`, {
              body: JSON.stringify({
                on: signalA,
                off,
                frontSignalA,
                filter: enabledFilter,
                center,
                edge,
                upper,
              }),
              contentType: 'application/json',
            });
            expect(
              unchangedFront.equals(frontA),
              `${path}: фильтр Content не затрагивает front`,
            ).toBe(true);
            expect(off, `${path}: без фильтра виден мелкий рисунок underlay`).toBeGreaterThan(8);
            if (material === 'glass' && path === 'runtime') {
              expect(signalA, 'Мягкий frost сохраняет структуру в центре Glass').toBeGreaterThan(
                off * 0.05,
              );
              expect(signalA, 'Мягкий frost ослабляет мелкий рисунок').toBeLessThan(off * 0.75);
            } else {
              expect(signalA, `${path}: diffuse материал подавляет мелкий рисунок`).toBeLessThan(3);
              expect(signalA, `${path}: пространственное подавление ≥80%`).toBeLessThan(off * 0.2);
            }
            await restore();
            expect(
              (await capture(center)).equals(contentA),
              `${path}: фильтр восстанавливает пиксели`,
            ).toBe(true);

            if (material === 'glass' && path === 'runtime') {
              const lensedEdge = await capture(edge);
              const withoutLens = enabledFilter.replace(/url\([^)]*\)\s*/g, '').trim();
              expect(withoutLens).not.toBe(enabledFilter);
              await setFilter(surface, withoutLens);
              await settle(page);
              const edgeOff = await capture(edge);
              const centerOff = await capture(center);
              const edgeDifference = await comparePixels(page, lensedEdge, edgeOff);
              const centerDifference = await comparePixels(page, contentA, centerOff);
              await testInfo.attach('runtime-lens-on', {
                body: lensedEdge,
                contentType: 'image/png',
              });
              await testInfo.attach('runtime-lens-off', {
                body: edgeOff,
                contentType: 'image/png',
              });
              await testInfo.attach('runtime-lens', {
                body: JSON.stringify({
                  edge: edgeDifference,
                  center: centerDifference,
                  withoutLens,
                }),
                contentType: 'application/json',
              });
              expect(edgeDifference.mae, 'Линза меняет изображение у края').toBeGreaterThan(0.5);
              expect(edgeDifference.mae, 'Смещение ослабевает к центру').toBeGreaterThan(
                centerDifference.mae * 2,
              );
              await restore();
            }
          }

          await page.evaluate(() => window.cardImageFixture.setImage('B'));
          await settle(page);
          const contentB = await capture(center);
          const frontB = await capture(upper);
          const frontSignalB = await stripeSignal(page, frontB);
          const response = await comparePixels(page, contentA, contentB);
          await testInfo.attach(`${path}-B-content`, { body: contentB, contentType: 'image/png' });
          await testInfo.attach(`${path}-B-front`, { body: frontB, contentType: 'image/png' });
          await testInfo.attach(`${path}-response`, {
            body: JSON.stringify({ response, frontSignalA, frontSignalB, material, path }),
            contentType: 'application/json',
          });
          expect(frontSignalB, `${path}: переднее B сохраняет мелкие полосы`).toBeGreaterThan(80);
          expect(frontB.equals(frontA), `${path}: imageSrc обновляет переднее изображение`).toBe(
            false,
          );
          if (material === 'solid')
            expect(contentB.equals(contentA), 'Solid закрывает подложку').toBe(true);
          else
            expect(
              response.meanDifference,
              `${path}: imageSrc обновляет обработанный Content`,
            ).toBeGreaterThan(3);
          expect(await surface.boundingBox()).toEqual(box);
          expect(await front.boundingBox()).toEqual(imageBox);
          await expect(card).toHaveCSS('overflow-x', 'auto');
          await expect(card).toHaveCSS('overflow-y', 'auto');
        }
        expect(errors).toEqual([]);
      });
    }
  }
}
