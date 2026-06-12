import { type Page, expect, test } from '@playwright/test';

/**
 * Read the effective backdrop-filter from a surface, handling both Chromium
 * (unprefixed `backdrop-filter`) and WebKit (legacy `-webkit-backdrop-filter`).
 * Returns whichever the engine actually populated, or 'none'.
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

/**
 * Materials smoke — Ambient / Solid modes, switched by `data-material`.
 *
 * Reframed from the old `glass.spec.ts` per the owner's verdict (2026-06-13):
 * real Glass is native-only; the web material is Ambient (honest backdrop blur)
 * with Solid as the second mode and the universal fallback. The assertions
 * below moved off the `--lab-glass-*` names onto the public contract:
 *   1. The SEMANTIC `--lab-mat-*` roles resolve (the material DNA is loaded).
 *   2. The material is ALIVE on a surface: `.lab-ambient` has a real
 *      backdrop-filter in Ambient, and its body tint FOLLOWS the `--lab-*`
 *      colour core (not a hardcoded hex).
 *   3. The CORE PROMISE: flipping `data-material` on the root re-skins EVERY
 *      surface with no markup change — ambient↔solid changes the backdrop
 *      filter on ≥2 structurally different surfaces.
 *   4. `glassy` is a documented ALIAS of ambient on the web (honest degrade).
 *
 * Cross-engine (Chromium + WebKit) is enforced by the Playwright projects.
 */

test('materials demo renders with both surfaces visible', async ({ page }) => {
  await page.goto('/materials.html');
  await expect(page.getByTestId('title')).toHaveText('Materials');
  await expect(page.getByTestId('surface-card')).toBeVisible();
  await expect(page.getByTestId('surface-form')).toBeVisible();
  await expect(page.getByTestId('scene')).toBeAttached();
});

test('the semantic --lab-mat-* roles resolve from @labpics/ui-core', async ({ page }) => {
  await page.goto('/materials.html');

  const roles = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    return {
      blur: root.getPropertyValue('--lab-mat-blur').trim(),
      saturate: root.getPropertyValue('--lab-mat-saturate').trim(),
      fillAlpha: root.getPropertyValue('--lab-mat-fill-alpha').trim(),
      noiseAlpha: root.getPropertyValue('--lab-mat-noise-alpha').trim(),
      blend: root.getPropertyValue('--lab-mat-blend').trim(),
    };
  });

  // Every semantic role must be present — the contract is loaded.
  expect(roles.blur.length).toBeGreaterThan(0);
  expect(roles.saturate.length).toBeGreaterThan(0);
  expect(roles.fillAlpha.length).toBeGreaterThan(0);
  expect(roles.noiseAlpha.length).toBeGreaterThan(0);
  expect(roles.blend.length).toBeGreaterThan(0);

  // Default mode is Ambient → blur must be a positive length.
  expect(Number.parseFloat(roles.blur)).toBeGreaterThan(0);
});

test('.lab-ambient applies a live backdrop-filter in Ambient mode', async ({ page }) => {
  await page.goto('/materials.html');

  const filter = await readBackdropFilter(page, 'surface-card');

  expect(filter).not.toBe('none');
  expect(filter).toContain('blur');
  expect(filter).toContain('saturate');
});

test('flipping data-material=solid removes the live blur on EVERY surface', async ({ page }) => {
  await page.goto('/materials.html');

  // Read the blur on two structurally different surfaces (card + form) before.
  const cardAmbient = await readBackdropFilter(page, 'surface-card');
  const formAmbient = await readBackdropFilter(page, 'surface-form');
  expect(cardAmbient).toContain('blur');
  expect(formAmbient).toContain('blur');

  // The whole point of the task: ONE attribute on the root, ZERO markup change.
  await page.evaluate(() => document.documentElement.setAttribute('data-material', 'solid'));

  const cardSolid = await readBackdropFilter(page, 'surface-card');
  const formSolid = await readBackdropFilter(page, 'surface-form');

  // Solid sets --lab-mat-blur to 0px → the unprefixed filter is blur(0px) (or
  // serialised to none). Either way it must no longer be the Ambient blur.
  // (Chromium serialises blur(0px); the assertion accepts both 'none' and a
  // 0px blur — what matters is it CHANGED away from the live Ambient blur.)
  const pairs: ReadonlyArray<readonly [string, string]> = [
    [cardAmbient, cardSolid],
    [formAmbient, formSolid],
  ];
  for (const [before, after] of pairs) {
    expect(after).not.toBe(before);
    const stillLiveBlur = /blur\((?!0px\))/.test(after);
    expect(stillLiveBlur).toBe(false);
  }
});

