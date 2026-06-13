import { type Locator, type Page, expect, test } from '@playwright/test';

/**
 * Pagination suite — a component that OWNS a page value and so drives the
 * @zag-js/pagination machine through the LabUI seam, verified on BOTH renderers.
 *
 * The fixture (`pagination.html`) mounts the Lit `<lab-pagination>` and the
 * native-React `<Pagination>` over the SAME data shape under one [data-theme].
 * These checks are its browser-side definition of done:
 *   1. Render — both renderers paint a nav with page items + prev/next.
 *   2. Current page — the seeded page carries data-selected + aria-current on both.
 *   3. Machine behaviour — clicking a page / Next moves the selection on both.
 *   4. Visual parity — the current page resolves the SAME computed background.
 *   5. Tokens + theme — re-pointing a role / flipping [data-theme] re-skins both.
 */

function litHost(page: Page, testid: string): Locator {
  return page.getByTestId(testid);
}
function litSelected(page: Page): Locator {
  return litHost(page, 'lit-pagination').locator('.item[data-selected]');
}
function reactSelected(page: Page): Locator {
  return page.getByTestId('react-pagination').locator('.lab-pagination-item[data-selected]');
}

const bg = (el: HTMLElement) => getComputedStyle(el).backgroundColor;

test.beforeEach(async ({ page }) => {
  await page.goto('/pagination.html');
});

test('delivered HTML carries the Lit element (React island mounts client-side)', async ({
  request,
}) => {
  const body = await (await request.get('/pagination.html')).text();
  expect(body).toMatch(/<lab-pagination/i);
  expect(body).toContain('id="react-root"');
});

test('render: both renderers expose page items and prev/next triggers', async ({ page }) => {
  await expect(litHost(page, 'lit-pagination').locator('.item').first()).toBeVisible();
  await expect(litHost(page, 'lit-pagination').locator('.trigger-prev')).toBeVisible();
  await expect(litHost(page, 'lit-pagination').locator('.trigger-next')).toBeVisible();
  await expect(
    page.getByTestId('react-pagination').locator('.lab-pagination-item').first(),
  ).toBeVisible();
});

test('current page: the seeded page is selected + aria-current on both renderers', async ({
  page,
}) => {
  await expect(litSelected(page)).toHaveText('8');
  await expect(litSelected(page)).toHaveAttribute('aria-current', 'page');
  await expect(reactSelected(page)).toHaveText('8');
  await expect(reactSelected(page)).toHaveAttribute('aria-current', 'page');
});

test('machine behaviour: clicking Next advances the page on both renderers', async ({ page }) => {
  await litHost(page, 'lit-pagination').locator('.trigger-next').click();
  await expect(litSelected(page)).toHaveText('9');

  await page.getByTestId('react-pagination').locator('.lab-pagination-trigger').last().click();
  await expect(reactSelected(page)).toHaveText('9');
});

test('visual parity: Lit and React resolve the same current-page background', async ({ page }) => {
  await expect(reactSelected(page)).toBeVisible();
  expect(await reactSelected(page).evaluate(bg)).toBe(await litSelected(page).evaluate(bg));
});

test('tokens: re-pointing --lab-fill-accent re-skins BOTH current pages', async ({ page }) => {
  await expect(reactSelected(page)).toBeVisible();
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--lab-fill-accent', 'rgb(1, 2, 3)');
  });
  await expect.poll(() => litSelected(page).evaluate(bg)).toBe('rgb(1, 2, 3)');
  await expect.poll(() => reactSelected(page).evaluate(bg)).toBe('rgb(1, 2, 3)');
});

test('theme: flipping [data-theme] re-skins both renderers with zero edits', async ({ page }) => {
  await expect(reactSelected(page)).toBeVisible();
  const litDark = await litSelected(page).evaluate(bg);
  const reactDark = await reactSelected(page).evaluate(bg);

  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));

  await expect.poll(() => litSelected(page).evaluate(bg)).not.toBe(litDark);
  await expect.poll(() => reactSelected(page).evaluate(bg)).not.toBe(reactDark);
});
