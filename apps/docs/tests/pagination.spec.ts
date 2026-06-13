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
function litPrev(page: Page): Locator {
  return litHost(page, 'lit-pagination').locator('.trigger-prev');
}
function litNext(page: Page): Locator {
  return litHost(page, 'lit-pagination').locator('.trigger-next');
}
/** Target prev/next by their accessible label, not `.first()`/`.last()` (robust). */
function reactPrev(page: Page): Locator {
  return page.getByTestId('react-pagination').getByLabel('Previous page');
}
function reactNext(page: Page): Locator {
  return page.getByTestId('react-pagination').getByLabel('Next page');
}
/** The boundary page item carrying `text`, on a renderer. */
function litPage(page: Page, text: string): Locator {
  return litHost(page, 'lit-pagination').locator('.item', { hasText: new RegExp(`^${text}$`) });
}
function reactPage(page: Page, text: string): Locator {
  return page
    .getByTestId('react-pagination')
    .locator('.lab-pagination-item', { hasText: new RegExp(`^${text}$`) });
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
  await litNext(page).click();
  await expect(litSelected(page)).toHaveText('9');

  // Target Next by its accessible label, not `.last()` — robust to control reorders.
  await reactNext(page).click();
  await expect(reactSelected(page)).toHaveText('9');
});

test('bounds: prev disables on the first page, next disables on the last (both renderers)', async ({
  page,
}) => {
  // Fixture seeds page 8 of 20 (count 200 / pageSize 10), so both bounds start
  // enabled. The first/last boundary items (1 and 20) are always rendered
  // (boundaryCount fixed at 1), so a single click reaches each edge.
  // Zag pagination (pagination.connect.js): prev `disabled` when isFirstPage,
  // next `disabled` when isLastPage — native button disabled, asserted directly.

  // --- Lit ---
  await expect(litPrev(page)).toBeEnabled();
  await expect(litNext(page)).toBeEnabled();

  await litPage(page, '1').click();
  await expect(litSelected(page)).toHaveText('1');
  await expect(litPrev(page)).toBeDisabled();
  await expect(litNext(page)).toBeEnabled();

  await litPage(page, '20').click();
  await expect(litSelected(page)).toHaveText('20');
  await expect(litNext(page)).toBeDisabled();
  await expect(litPrev(page)).toBeEnabled();

  // --- React ---
  await expect(reactPrev(page)).toBeEnabled();
  await expect(reactNext(page)).toBeEnabled();

  await reactPage(page, '1').click();
  await expect(reactSelected(page)).toHaveText('1');
  await expect(reactPrev(page)).toBeDisabled();
  await expect(reactNext(page)).toBeEnabled();

  await reactPage(page, '20').click();
  await expect(reactSelected(page)).toHaveText('20');
  await expect(reactNext(page)).toBeDisabled();
  await expect(reactPrev(page)).toBeEnabled();
});

test('ellipsis: present, aria-hidden, and not a button (both renderers)', async ({ page }) => {
  // 20 pages with siblingCount 1 around page 8 forces ellipses on both sides.
  const litEllipsis = litHost(page, 'lit-pagination').locator('.ellipsis');
  const reactEllipsis = page
    .getByTestId('react-pagination')
    .locator('.lab-pagination-ellipsis');

  for (const ellipsis of [litEllipsis, reactEllipsis]) {
    expect(await ellipsis.count()).toBeGreaterThan(0);
    await expect(ellipsis.first()).toHaveAttribute('aria-hidden', 'true');
    // Decorative — a <span>, never a <button>; cannot be a click target.
    expect((await ellipsis.first().evaluate((el) => el.tagName)).toLowerCase()).toBe('span');
  }
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
