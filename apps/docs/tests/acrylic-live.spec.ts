import {
  ACRYLIC_LUMINOSITY_OPACITY,
  FULL_BACKDROP,
  acrylicCorridor,
  bandOverCorridor,
  compositeOver,
  luminosityBlend,
} from '@labpics/ui-materials';
import { type Locator, type Page, expect, test } from '@playwright/test';
import { normalizeCssColor } from './support/color.js';

/*
 * Acrylic v2 LIVE — браузерный дифференциал luminosity-зажима (ADR-0009).
 *
 * Полигон (`acrylic-live.html`): два экстремальных поля фона (чистый чёрный /
 * чистый белый — углы коридора гарантии) и SOFT-панель над каждым; рантайм
 * смонтирован. Спек доказывает НА РЕАЛЬНЫХ ПИКСЕЛЯХ композитора:
 *   1. Движок держит поверхность: computed backdrop-filter = url(#lab-acrylic-…).
 *   2. Дифференциал вывода: WCAG-люминанс фактических пикселей обеих панелей
 *      лежит в полосе, ВЫЧИСЛЕННОЙ из живого тинт-токена страницы через
 *      acrylicCorridor/bandOverCorridor — симуляция и композитор сходятся.
 *   3. Зажим сужает: разброс |Y_white − Y_black| под движком строго уже, чем
 *      у CSS-фолбэка (A/B на одной странице через window.__labAcrylicLive).
 *   4. Тема живая: flood-color фильтра — var() контракта, флип data-theme
 *      перекрашивает без пере-монтирования.
 *   5. Честная деградация: forced-colors гасит движок (инлайн снят сам).
 * WebKit-ветка закрепляет фолбэк-истину (v1: blur+saturate, никакого url()).
 *
 * Цвет токена нормализует БРАУЗЕР (support/color, oklch-safe); пиксели читаются
 * скриншотом панели → canvas.getImageData с усреднением центрального патча
 * (24×24: гасит зерно ~2% и обходит рим/текст). Допуск полосы 0.03 по Y —
 * зерно (±0.005 после усреднения) + байт-раунды браузера; полоса сама по себе
 * на порядок шире допуска.
 */

const BAND_EPS = 0.03;

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

function wcagLuminance(c: { r: number; g: number; b: number }): number {
  const lin = (ch: number): number => {
    const s = ch / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
}

async function patchLuminance(page: Page, panel: Locator): Promise<number> {
  return wcagLuminance(await patchColor(page, panel));
}

/** Евклидова дистанция средних каналов, в байтах. */
function channelDistance(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number },
): number {
  return Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
}

/** Живой SOFT-тинт страницы (тот же токен, что ест flood фильтра). */
async function readSoftTint(page: Page): Promise<{ r: number; g: number; b: number; a: number }> {
  const raw = await page
    .getByTestId('surface-on-black')
    .evaluate((el) => getComputedStyle(el).getPropertyValue('--lab-bg-material-soft-01').trim());
  const tint = await normalizeCssColor(page, raw);
  expect(tint, `--lab-bg-material-soft-01 "${raw}" must normalise to sRGB`).not.toBeNull();
  if (!tint) throw new Error('unreachable');
  return tint;
}

test.beforeEach(async ({ page }) => {
  await page.goto('/acrylic-live.html');
  await page.addStyleTag({
    content: '*,*::before,*::after{transition:none!important;animation:none!important}',
  });
  await expect(page.getByTestId('live-status')).toContainText('runtime: mounted');
});

