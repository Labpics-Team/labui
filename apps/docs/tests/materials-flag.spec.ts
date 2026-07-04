import { evaluateTier } from '@labpics/ui-materials';
import { type Page, expect, test } from '@playwright/test';

/**
 * Materials FLAG demo (solid | glass | blur) — the owner's exit criterion.
 *
 * Proves, in a real browser across Chromium + WebKit:
 *   1. ONE `data-material` attribute flips the card AND the modal solid→glass
 *      (zero markup change) — measured on the actual computed backdrop-filter.
 *   2. The label stays legal in BOTH modes: the solid composite contrast is
 *      measured from the LIVE resolved contract tokens (compositing 01 over 02
 *      in-page — we do NOT sample canvas lightness, which headless Chromium
 *      mis-reads for a plain fill; the composite of the resolved values is the
 *      honest, deterministic measurement), and the label token does not change
 *      with the mode (glass legality for the `base` tier is proven by the
 *      package's α-boundary unit test).
 *   3. No glass-on-glass nesting (placement invariant).
 */

function readBackdropFilter(page: Page, testId: string): Promise<string> {
  return page.getByTestId(testId).evaluate((el) => {
    const cs = getComputedStyle(el);
    const std = cs.backdropFilter;
    const webkit = (cs as unknown as Record<string, string>).webkitBackdropFilter;
    for (const value of [std, webkit]) {
      if (value && value !== 'none') {
        return value;
      }
    }
    return 'none';
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto('/materials-flag.html');
  // Kill transitions/animations before any measurement (avoids mid-frame reads).
  await page.addStyleTag({
    content: '*,*::before,*::after{transition:none!important;animation:none!important}',
  });
});

test('renders the card and (on open) the modal surface', async ({ page }) => {
  await expect(page.getByTestId('surface-card')).toBeVisible();
  await page.getByTestId('open-modal').click();
  await expect(page.getByTestId('surface-modal')).toBeVisible();
});

test('one data-material flip turns card AND modal solid→glass', async ({ page }) => {
  await page.getByTestId('open-modal').click();

  // A LIVE blur is `blur(<non-zero>px)`. Solid serialises to `none` (WebKit) or
  // the no-op `blur(0px) saturate(1)` (Chromium) — neither is a live blur.
  const hasLiveBlur = (filter: string): boolean => /blur\((?!0px\))/.test(filter);

  // Solid (default): no live blur on either surface.
  expect(hasLiveBlur(await readBackdropFilter(page, 'surface-card'))).toBe(false);
  expect(hasLiveBlur(await readBackdropFilter(page, 'surface-modal'))).toBe(false);

  // The whole point: ONE attribute on the root, ZERO markup change.
  await page.evaluate(() => document.documentElement.setAttribute('data-material', 'glass'));

  const cardGlass = await readBackdropFilter(page, 'surface-card');
  const modalGlass = await readBackdropFilter(page, 'surface-modal');
  expect(hasLiveBlur(cardGlass)).toBe(true);
  expect(cardGlass).toContain('saturate');
  expect(hasLiveBlur(modalGlass)).toBe(true);

  // Blur mode uses a heavier radius than glass on the same surface.
  await page.evaluate(() => document.documentElement.setAttribute('data-material', 'blur'));
  const cardBlur = await readBackdropFilter(page, 'surface-card');
  const radius = (f: string) => Number.parseFloat(f.match(/blur\(([\d.]+)px\)/)?.[1] ?? 'NaN');
  expect(radius(cardBlur)).toBeGreaterThan(radius(cardGlass));
});

test('the base-tier label is legal on the solid composite (live contract tokens)', async ({
  page,
}) => {
  const result = await page.getByTestId('surface-card').evaluate((el) => {
    // In-page sRGB / WCAG helpers — measure the RESOLVED contract, not literals.
    const parse = (s: string) => {
      const probe = document.createElement('span');
      probe.style.color = s;
      document.body.appendChild(probe);
      const resolved = getComputedStyle(probe).color;
      probe.remove();
      const n = resolved.match(/[\d.]+/g)?.map(Number) ?? [];
      return { r: n[0] ?? 0, g: n[1] ?? 0, b: n[2] ?? 0, a: n[3] ?? 1 };
    };
    const lin = (c: number) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    const lum = (c: { r: number; g: number; b: number }) =>
      0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
    const over = (
      src: { r: number; g: number; b: number; a: number },
      base: { r: number; g: number; b: number },
    ) => ({
      r: src.r * src.a + base.r * (1 - src.a),
      g: src.g * src.a + base.g * (1 - src.a),
      b: src.b * src.a + base.b * (1 - src.a),
    });
    const contrast = (l1: number, l2: number) =>
      (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);

    const rootCS = getComputedStyle(document.documentElement);
    const tint = parse(rootCS.getPropertyValue('--lab-bg-material-base-01'));
    const base = parse(rootCS.getPropertyValue('--lab-bg-material-base-02'));
    const label = parse(getComputedStyle(el).color);

    const solid = over(tint, base);
    return { contrast: contrast(lum(label), lum(solid)), label: getComputedStyle(el).color };
  });

  expect(result.contrast).toBeGreaterThanOrEqual(4.5);
});

test('the label token is the SAME in solid and glass (legal in both by construction)', async ({
  page,
}) => {
  const labelColour = () =>
    page.getByTestId('card-label').evaluate((el) => getComputedStyle(el).color);

  const solid = await labelColour();
  await page.evaluate(() => document.documentElement.setAttribute('data-material', 'glass'));
  const glass = await labelColour();

  // The surface commits ONE polarity label; the mode never changes it — so the
  // base-tier glass legality proven by the α-boundary unit test carries over.
  expect(glass).toBe(solid);
});

/**
 * DIFFERENTIAL (class C): the α-boundary the guarantee computes must equal the
 * REAL browser composite. The guarantee bounds each tier by the tint composited
 * over black (effLow) and over white (effHigh); here the browser's own compositor
 * paints that exact composite on a <canvas> and we read the pixel back with
 * getImageData — an independent oracle (the engine paints, not our JS). They must
 * agree within a byte of rounding across the whole tier ladder.
 *
 * RED-proof: revert evaluateTier to the blend-of-luminances (effLow = α·L_tint …)
 * and this FAILS on the sheer tiers — e.g. light/soft blend effLow ≈ 0.266 vs the
 * browser's real composite ≈ 0.174 (Δ ≈ 0.09 ≫ tolerance), the very gap that made
 * `light/soft` a misleading "guaranteed". Restore the composite bound → GREEN.
 */
const MATERIAL_TIERS = ['base', 'muted', 'soft', 'subtle', 'elevated'] as const;
const LUM_TOLERANCE = 0.02; // ~1 byte of canvas rounding

test('DIFFERENTIAL: guarantee effLow/effHigh equal the browser composite (black/white backdrop)', async ({
  page,
}) => {
  // The browser compositor is the oracle: paint tint over black and over white on
  // a canvas, read the composited pixel's luminance for every tier.
  const measured = await page.evaluate((tiers) => {
    const root = getComputedStyle(document.documentElement);
    const resolve = (token: string) => {
      const probe = document.createElement('span');
      probe.style.color = root.getPropertyValue(token);
      document.body.appendChild(probe);
      const c = getComputedStyle(probe).color;
      probe.remove();
      return c;
    };
    const lin = (c: number) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    const lum = (r: number, g: number, b: number) =>
      0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    const sampleOver = (tintCss: string, backdrop: string) => {
      const cv = document.createElement('canvas');
      cv.width = 4;
      cv.height = 4;
      const ctx = cv.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        throw new Error('no 2d canvas context');
      }
      ctx.fillStyle = backdrop;
      ctx.fillRect(0, 0, 4, 4);
      ctx.fillStyle = tintCss; // straight-alpha source-over — the browser's real composite
      ctx.fillRect(0, 0, 4, 4);
      const d = ctx.getImageData(2, 2, 1, 1).data;
      return lum(d[0] ?? 0, d[1] ?? 0, d[2] ?? 0);
    };
    return tiers.map((tier) => {
      const tintCss = resolve(`--lab-bg-material-${tier}-01`);
      return {
        tier,
        tintCss,
        lumOverBlack: sampleOver(tintCss, 'rgb(0, 0, 0)'),
        lumOverWhite: sampleOver(tintCss, 'rgb(255, 255, 255)'),
      };
    });
  }, MATERIAL_TIERS);

  // Parse the browser-resolved tint and route it through the REAL guarantee code.
  const parse = (css: string) => {
    const n = css.match(/[\d.]+/g)?.map(Number) ?? [];
    return { r: n[0] ?? 0, g: n[1] ?? 0, b: n[2] ?? 0, a: n[3] ?? 1 };
  };
  const OPAQUE_BLACK = { r: 0, g: 0, b: 0, a: 1 };
  const PROBE_LABEL = [{ name: 'probe', colour: OPAQUE_BLACK }];

  for (const row of measured) {
    const tint = parse(row.tintCss);
    // effLow/effHigh depend only on the tint; base + label are inert here.
    const verdict = evaluateTier(row.tier, 'light', { tint, base: OPAQUE_BLACK }, PROBE_LABEL);
    expect(
      Math.abs(verdict.effLow - row.lumOverBlack),
      `${row.tier}: effLow (guarantee) vs composite-over-black (browser)`,
    ).toBeLessThan(LUM_TOLERANCE);
    expect(
      Math.abs(verdict.effHigh - row.lumOverWhite),
      `${row.tier}: effHigh (guarantee) vs composite-over-white (browser)`,
    ).toBeLessThan(LUM_TOLERANCE);
  }
});

test('placement: no glass-on-glass nesting on the page', async ({ page }) => {
  await page.getByTestId('open-modal').click();
  await page.evaluate(() => document.documentElement.setAttribute('data-material', 'glass'));
  const nested = await page.evaluate(
    () => document.querySelectorAll('.lab-material .lab-material').length,
  );
  expect(nested).toBe(0);
});
