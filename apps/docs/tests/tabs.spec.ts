import { type Locator, type Page, expect, test } from '@playwright/test';

/**
 * Tabs suite — a COMPOUND component that consumes the @zag-js/tabs GROUP machine
 * through the LabUI seam, verified on BOTH renderers.
 *
 * The fixture (`tabs.html`) mounts the Lit `<lab-tabs>` and the native-React
 * `<Tabs>` with identical specimens under one [data-theme]. These checks are the
 * Tabs' browser-side definition of done:
 *   1. Render — both renderers paint a real tablist with a token.
 *   2. Machine behaviour — clicking a tab selects it (data-selected moves) on both.
 *   3. a11y roving — arrow keys move selection via the machine (automatic mode).
 *   4. Disabled — a disabled tab does not select.
 *   5. Visual parity — the selected underline resolves the SAME computed colour.
 *   6. Tokens + theme — re-pointing a role / flipping [data-theme] re-skins both.
 */

function litHost(page: Page, testid: string): Locator {
  return page.getByTestId(testid);
}
/** All Lit triggers (shadow-pierced) in document order. */
function litTriggers(page: Page, testid: string): Locator {
  return litHost(page, testid).locator('.trigger');
}
/** All React triggers in document order. */
function reactTriggers(page: Page, testid: string): Locator {
  return page.getByTestId(testid).locator('.lab-tabs-trigger');
}

const underline = (el: HTMLElement) => getComputedStyle(el).borderBottomColor;

test.beforeEach(async ({ page }) => {
  await page.goto('/tabs.html');
});

test('delivered HTML carries the Lit element (React island mounts client-side)', async ({
  request,
}) => {
  const body = await (await request.get('/tabs.html')).text();
  expect(body).toMatch(/<lab-tabs/i);
  expect(body).toContain('id="react-root"');
});

test('render: both renderers expose a tablist with three tabs', async ({ page }) => {
  await expect(litHost(page, 'lit-tabs')).toBeVisible();
  await expect(litTriggers(page, 'lit-tabs')).toHaveCount(3);
  await expect(reactTriggers(page, 'react-tabs')).toHaveCount(3);
  // Roles come from the machine — a real tablist, not div soup.
  await expect(litHost(page, 'lit-tabs').locator('[role="tablist"]')).toBeVisible();
  await expect(page.getByTestId('react-tabs').locator('[role="tablist"]')).toBeVisible();
});

test('machine behaviour: clicking a tab moves selection on both renderers', async ({ page }) => {
  // Default selection is the first tab (account).
  const litTabsList = litTriggers(page, 'lit-tabs');
  await expect(litTabsList.nth(0)).toHaveAttribute('data-selected', /.*/);
  await litTabsList.nth(1).click();
  await expect(litTabsList.nth(1)).toHaveAttribute('data-selected', /.*/);
  await expect(litTabsList.nth(0)).not.toHaveAttribute('data-selected', /.*/);
  await expect(litTabsList.nth(1)).toHaveAttribute('aria-selected', 'true');

  const reactTabsList = reactTriggers(page, 'react-tabs');
  await expect(reactTabsList.nth(0)).toHaveAttribute('data-selected', /.*/);
  await reactTabsList.nth(1).click();
  await expect(reactTabsList.nth(1)).toHaveAttribute('data-selected', /.*/);
  await expect(reactTabsList.nth(0)).not.toHaveAttribute('data-selected', /.*/);
});

test('a11y roving: ArrowRight selects the next tab via the machine (automatic)', async ({
  page,
}) => {
  const litTabsList = litTriggers(page, 'lit-tabs');
  await litTabsList.nth(0).focus();
  await page.keyboard.press('ArrowRight');
  // Automatic activation: focusing the next tab selects it.
  await expect(litTabsList.nth(1)).toHaveAttribute('data-selected', /.*/);
});

test('disabled: a disabled tab does not select on either renderer', async ({ page }) => {
  // The third tab (team) is disabled.
  const litTeam = litTriggers(page, 'lit-tabs').nth(2);
  await expect(litTeam).toHaveAttribute('data-disabled', /.*/);
  await litTeam.click({ force: true });
  await expect(litTeam).not.toHaveAttribute('data-selected', /.*/);

  const reactTeam = reactTriggers(page, 'react-tabs').nth(2);
  await expect(reactTeam).toHaveAttribute('data-disabled', /.*/);
  await reactTeam.click({ force: true });
  await expect(reactTeam).not.toHaveAttribute('data-selected', /.*/);
});

test('visual parity: Lit and React resolve the same selected underline colour', async ({
  page,
}) => {
  const litSelected = litHost(page, 'lit-tabs').locator('.trigger[data-selected]');
  const reactSelected = page.getByTestId('react-tabs').locator('.lab-tabs-trigger[data-selected]');
  await expect(reactSelected).toBeVisible();
  expect(await reactSelected.evaluate(underline)).toBe(await litSelected.evaluate(underline));
});

test('tokens: re-pointing --lab-fill-accent re-skins BOTH selected underlines', async ({
  page,
}) => {
  const litSelected = litHost(page, 'lit-tabs').locator('.trigger[data-selected]');
  const reactSelected = page.getByTestId('react-tabs').locator('.lab-tabs-trigger[data-selected]');
  await expect(reactSelected).toBeVisible();

  await page.evaluate(() => {
    document.documentElement.style.setProperty('--lab-fill-accent', 'rgb(1, 2, 3)');
  });
  await expect.poll(() => litSelected.evaluate(underline)).toBe('rgb(1, 2, 3)');
  await expect.poll(() => reactSelected.evaluate(underline)).toBe('rgb(1, 2, 3)');
});

test('theme: flipping [data-theme] re-skins both renderers with zero edits', async ({ page }) => {
  const litSelected = litHost(page, 'lit-tabs').locator('.trigger[data-selected]');
  const reactSelected = page.getByTestId('react-tabs').locator('.lab-tabs-trigger[data-selected]');
  await expect(reactSelected).toBeVisible();

  const litDark = await litSelected.evaluate(underline);
  const reactDark = await reactSelected.evaluate(underline);

  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));

  await expect.poll(() => litSelected.evaluate(underline)).not.toBe(litDark);
  await expect.poll(() => reactSelected.evaluate(underline)).not.toBe(reactDark);
});