test.describe('acrylic v2 — движок (Chromium)', () => {
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'luminosity-конвейер рисует только Chromium; WebKit-истина — фолбэк-ветка ниже',
  );

  test('движок держит обе панели url()-конвейером, зерно остаётся', async ({ page }) => {
    for (const id of ['surface-on-black', 'surface-on-white']) {
      await expect
        .poll(() => readBackdropFilter(page, id), { message: `${id}: инлайн-конвейер движка` })
        .toContain('lab-acrylic-');
      const bg = await page.getByTestId(id).evaluate((el) => getComputedStyle(el).backgroundImage);
      expect(bg, `${id}: слой зерна не тронут движком`).toContain('data:image/png');
    }
  });

  test('per-surface фильтр НЕ течёт: счётчик <filter> стабилен через N mode-флипов', async ({
    page,
  }) => {
    // Класс-замок утечки. Прежняя модель (5 статичных tier-фильтров) делала
    // leak структурно невозможным; per-surface модель полагается на
    // destroy()→filter.remove(). Если detach пропустит удаление, узлы копятся —
    // этот тест ловит класс. RED-proof: без filter.remove() в destroy счётчик
    // растёт с каждым флипом и тест падает.
    const filterCount = (): Promise<number> =>
      page.evaluate(() => document.querySelectorAll('svg.lab-acrylic-defs filter').length);

    await expect.poll(() => readBackdropFilter(page, 'surface-on-black')).toContain('lab-acrylic-');
    const baseline = await filterCount();
    expect(baseline, 'по одному фильтру на acrylic-панель фикстуры').toBeGreaterThan(0);

    for (let i = 0; i < 8; i++) {
      await page.evaluate(() => document.documentElement.setAttribute('data-material', 'solid'));
      await expect
        .poll(() => readBackdropFilter(page, 'surface-on-black'))
        .not.toContain('lab-acrylic');
      await page.evaluate(() => document.documentElement.setAttribute('data-material', 'acrylic'));
      await expect
        .poll(() => readBackdropFilter(page, 'surface-on-black'))
        .toContain('lab-acrylic-');
    }

    // detach удалил старые фильтры перед каждым новым attach → счётчик вернулся
    // к базовому, а не вырос на 8× панелей.
    expect(await filterCount(), 'узлы <filter> не копятся через флипы').toBe(baseline);
  });

  test('дифференциал: пиксели в выведенной полосе; зажим уже фолбэка', async ({ page }) => {
    const tint = await readSoftTint(page);
    const engineBand = bandOverCorridor(tint, acrylicCorridor(tint, ACRYLIC_LUMINOSITY_OPACITY));
    const fallbackBand = bandOverCorridor(tint, FULL_BACKDROP);

    const onBlack = page.getByTestId('surface-on-black');
    const onWhite = page.getByTestId('surface-on-white');

    const yBlackEngine = await patchLuminance(page, onBlack);
    const yWhiteEngine = await patchLuminance(page, onWhite);
    const yBlueEngine = await patchLuminance(page, page.getByTestId('surface-on-blue'));

    for (const [name, y] of [
      ['black', yBlackEngine],
      ['white', yWhiteEngine],
      ['blue', yBlueEngine],
    ] as const) {
      expect(y, `движок/${name}: Y внутри выведенной полосы`).toBeGreaterThanOrEqual(
        engineBand.effLow - BAND_EPS,
      );
      expect(y, `движок/${name}: Y внутри выведенной полосы`).toBeLessThanOrEqual(
        engineBand.effHigh + BAND_EPS,
      );
    }

    // A/B: снять рантайм → CSS-фолбэк v1 на тех же панелях.
    await page.evaluate(() =>
      (window as { __labAcrylicLive?: { dispose(): void } }).__labAcrylicLive?.dispose(),
    );
    await expect
      .poll(() => readBackdropFilter(page, 'surface-on-black'))
      .not.toContain('lab-acrylic');

    const yBlackFallback = await patchLuminance(page, onBlack);
    const yWhiteFallback = await patchLuminance(page, onWhite);

    for (const [name, y] of [
      ['black', yBlackFallback],
      ['white', yWhiteFallback],
    ] as const) {
      expect(y, `фолбэк/${name}: Y внутри полной полосы`).toBeGreaterThanOrEqual(
        fallbackBand.effLow - BAND_EPS,
      );
      expect(y, `фолбэк/${name}: Y внутри полной полосы`).toBeLessThanOrEqual(
        fallbackBand.effHigh + BAND_EPS,
      );
    }

    const engineSpread = Math.abs(yWhiteEngine - yBlackEngine);
    const fallbackSpread = Math.abs(yWhiteFallback - yBlackFallback);
    expect(
      engineSpread,
      `зажим сужает разброс: движок ${engineSpread.toFixed(4)} vs фолбэк ${fallbackSpread.toFixed(4)}`,
    ).toBeLessThan(fallbackSpread * 0.75);
  });

  test('режим смеси — именно luminosity: канальный дифференциал на синем поле', async ({
    page,
  }) => {
    /*
     * Детектор ПОДМЕНЫ РЕЖИМА (класс Д — тест, который кусается там, где
     * яркостный дифференциал слеп): по Y luminosity почти неотличим от
     * normal-композита того же flood, но на НАСЫЩЕННОМ синем поле каналы
     * расходятся радикально — luminosity сохраняет оттенок фона (результат
     * синеет), normal смывает его к тинту. Реальный пиксель обязан лечь к
     * симуляции luminosity и НЕ лечь к симуляции normal.
     */
    const tint = await readSoftTint(page);
    const alpha = Math.min(1, Math.max(0, tint.a * ACRYLIC_LUMINOSITY_OPACITY));
    // Поле под панелью: чистый синий; блюр над сплошным полем — то же поле,
    // saturate(1.8) на максимально насыщенном синем клампится в него же.
    const blue = { r: 0, g: 0, b: 255, a: 1 };

    // Симуляция v2: luminosity-зажим → тинт сверху (straight alpha).
    const simLum = compositeOver(tint, luminosityBlend(blue, tint, ACRYLIC_LUMINOSITY_OPACITY));
    // Симуляция подмены: тот же flood обычным normal-композитом → тинт сверху.
    const simNormal = compositeOver(tint, {
      r: alpha * tint.r + (1 - alpha) * blue.r,
      g: alpha * tint.g + (1 - alpha) * blue.g,
      b: alpha * tint.b + (1 - alpha) * blue.b,
      a: 1,
    });

    const px = await patchColor(page, page.getByTestId('surface-on-blue'));
    const toLum = channelDistance(px, simLum);
    const toNormal = channelDistance(px, simNormal);
    // RED-proof (2026-07-09): на мутанте mode="normal" реальный пиксель лёг в
    // 1.6 байта от simNormal и тест упал; на честном luminosity — 3.9 байта от
    // simLum (зерно+байт-раунды) и далеко от normal. Детектор различает режим.

    expect(
      toLum,
      `пиксель обязан сойтись с симуляцией luminosity (Δ=${toLum.toFixed(1)} байт)`,
    ).toBeLessThan(14);
    expect(
      toLum,
      `и лежать СТРОГО ближе к luminosity, чем к normal-подмене (${toLum.toFixed(1)} vs ${toNormal.toFixed(1)})`,
    ).toBeLessThan(toNormal * 0.5);
  });

  test('flood живёт на var() контракта: флип темы перекрашивает без ре-маунта', async ({
    page,
  }) => {
    const before = await patchLuminance(page, page.getByTestId('surface-on-black'));
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    await expect
      .poll(() => patchLuminance(page, page.getByTestId('surface-on-black')))
      .not.toBeCloseTo(before, 1);
  });

  test('forced-colors гасит движок сам (инлайн сильнее листа — снятие в JS)', async ({ page }) => {
    await expect.poll(() => readBackdropFilter(page, 'surface-on-black')).toContain('lab-acrylic-');
    await page.emulateMedia({ forcedColors: 'active' });
    await expect
      .poll(() => readBackdropFilter(page, 'surface-on-black'), {
        message: 'движок обязан снять инлайн под forced-colors',
      })
      .not.toContain('lab-acrylic');
    await page.emulateMedia({ forcedColors: null });
    await expect
      .poll(() => readBackdropFilter(page, 'surface-on-black'), {
        message: 'возврат режима возвращает движок',
      })
      .toContain('lab-acrylic-');
  });
});

test.describe('acrylic v2 — фолбэк-истина (WebKit)', () => {
  test.skip(
    ({ browserName }) => browserName === 'chromium',
    'ветка закрепляет НЕ-движковую истину: v1-рецепт без url()',
  );

  test('WebKit остаётся на честном v1: blur+saturate, никакого url()-конвейера', async ({
    page,
  }) => {
    const filter = await readBackdropFilter(page, 'surface-on-black');
    expect(filter).toContain('blur(');
    expect(filter).toContain('saturate(');
    expect(filter).not.toContain('url(');
    const bg = await page
      .getByTestId('surface-on-black')
      .evaluate((el) => getComputedStyle(el).backgroundImage);
    expect(bg).toContain('data:image/png');
  });
});