test('glassy is a web alias of ambient (same backdrop-filter)', async ({ page }) => {
  await page.goto('/materials.html');

  await page.evaluate(() => document.documentElement.setAttribute('data-material', 'ambient'));
  const ambient = await readBackdropFilter(page, 'surface-card');

  await page.evaluate(() => document.documentElement.setAttribute('data-material', 'glassy'));
  const glassy = await readBackdropFilter(page, 'surface-card');

  // Owner verdict: on the web, Glassy degrades honestly to Ambient — identical.
  expect(glassy).toBe(ambient);
  expect(glassy).toContain('blur');
});

test('.lab-ambient tint FOLLOWS the --lab-* colour core (not hardcoded)', async ({ page }) => {
  await page.goto('/materials.html');

  const card = page.getByTestId('surface-card');

  // Re-point the surface token the material tint is built from, and assert the
  // body background changes. Only true var() consumption can do that.
  const before = await card.evaluate((el) => getComputedStyle(el).backgroundColor);

  await page.evaluate(() => {
    document.documentElement.style.setProperty('--lab-surface-raised', 'rgb(7, 130, 200)');
  });

  const after = await card.evaluate((el) => getComputedStyle(el).backgroundColor);

  expect(after).not.toBe(before);
  expect(after).toMatch(/^(rgba?\(|color\()/);

  const channels = await card.evaluate((el) => {
    const probe = document.createElement('span');
    probe.style.color = getComputedStyle(el).backgroundColor;
    document.body.appendChild(probe);
    const resolved = getComputedStyle(probe).color;
    probe.remove();
    const nums = resolved.match(/[\d.]+/g)?.map(Number) ?? [];
    return { r: nums[0] ?? 0, g: nums[1] ?? 0, b: nums[2] ?? 0 };
  });
  expect(channels.b).toBeGreaterThan(channels.r);
});

test('the Ambient ladder renders four DISTINCT blur radii (Figma 128/48/24/12)', async ({
  page,
}) => {
  await page.goto('/materials.html');

  // Pull the blur radius out of whichever backdrop-filter the engine populated.
  // This guards the tier modifiers on BOTH engines — including the WebKit
  // literal -webkit-backdrop-filter overrides (without them Safari would render
  // every tier at the base 48px and the ladder would be flat).
  const radiusFor = async (testId: string) => {
    const filter = await readBackdropFilter(page, testId);
    const match = filter.match(/blur\(([\d.]+)px\)/);
    return match?.[1] ? Number.parseFloat(match[1]) : Number.NaN;
  };

  const strong = await radiusFor('ladder-strong');
  const base = await radiusFor('ladder-base');
  const muted = await radiusFor('ladder-muted');
  const soft = await radiusFor('ladder-soft');

  // Exact Figma ladder (labui-figma-styles.md BG-blur): 128 / 48 / 24 / 12.
  expect(strong).toBe(128);
  expect(base).toBe(48);
  expect(muted).toBe(24);
  expect(soft).toBe(12);
  // And strictly descending — the ladder is a ladder, not a flat run.
  expect(strong).toBeGreaterThan(base);
  expect(base).toBeGreaterThan(muted);
  expect(muted).toBeGreaterThan(soft);
});

test('a prefers-reduced-transparency rule downgrades the material to Solid', async ({ page }) => {
  await page.goto('/materials.html');

  // Playwright 1.49 cannot emulate prefers-reduced-transparency, so assert the
  // contract is PRESENT in the cascade: a @media (prefers-reduced-transparency:
  // reduce) block must set --lab-mat-fill-alpha:1 and --lab-mat-blur:0px (the
  // Solid downgrade). Walk the loaded stylesheets and read the rule text.
  const found = await page.evaluate(() => {
    for (const sheet of Array.from(document.styleSheets)) {
      let rules: CSSRule[];
      try {
        rules = Array.from(sheet.cssRules);
      } catch {
        continue; // cross-origin sheet — skip
      }
      for (const rule of rules) {
        if (
          rule instanceof CSSMediaRule &&
          rule.conditionText.includes('prefers-reduced-transparency')
        ) {
          const text = rule.cssText;
          if (text.includes('--lab-mat-fill-alpha: 1') && text.includes('--lab-mat-blur: 0px')) {
            return true;
          }
        }
      }
    }
    return false;
  });

  expect(found).toBe(true);
});
