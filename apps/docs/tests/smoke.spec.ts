import { expect, test } from '@playwright/test';

/**
 * Smoke + colors-integration test.
 *
 * Two guarantees for the bootstrap skeleton:
 *  1. The docs page renders (title visible).
 *  2. The `--lab-*` color contract from `@labui/colors` is applied — the
 *     heading's resolved color equals the `--lab-label-primary` token value,
 *     proving the integration point, not a hardcoded hex.
 *
 * Component/visual tests are added in `qa-playwright`, on this same harness.
 */

// Helper: parse a CSS color string to normalized rgb for comparison.
function normalizeColor(value: string): string {
  return value.replace(/\s+/g, '').toLowerCase();
}

test('docs page renders', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('title')).toHaveText('LabUI');
  await expect(page.getByTestId('title')).toBeVisible();
  await expect(page.getByTestId('tagline')).toBeVisible();
});

test('heading applies the --lab-label-primary token from @labui/colors', async ({ page }) => {
  await page.goto('/');

  const title = page.getByTestId('title');

  // The token value declared by the @labui/colors contract, read from :root.
  const tokenValue = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--lab-label-primary').trim(),
  );
  // The generated Lab UI colour contract must actually be loaded.
  expect(tokenValue.length).toBeGreaterThan(0);

  // The heading's resolved color must equal the token — i.e. it comes from the
  // package contract, not a literal hardcoded somewhere else.
  const headingColor = await title.evaluate((el) => getComputedStyle(el).color);

  // Browsers report `color` as rgb(); resolve the token through the same engine
  // by painting it on a throwaway element and reading it back.
  const tokenAsRgb = await page.evaluate((raw) => {
    const probe = document.createElement('span');
    probe.style.color = raw;
    document.body.appendChild(probe);
    const resolved = getComputedStyle(probe).color;
    probe.remove();
    return resolved;
  }, tokenValue);

  expect(normalizeColor(headingColor)).toBe(normalizeColor(tokenAsRgb));

  // The decisive check (CodeRabbit #1): equality above would also pass if the
  // heading hardcoded the same hex. Re-point the token at :root and assert the
  // heading FOLLOWS it — only true var() consumption can do that.
  const sentinel = 'rgb(1, 2, 3)';
  await page.evaluate((value) => {
    document.documentElement.style.setProperty('--lab-label-primary', value);
  }, sentinel);
  const followedColor = await title.evaluate((el) => getComputedStyle(el).color);
  expect(normalizeColor(followedColor)).toBe(normalizeColor(sentinel));
});
