import { compositeOverByte } from '@labpics/ui-materials';
import { type Page, expect, test } from '@playwright/test';
import { normalizeCssColor, relativeLuminance } from './support/color.js';

/**
 * Materials FLAG demo (solid | glass | acrylic) — the owner's exit criterion.
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
  await page.goto('/_fixtures/materials-flag.html');
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

  // …и слой зерна теперь поверх тинт-градиента — фирменный признак acrylic
  // (ADR-0004 Решение 1 §4; отдельный blur-ярус снесён — ADR-0008).
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

test('placement: no live-blur-on-live-blur nesting on the page (glass/acrylic)', async ({
  page,
}) => {
  // The background policy forbids nesting a live-blur material inside another
  // (double live blur = seam). Assert it across every live mode, not just glass.
  await page.getByTestId('open-modal').click();
  for (const mode of ['glass', 'acrylic'] as const) {
    await page.evaluate((m) => document.documentElement.setAttribute('data-material', m), mode);
    const nested = await page.evaluate(
      () => document.querySelectorAll('.lab-material .lab-material').length,
    );
    expect(nested, `no nested material under ${mode}`).toBe(0);
  }
});

/** The `::before` rim ring's resolved `background-image` (the specular gradient,
 * or `none` when `--_rim` is unset). Reading the pseudo-element is the only way
 * to observe the ring in a real browser. */
function readRimBackground(page: Page, testId: string): Promise<string> {
  return page
    .getByTestId(testId)
    .evaluate((el) => getComputedStyle(el, '::before').backgroundImage);
}

/** A live rim is a gradient painted into the `::before`; `none` means no rim. */
const hasRim = (bg: string): boolean => bg !== 'none' && /gradient/i.test(bg);

test('specular rim: ON for glass + acrylic, OFF for solid (::before gradient)', async ({
  page,
}) => {
  // Solid default paints no rim — the ::before is an empty, pixel-identical layer.
  expect(hasRim(await readRimBackground(page, 'surface-card')), 'no rim on solid').toBe(false);

  // Glass & acrylic — the light-catching edge appears (a gradient in the ::before).
  for (const mode of ['glass', 'acrylic'] as const) {
    await page.evaluate((m) => document.documentElement.setAttribute('data-material', m), mode);
    expect(hasRim(await readRimBackground(page, 'surface-card')), `rim ON for ${mode}`).toBe(true);
  }
});

test('specular rim is a 1px EDGE ring, not a fill (browser honours mask-composite at runtime)', async ({
  page,
}) => {
  // hasRim proves a gradient is painted; this proves the ring GEOMETRY is live —
  // the browser actually applies the mask-composite that carves the interior out.
  // Without it the gradient would flood the whole ::before (a filled rectangle),
  // and the plain gradient check would stay green. Read the RUNTIME computed
  // mask-composite (Chromium `maskComposite=exclude`, WebKit
  // `webkitMaskComposite=xor`) + the 1px padding-box thickness on the ::before.
  await page.evaluate(() => document.documentElement.setAttribute('data-material', 'glass'));
  const ring = await page.getByTestId('surface-card').evaluate((el) => {
    const cs = getComputedStyle(el, '::before');
    const rec = cs as unknown as Record<string, string>;
    return {
      composite: cs.maskComposite || rec.webkitMaskComposite || '',
      padding: cs.paddingTop,
    };
  });
  // The ring-producing composite: `exclude` (standard) or `xor` (-webkit) — never
  // `add`/`source-over`, which would NOT punch out the interior.
  expect(
    /exclude|xor/.test(ring.composite),
    `mask-composite carves the ring (got "${ring.composite}")`,
  ).toBe(true);
  expect(ring.padding, '1px ring thickness').toBe('1px');
});

test('specular rim rebinds with the theme (light brighter than dark at the top edge)', async ({
  page,
}) => {
  // The top stop of the rim gradient is white at a theme-specific alpha (light .50,
  // dark .12). Read the ::before background in glass under each theme and compare
  // the top-stop alpha — light must be the brighter edge. Colour parsing goes
  // through the browser-normalised bytes (oklch/color-mix-safe), never a regex.
  await page.evaluate(() => document.documentElement.setAttribute('data-material', 'glass'));

  const topAlpha = async (): Promise<number> => {
    const bg = await readRimBackground(page, 'surface-card');
    // The browser serialises the color-mix stops as `color(srgb …)` (Chromium)
    // or `rgba(…)` (WebKit); grab the FIRST stop and let the canvas-based
    // normaliser read its byte alpha (any CSS Color 4 form is handled).
    const firstStop = bg.match(/(?:color|rgba?|oklch|oklab|hsla?)\([^)]*\)/i)?.[0] ?? '';
    const parsed = await normalizeCssColor(page, firstStop);
    return parsed?.a ?? 0;
  };

  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
  const light = await topAlpha();
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  const dark = await topAlpha();

  expect(light, 'light rim top-stop resolved').toBeGreaterThan(0);
  expect(dark, 'dark rim top-stop resolved').toBeGreaterThan(0);
  expect(light, 'light rim edge is brighter than dark').toBeGreaterThan(dark);
});

test('specular rim is stripped under degradation (forced-colors, contrast:more)', async ({
  page,
}) => {
  await page.evaluate(() => document.documentElement.setAttribute('data-material', 'glass'));
  expect(hasRim(await readRimBackground(page, 'surface-card')), 'rim present in glass').toBe(true);

  // forced-colors: active → opaque solid canon, rim stripped with the translucency.
  await page.emulateMedia({ forcedColors: 'active' });
  expect(hasRim(await readRimBackground(page, 'surface-card')), 'no rim under forced-colors').toBe(
    false,
  );

  // prefers-contrast: more → solid too, rim gone.
  await page.emulateMedia({ forcedColors: null, contrast: 'more' });
  expect(
    hasRim(await readRimBackground(page, 'surface-card')),
    'no rim under prefers-contrast: more',
  ).toBe(false);

  await page.emulateMedia({ contrast: null });
});
