import { expect, test } from '@playwright/test';
import { normalizeCssColor, relativeLuminance } from './support/color.js';

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

  // Сырые резолвнутые цвета: фон карточки и цвет сильнейшей (первой) ply тени —
  // ровно как их сериализует движок. Оба приходят в CSS Color 4 (движок эмитит
  // роли в oklch()), поэтому первый цветовой токен box-shadow ловим ЛЮБОЙ
  // цветовой функцией, а нормализацию в sRGB отдаём браузеру (normalizeCssColor).
  const { surfaceRaw, plyRaw } = await page.getByTestId('card-xl').evaluate((el) => {
    const cs = getComputedStyle(el);
    const firstColor =
      cs.boxShadow.match(/(?:rgba?|hsla?|hwb|oklch|oklab|lab|lch|color)\([^)]*\)/)?.[0] ?? '';
    return { surfaceRaw: cs.backgroundColor, plyRaw: firstColor };
  });

  const surface = await normalizeCssColor(page, surfaceRaw);
  const ply = await normalizeCssColor(page, plyRaw);
  if (!surface || !ply) {
    throw new Error(
      `dark-theme shadow: браузер не распознал цвет.\n  surface="${surfaceRaw}"\n  ply="${plyRaw}"`,
    );
  }

  // Тень-краска (#101012 анкер) СТРОГО темнее тёмной поверхности, на которой
  // лежит — тень, не свечение. Сравниваем по WCAG relative luminance цвета
  // краски (альфа не участвует: сравнивается ЦВЕТ, не композит).
  expect(relativeLuminance(ply)).toBeLessThan(relativeLuminance(surface));
});
