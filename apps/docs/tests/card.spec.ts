import { type Locator, type Page, expect, test } from '@playwright/test';

/**
 * Card suite — a PRESENTATIONAL component that OPTS OUT of the Zag seam (like
 * Badge / Loader), verified on BOTH renderers.
 *
 * The fixture (`card.html`) mounts the Lit `<lab-card>` and the native-React
 * `<Card>` with identical specimens under one [data-theme]. Because Card has no
 * machine, these checks assert STRUCTURE + native semantics + visual parity — NOT
 * machine output (there is none to assert, and faking some would be dishonest):
 *   1. Render — both renderers paint a real <article> surface with a token.
 *   2. Native semantics — header / footer are real landmark elements.
 *   3. Variant — each variant resolves a distinct surface background.
 *   4. Visual parity — matching specimens resolve the SAME background colour.
 *   5. Tokens + theme — re-pointing a role / flipping [data-theme] re-skins both.
 */

/** The Lit card's painted <article> surface (shadow-pierced). */
function litCard(page: Page, testid: string): Locator {
  return page.getByTestId(testid).locator('.card');
}
/** The React card IS the <article> surface. */
function reactCard(page: Page, testid: string): Locator {
  return page.getByTestId(testid);
}

const bg = (el: HTMLElement) => getComputedStyle(el).backgroundColor;

test.beforeEach(async ({ page }) => {
  await page.goto('/card.html');
});

test('delivered HTML carries the Lit element (React island mounts client-side)', async ({
  request,
}) => {
  const body = await (await request.get('/card.html')).text();
  expect(body).toMatch(/<lab-card/i);
  expect(body).toContain('id="react-root"');
});

test('render: both renderers paint an <article> surface', async ({ page }) => {
  for (const card of [litCard(page, 'lit-elevated'), reactCard(page, 'react-elevated')]) {
    await expect(card).toBeVisible();
    expect(await card.evaluate((el) => el.tagName.toLowerCase())).toBe('article');
  }
});

test('native semantics: header and footer are real landmark elements', async ({ page }) => {
  // Lit: header/footer live in the shadow root of the host.
  const litHeader = page.getByTestId('lit-elevated').locator('header.header, .header');
  const litFooter = page.getByTestId('lit-elevated').locator('footer.footer, .footer');
  expect(await litHeader.evaluate((el) => el.tagName.toLowerCase())).toBe('header');
  expect(await litFooter.evaluate((el) => el.tagName.toLowerCase())).toBe('footer');

  // React: header/footer are native landmarks too.
  const reactHeader = reactCard(page, 'react-elevated').locator('.lab-card-header');
  const reactFooter = reactCard(page, 'react-elevated').locator('.lab-card-footer');
  expect(await reactHeader.evaluate((el) => el.tagName.toLowerCase())).toBe('header');
  expect(await reactFooter.evaluate((el) => el.tagName.toLowerCase())).toBe('footer');
});

test('opt-out honesty: the host carries no machine role on the surface', async ({ page }) => {
  // A presentational card must NOT fabricate a widget role on its surface. The
  // <article> is its own semantics; no role="button"/"region"/etc. is injected.
  const litRole = await litCard(page, 'lit-elevated').getAttribute('role');
  const reactRole = await reactCard(page, 'react-elevated').getAttribute('role');
  expect(litRole).toBeNull();
  expect(reactRole).toBeNull();
});

test('variants: elevated / outlined / filled resolve distinct surfaces (both renderers)', async ({
  page,
}) => {
  for (const prefix of ['lit', 'react']) {
    const elevated =
      prefix === 'lit' ? litCard(page, 'lit-elevated') : reactCard(page, 'react-elevated');
    const outlined =
      prefix === 'lit' ? litCard(page, 'lit-outlined') : reactCard(page, 'react-outlined');
    const filled = prefix === 'lit' ? litCard(page, 'lit-filled') : reactCard(page, 'react-filled');

    const elevatedBg = await elevated.evaluate(bg);
    const filledBg = await filled.evaluate(bg);
    // Filled is a tinted surface, distinct from the raised elevated surface.
    expect(filledBg).not.toBe(elevatedBg);
    // Outlined carries a real border (the variant's tell).
    const outlinedBorder = await outlined.evaluate((el) => getComputedStyle(el).borderTopWidth);
    expect(outlinedBorder).not.toBe('0px');
  }
});

test('visual parity: Lit and React resolve the same elevated surface colour', async ({ page }) => {
  const litBg = await litCard(page, 'lit-elevated').evaluate(bg);
  const reactBg = await reactCard(page, 'react-elevated').evaluate(bg);
  expect(reactBg).toBe(litBg);
});

test('tokens: re-pointing --lab-surface-raised re-skins BOTH elevated cards', async ({ page }) => {
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--lab-surface-raised', 'rgb(1, 2, 3)');
  });
  await expect.poll(() => litCard(page, 'lit-elevated').evaluate(bg)).toBe('rgb(1, 2, 3)');
  await expect.poll(() => reactCard(page, 'react-elevated').evaluate(bg)).toBe('rgb(1, 2, 3)');
});

test('theme: flipping [data-theme] re-skins both renderers with zero edits', async ({ page }) => {
  const litDark = await litCard(page, 'lit-outlined').evaluate(bg);
  const reactDark = await reactCard(page, 'react-outlined').evaluate(bg);

  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));

  await expect.poll(() => litCard(page, 'lit-outlined').evaluate(bg)).not.toBe(litDark);
  await expect.poll(() => reactCard(page, 'react-outlined').evaluate(bg)).not.toBe(reactDark);
});
