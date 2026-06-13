import { expect, test } from '@playwright/test';

/**
 * Core-scaffold PROOF smoke — proves the whole seam works on the Lit renderer.
 *
 * `<lab-proof>` is a PROOF element, not the production Button. These checks are
 * the scaffold's definition of done on the browser side:
 *   1. SSR — the delivered HTML carries declarative shadow DOM (styled first
 *      paint, no FOUC) before any JS runs.
 *   2. Render — the element upgrades and shows its inner button.
 *   3. Behavior — a click runs the Zag toggle machine: aria-pressed flips and
 *      the host's reflected `pressed` attribute follows.
 *   4. Tokens — the pressed surface resolves a `--lab-*` role, and re-pointing
 *      that role on the root re-skins the element (proves var() consumption, not
 *      a hardcoded colour).
 *   5. Theme — flipping `[data-theme]` on the root re-skins the element with
 *      zero element edits.
 */

test('SSR: delivered HTML carries declarative shadow DOM with a token', async ({ request }) => {
  // Read the raw HTML the server delivers — NOT the hydrated DOM. The SSR island
  // must already contain the DSD template before any client JS runs.
  const res = await request.get('/proof.html');
  const body = await res.text();
  expect(body).toMatch(/shadowrootmode="open"/i);
  expect(body).toMatch(/<button/i);
  expect(body).toMatch(/var\(--lab-/);
});

test('render + toggle behavior: click flips aria-pressed and the host attribute', async ({
  page,
}) => {
  await page.goto('/proof.html');
  const proof = page.getByTestId('proof-client');
  await expect(proof).toBeVisible();

  // The inner button is in the shadow root; Playwright pierces it.
  const button = proof.locator('button');
  await expect(button).toBeVisible();
  await expect(button).toHaveAttribute('aria-pressed', 'false');
  await expect(proof).not.toHaveAttribute('pressed', /.*/);

  await button.click();

  // The Zag machine drove the transition: ARIA + reflected host attribute agree.
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await expect(proof).toHaveAttribute('pressed', '');

  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'false');
});

test('tokens: pressed surface follows the --lab-fill-accent role', async ({ page }) => {
  await page.goto('/proof.html');
  const proof = page.getByTestId('proof-client');
  const button = proof.locator('button');
  await button.click(); // press → accent fill role
  // Wait for the machine→reflect cycle to land before reading paint.
  await expect(proof).toHaveAttribute('pressed', '');

  // Re-point the role on the root; the pressed button must follow it. Only true
  // var() consumption can do this — a hardcoded hex would not move.
  const sentinel = 'rgb(1, 2, 3)';
  await page.evaluate((value) => {
    document.documentElement.style.setProperty('--lab-fill-accent', value);
  }, sentinel);

  await expect
    .poll(() => button.evaluate((el) => getComputedStyle(el).backgroundColor))
    .toBe('rgb(1, 2, 3)');
});

test('theme: flipping [data-theme] re-skins the proof with zero element edits', async ({
  page,
}) => {
  await page.goto('/proof.html');
  const proof = page.getByTestId('proof-client');
  const button = proof.locator('button');

  // Read a role the theme rebinds: the unpressed border uses --lab-border-neutral,
  // which the demo theme defines distinctly per theme.
  const darkBorder = await button.evaluate((el) => getComputedStyle(el).borderTopColor);

  // One attribute flip on the root — the element does not know about themes.
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));

  await expect
    .poll(() => button.evaluate((el) => getComputedStyle(el).borderTopColor))
    .not.toBe(darkBorder);
});
