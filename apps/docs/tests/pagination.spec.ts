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

/**
 * The CASE-SENSITIVE accessible name on a trigger. Playwright's `getByLabel` is
 * case-INSENSITIVE, so it cannot catch a lowercase/uppercase drift between the two
 * renderers (the audit finding). Reading the raw attribute makes the casing
 * load-bearing in the assertion — the drift cannot silently return.
 */
function ariaLabel(locator: Locator): Promise<string | null> {
  return locator.getAttribute('aria-label');
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
  const reactEllipsis = page.getByTestId('react-pagination').locator('.lab-pagination-ellipsis');

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

test('a11y name: prev/next carry the SAME capitalized accessible name on both renderers', async ({
  page,
}) => {
  // Case-SENSITIVE: the regression was Lit emitting Zag's lowercase 'previous page'
  // (its spread overwrote the template) while React kept 'Previous page'. Assert the
  // exact string on each renderer so the casing — not just the words — is verified.
  await expect(reactPrev(page)).toBeVisible();

  expect(await ariaLabel(litPrev(page)), 'Lit prev accessible name').toBe('Previous page');
  expect(await ariaLabel(litNext(page)), 'Lit next accessible name').toBe('Next page');
  expect(await ariaLabel(reactPrev(page)), 'React prev accessible name').toBe('Previous page');
  expect(await ariaLabel(reactNext(page)), 'React next accessible name').toBe('Next page');

  // And the two renderers agree with each other (parity, not just per-renderer).
  expect(await ariaLabel(litPrev(page))).toBe(await ariaLabel(reactPrev(page)));
  expect(await ariaLabel(litNext(page))).toBe(await ariaLabel(reactNext(page)));
});

test('keyboard: Tab order + Enter/Space activate page and prev/next (Lit)', async ({ page }) => {
  // The machine wires real <button>s, so focus + Enter/Space are the PLATFORM
  // defaults, never a re-implemented key handler. Fixture seeds page 8 of 20, so
  // both prev and next start enabled — a deterministic mid-range starting point.
  const host = litHost(page, 'lit-pagination');
  const focus = (selector: string) =>
    host.evaluate((el, sel) => {
      (el as HTMLElement).shadowRoot?.querySelector<HTMLElement>(sel)?.focus();
    }, selector);
  const focusedClass = () =>
    host.evaluate((el) => (el as HTMLElement).shadowRoot?.activeElement?.className ?? null);

  // --- Space on the focused next trigger advances one page (seeded page 8 → 9) ---
  await expect(litSelected(page)).toHaveText('8');
  await focus('.trigger-next');
  await page.keyboard.press('Space');
  await expect(litSelected(page)).toHaveText('9');

  // --- Space on the focused prev trigger steps back one page (9 → 8) ---
  await focus('.trigger-prev');
  await page.keyboard.press('Space');
  await expect(litSelected(page)).toHaveText('8');

  // --- Tab order: prev trigger is the first tab stop; Tab advances onto a page item ---
  await focus('.trigger-prev');
  expect(await focusedClass(), 'prev trigger is the first tab stop').toContain('trigger-prev');
  await page.keyboard.press('Tab');
  expect(await focusedClass(), 'Tab advances onto a page item button').toContain('item');

  // --- Enter activates the FOCUSED page button: it becomes the selected page.
  // Done last because it can collapse the rendered window around the new page. ---
  const focusedPageText = await host.evaluate(
    (el) => (el as HTMLElement).shadowRoot?.activeElement?.textContent ?? null,
  );
  await page.keyboard.press('Enter');
  await expect(litSelected(page)).toHaveText(focusedPageText ?? '');
});

test('keyboard: Enter activates page + prev/next on the React renderer', async ({ page }) => {
  // React mirror: focus the prev trigger, Tab to a page button, Enter to jump.
  await reactPrev(page).focus();
  await expect(reactPrev(page)).toBeFocused();

  await page.keyboard.press('Tab');
  // After Tab, a page item button holds focus inside the React island.
  const focusedIsItem = await page.evaluate(() =>
    document.activeElement?.classList.contains('lab-pagination-item'),
  );
  expect(focusedIsItem, 'Tab moved focus onto a React page item').toBe(true);

  const before = await reactSelected(page).textContent();
  await page.keyboard.press('Enter');
  await expect(reactSelected(page)).not.toHaveText(before ?? '');
});

test('event contract: Lit emits a page-change CustomEvent with detail {page,pageSize}', async ({
  page,
}) => {
  // The machine is the source of truth; the element re-broadcasts each page change
  // as a composed, bubbling CustomEvent whose detail is Zag's PageChangeDetails
  // ({ page, pageSize }). Capture the next event, then drive Next.
  const detail = await page.evaluate(() => {
    const host = document.querySelector('[data-testid="lit-pagination"]') as HTMLElement;
    return new Promise<{ page: number; pageSize: number }>((resolve) => {
      host.addEventListener(
        'page-change',
        (e) => resolve((e as CustomEvent<{ page: number; pageSize: number }>).detail),
        { once: true },
      );
      host.shadowRoot?.querySelector<HTMLElement>('.trigger-next')?.click();
    });
  });
  // Fixture seeds page 8; Next advances to 9. pageSize is the configured 10.
  expect(detail.page).toBe(9);
  expect(detail.pageSize).toBe(10);
});

test('event contract: React onPageChange fires with the new page (controlled instance)', async ({
  page,
}) => {
  // The controlled specimen records the last onPageChange page on a window flag.
  // It seeds page 3; clicking Next must report page 4 and the controlled view follows.
  const controlled = page.getByTestId('react-pagination-controlled');
  await expect(controlled.locator('.lab-pagination-item[data-selected]')).toHaveText('3');

  await controlled.getByLabel('Next page').click();

  await expect
    .poll(() => page.evaluate(() => (window as { __reactPageChange?: number }).__reactPageChange))
    .toBe(4);
  // Controlled mode: the consumer-owned `page` advanced, so the view shows 4.
  await expect(controlled.locator('.lab-pagination-item[data-selected]')).toHaveText('4');
});

test('siblingCount=0: only the current page sits between the boundary items (both renderers)', async ({
  page,
}) => {
  // With siblingCount=0 around page 8 of 20, the range collapses to
  // [1, …, 8, …, 20]: the first/last boundary (fixed at 1), ellipses, and the
  // current page only — no adjacent siblings. Exactly one page item is selected.
  const litSiblings0 = litHost(page, 'lit-pagination-siblings0');
  const reactSiblings0 = page.getByTestId('react-pagination-siblings0');

  await expect(litSiblings0.locator('.item[data-selected]')).toHaveText('8');
  await expect(reactSiblings0.locator('.lab-pagination-item[data-selected]')).toHaveText('8');

  // Boundaries 1 and 20 are present; the immediate siblings 7 and 9 are NOT.
  for (const [host, itemSel] of [
    [litSiblings0, '.item'],
    [reactSiblings0, '.lab-pagination-item'],
  ] as const) {
    await expect(host.locator(itemSel, { hasText: /^1$/ })).toBeVisible();
    await expect(host.locator(itemSel, { hasText: /^20$/ })).toBeVisible();
    await expect(host.locator(itemSel, { hasText: /^7$/ })).toHaveCount(0);
    await expect(host.locator(itemSel, { hasText: /^9$/ })).toHaveCount(0);
    // Ellipses bracket the current page on both sides.
    expect(await host.locator('.ellipsis, .lab-pagination-ellipsis').count()).toBe(2);
  }
});

test('controlled mode: the page attribute drives the selection on the Lit renderer', async ({
  page,
}) => {
  // The `page` attribute is SET (controlled), so the consumer owns the value: the
  // seeded page is 3, and the seam respects it rather than the default of 1.
  const controlled = litHost(page, 'lit-pagination-controlled');
  await expect(controlled.locator('.item[data-selected]')).toHaveText('3');
  await expect(controlled.locator('.item[data-selected]')).toHaveAttribute('aria-current', 'page');
});
