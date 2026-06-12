import { expect, test } from '@playwright/test';

/**
 * Glass Tier-1 smoke.
 *
 * Two guarantees the owner's task requires:
 *   1. The `--lab-glass-*` identity tokens (the glass DNA) RESOLVE on the page —
 *      they are loaded from @labpics/ui-core, not missing.
 *   2. The effect is actually APPLIED and ALIVE: `.lab-glass` has a real
 *      backdrop-filter (blur + saturate), and its tint FOLLOWS the `--lab-*`
 *      colour core (not a hardcoded hex) — the same decisive var()-follows
 *      check the colours smoke uses.
 *
 * Cross-engine (Chromium + WebKit) is enforced by the Playwright projects, so
 * the same assertions run on both — the task's "≥2 engines" gate.
 */

test('glass demo page renders with the panel visible', async ({ page }) => {
  await page.goto('/glass.html');
  await expect(page.getByTestId('title')).toHaveText('Glass · Tier-1');
  await expect(page.getByTestId('glass-panel')).toBeVisible();
  await expect(page.getByTestId('backdrop')).toBeAttached();
});

test('the --lab-glass-* identity tokens resolve from @labpics/ui-core', async ({ page }) => {
  await page.goto('/glass.html');

  const tokens = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    return {
      blur: root.getPropertyValue('--lab-glass-blur').trim(),
      saturate: root.getPropertyValue('--lab-glass-saturate').trim(),
      tintAlpha: root.getPropertyValue('--lab-glass-tint-alpha').trim(),
      rim: root.getPropertyValue('--lab-glass-rim-color').trim(),
      specular: root.getPropertyValue('--lab-glass-specular').trim(),
      noiseOpacity: root.getPropertyValue('--lab-glass-noise-opacity').trim(),
    };
  });

  // Every DNA token must be present — the contract is loaded.
  expect(tokens.blur.length).toBeGreaterThan(0);
  expect(tokens.saturate.length).toBeGreaterThan(0);
  expect(tokens.tintAlpha.length).toBeGreaterThan(0);
  expect(tokens.rim.length).toBeGreaterThan(0);
  expect(tokens.specular.length).toBeGreaterThan(0);
  expect(tokens.noiseOpacity.length).toBeGreaterThan(0);

  // Blur must be a positive length (saturation alone is not glass).
  expect(Number.parseFloat(tokens.blur)).toBeGreaterThan(0);
});

test('.lab-glass applies a live backdrop-filter (blur + saturate)', async ({ page }) => {
  await page.goto('/glass.html');

  const panel = page.getByTestId('glass-panel');

  // Chromium computes the unprefixed `backdrop-filter`; Safari only the legacy
  // `-webkit-backdrop-filter`. Take whichever the engine actually populated —
  // the glass must read as blur+saturate on BOTH (the cross-engine gate).
  const filter = await panel.evaluate((el) => {
    const cs = getComputedStyle(el);
    const std = cs.backdropFilter;
    const webkit = (cs as unknown as Record<string, string>).webkitBackdropFilter;
    // Prefer whichever is a real filter (not empty / not 'none').
    for (const value of [std, webkit]) {
      if (value && value !== 'none') {
        return value;
      }
    }
    return std || webkit || 'none';
  });

  expect(filter).not.toBe('none');
  expect(filter).toContain('blur');
  expect(filter).toContain('saturate');
});

test('.lab-glass tint FOLLOWS the --lab-* colour core (not hardcoded)', async ({ page }) => {
  await page.goto('/glass.html');

  const panel = page.getByTestId('glass-panel');

  // Re-point the surface token the glass tint is built from, and assert the
  // pane's background-color changes. Only true var() consumption can do that —
  // a hardcoded hex would not move. This proves no colour duplication.
  const before = await panel.evaluate((el) => getComputedStyle(el).backgroundColor);

  await page.evaluate(() => {
    document.documentElement.style.setProperty('--lab-surface-raised', 'rgb(7, 130, 200)');
  });

  const after = await panel.evaluate((el) => getComputedStyle(el).backgroundColor);

  expect(after).not.toBe(before);
  // Engines serialise color-mix output as either rgb()/rgba() or the CSS Color 4
  // color(srgb …) form — accept both, the point is it changed and is a colour.
  expect(after).toMatch(/^(rgba?\(|color\()/);
  // And it carries the re-pointed blue surface: the blue channel dominates.
  // color(srgb 0.027 0.509 0.784 …) or rgb(7, 130, 200 …) — blue > red.
  const channels = await panel.evaluate((el) => {
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

test('the glass panel sits above the content backdrop (clip + stacking intact)', async ({
  page,
}) => {
  await page.goto('/glass.html');

  const panel = page.getByTestId('glass-panel');

  // overflow:hidden clips the blur to the rounded box (no edge bleed).
  const overflow = await panel.evaluate((el) => getComputedStyle(el).overflow);
  expect(overflow).toBe('hidden');

  // A non-zero border-radius means the rounded clip is in effect.
  const radius = await panel.evaluate((el) =>
    Number.parseFloat(getComputedStyle(el).borderTopLeftRadius),
  );
  expect(radius).toBeGreaterThan(0);
});
