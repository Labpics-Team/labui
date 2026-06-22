import { expect, test } from '@playwright/test';

/**
 * Motion e2e — reduced-motion differential
 * Class: e2e
 * Invariant 4 — reduced-motion honoured at the API boundary, always.
 *
 * Differential test:
 *   A. With `reducedMotion: 'reduce'` emulated → the box jumps to left=200px
 *      in a single step (no multi-frame animation).
 *   B. Without emulation → the box moves via the spring driver over multiple frames
 *      (animated motion is present).
 *
 * This is a REAL emulated-media differential:
 *   - Playwright chromium: supports `reducedMotion` override via page.emulateMedia().
 *   - Playwright webkit: ditto.
 *   - The fixture HTML reads `window.matchMedia('(prefers-reduced-motion: reduce)')`.
 *   - The @labpics/ui-motion driver honours this query.
 *
 * RED proof:
 *   The @labpics/ui-motion package is a placeholder. When the fixture page
 *   loads, the `import { drive } from '@labpics/ui-motion'` fails (drive is
 *   not exported) → status="error" → the `data-testid="status"` check
 *   `toHaveText('done')` fails → RED for the right reason.
 *
 * Mutation proof (for when implemented — how="mutation"):
 *   Remove the `matchMedia` check from the driver → the reduce branch never
 *   fires → even with reducedMotion emulated, `frameCount > 1` → the
 *   `toEqual('1')` assertion fails.
 */

test.describe('reduced-motion differential (invariant 4)', () => {
  test('with reducedMotion:reduce — box reaches final position in <=1 frame (chromium)', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/motion.html');

    // Wait for the animation to finish (status flips to "done" when drive() resolves).
    await expect(page.getByTestId('status')).toHaveText('done', { timeout: 10_000 });

    const box = page.getByTestId('animated-box');

    // Final position must reach the target (200px).
    const finalLeft = await box.getAttribute('data-final-left');
    expect(Number(finalLeft)).toBe(200);

    // With reduce, the driver must NOT have looped — frame count must be <=1.
    const frameCount = await box.getAttribute('data-frame-count');
    expect(Number(frameCount)).toBeLessThanOrEqual(1);
  });

  test('without reducedMotion — box animates over multiple frames (chromium)', async ({ page }) => {
    // No reducedMotion emulation — the driver runs the full spring loop.
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/motion.html');

    await expect(page.getByTestId('status')).toHaveText('done', { timeout: 10_000 });

    const box = page.getByTestId('animated-box');

    const finalLeft = await box.getAttribute('data-final-left');
    expect(Number(finalLeft)).toBe(200);

    // Without reduce, the spring driver must have produced multiple frames.
    const frameCount = await box.getAttribute('data-frame-count');
    expect(Number(frameCount)).toBeGreaterThan(1);
  });

  test('with reducedMotion:reduce — box reaches final position in <=1 frame (webkit)', async ({
    page,
    browserName,
  }) => {
    // WebKit is included per the Playwright config (materials/shadow cross-engine checks).
    test.skip(browserName !== 'webkit', 'WebKit-specific variant');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/motion.html');

    await expect(page.getByTestId('status')).toHaveText('done', { timeout: 10_000 });

    const box = page.getByTestId('animated-box');
    const finalLeft = await box.getAttribute('data-final-left');
    expect(Number(finalLeft)).toBe(200);

    const frameCount = await box.getAttribute('data-frame-count');
    expect(Number(frameCount)).toBeLessThanOrEqual(1);
  });

  test('without reducedMotion — box animates over multiple frames (webkit)', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'webkit', 'WebKit-specific variant');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/motion.html');

    await expect(page.getByTestId('status')).toHaveText('done', { timeout: 10_000 });

    const box = page.getByTestId('animated-box');
    const finalLeft = await box.getAttribute('data-final-left');
    expect(Number(finalLeft)).toBe(200);

    const frameCount = await box.getAttribute('data-frame-count');
    expect(Number(frameCount)).toBeGreaterThan(1);
  });
});
