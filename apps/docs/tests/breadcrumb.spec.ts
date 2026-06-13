import { type Locator, type Page, expect, test } from '@playwright/test';

/**
 * Breadcrumb suite — a PRESENTATIONAL navigation primitive (no machine), verified
 * on BOTH renderers.
 *
 * The fixture (`breadcrumb.html`) mounts the Lit `<lab-breadcrumb>` and the
 * native-React `<Breadcrumb>` with identical crumbs under one [data-theme]. These
 * checks are its browser-side definition of done:
 *   1. Render — both renderers paint a real nav landmark + ordered list.
 *   2. Semantics — links carry href; the last crumb is current (aria-current=page),
 *      not a link.
 *   3. Visual parity — the current crumb resolves the SAME computed colour.
 *   4. Tokens + theme — re-pointing a role / flipping [data-theme] re-skins both.
 */

function litHost(page: Page, testid: string): Locator {
  return page.getByTestId(testid);
}
function litCurrent(page: Page): Locator {
  return litHost(page, 'lit-breadcrumb').locator('.current');
}
function reactCurrent(page: Page): Locator {
  return page.getByTestId('react-breadcrumb').locator('.lab-breadcrumb-current');
}

const color = (el: HTMLElement) => getComputedStyle(el).color;

test.beforeEach(async ({ page }) => {
  await page.goto('/breadcrumb.html');
});

test('delivered HTML carries the Lit element (React island mounts client-side)', async ({
  request,
}) => {
  const body = await (await request.get('/breadcrumb.html')).text();
  expect(body).toMatch(/<lab-breadcrumb/i);
  expect(body).toContain('id="react-root"');
});

test('semantics: a nav landmark + ordered list of links on both renderers', async ({ page }) => {
  for (const host of [litHost(page, 'lit-breadcrumb'), page.getByTestId('react-breadcrumb')]) {
    await expect(host.locator('nav[aria-label="Breadcrumb"]')).toBeVisible();
    await expect(host.locator('ol')).toBeVisible();
    // Intermediate crumbs are real links.
    await expect(host.locator('a[href="#home"]')).toBeVisible();
  }
});

test('the final crumb is the current page (aria-current), not a link', async ({ page }) => {
  await expect(litCurrent(page)).toHaveAttribute('aria-current', 'page');
  await expect(litCurrent(page)).toHaveText('Breadcrumb');
  // It must not be an anchor.
  await expect(litHost(page, 'lit-breadcrumb').locator('a:has-text("Breadcrumb")')).toHaveCount(0);

  await expect(reactCurrent(page)).toHaveAttribute('aria-current', 'page');
  await expect(reactCurrent(page)).toHaveText('Breadcrumb');
});

test('separators: aria-hidden and exactly items-1 of them (both renderers)', async ({ page }) => {
  // The fixture renders 4 crumbs → 3 separators, and the last crumb has none
  // (you don't separate past the current page). Separators are decorative, so a
  // screen reader announces the trail, not the punctuation.
  const litSeparators = litHost(page, 'lit-breadcrumb').locator('.separator');
  const reactSeparators = page.getByTestId('react-breadcrumb').locator('.lab-breadcrumb-separator');

  for (const separators of [litSeparators, reactSeparators]) {
    await expect(separators).toHaveCount(3); // 4 crumbs − 1
    await expect(separators.first()).toHaveAttribute('aria-hidden', 'true');
  }
});

test('visual parity: Lit and React resolve the same current-crumb colour', async ({ page }) => {
  await expect(reactCurrent(page)).toBeVisible();
  expect(await reactCurrent(page).evaluate(color)).toBe(await litCurrent(page).evaluate(color));
});

test('tokens: re-pointing --lab-label-primary re-skins BOTH current crumbs', async ({ page }) => {
  await expect(reactCurrent(page)).toBeVisible();
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--lab-label-primary', 'rgb(1, 2, 3)');
  });
  await expect.poll(() => litCurrent(page).evaluate(color)).toBe('rgb(1, 2, 3)');
  await expect.poll(() => reactCurrent(page).evaluate(color)).toBe('rgb(1, 2, 3)');
});

test('theme: flipping [data-theme] re-skins both renderers with zero edits', async ({ page }) => {
  await expect(reactCurrent(page)).toBeVisible();
  const litDark = await litCurrent(page).evaluate(color);
  const reactDark = await reactCurrent(page).evaluate(color);

  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));

  await expect.poll(() => litCurrent(page).evaluate(color)).not.toBe(litDark);
  await expect.poll(() => reactCurrent(page).evaluate(color)).not.toBe(reactDark);
});
