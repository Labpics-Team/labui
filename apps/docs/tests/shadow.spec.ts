import { expect, test } from '@playwright/test';

/**
 * Shadow-stack smoke. Proves the generated @labpics/ui-shadow contract is wired
 * into the demo and behaves as designed:
 *   1. the elevation roles + global angle token + alpha contract resolve;
 *   2. switching theme changes the shadow (alpha contract re-set per theme);
 *   3. moving the one light-angle token re-derives every ply's x/y offset;
 *   4. the shadow colour is the surface tint, never pure black.
 *
 * These assert behaviour (resolved computed styles), not pixels, so they are not
 * flaky; the side-by-side visual baseline lives in visual-parity-harness.
 */

const SHADOW_URL = '/shadow.html';

async function rootVar(page: import('@playwright/test').Page, name: string): Promise<string> {
  return page.evaluate(
    (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim(),
    name,
  );
}

function boxShadow(page: import('@playwright/test').Page, testId: string): Promise<string> {
  return page.getByTestId(testId).evaluate((el) => getComputedStyle(el).boxShadow);
}

test('shadow contract resolves: global angle, four alpha layers, four roles', async ({ page }) => {
  await page.goto(SHADOW_URL);

  expect(await rootVar(page, '--lab-light-angle')).toBe('35deg');

  for (const layer of ['minor', 'ambient', 'penumbra', 'major']) {
    const alpha = await rootVar(page, `--lab-shadow-alpha-${layer}`);
    expect(Number.parseFloat(alpha)).toBeGreaterThan(0);
  }

  for (const role of ['resting', 'raised', 'overlay', 'modal']) {
    const value = await rootVar(page, `--lab-elevation-${role}`);
    expect(value.length).toBeGreaterThan(0);
  }
});

test('every elevation card resolves to a real four-ply box-shadow', async ({ page }) => {
  await page.goto(SHADOW_URL);

  for (const role of ['resting', 'raised', 'overlay', 'modal']) {
    const shadow = await boxShadow(page, `card-${role}`);
    expect(shadow).not.toBe('none');
    // Four plies → four colour stops. Browsers serialize the color-mix result
    // as either color(srgb ...) or rgba(...) depending on engine; count both.
    const plies = shadow.match(/color\(srgb|rgba?\(/g) ?? [];
    expect(plies.length).toBe(4);
  }
});

test('elevation grows: modal casts a larger shadow than resting', async ({ page }) => {
  await page.goto(SHADOW_URL);

  // The computed box-shadow encodes resolved px offsets/blur. The modal role is
  // an order of magnitude deeper, so its serialized value is materially longer
  // in total blur/offset magnitude. Assert the max numeric token grows.
  const maxToken = (s: string): number =>
    Math.max(
      ...(s.match(/-?\d+(?:\.\d+)?px/g) ?? ['0px']).map((t) => Math.abs(Number.parseFloat(t))),
    );

  const resting = maxToken(await boxShadow(page, 'card-resting'));
  const modal = maxToken(await boxShadow(page, 'card-modal'));
  expect(modal).toBeGreaterThan(resting);
});

test('switching theme changes the shadow (alpha contract re-set per theme)', async ({ page }) => {
  await page.goto(SHADOW_URL);

  const lightMajorAlpha = await rootVar(page, '--lab-shadow-alpha-major');
  const lightShadow = await boxShadow(page, 'card-modal');

  await page.getByTestId('theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  const darkMajorAlpha = await rootVar(page, '--lab-shadow-alpha-major');
  const darkShadow = await boxShadow(page, 'card-modal');

  // Dark theme is heavier (Figma anchor @20 vs @12) and the rendered shadow
  // must actually differ — a true variable-driven theme swap, not a no-op.
  expect(Number.parseFloat(darkMajorAlpha)).toBeGreaterThan(Number.parseFloat(lightMajorAlpha));
  expect(darkShadow).not.toBe(lightShadow);
});

test('the single light-angle token re-derives every ply offset', async ({ page }) => {
  await page.goto(SHADOW_URL);

  const before = await boxShadow(page, 'card-modal');

  // Drive the one global token to a steeper angle via the slider.
  const slider = page.getByTestId('angle-input');
  await slider.fill('70');
  await slider.dispatchEvent('input');
  await expect(page.getByTestId('angle-output')).toHaveText('70°');

  const after = await boxShadow(page, 'card-modal');
  // A different light angle → different x/y offset split → different shadow.
  expect(after).not.toBe(before);
});

test('shadow colour is the surface tint, never pure black', async ({ page }) => {
  await page.goto(SHADOW_URL);

  // Neutral card: shadow resolves from the #101012 anchor — NOT pure black.
  // Guard both serializations: rgb(0,0,0) and color(srgb 0 0 0).
  const neutral = await boxShadow(page, 'card-modal');
  expect(neutral).not.toMatch(/rgba?\(\s*0\s*,\s*0\s*,\s*0/);
  expect(neutral).not.toMatch(/color\(srgb\s+0\s+0\s+0\b/);

  // Tinted card sets --lab-surface-shadow-tint to the accent; its shadow must
  // differ from the neutral card's, proving the tint flows into the colour.
  const tinted = await boxShadow(page, 'card-tinted-modal');
  expect(tinted).not.toBe(neutral);
});
