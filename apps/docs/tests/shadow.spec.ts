import { expect, test } from '@playwright/test';

/**
 * Shadow-stack smoke. Proves the generated @labpics/ui-shadow contract is wired
 * into the demo and behaves to the owner's verdict (2026-06-13):
 *   1. the five sizes + four role aliases + global angle + alpha contract resolve;
 *   2. each card resolves to a real four-ply box-shadow (equal-layeredness);
 *   3. the default light is vertical (angle 0 → offset-x 0);
 *   4. elevation changes ease (the motion token wires `transition: box-shadow`);
 *   5. on the dark theme the shadow is darker than the surface — never a glow.
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

const SIZES = ['xs', 's', 'm', 'l', 'xl'] as const;
const ROLES = ['resting', 'raised', 'overlay', 'modal'] as const;

test('contract resolves: vertical angle, four alphas, five sizes, four roles', async ({ page }) => {
  await page.goto(SHADOW_URL);

  // Owner default: vertical light.
  expect(await rootVar(page, '--lab-light-angle')).toBe('0deg');

  for (const slot of ['s1', 's2', 's3', 's4']) {
    const alpha = await rootVar(page, `--lab-shadow-alpha-${slot}`);
    expect(Number.parseFloat(alpha)).toBeGreaterThan(0);
  }

  for (const size of SIZES) {
    expect((await rootVar(page, `--lab-shadow-${size}`)).length).toBeGreaterThan(0);
  }
  for (const role of ROLES) {
    expect((await rootVar(page, `--lab-elevation-${role}`)).length).toBeGreaterThan(0);
  }
});

test('every card resolves to a real four-ply box-shadow (equal-layeredness)', async ({ page }) => {
  await page.goto(SHADOW_URL);

  for (const id of [...SIZES.map((s) => `card-${s}`), ...ROLES.map((r) => `card-${r}`)]) {
    const shadow = await boxShadow(page, id);
    expect(shadow, id).not.toBe('none');
    // Four plies → four colour stops. Browsers serialize color-mix as
    // color(srgb ...) or rgba(...) depending on engine; count both.
    const plies = shadow.match(/color\(srgb|rgba?\(/g) ?? [];
    expect(plies.length, id).toBe(4);
  }
});

test('default light is vertical: every ply has zero horizontal offset', async ({ page }) => {
  await page.goto(SHADOW_URL);

  for (const size of SIZES) {
    const shadow = await boxShadow(page, `card-${size}`);
    // Computed box-shadow serializes as `<color> <x> <y> <blur>` per ply. The
    // owner ladder is vertical: x = 0 for every ply at the default angle.
    const plies = shadow.split(/,(?![^(]*\))/);
    for (const ply of plies) {
      const nums = ply.match(/-?\d+(?:\.\d+)?px/g) ?? [];
      // First px token is the x-offset; it must be exactly 0px.
      expect(nums[0], `${size}: ${ply}`).toBe('0px');
    }
  }
});

test('elevation grows: XL casts a larger shadow than XS', async ({ page }) => {
  await page.goto(SHADOW_URL);

  const maxToken = (s: string): number =>
    Math.max(
      ...(s.match(/-?\d+(?:\.\d+)?px/g) ?? ['0px']).map((t) => Math.abs(Number.parseFloat(t))),
    );

  const xs = maxToken(await boxShadow(page, 'card-xs'));
  const xl = maxToken(await boxShadow(page, 'card-xl'));
  expect(xl).toBeGreaterThan(xs);
});

test('elevation changes ease — the motion token wires a box-shadow transition', async ({
  page,
}) => {
  await page.goto(SHADOW_URL);

  // The size/role classes carry `transition: var(--lab-shadow-transition)`. The
  // resolved transition-property must include box-shadow with a non-zero
  // duration, so a state change tweens instead of snapping (owner verdict c).
  const t = await page.getByTestId('card-m').evaluate((el) => {
    const cs = getComputedStyle(el);
    return { prop: cs.transitionProperty, dur: cs.transitionDuration };
  });
  expect(t.prop).toContain('box-shadow');
  const seconds = (t.dur.split(',')[0] ?? '0s').trim();
  expect(Number.parseFloat(seconds)).toBeGreaterThan(0);
});

test('shadow is the neutral anchor, never pure black; tint is opt-in', async ({ page }) => {
  await page.goto(SHADOW_URL);

  const neutral = await boxShadow(page, 'card-xl');
  expect(neutral).not.toMatch(/rgba?\(\s*0\s*,\s*0\s*,\s*0/);
  expect(neutral).not.toMatch(/color\(srgb\s+0\s+0\s+0\b/);

  // The opt-in tinted card raises tint strength + sets a hue; its shadow differs
  // from the neutral card's, proving the tint flows into the colour.
  const tinted = await boxShadow(page, 'card-tinted-xl');
  expect(tinted).not.toBe(neutral);
});

test('dark theme: the shadow is darker than the surface — a shadow, not a glow', async ({
  page,
}) => {
  await page.goto(SHADOW_URL);
  await page.getByTestId('theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  // Relative luminance of an `rgb()/rgba()` or `color(srgb r g b)` string.
  const luminance = (color: string): number => {
    const srgb = color.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
    if (srgb) {
      return 0.2126 * Number(srgb[1]) + 0.7152 * Number(srgb[2]) + 0.0722 * Number(srgb[3]);
    }
    const rgb = color.match(/rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/);
    if (rgb) {
      return (0.2126 * Number(rgb[1]) + 0.7152 * Number(rgb[2]) + 0.0722 * Number(rgb[3])) / 255;
    }
    return Number.NaN;
  };

  // The card surface and its strongest (first) shadow ply, both as the engine
  // resolves them on the dark theme.
  const { surface, ply } = await page.getByTestId('card-xl').evaluate((el) => {
    const cs = getComputedStyle(el);
    const shadow = cs.boxShadow;
    const firstColor = shadow.match(/(?:color\(srgb[^)]*\)|rgba?\([^)]*\))/)?.[0] ?? '';
    return { surface: cs.backgroundColor, ply: firstColor };
  });

  const surfaceL = luminance(surface);
  const shadowL = luminance(ply);
  expect(Number.isNaN(surfaceL)).toBe(false);
  expect(Number.isNaN(shadowL)).toBe(false);
  // The composite shadow ink is the #101012 anchor at low alpha — strictly
  // darker than the dark surface it sits on. Never a glow.
  expect(shadowL).toBeLessThan(surfaceL);
});
