import { compositeOverByte } from '@labpics/ui-materials';
import { type Page, expect, test } from '@playwright/test';
import { normalizeCssColor, relativeLuminance } from './support/color.js';

/**
 * Materials FLAG demo (solid | glass | blur | acrylic) — the owner's exit criterion.
 *
 * Proves, in a real browser across Chromium + WebKit:
 *   1. ONE `data-material` attribute flips the card AND the modal solid→glass→acrylic
 *      (zero markup change) — measured on the actual computed backdrop-filter.
 *   2. The label stays legal in every live mode: the solid composite contrast is
 *      measured from the LIVE resolved contract tokens (compositing 01 over 02),
 *      and the label token does not change with the mode.
 *   3. Acrylic paints the ~2% grain layer (a data-URI image on top of the tint),
 *      degrades honestly to solid under reduced-capability media, and never nests.
 *
 * Colour reading goes through `support/color.ts` (`normalizeCssColor` — the browser
 * itself normalises any CSS Color 4 form to sRGB bytes), never a bespoke regex that
 * silently returns NaN/garbage on `oklch()` (the class PR #101 closed for shadow).
 */

/** Straight-alpha source-over composite in sRGB bytes (the material's solid canon). */
function over(
  src: { r: number; g: number; b: number; a: number },
  base: { r: number; g: number; b: number },
): { r: number; g: number; b: number; a: number } {
  return {
    r: src.r * src.a + base.r * (1 - src.a),
    g: src.g * src.a + base.g * (1 - src.a),
    b: src.b * src.a + base.b * (1 - src.a),
    a: 1,
  };
}

