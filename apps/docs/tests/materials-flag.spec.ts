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

test('placement: no glass-on-glass nesting on the page', async ({ page }) => {
  await page.getByTestId('open-modal').click();
  await page.evaluate(() => document.documentElement.setAttribute('data-material', 'glass'));
  const nested = await page.evaluate(
    () => document.querySelectorAll('.lab-material .lab-material').length,
  );
  expect(nested).toBe(0);
});
