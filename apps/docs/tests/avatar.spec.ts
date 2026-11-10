import { type Page, expect, test } from '@playwright/test';
import { waitForThemePaint } from './helpers/theme-paint.js';

/**
 * Avatar suite — a presentational primitive, verified on BOTH renderers.
 *
 *   1. Delivered HTML carries the Lit element; the React island mounts client-side.
 *   2. Honest fallback — no src ⇒ initials; no src + no name ⇒ the anonymous glyph.
 *   3. a11y — the initials disc is role="img" with the name as its accessible label.
 *   4. Visual parity — disc surface, label colour, and status-dot colour match.
 *   5. Theme — flipping [data-theme] re-skins both renderers.
 */

const bg = (el: HTMLElement) => getComputedStyle(el).backgroundColor;
const fg = (el: HTMLElement) => getComputedStyle(el).color;

/** The painted disc for a Lit host is .avatar in its shadow root. */
function litDisc(page: Page, testid: string) {
  return page.getByTestId(testid).locator('.avatar');
}
function reactDisc(page: Page, testid: string) {
  return page.getByTestId(testid).locator('.lab-avatar-disc');
}
function litStatus(page: Page, testid: string) {
  return page.getByTestId(testid).locator('.status');
}
function reactStatus(page: Page, testid: string) {
  return page.getByTestId(testid).locator('.lab-avatar-status');
}

test.beforeEach(async ({ page }) => {
  await page.goto('/avatar.html');
});

test('delivered HTML carries the Lit element (React island mounts on the client)', async ({
  request,
}) => {
  const body = await (await request.get('/avatar.html')).text();
  expect(body).toMatch(/<lab-avatar/i);
  expect(body).toContain('id="react-root"');
});

test('honest fallback: a name with no image renders initials on both renderers', async ({
  page,
}) => {
  await expect(reactDisc(page, 'react-brand-online')).toBeVisible();
  // "Ada Lovelace" → "AL"; no <img> because no src was given.
  await expect(litDisc(page, 'lit-brand-online')).toContainText('AL');
  await expect(reactDisc(page, 'react-brand-online')).toContainText('AL');
  await expect(page.getByTestId('lit-brand-online').locator('img')).toHaveCount(0);
  await expect(page.getByTestId('react-brand-online').locator('img')).toHaveCount(0);
});

test('honest fallback: no name and no image renders the anonymous glyph, not initials', async ({
  page,
}) => {
  // The anonymous specimen has neither src nor name → a person glyph (an <svg>),
  // never a broken image and never stray letters.
  await expect(litDisc(page, 'lit-anon').locator('svg')).toHaveCount(1);
  await expect(reactDisc(page, 'react-anon').locator('svg')).toHaveCount(1);
});

test('a11y: the initials disc is role="img" with the name as its label', async ({ page }) => {
  await expect(reactDisc(page, 'react-success-away')).toHaveAttribute('role', 'img');
  await expect(reactDisc(page, 'react-success-away')).toHaveAttribute('aria-label', 'Grace Hopper');
  await expect(litDisc(page, 'lit-success-away')).toHaveAttribute('role', 'img');
  await expect(litDisc(page, 'lit-success-away')).toHaveAttribute('aria-label', 'Grace Hopper');
});

test('a11y: the status meaning is not colour-only (a visually-hidden label carries it)', async ({
  page,
}) => {
  await expect(page.getByTestId('lit-danger-dnd')).toContainText('Do not disturb');
  await expect(page.getByTestId('react-danger-dnd')).toContainText('Do not disturb');
});

test('visual parity: disc surface + label colour match per colour family', async ({ page }) => {
  await waitForThemePaint(
    page,
    litDisc(page, 'lit-brand-online'),
    reactDisc(page, 'react-brand-online'),
  );
  await expect(reactDisc(page, 'react-brand-online')).toBeVisible();
  for (const variant of [
    'brand-online',
    'success-away',
    'danger-dnd',
    'neutral-offline',
  ] as const) {
    const lit = litDisc(page, `lit-${variant}`);
    const react = reactDisc(page, `react-${variant}`);
    expect(await react.evaluate(bg), `${variant}: disc surface parity`).toBe(
      await lit.evaluate(bg),
    );
    expect(await react.evaluate(fg), `${variant}: initials colour parity`).toBe(
      await lit.evaluate(fg),
    );
  }
});

test('visual parity: the online status dot resolves the same colour on both renderers', async ({
  page,
}) => {
  await waitForThemePaint(
    page,
    litStatus(page, 'lit-brand-online'),
    reactStatus(page, 'react-brand-online'),
  );
  const lit = litStatus(page, 'lit-brand-online');
  const react = reactStatus(page, 'react-brand-online');
  await expect(react).toBeVisible();
  expect(await react.evaluate(bg)).toBe(await lit.evaluate(bg));
});

test('theme: flipping [data-theme] re-skins both renderers with zero edits', async ({ page }) => {
  const lit = litDisc(page, 'lit-brand-online');
  const react = reactDisc(page, 'react-brand-online');
  await expect(react).toBeVisible();

  const litDark = await lit.evaluate(bg);
  const reactDark = await react.evaluate(bg);

  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));

  await expect.poll(() => lit.evaluate(bg)).not.toBe(litDark);
  await expect.poll(() => react.evaluate(bg)).not.toBe(reactDark);
});
