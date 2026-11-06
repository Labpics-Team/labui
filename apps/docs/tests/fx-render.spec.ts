import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

// Standalone fx:render и Playwright используют один харнесс и разбор PNG.
// Браузерный гейт выполняется в e2e, отдельно от pnpm test.
import {
  GLOW_FAMILIES,
  GLOW_STEPS,
  SENTIMENTS,
  SKELETON_LAYERS,
  assertFxRender,
  buildHarnessHtml,
  decodePng,
  sampleRegion,
} from '../../../packages/colors/test/fx-render/fx-render.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const contractPath = join(repoRoot, 'packages', 'colors', 'contract.css');

interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Конечный CSS рендерится в самодостаточном харнессе. Свечение накапливается
 * одинаковыми слоями: DOM проверяет их состав, PNG — видимый результат.
 * Скриншот сохраняется в отчёте Playwright даже при нарушении пиксельного закона.
 */
test('FX-render: glow: накопленные слои non-blank+монотонны, focus-ring non-blank (пиксельный замер)', async ({
  page,
  browserName,
}) => {
  // Пороги screen-blend были калиброваны для Chromium. Их переносимость
  // на другие движки этим тестом не установлена.
  test.skip(browserName !== 'chromium', 'пиксельный screen-blend гейт калиброван под Chromium');
  const contractCss = readFileSync(contractPath, 'utf8');
  await page.setContent(buildHarnessHtml(contractCss), { waitUntil: 'load' });

  const boxes = new Map<string, BBox>();
  const grab = async (key: string) => {
    const b = await page.locator(`[data-swatch="${key}"]`).boundingBox();
    if (!b) throw new Error(`свотч не найден в DOM: ${key}`);
    boxes.set(key, b);
  };
  for (const family of GLOW_FAMILIES) {
    let firstLayerStyle: string | undefined;
    for (const [index, step] of GLOW_STEPS.entries()) {
      await grab(`${family}:${step}`);
      const layers = page.locator(`[data-glow-stack="${family}:${step}"] [data-glow-layer]`);
      expect(await layers.count()).toBe(index + 1);
      const renderedLayers = await layers.evaluateAll((elements) =>
        elements.map((element) => ({
          order: element.getAttribute('data-glow-layer'),
          background: getComputedStyle(element).backgroundImage,
          blend: getComputedStyle(element).mixBlendMode,
        })),
      );
      expect(renderedLayers.map((layer) => layer.order)).toEqual(
        Array.from({ length: index + 1 }, (_, n) => String(n + 1)),
      );
      firstLayerStyle ??= renderedLayers[0]?.background;
      expect(firstLayerStyle).toBeTruthy();
      for (const layer of renderedLayers) {
        expect(layer.background).toBe(firstLayerStyle);
        expect(layer.blend).toBe('screen');
      }
    }
  }
  for (const family of SENTIMENTS) await grab(`${family}:focus`);
  for (const layer of SKELETON_LAYERS) await grab(`skeleton:${layer}`);
  await grab('ref:backdrop');
  const box = (key: string): BBox => {
    const b = boxes.get(key);
    if (!b) throw new Error(`нет bbox: ${key}`);
    return b;
  };

  const png = await page.screenshot({ fullPage: true, animations: 'disabled' });

  const decoded = decodePng(png);
  const backdropL = sampleRegion(decoded, box('ref:backdrop')).L;
  const glow: Record<
    string,
    {
      single: ReturnType<typeof sampleRegion>;
      double: ReturnType<typeof sampleRegion>;
      triple: ReturnType<typeof sampleRegion>;
    }
  > = {};
  const focus: Record<string, ReturnType<typeof sampleRegion>> = {};
  for (const family of GLOW_FAMILIES) {
    glow[family] = {
      single: sampleRegion(decoded, box(`${family}:single`)),
      double: sampleRegion(decoded, box(`${family}:double`)),
      triple: sampleRegion(decoded, box(`${family}:triple`)),
    };
  }
  for (const family of SENTIMENTS) focus[family] = sampleRegion(decoded, box(`${family}:focus`));
  const skeleton = {
    base: sampleRegion(decoded, box('skeleton:base')),
    highlight: sampleRegion(decoded, box('skeleton:highlight')),
  };

  // Инварианты (кидает при нарушении). Прикрепляем скриншот к отчёту Playwright.
  await test.info().attach('fx-render', { body: png, contentType: 'image/png' });
  expect(() => assertFxRender({ backdropL, glow, focus, skeleton })).not.toThrow();
});
