import { type Locator, type Page, expect, test } from '@playwright/test';
import { waitForThemePaint } from './helpers/theme-paint.js';

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
 *   3. Hrefless non-current crumb (Figma "disabled crumb") — a bare <span part=link>
 *      with no role and no aria-current (neither a link nor the current page).
 *   4. Keyboard — link crumbs are Tab-reachable and keyboard-focusable (focus-visible),
 *      with no re-implemented Enter/Space (native <a> handles activation). The strict
 *      Tab-order traversal runs on Chromium; headless WebKit keeps links out of the
 *      Tab order without the macOS Full-Keyboard-Access OS setting (honest skip,
 *      mirroring radio-group).
 *   5. Visual parity — the current crumb resolves the SAME computed colour.
 *   6. Tokens + theme — re-pointing a role / flipping [data-theme] re-skins both.
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
  // The fixture renders 5 crumbs → 4 separators, and the last crumb has none
  // (you don't separate past the current page). Separators are decorative, so a
  // screen reader announces the trail, not the punctuation.
  const litSeparators = litHost(page, 'lit-breadcrumb').locator('.separator');
  const reactSeparators = page.getByTestId('react-breadcrumb').locator('.lab-breadcrumb-separator');

  for (const separators of [litSeparators, reactSeparators]) {
    await expect(separators).toHaveCount(4); // 5 crumbs − 1
    await expect(separators.first()).toHaveAttribute('aria-hidden', 'true');
  }
});

test('hrefless non-current crumb renders as bare text — no link, no role, no aria-current (both renderers)', async ({
  page,
}) => {
  // The fixture's "Components" crumb has NO href and is NOT the last crumb: the
  // Figma "disabled crumb". It must be inert text — a <span part="link"> (Lit) /
  // <span.lab-breadcrumb-link> (React) — never an <a>, and never aria-current
  // (that belongs only to the final crumb). A destination-less <a> would lie to
  // assistive tech; plain text is the honest primitive.
  const lit = litHost(page, 'lit-breadcrumb');
  const react = page.getByTestId('react-breadcrumb');

  // Lit: the hrefless crumb is a <span part="link">, and there is no anchor for it.
  const litHrefless = lit.locator('span[part="link"]:has-text("Components")');
  await expect(litHrefless).toHaveCount(1);
  await expect(litHrefless).not.toHaveAttribute('aria-current', /.*/);
  await expect(lit.locator('a:has-text("Components")')).toHaveCount(0);

  // React: the hrefless crumb is a <span class="lab-breadcrumb-link">, not an <a>.
  const reactHrefless = react.locator('span.lab-breadcrumb-link:has-text("Components")');
  await expect(reactHrefless).toHaveCount(1);
  await expect(reactHrefless).not.toHaveAttribute('aria-current', /.*/);
  await expect(react.locator('a:has-text("Components")')).toHaveCount(0);
});

test('keyboard: link crumbs are Tab-reachable and keyboard-focusable with focus-visible (both renderers, chromium)', async ({
  page,
  browserName,
}) => {
  // Crumb links are native <a href> — so the platform owns both tab order AND
  // activation (Enter), with NO re-implemented key handler. The OBSERVABLE
  // keyboard contract per renderer: a forward Tab REACHES the link (it is in the
  // tab order, not merely .focus()-able), and that keyboard focus matches
  // :focus-visible so the ring shows for keyboard users.
  //
  // WebKit excludes links from the Tab order unless the macOS Full-Keyboard-Access
  // OS setting is on (off in headless) — the same honest skip the radio-group
  // arrow-nav test takes. There the link is reachable by .focus() and click, just
  // not by the Tab key in headless WebKit.
  test.skip(
    browserName === 'webkit',
    'WebKit needs the macOS Full Keyboard Access OS setting to put links in the Tab order; unavailable in headless automation.',
  );

  for (const [testid, anchor] of [
    ['lit-breadcrumb', litHost(page, 'lit-breadcrumb').locator('a[href="#home"]')],
    ['react-breadcrumb', page.getByTestId('react-breadcrumb').locator('a[href="#home"]')],
  ] as const) {
    // Land on the link first (proves it can hold focus), then Shift+Tab off it and
    // Tab back: returning to it via a forward Tab proves it is genuinely in the
    // Tab order. Driving focus by keyboard also primes keyboard modality so
    // :focus-visible holds.
    await anchor.focus();
    await expect(anchor, `${testid}: crumb link can hold focus`).toBeFocused();

    await page.keyboard.press('Shift+Tab');
    await expect(anchor, `${testid}: Shift+Tab leaves the crumb link`).not.toBeFocused();

    await page.keyboard.press('Tab');
    await expect(anchor, `${testid}: a forward Tab reaches the crumb link`).toBeFocused();

    // focus-visible must match for keyboard focus → the ring is shown. No Enter or
    // Space is asserted: the native <a> owns activation, nothing is re-implemented.
    const focusVisible = await anchor.evaluate((el) => el.matches(':focus-visible'));
    expect(focusVisible, `${testid}: focused crumb link matches :focus-visible`).toBe(true);
  }
});

test('visual parity: Lit and React resolve the same current-crumb colour', async ({ page }) => {
  await waitForThemePaint(page, litCurrent(page), reactCurrent(page));
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
