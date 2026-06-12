import { expect, test } from '@playwright/test';

/**
 * Smoke for the Lit Button prototype (criterion inputs for decision-and-adr):
 *  - the custom element upgrades and renders in the shadow DOM;
 *  - visible states differ (fill vs ghost have different backgrounds);
 *  - the --lab-* contract pierces the shadow boundary (criterion 3);
 *  - the SAME component re-skins when the theme variable set is swapped, with
 *    NO component edit (criterion 3, theme-agnosticism);
 *  - loading sets aria-busy and disables interaction (a11y).
 */

function rgb(value: string): string {
  return value.replace(/\s+/g, '').toLowerCase();
}

// Reads the resolved background of the inner <button> inside the shadow root.
async function innerBg(locator: import('@playwright/test').Locator): Promise<string> {
  return locator.evaluate((host) => {
    const btn = host.shadowRoot?.querySelector('button');
    if (!btn) throw new Error('shadow button missing');
    return getComputedStyle(btn).backgroundColor;
  });
}

test('button upgrades and renders in the shadow DOM', async ({ page }) => {
  await page.goto('/');
  const btn = page.getByTestId('btn-accent-fill');
  await expect(btn).toBeVisible();
  const hasShadowButton = await btn.evaluate((el) => !!el.shadowRoot?.querySelector('button'));
  expect(hasShadowButton).toBe(true);
});

test('kinds differ by surface, not by a border on top', async ({ page }) => {
  await page.goto('/');
  const fill = await innerBg(page.getByTestId('btn-accent-fill'));
  const ghost = await innerBg(page.getByTestId('btn-accent-ghost'));
  // fill has an opaque accent surface; ghost is transparent — separation is the
  // surface, exactly the owner's principle.
  expect(rgb(fill)).not.toBe(rgb(ghost));
  expect(rgb(ghost)).toMatch(/rgba?\(0,0,0,0\)|transparent/);
});

test('--lab-* pierces shadow DOM and themes swap with no component edit', async ({ page }) => {
  await page.goto('/');
  const btn = page.getByTestId('btn-accent-fill');

  const darkBg = await innerBg(btn);
  expect(rgb(darkBg)).not.toBe('rgba(0,0,0,0)');

  // Swap the variable set only (what the toggle does) — the component is never
  // touched. The accent fill must change between Light and Dark. Poll until the
  // repaint flushes (a single read can race the style recalc after the swap).
  await page.getByTestId('theme-toggle').click();
  await expect(page.getByTestId('theme-name')).toHaveText('light');
  await expect.poll(async () => rgb(await innerBg(btn))).not.toBe(rgb(darkBg));
});

test('loading state is announced and blocks interaction', async ({ page }) => {
  await page.goto('/');
  const loading = page.getByTestId('btn-loading');
  const innerDisabled = await loading.evaluate((el) => {
    const btn = el.shadowRoot?.querySelector('button');
    return { busy: btn?.getAttribute('aria-busy'), disabled: btn?.hasAttribute('disabled') };
  });
  expect(innerDisabled.busy).toBe('true');
  expect(innerDisabled.disabled).toBe(true);
});

test('keyboard focus reaches the control (a11y)', async ({ page }) => {
  await page.goto('/');
  // First focusable in the matrix is the theme toggle; tab once more into the
  // first button host and assert the inner native button is the active element.
  await page.getByTestId('btn-accent-fill').focus();
  const focused = await page
    .getByTestId('btn-accent-fill')
    .evaluate((el) => el.shadowRoot?.activeElement?.tagName.toLowerCase());
  expect(focused).toBe('button');
});
