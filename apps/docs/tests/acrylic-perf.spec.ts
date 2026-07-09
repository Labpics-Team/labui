import { type Page, expect, test } from '@playwright/test';

/*
 * Acrylic v2 — перф-паритет живых материалов (ADR-0009).
 *
 * Физический порог acrylic — «вся работа в композиторе, ноль JS в кадре»:
 * per-frame стоимость обязана быть класса стекла, не хуже. Этот спек ловит
 * КЛАСС регрессий «в кадр попала работа» (JS-обработчик, лишний проход,
 * layout-инвалидация): под непрерывно движущимся контентом (WAAPI-transform —
 * чисто композиторная анимация, форсирует ресэмпл backdrop каждый кадр)
 * меряется медианная дельта rAF для solid → glass (LG-движок) → acrylic
 * (v2-конвейер) на ОДНОЙ странице.
 *
 * Гейт НАМЕРЕННО относительный и щадящий (медиана, ×1.5 + 4ms слака):
 * на общих CI-раннерах абсолютные тайминги шумят; класс, который ловим, —
 * кратная деградация, а не микродельты. Абсолютные числа печатаются в отчёт
 * и фиксируются в packages/materials/bench/BASELINE.md. Не в smoke-наборе —
 * полный прогон гоняет его по расписанию (e2e-full).
 */

async function settleMaterial(page: Page, mode: 'solid' | 'glass' | 'acrylic'): Promise<void> {
  await page.evaluate((m) => document.documentElement.setAttribute('data-material', m), mode);
  const bf = () =>
    page
      .getByTestId('surface-on-black')
      .evaluate((el) => getComputedStyle(el).backdropFilter || 'none');
  if (mode === 'acrylic') {
    await expect.poll(bf, { message: 'acrylic-движок держит поверхность' }).toContain('url(');
  } else if (mode === 'glass') {
    // LG-движок пишет инлайн-стек (url либо frost-хвост) — ждём НЕ-acrylic.
    await expect.poll(bf).not.toContain('lab-acrylic');
  } else {
    await expect.poll(bf, { message: 'solid: живого блюра нет' }).not.toContain('url(');
  }
  // Кадр на стабилизацию каскада/движков после флипа.
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(null))));
}

/** Медианная дельта rAF за ~80 кадров (первые 10 — прогрев, отбрасываются). */
function medianFrameDelta(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const deltas: number[] = [];
        let last = performance.now();
        let n = 0;
        const tick = (t: number): void => {
          deltas.push(t - last);
          last = t;
          n += 1;
          if (n < 90) requestAnimationFrame(tick);
          else {
            const tail = deltas.slice(10).sort((a, b) => a - b);
            resolve(tail[Math.floor(tail.length / 2)] ?? Number.NaN);
          }
        };
        requestAnimationFrame(tick);
      }),
  );
}

test.describe('acrylic v2 — перф-паритет (Chromium)', () => {
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'движки живут только на Chromium; на WebKit меряется другой путь (v1)',
  );

  test('медианный кадр: acrylic-движок класса стекла, не хуже', async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    await page.goto('/acrylic-live.html');
    await expect(page.getByTestId('live-status')).toContainText('runtime: mounted');

    // Движущийся контент ПОД панелями: композиторная transform-анимация
    // (никакого JS в кадре у самой страницы) — форсирует ресэмпл backdrop.
    await page.evaluate(() => {
      const mover = document.createElement('div');
      mover.setAttribute('data-testid', 'perf-mover');
      mover.style.cssText =
        'position:fixed;left:0;top:0;width:200vw;height:100vh;' +
        'background:repeating-linear-gradient(90deg,#000 0 40px,#fff 40px 80px,#d40045 80px 120px)';
      const main = document.querySelector('main');
      document.body.insertBefore(mover, main);
      mover.animate(
        [{ transform: 'translateX(0)' }, { transform: 'translateX(-50vw)' }],
        { duration: 1600, iterations: Number.POSITIVE_INFINITY },
      );
    });

    const results: Record<string, number> = {};
    for (const mode of ['solid', 'glass', 'acrylic'] as const) {
      await settleMaterial(page, mode);
      results[mode] = await medianFrameDelta(page);
    }

    testInfo.annotations.push({
      type: 'perf-median-frame-ms',
      description: `solid=${results.solid?.toFixed(2)} glass=${results.glass?.toFixed(2)} acrylic=${results.acrylic?.toFixed(2)}`,
    });
    console.log(
      `[acrylic-perf] median frame ms: solid=${results.solid?.toFixed(2)} glass=${results.glass?.toFixed(2)} acrylic=${results.acrylic?.toFixed(2)}`,
    );

    const solid = results.solid ?? Number.NaN;
    const glass = results.glass ?? Number.NaN;
    const acrylic = results.acrylic ?? Number.NaN;
    expect(Number.isFinite(solid) && Number.isFinite(glass) && Number.isFinite(acrylic)).toBe(
      true,
    );

    // Класс-гейт: acrylic не дороже стекла кратно (JS/лишний проход в кадре
    // дал бы ×2+). Слак 4ms гасит квантование rAF на шумном раннере.
    expect(
      acrylic,
      `acrylic (${acrylic.toFixed(2)}ms) ≤ glass (${glass.toFixed(2)}ms) × 1.5 + 4ms`,
    ).toBeLessThanOrEqual(glass * 1.5 + 4);
  });
});
