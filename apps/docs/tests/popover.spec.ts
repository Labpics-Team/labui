import { type Locator, type Page, expect, test } from '@playwright/test';

/**
 * Popover suite — the first dismissable, focus-managed overlay, verified on BOTH
 * renderers.
 *
 * The fixture (`popover.html`) mounts the Lit `<lab-popover>` and the native-React
 * `<Popover>` with identical specimens under one [data-theme]. These checks are the
 * Popover's browser-side definition of done:
 *   1. Render — the delivered HTML carries the Lit element; React is a client island.
 *   2. Open on click — the Zag machine opens the dialog and sets aria-expanded.
 *   3. Escape dismiss + focus restore — Escape closes and focus returns to trigger.
 *   4. Outside-click dismiss — clicking outside closes the panel.
 *   5. Positioning — the open panel is placed on-screen near the trigger.
 *   6. Modal — the scrim is shown when modal.
 *   7. Visual parity — Lit and React resolve the SAME panel colour when open.
 */

function litHost(page: Page, testid: string): Locator {
  return page.getByTestId(testid);
}
function litContent(page: Page, testid: string): Locator {
  return litHost(page, testid).locator('.content');
}
function litBackdrop(page: Page, testid: string): Locator {
  return litHost(page, testid).locator('.backdrop');
}
function reactTrigger(page: Page, testid: string): Locator {
  return page.getByTestId(testid).locator('.lab-popover-trigger');
}
function reactOpenContent(page: Page): Locator {
  return page.locator('.lab-popover-content[data-state="open"]');
}

const bg = (el: HTMLElement) => getComputedStyle(el).backgroundColor;

/**
 * Wait until the machine's autoFocus has moved focus INTO the open dialog. Zag
 * attaches its document-level Escape/outside-click listeners as part of the same
 * open effects, so once focus is inside the panel those dismissers are live — this
 * is the honest gate that removes the open→dismiss race (no arbitrary sleep).
 */
async function litFocusInDialog(page: Page, testid: string): Promise<void> {
  // Zag's focus trap focuses the first focusable in the content's shadow subtree
  // (the close button, or the content itself); shadowRoot.activeElement then sits
  // inside .content (vs the trigger, which is outside it).
  await expect
    .poll(() =>
      litHost(page, testid).evaluate(
        (h) => (h as HTMLElement).shadowRoot?.activeElement?.closest('.content') != null,
      ),
    )
    .toBe(true);
}
async function reactFocusInDialog(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(() => document.activeElement?.closest('.lab-popover-content') != null),
    )
    .toBe(true);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/popover.html');
});

test('delivered HTML carries the Lit element (React island mounts client-side)', async ({
  request,
}) => {
  const body = await (await request.get('/popover.html')).text();
  expect(body).toMatch(/<lab-popover/i);
  expect(body).toContain('id="react-root"');
});

test('open on click: the Zag machine opens the dialog on both renderers', async ({ page }) => {
  // Lit.
  const lit = litContent(page, 'lit-pop');
  await expect(lit).toBeHidden();
  await litHost(page, 'lit-pop').locator('.trigger').click();
  await expect(lit).toBeVisible();
  await expect(lit).toHaveAttribute('role', 'dialog');
  await expect(litHost(page, 'lit-pop').locator('.trigger')).toHaveAttribute(
    'aria-expanded',
    'true',
  );

  // React.
  await reactTrigger(page, 'react-pop').click();
  await expect(reactOpenContent(page)).toBeVisible();
  await expect(reactTrigger(page, 'react-pop')).toHaveAttribute('aria-expanded', 'true');
});

test('a11y: Escape dismisses and restores focus to the trigger (keyboard)', async ({ page }) => {
  // Lit.
  const litTrigger = litHost(page, 'lit-pop').locator('.trigger');
  await litTrigger.click();
  await expect(litContent(page, 'lit-pop')).toBeVisible();
  await litFocusInDialog(page, 'lit-pop');
  await page.keyboard.press('Escape');
  await expect(litContent(page, 'lit-pop')).toBeHidden();
  await expect(litHost(page, 'lit-pop')).toBeFocused();

  // React.
  await reactTrigger(page, 'react-pop').click();
  await expect(reactOpenContent(page)).toBeVisible();
  await reactFocusInDialog(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('.lab-popover-content[data-state="open"]')).toHaveCount(0);
  await expect(reactTrigger(page, 'react-pop')).toBeFocused();
});

test('dismiss: clicking outside closes the panel', async ({ page }) => {
  await litHost(page, 'lit-pop').locator('.trigger').click();
  await expect(litContent(page, 'lit-pop')).toBeVisible();
  // Click the page title — outside the panel and trigger.
  await page.getByTestId('popover-title').click();
  await expect(litContent(page, 'lit-pop')).toBeHidden();
});

test('positioning: the open panel is placed on-screen near the trigger', async ({ page }) => {
  await litHost(page, 'lit-pop').locator('.trigger').click();
  const content = litContent(page, 'lit-pop');
  await expect(content).toBeVisible();
  const box = await content.boundingBox();
  expect(box).not.toBeNull();
  expect(box?.y ?? -1).toBeGreaterThanOrEqual(0);
  expect(box?.width ?? 0).toBeGreaterThan(0);
});

test('modal: the scrim is shown when modal, on both renderers', async ({ page }) => {
  // Lit modal popover — the scrim covers the viewport while open.
  await litHost(page, 'lit-pop-modal').locator('.trigger').click();
  await expect(litContent(page, 'lit-pop-modal')).toBeVisible();
  await expect(litBackdrop(page, 'lit-pop-modal')).toBeVisible();

  // Close it before testing React, so its full-viewport scrim stops intercepting
  // pointer events over the React trigger.
  await litFocusInDialog(page, 'lit-pop-modal');
  await page.keyboard.press('Escape');
  await expect(litContent(page, 'lit-pop-modal')).toBeHidden();
  await expect(litBackdrop(page, 'lit-pop-modal')).toBeHidden();

  // React modal popover.
  await reactTrigger(page, 'react-pop-modal').click();
  await expect(page.locator('.lab-popover-backdrop')).toBeVisible();
});

test('visual parity: Lit and React resolve the same panel colour when open', async ({ page }) => {
  await litHost(page, 'lit-pop').locator('.trigger').click();
  const litPanelBg = await litContent(page, 'lit-pop').evaluate(bg);

  await reactTrigger(page, 'react-pop').click();
  const reactPanelBg = await reactOpenContent(page).evaluate(bg);

  expect(reactPanelBg, 'popover panel background parity').toBe(litPanelBg);
});
