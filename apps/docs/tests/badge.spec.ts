import { type Page, expect, test } from '@playwright/test';

/**
 * Badge suite — a presentational primitive, verified on BOTH renderers.
 *
 * The fixture (`badge.html`) mounts the Lit `<lab-badge>` and the native-React
 * `<Badge>` with identical specimens under one [data-theme]:
 *   1. Delivered HTML carries the Lit element; the React island mounts client-side.
 *   2. Visual parity — matching specimens resolve the SAME computed colours.
 *   3. Semantics — Badge is a non-interactive label (no button role, not focusable).
 *   4. Tokens + theme — re-pointing a role and flipping [data-theme] re-skin both.
 */

const bg = (el: HTMLElement) => getComputedStyle(el).backgroundColor;
const fg = (el: HTMLElement) => getComputedStyle(el).color;

/** The painted surface for a Lit host is the inner .badge in its shadow root. */
function litBadge(page: Page, testid: string) {
  return page.getByTestId(testid).locator('.badge');
}
function reactBadge(page: Page, testid: string) {
  // React sets data-testid on the [data-lab-badge] span — the painted node itself.
  return page.getByTestId(testid);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/badge.html');
});

test('delivered HTML carries the Lit element (React island mounts on the client)', async ({
  request,
}) => {
  const body = await (await request.get('/badge.html')).text();
  expect(body).toMatch(/<lab-badge/i);
  expect(body).toContain('id="react-root"');
});

test('visual parity: Lit and React resolve the same surface + label colours', async ({ page }) => {
  await expect(reactBadge(page, 'react-brand-fill')).toBeVisible();

  for (const variant of [
    'brand-fill',
    'success-tinted',
    'danger-fill',
    'neutral-tinted',
  ] as const) {
    const lit = litBadge(page, `lit-${variant}`);
    const react = reactBadge(page, `react-${variant}`);

    expect(await react.evaluate(bg), `${variant}: background parity`).toBe(await lit.evaluate(bg));
    expect(await react.evaluate(fg), `${variant}: label parity`).toBe(await lit.evaluate(fg));
  }
});

test('semantics: badge is a non-interactive label, not a button', async ({ page }) => {
  // No button role on either renderer, and it is not in the tab order.
  await expect(page.getByTestId('react-brand-fill')).not.toHaveAttribute('role', 'button');
  const reactTabIndex = await reactBadge(page, 'react-brand-fill').getAttribute('tabindex');
  expect(reactTabIndex).toBeNull();
  // The Lit host exposes no inner <button>.
  await expect(page.getByTestId('lit-brand-fill').locator('button')).toHaveCount(0);
});

test('disabled badge dims identically on both renderers', async ({ page }) => {
  const litOpacity = await litBadge(page, 'lit-disabled').evaluate(
    (el) => getComputedStyle(el).opacity,
  );
  const reactOpacity = await reactBadge(page, 'react-disabled').evaluate(
    (el) => getComputedStyle(el).opacity,
  );
  expect(reactOpacity).toBe(litOpacity);
  expect(Number(litOpacity)).toBeLessThan(1);
});

test('tokens: re-pointing --lab-badge-fill-brand re-skins BOTH fill renderers', async ({
  page,
}) => {
  const lit = litBadge(page, 'lit-brand-fill');
  const react = reactBadge(page, 'react-brand-fill');
  await expect(react).toBeVisible();

  await page.evaluate(() => {
    document.documentElement.style.setProperty('--lab-badge-fill-brand', 'rgb(1, 2, 3)');
  });

  await expect.poll(() => lit.evaluate(bg)).toBe('rgb(1, 2, 3)');
  await expect.poll(() => react.evaluate(bg)).toBe('rgb(1, 2, 3)');
});

test('theme: flipping [data-theme] re-skins both renderers with zero edits', async ({ page }) => {
  const lit = litBadge(page, 'lit-neutral-tinted');
  const react = reactBadge(page, 'react-neutral-tinted');
  await expect(react).toBeVisible();

  const litDark = await lit.evaluate(fg);
  const reactDark = await react.evaluate(fg);

  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));

  await expect.poll(() => lit.evaluate(fg)).not.toBe(litDark);
  await expect.poll(() => react.evaluate(fg)).not.toBe(reactDark);
});
