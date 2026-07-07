import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

// Разделяемый чистый гейт (тот же код кормит standalone `pnpm --filter
// @labui/colors fx:render`): харнесс + PNG-декодер + инварианты. Спека даёт
// CI-воспроизводимость — гейт живёт в e2e-джобе (у `pnpm test` браузеров нет).
import {
  GLOW_STEPS,
  SENTIMENTS,
  SKELETON_LAYERS,
  assertFxRender,
  buildHarnessHtml,
  decodePng,
  sampleRegion,
} from '../../../packages/colors/test/fx-render/fx-gate.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const contractPath = join(repoRoot, 'packages', 'colors-stub', 'contract.css');

interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * FX-render: рендер эмитированных PR #93 FX-токенов и ОБЪЕКТИВНАЯ проверка по
 * ПИКСЕЛЯМ (не CSS-alpha, не canvas). Замер считается ЗДЕСЬ, на лету — ничего не
 * читается из репозитория. PNG кладём в отчёт Playwright через attach() (его CI
 * отдаёт как artifact workflow), а НЕ пишем в дерево — бинарь в git недопустим.
 * setContent, а не docs-сервер: харнесс самодостаточен (inline-контракт).
 */
test('FX-render: glow 6 сентиментов non-blank+монотонны, focus-ring non-blank (пиксельный замер)', async ({
  page,
  browserName,
}) => {
  // Гейт КАЛИБРОВАН под Chromium: абсолютные пиксельные пороги замеряют
  // mix-blend-mode:screen + color-mix(in srgb, … calc()) — WebKit композитит их
  // иначе (glow-свотчи выходят ТЕМНЕЕ фона, дельты отрицательны), потому пороги
  // не переносятся. Это НЕ регресс скелетона: glow-инварианты #99 равно провалены
  // на WebKit и до этой волны (спека шла лишь в e2e-full, не в per-PR smoke).
  // Кросс-движковую корректность держит materials-flag.spec (backdrop-filter),
  // а не этот luminance-гейт. Не маскировка — верное сужение области замера.
  test.skip(browserName !== 'chromium', 'пиксельный screen-blend гейт калиброван под Chromium');
  const contractCss = readFileSync(contractPath, 'utf8');
  await page.setContent(buildHarnessHtml(contractCss), { waitUntil: 'load' });

  const boxes = new Map<string, BBox>();
  const grab = async (key: string) => {
    const b = await page.locator(`[data-swatch="${key}"]`).boundingBox();
    if (!b) throw new Error(`свотч не найден в DOM: ${key}`);
    boxes.set(key, b);
  };
  for (const s of SENTIMENTS) {
    for (const step of GLOW_STEPS) await grab(`${s}:${step}`);
    await grab(`${s}:focus`);
  }
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
      subtle: ReturnType<typeof sampleRegion>;
      base: ReturnType<typeof sampleRegion>;
      bloom: ReturnType<typeof sampleRegion>;
    }
  > = {};
  const focus: Record<string, ReturnType<typeof sampleRegion>> = {};
  for (const s of SENTIMENTS) {
    glow[s] = {
      subtle: sampleRegion(decoded, box(`${s}:subtle`)),
      base: sampleRegion(decoded, box(`${s}:base`)),
      bloom: sampleRegion(decoded, box(`${s}:bloom`)),
    };
    focus[s] = sampleRegion(decoded, box(`${s}:focus`));
  }
  const skeleton = {
    base: sampleRegion(decoded, box('skeleton:base')),
    highlight: sampleRegion(decoded, box('skeleton:highlight')),
  };

  // Инварианты (кидает при нарушении). Прикрепляем скриншот к отчёту Playwright.
  expect(() => assertFxRender({ backdropL, glow, focus, skeleton })).not.toThrow();
  await test.info().attach('fx-render', { body: png, contentType: 'image/png' });
});
