import { type Page, expect, test } from '@playwright/test';
import { waitForThemePaint } from './helpers/theme-paint.js';

/**
 * Kbd suite — a presentational primitive, verified on BOTH renderers.
 *
 *   1. Delivered HTML carries the Lit element; the React island mounts client-side.
 *   2. Semantics — both renderers use a real <kbd> element (keyboard-input meaning).
 *   3. Visual parity — matching sizes resolve the SAME computed surface/rim/text.
 *   4. Tokens + theme — re-pointing a role and flipping [data-theme] re-skin both.
 */

const bg = (el: HTMLElement) => getComputedStyle(el).backgroundColor;
const fg = (el: HTMLElement) => getComputedStyle(el).color;
const border = (el: HTMLElement) => getComputedStyle(el).borderTopColor;

/** The painted cap for a Lit host is the inner <kbd> in its shadow root. */
function litKbd(page: Page, testid: string) {
  return page.getByTestId(testid).locator('kbd');
}
function reactKbd(page: Page, testid: string) {
  // React renders the <kbd> directly with the data-testid on it.
  return page.getByTestId(testid);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/kbd.html');
});

test('delivered HTML carries the Lit element (React island mounts on the client)', async ({
  request,
}) => {
  const body = await (await request.get('/kbd.html')).text();
  expect(body).toMatch(/<lab-kbd/i);
  expect(body).toContain('id="react-root"');
});

test('semantics: both renderers use a real <kbd> element', async ({ page }) => {
  await expect(reactKbd(page, 'react-m')).toBeVisible();
  // React node IS a <kbd>.
  expect(await reactKbd(page, 'react-m').evaluate((el) => el.tagName.toLowerCase())).toBe('kbd');
  // Lit host contains a <kbd> in its shadow root.
  await expect(litKbd(page, 'lit-m')).toHaveCount(1);
});

test('visual parity: Lit and React resolve the same cap colours per size', async ({ page }) => {
  await waitForThemePaint(page, litKbd(page, 'lit-m'), reactKbd(page, 'react-m'));
  await expect(reactKbd(page, 'react-m')).toBeVisible();

  for (const size of ['s', 'm', 'l'] as const) {
    const lit = litKbd(page, `lit-${size}`);
    const react = reactKbd(page, `react-${size}`);

    expect(await react.evaluate(bg), `${size}: surface parity`).toBe(await lit.evaluate(bg));
    expect(await react.evaluate(fg), `${size}: text parity`).toBe(await lit.evaluate(fg));
    expect(await react.evaluate(border), `${size}: rim parity`).toBe(await lit.evaluate(border));
  }
});

test('tokens: re-pointing --lab-fill-primary re-skins BOTH renderers', async ({ page }) => {
  const lit = litKbd(page, 'lit-m');
  const react = reactKbd(page, 'react-m');
  await expect(react).toBeVisible();

  await page.evaluate(() => {
    document.documentElement.style.setProperty('--lab-fill-primary', 'rgb(1, 2, 3)');
  });

  await expect.poll(() => lit.evaluate(bg)).toBe('rgb(1, 2, 3)');
  await expect.poll(() => react.evaluate(bg)).toBe('rgb(1, 2, 3)');
});

test('theme: flipping [data-theme] re-skins both renderers with zero edits', async ({ page }) => {
  const lit = litKbd(page, 'lit-m');
  const react = reactKbd(page, 'react-m');
  await expect(react).toBeVisible();

  const litDark = await lit.evaluate(fg);
  const reactDark = await react.evaluate(fg);

  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));

  await expect.poll(() => lit.evaluate(fg)).not.toBe(litDark);
  await expect.poll(() => react.evaluate(fg)).not.toBe(reactDark);
});
