import {
  type MaterialPaints,
  materialBlendMode,
  materialPaintOver,
  materialProfile,
} from '@labpics/ui-materials';
import { type Locator, type Page, expect, test } from '@playwright/test';
import { normalizeCssColor } from './support/color.js';

function readBackdropFilter(page: Page, testId: string): Promise<string> {
  return page.getByTestId(testId).evaluate((el) => {
    const cs = getComputedStyle(el);
    const std = cs.backdropFilter;
    const webkit = (cs as unknown as Record<string, string>).webkitBackdropFilter;
    for (const value of [std, webkit]) {
      if (value && value !== 'none') return value;
    }
    return 'none';
  });
}

/** Средние каналы усреднённого центрального патча РЕАЛЬНЫХ пикселей панели
 *  (24×24: гасит зерно ~2%, обходит рим и текст). */
async function patchColor(
  page: Page,
  panel: Locator,
): Promise<{ r: number; g: number; b: number }> {
  const b64 = (await panel.screenshot()).toString('base64');
  return page.evaluate(async (data) => {
    const img = new Image();
    img.src = `data:image/png;base64,${data}`;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('no 2d context');
    ctx.drawImage(img, 0, 0);
    const w = 24;
    const h = 24;
    const x = Math.floor(img.width / 2 - w / 2);
    const y = Math.floor(img.height * 0.65);
    const d = ctx.getImageData(x, y, w, h).data;
    let r = 0;
    let g = 0;
    let b = 0;
    for (let i = 0; i < d.length; i += 4) {
      r += d[i] ?? 0;
      g += d[i + 1] ?? 0;
      b += d[i + 2] ?? 0;
    }
    const n = d.length / 4;
    return { r: r / n, g: g / n, b: b / n };
  }, b64);
}

async function readPaints(page: Page): Promise<MaterialPaints> {
  const values = await page.getByTestId('surface-on-black').evaluate((el) => {
    const cs = getComputedStyle(el);
    return [
      cs.getPropertyValue('--_tint'),
      cs.getPropertyValue('--_blend'),
      el.getAttribute('data-lab-material-theme'),
    ];
  });
  const normal = await normalizeCssColor(page, values[0] ?? '');
  const blend = await normalizeCssColor(page, values[1] ?? '');
  if (!normal || !blend) throw new Error('Missing material paint roles');
  return { normal, blend, blendMode: materialBlendMode(values[2] === 'dark' ? 'dark' : 'light') };
}

test.beforeEach(async ({ page }) => {
  await page.goto('/_fixtures/acrylic-live.html');
  await expect(page.getByTestId('live-status')).toContainText('runtime: mounted');
});

test.describe('author paints in the backdrop renderer', () => {
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'SVG backdrop transfer is currently supported by Chromium',
  );

  for (const theme of ['light', 'dark'] as const) {
    test(`${theme}: rendered RGB follows both author paints over black, blue and white`, async ({
      page,
    }) => {
      await page
        .locator('html')
        .evaluate((el, theme) => el.setAttribute('data-theme', theme), theme);
      await expect(page.getByTestId('surface-on-black')).toHaveAttribute(
        'data-lab-material-theme',
        theme,
      );
      const paints = await readPaints(page);
      const noise = {
        r: materialProfile.noise.color[0] ?? 0,
        g: materialProfile.noise.color[1] ?? 0,
        b: materialProfile.noise.color[2] ?? 0,
        a: materialProfile.noise.opacity,
      };
      for (const [name, backdrop] of [
        ['black', { r: 0, g: 0, b: 0, a: 1 }],
        ['blue', { r: 0, g: 0, b: 255, a: 1 }],
        ['white', { r: 255, g: 255, b: 255, a: 1 }],
      ] as const) {
        await expect
          .poll(() => readBackdropFilter(page, `surface-on-${name}`))
          .toContain('lab-material-paint-');
        const pixel = await patchColor(page, page.getByTestId(`surface-on-${name}`));
        const endpoints = [
          materialPaintOver(paints, backdrop),
          materialPaintOver(paints, {
            r: backdrop.r + ((255 - backdrop.r) * noise.r * noise.a) / 255,
            g: backdrop.g + ((255 - backdrop.g) * noise.g * noise.a) / 255,
            b: backdrop.b + ((255 - backdrop.b) * noise.b * noise.a) / 255,
            a: 1,
          }),
        ];
        for (const key of ['r', 'g', 'b'] as const) {
          const low = Math.min(...endpoints.map((value) => value[key]));
          const high = Math.max(...endpoints.map((value) => value[key]));
          // This uniform-field pixel test includes baked grain and compositor
          // quantisation. It does not claim a maximum full-image Figma error.
          expect(pixel[key], `${name}/${key}`).toBeGreaterThanOrEqual(low - 2);
          expect(pixel[key], `${name}/${key}`).toBeLessThanOrEqual(high + 2);
        }
      }
    });
  }

  test('mode flips, media changes and final disposal release paint filters', async ({ page }) => {
    const count = () => page.locator('.lab-material-paint-defs filter').count();
    await expect.poll(count).toBe(1);
    for (let i = 0; i < 8; i++) {
      await page.locator('html').evaluate((el) => el.setAttribute('data-material', 'solid'));
      await expect.poll(count).toBe(0);
      await page.locator('html').evaluate((el) => el.setAttribute('data-material', 'acrylic'));
      await expect.poll(count).toBe(1);
    }
    await page.emulateMedia({ forcedColors: 'active' });
    await expect.poll(count).toBe(0);
    await expect(page.getByTestId('surface-on-black')).toHaveCSS('backdrop-filter', 'none');
    await page.emulateMedia({ forcedColors: 'none' });
    await expect.poll(count).toBe(1);
    await page.evaluate(() => window.__labAcrylicLive?.dispose());
    await expect(page.locator('.lab-material-paint-defs')).toHaveCount(0);
  });

  test('theme changes replace the shared transfer and update the actual pixels', async ({
    page,
  }) => {
    const panel = page.getByTestId('surface-on-black');
    const before = await patchColor(page, panel);
    const ids = await page
      .locator('.lab-material-paint-defs filter')
      .evaluateAll((els) => els.map((el) => el.id));
    await page.locator('html').evaluate((el) => el.setAttribute('data-theme', 'dark'));
    await expect.poll(async () => (await patchColor(page, panel)).r).toBeLessThan(before.r - 50);
    expect(
      await page
        .locator('.lab-material-paint-defs filter')
        .evaluateAll((els) => els.map((el) => el.id)),
    ).not.toEqual(ids);
    await expect(page.locator('.lab-material-paint-defs filter')).toHaveCount(1);
  });

  test('Screen grain does not darken a white backdrop', async ({ page }) => {
    const panel = page.getByTestId('surface-on-white');
    const paintFilter = () =>
      panel.evaluate((el) => el.style.getPropertyValue('--_material-paint-filter'));
    const before = await paintFilter();
    await panel.evaluate((el) => {
      el.style.setProperty('--_tint', 'rgb(0 0 0 / 0)');
      el.style.setProperty('--_blend', 'rgb(0 0 0 / 0)');
    });
    await expect.poll(paintFilter).not.toBe(before);
    await expect
      .poll(async () => Math.min(...Object.values(await patchColor(page, panel))))
      .toBeGreaterThanOrEqual(254.5);
  });
});