/** WCAG contrast ratio between two relative luminances (not a colour parser). */
function contrast(l1: number, l2: number): number {
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

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

/** The card's computed `background-image` — carries the acrylic grain layer (a
 * `url(data:image/png…)`) only in acrylic mode. */
function readBackgroundImage(page: Page, testId: string): Promise<string> {
  return page.getByTestId(testId).evaluate((el) => getComputedStyle(el).backgroundImage);
}

/** A LIVE blur is `blur(<non-zero>px)`. Solid serialises to `none` (WebKit) or the
 * no-op `blur(0px) saturate(1)` (Chromium) — neither is a live blur. */
const hasLiveBlur = (filter: string): boolean => /blur\((?!0px\))/.test(filter);

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

test('acrylic flip: live blur + saturate + the ~2% grain layer (data-URI over the tint)', async ({
  page,
}) => {
  // Solid default paints NO grain layer (no data-URI image in the background).
  expect(await readBackgroundImage(page, 'surface-card')).not.toContain('data:image/png');

  await page.evaluate(() => document.documentElement.setAttribute('data-material', 'acrylic'));

  // Acrylic reads the live backdrop: a real (non-zero) blur + saturate.
  const filter = await readBackdropFilter(page, 'surface-card');
  expect(hasLiveBlur(filter)).toBe(true);
  expect(filter).toContain('saturate');

  // …and the grain layer is now on top of the tint gradient — the ONE thing that
  // distinguishes acrylic from plain blur (ADR-0004 Решение 1 §4).
  const bg = await readBackgroundImage(page, 'surface-card');
  expect(bg).toContain('data:image/png');
  expect(bg).toContain('linear-gradient'); // grain sits ABOVE the tint, not instead of it
});

test('the base-tier label is legal on the solid composite (live contract tokens via support/color)', async ({
  page,
}) => {
  // Read the RESOLVED contract tokens + label as strings, normalise each to sRGB
  // bytes with the browser (oklch-safe), then composite + contrast in Node.
  const { tintRaw, baseRaw, labelRaw } = await page.getByTestId('surface-card').evaluate((el) => {
    const root = getComputedStyle(document.documentElement);
    return {
      tintRaw: root.getPropertyValue('--lab-bg-material-base-01'),
      baseRaw: root.getPropertyValue('--lab-bg-material-base-02'),
      labelRaw: getComputedStyle(el).color,
    };
  });

  const tint = await normalizeCssColor(page, tintRaw);
  const base = await normalizeCssColor(page, baseRaw);
  const label = await normalizeCssColor(page, labelRaw);
  expect(tint, `tint "${tintRaw}" resolved`).not.toBeNull();
  expect(base, `base "${baseRaw}" resolved`).not.toBeNull();
  expect(label, `label "${labelRaw}" resolved`).not.toBeNull();
  if (!tint || !base || !label) return;

  const solid = over(tint, base);
  const ratio = contrast(relativeLuminance(label), relativeLuminance(solid));
  expect(ratio).toBeGreaterThanOrEqual(4.5);
});

test('the label token is the SAME across solid, glass and acrylic (legal in all by construction)', async ({
  page,
}) => {
  const labelColour = () =>
    page.getByTestId('card-label').evaluate((el) => getComputedStyle(el).color);

  const solid = await labelColour();
  // The surface commits ONE polarity label; the mode never changes it — so the
  // base-tier glass legality proven by the α-boundary unit test carries over, and
  // acrylic inherits the SAME tint/corridor as glass (ADR-0004 Решение 2).
  for (const mode of ['glass', 'acrylic'] as const) {
    await page.evaluate((m) => document.documentElement.setAttribute('data-material', m), mode);
    expect(await labelColour(), `label unchanged in ${mode}`).toBe(solid);
  }
});

test('acrylic degrades to solid under reduced-capability media (honest fallback)', async ({
  page,
}) => {
  await page.evaluate(() => document.documentElement.setAttribute('data-material', 'acrylic'));
  expect(hasLiveBlur(await readBackdropFilter(page, 'surface-card'))).toBe(true);

  // forced-colors: active → the opaque solid canon, translucency + grain stripped.
  await page.emulateMedia({ forcedColors: 'active' });
  const forced = await readBackdropFilter(page, 'surface-card');
  expect(hasLiveBlur(forced), 'no live blur under forced-colors').toBe(false);
  expect(await readBackgroundImage(page, 'surface-card')).not.toContain('data:image/png');

  // prefers-contrast: more → solid too (strengthen: opaque, maximum contrast).
  await page.emulateMedia({ forcedColors: null, contrast: 'more' });
  expect(
    hasLiveBlur(await readBackdropFilter(page, 'surface-card')),
    'no live blur under prefers-contrast: more',
  ).toBe(false);

  await page.emulateMedia({ contrast: null });
});

/**
 * DIFFERENTIAL (class C) — task #52, BYTE-EXACT. The browser's own compositor is
 * the oracle: it paints the tint straight-alpha over black/white on a <canvas> and
 * we read the committed pixel back with getImageData. Our `compositeOverByte`
 * (round-half-even — the exact ImageData/engine byte) must reproduce that pixel
 * BYTE-FOR-BYTE across the whole tier ladder. No luminance tolerance, no
 * "invisible-rounding" slack: the reference composite and the prod paint are the
 * same byte or the test is red.
 *
 * The tint is parsed from its DECLARED string (`rgb(r g b / a)`), NOT through the
 * byte-quantising `normalizeCssColor`: byte-exactness needs the *exact declared
 * alpha* (0.898…), and re-rasterising the tint would quantise that alpha to a byte
 * and could fork the composite by 1 LSB. To still close the silent-oklch class
 * (PR #101), we ASSERT the resolved tint is an `rgb()` form — if the colours train
 * ever emits the tint as `oklch()`, this fails LOUDLY (a signal to move the byte
 * path onto a canvas oracle for alpha too), never computing garbage silently.
 *
 * RED-proof: swap `compositeOverByte` to truncation (`| 0`), round-half-up, or a
 * linear-light composite and this FAILS on the sheer tiers (e.g. light/base over
 * black paints #949494, truncation predicts #939393). Restore → GREEN.
 */
const MATERIAL_TIERS = ['base', 'muted', 'soft', 'subtle', 'elevated'] as const;

test('DIFFERENTIAL byte-exact: compositeOverByte reproduces the canvas pixel (black/white backdrop)', async ({
  page,
}) => {
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
    const sampleBytes = (tintCss: string, backdrop: string): [number, number, number] => {
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
      return [d[0] ?? 0, d[1] ?? 0, d[2] ?? 0];
    };
    return tiers.map((tier) => {
      const tintCss = resolve(`--lab-bg-material-${tier}-01`);
      return {
        tier,
        tintCss,
        overBlack: sampleBytes(tintCss, 'rgb(0, 0, 0)'),
        overWhite: sampleBytes(tintCss, 'rgb(255, 255, 255)'),
      };
    });
  }, MATERIAL_TIERS);

  // Parse the SAME browser-resolved tint string the canvas painted (declared alpha
  // preserved), guarding against a future oklch emission (loud, not silent).
  const parse = (css: string, tier: string) => {
    expect(
      /^rgba?\(/i.test(css.trim()),
      `tier ${tier}: tint "${css}" must be an rgb() form for the byte-exact path (oklch would need a canvas oracle for alpha)`,
    ).toBe(true);
    const n = css.match(/[\d.]+/g)?.map(Number) ?? [];
    return { r: n[0] ?? 0, g: n[1] ?? 0, b: n[2] ?? 0, a: n[3] ?? 1 };
  };
  const BLACK = { r: 0, g: 0, b: 0, a: 1 };
  const WHITE = { r: 255, g: 255, b: 255, a: 1 };

  for (const row of measured) {
    const tint = parse(row.tintCss, row.tier);
    const black = compositeOverByte(tint, BLACK);
    const white = compositeOverByte(tint, WHITE);
    expect(
      [black.r, black.g, black.b],
      `${row.tier}: compositeOverByte vs canvas over BLACK`,
    ).toEqual(row.overBlack);
    expect(
      [white.r, white.g, white.b],
      `${row.tier}: compositeOverByte vs canvas over WHITE`,
    ).toEqual(row.overWhite);
  }
});

test('placement: no live-blur-on-live-blur nesting on the page (glass/blur/acrylic)', async ({
  page,
}) => {
  // The background policy forbids nesting a live-blur material inside another
  // (double live blur = seam). Assert it across every live mode, not just glass.
  await page.getByTestId('open-modal').click();
  for (const mode of ['glass', 'blur', 'acrylic'] as const) {
    await page.evaluate((m) => document.documentElement.setAttribute('data-material', m), mode);
    const nested = await page.evaluate(
      () => document.querySelectorAll('.lab-material .lab-material').length,
    );
    expect(nested, `no nested material under ${mode}`).toBe(0);
  }
});
