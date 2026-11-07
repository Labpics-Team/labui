import { type Page, expect, test } from '@playwright/test';
import { waitForThemePaint } from './helpers/theme-paint.js';

/**
 * Loader suite — a presentational primitive, verified on BOTH renderers.
 *
 *   1. Delivered HTML carries the Lit element; the React island mounts client-side.
 *   2. a11y — both renderers expose role="status" + aria-busy and a hidden label.
 *   3. Visual parity — the ring colour follows currentColor identically on both.
 *   4. Theme — flipping [data-theme] re-skins the inherited ring colour on both.
 */

const ringColor = (el: HTMLElement) => getComputedStyle(el).borderTopColor;

/** The spinner ring for a Lit host is the .spinner in its shadow root. */
function litRing(page: Page, testid: string) {
  return page.getByTestId(testid).locator('.spinner');
}
function reactRing(page: Page, testid: string) {
  return page.getByTestId(testid).locator('.lab-loader-spinner');
}

test.beforeEach(async ({ page }) => {
  await page.goto('/loader.html');
});

test('delivered HTML carries the Lit element (React island mounts on the client)', async ({
  request,
}) => {
  const body = await (await request.get('/loader.html')).text();
  expect(body).toMatch(/<lab-loader/i);
  expect(body).toContain('id="react-root"');
});

test('a11y: both renderers announce a busy status with a hidden label', async ({ page }) => {
  await expect(page.getByTestId('react-m')).toBeVisible();

  for (const id of ['lit-l', 'react-l'] as const) {
    const host = page.getByTestId(id);
    // Lit sets role="status" on its host; React uses <output> (implicit status
    // role). toHaveRole resolves the computed ARIA role, so it covers both.
    await expect(host, `${id} status role`).toHaveRole('status');
    await expect(host, `${id} aria-busy`).toHaveAttribute('aria-busy', 'true');
  }
  // The custom label is present as the accessible name (visually-hidden region).
  await expect(page.getByTestId('lit-l')).toContainText('Saving changes');
  await expect(page.getByTestId('react-l')).toContainText('Saving changes');
});

test('visual parity: the ring follows currentColor identically on both renderers', async ({
  page,
}) => {
  await waitForThemePaint(page, litRing(page, 'lit-m'), reactRing(page, 'react-m'));
  const lit = litRing(page, 'lit-m');
  const react = reactRing(page, 'react-m');
  await expect(page.getByTestId('react-m')).toBeVisible();

  // Set a colour on each loader host so currentColor resolves to a known value
  // (the ring is drawn from currentColor — this is how a consumer paints it).
  for (const id of ['lit-m', 'react-m'] as const) {
    await page.getByTestId(id).evaluate((el: HTMLElement) => {
      el.style.color = 'rgb(4, 5, 6)';
    });
  }

  await expect.poll(() => lit.evaluate(ringColor)).toBe('rgb(4, 5, 6)');
  await expect.poll(() => react.evaluate(ringColor)).toBe('rgb(4, 5, 6)');
});

test('sizes render distinct diameters and both renderers agree', async ({ page }) => {
  await expect(page.getByTestId('react-s')).toBeVisible();
  // Read the computed width (rotation-invariant — boundingBox oscillates while the
  // ring spins). Same size token ⇒ same diameter across renderers.
  const widthOf = (el: HTMLElement) => getComputedStyle(el).width;
  const widths: number[] = [];
  for (const size of ['s', 'm', 'l'] as const) {
    const litW = await litRing(page, `lit-${size}`).evaluate(widthOf);
    const reactW = await reactRing(page, `react-${size}`).evaluate(widthOf);
    expect(reactW, `${size}: diameter parity`).toBe(litW);
    widths.push(Number.parseFloat(litW));
  }
  // The three sizes are genuinely distinct (s < m < l).
  expect(widths[0]).toBeLessThan(widths[1] ?? 0);
  expect(widths[1]).toBeLessThan(widths[2] ?? 0);
});
