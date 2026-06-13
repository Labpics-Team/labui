import { type Locator, type Page, expect, test } from '@playwright/test';

/**
 * Radio Group suite — the FIRST COMPOUND component, CONSUMING the
 * @zag-js/radio-group machine through the LabUI seam, verified on BOTH renderers.
 *
 * The fixture (`radio-group.html`) mounts the Lit `<lab-radio-group>` (all parts
 * in one shadow scope, from an `items` config) and the native-React
 * `<RadioGroup>`/`<Radio>` (context provider + leaf children) with identical
 * specimens. Definition of done:
 *   1. Render — both renderers paint a real radiogroup with a token-coloured dot.
 *   2. Machine behaviour — clicking an item selects it; the rest clear.
 *   3. Roving keyboard — Arrow keys move selection, skipping the disabled item.
 *   4. Disabled — a disabled item and a disabled group block selection.
 *   5. Visual parity + tokens + theme across both renderers.
 *
 * Playwright's CSS engine pierces open shadow DOM, so `litHost.locator('.item')`
 * reaches the Lit shadow parts the same way it reaches the React DOM parts.
 */

function litHost(page: Page, testid: string): Locator {
  return page.getByTestId(testid);
}
function reactRoot(page: Page, testid: string): Locator {
  return page.getByTestId(testid).locator('[data-lab-radio-group]');
}

/** The item row (a <label>) carrying the given label text, on either renderer. */
function litItem(page: Page, testid: string, label: string): Locator {
  return litHost(page, testid).locator('.item', { hasText: label });
}
function reactItem(page: Page, testid: string, label: string): Locator {
  return reactRoot(page, testid).locator('.lab-radio-item', { hasText: label });
}

/** The checked item-control (ring) on either renderer — driven by the machine. */
function litCheckedControl(page: Page, testid: string): Locator {
  return litHost(page, testid).locator('.control[data-state="checked"]');
}
function reactCheckedControl(page: Page, testid: string): Locator {
  return reactRoot(page, testid).locator('.lab-radio-control[data-state="checked"]');
}

const borderColor = (el: HTMLElement) => getComputedStyle(el).borderTopColor;
const bg = (el: HTMLElement) => getComputedStyle(el).backgroundColor;
const flexDirection = (el: HTMLElement) => getComputedStyle(el).flexDirection;

test.beforeEach(async ({ page }) => {
  await page.goto('/radio-group.html');
});

test('delivered HTML carries the Lit element (React island mounts client-side)', async ({
  request,
}) => {
  const body = await (await request.get('/radio-group.html')).text();
  expect(body).toMatch(/<lab-radio-group/i);
  expect(body).toContain('id="react-root"');
});

test('render: both renderers expose a role=radiogroup with a checked item', async ({ page }) => {
  await expect(litHost(page, 'lit-accent').locator('[role="radiogroup"]')).toBeVisible();
  await expect(reactRoot(page, 'react-accent')).toHaveAttribute('role', 'radiogroup');
  await expect(litCheckedControl(page, 'lit-accent')).toBeVisible();
  await expect(reactCheckedControl(page, 'react-accent')).toBeVisible();
});

test('machine behaviour: clicking an item selects it on both renderers', async ({ page }) => {
  // Lit starts on "express" (controlled-but-self-reflecting via `value`).
  const lit = litHost(page, 'lit-accent');
  await expect(lit).toHaveAttribute('value', 'express');
  await litItem(page, 'lit-accent', 'Standard').click();
  await expect(lit).toHaveAttribute('value', 'standard');

  // React starts on "express" (uncontrolled via `defaultValue`). After clicking
  // Standard, the Standard control is checked and Express is no longer.
  await reactItem(page, 'react-accent', 'Standard').click();
  await expect(
    reactItem(page, 'react-accent', 'Standard').locator('.lab-radio-control'),
  ).toHaveAttribute('data-state', 'checked');
  await expect(
    reactItem(page, 'react-accent', 'Express').locator('.lab-radio-control'),
  ).toHaveAttribute('data-state', 'unchecked');
});

test('roving keyboard: Arrow keys move selection, skipping the disabled item', async ({
  page,
  browserName,
}) => {
  // Arrow-key roving rides NATIVE radio semantics (the machine adds no arrow
  // handler — same-name radios form a native group the browser navigates). WebKit
  // only does this when the macOS "Full Keyboard Access" setting is on, which is
  // off in headless automation — so synthetic arrows are a harness limitation
  // there, NOT a component defect. The a11y is unchanged and machine-owned;
  // click-selection roving is still verified on WebKit by the test above.
  test.skip(
    browserName === 'webkit',
    'WebKit needs the macOS Full Keyboard Access OS setting for native radio arrow nav; unavailable in headless automation.',
  );

  // Click the checked (Express) row to establish real keyboard focus, then
  // ArrowRight → next enabled is Overnight (disabled, skipped) → wraps to
  // Standard. Selection follows roving focus; the machine + native radios own it.
  await litItem(page, 'lit-accent', 'Express').click();
  await page.keyboard.press('ArrowRight');
  await expect(litHost(page, 'lit-accent')).toHaveAttribute('value', 'standard');

  // React: same roving on the native renderer.
  await reactItem(page, 'react-accent', 'Express').click();
  await page.keyboard.press('ArrowRight');
  await expect(
    reactItem(page, 'react-accent', 'Standard').locator('.lab-radio-control'),
  ).toHaveAttribute('data-state', 'checked');
});

test('disabled item: the machine blocks selecting it on both renderers', async ({ page }) => {
  const litOvernightInput = litItem(page, 'lit-accent', 'Overnight').locator('input');
  expect(await litOvernightInput.evaluate((el) => (el as HTMLInputElement).disabled)).toBe(true);
  // Clicking the disabled row leaves the selection on Express.
  await litItem(page, 'lit-accent', 'Overnight').click({ force: true });
  await expect(litHost(page, 'lit-accent')).toHaveAttribute('value', 'express');

  await expect(
    reactItem(page, 'react-accent', 'Overnight').locator('.lab-radio-control'),
  ).toHaveAttribute('data-disabled', '');
});

test('disabled group: every input is disabled on both renderers', async ({ page }) => {
  const litInputs = litHost(page, 'lit-disabled').locator('input');
  const count = await litInputs.count();
  expect(count).toBe(3);
  for (let i = 0; i < count; i++) {
    expect(await litInputs.nth(i).evaluate((el) => (el as HTMLInputElement).disabled)).toBe(true);
  }
  await expect(reactRoot(page, 'react-disabled')).toHaveAttribute('data-disabled', '');
});

test('orientation: vertical lays the list out as a column on both renderers', async ({ page }) => {
  expect(await litHost(page, 'lit-vertical').locator('.root').evaluate(flexDirection)).toBe(
    'column',
  );
  expect(await reactRoot(page, 'react-vertical').evaluate(flexDirection)).toBe('column');
});

test('visual parity: Lit and React resolve the same checked ring + dot per type', async ({
  page,
}) => {
  await expect(reactCheckedControl(page, 'react-accent')).toBeVisible();

  for (const variant of ['accent', 'neutral', 'danger'] as const) {
    const litRing = await litCheckedControl(page, `lit-${variant}`).evaluate(borderColor);
    const reactRing = await reactCheckedControl(page, `react-${variant}`).evaluate(borderColor);
    expect(reactRing, `${variant}: checked ring border parity`).toBe(litRing);

    const litDot = await litCheckedControl(page, `lit-${variant}`).locator('.dot').evaluate(bg);
    const reactDot = await reactCheckedControl(page, `react-${variant}`)
      .locator('.lab-radio-dot')
      .evaluate(bg);
    expect(reactDot, `${variant}: checked dot parity`).toBe(litDot);
  }
});

test('tokens: re-pointing --lab-fill-accent re-skins BOTH checked dots', async ({ page }) => {
  const litDot = litCheckedControl(page, 'lit-accent').locator('.dot');
  const reactDot = reactCheckedControl(page, 'react-accent').locator('.lab-radio-dot');
  await expect(reactCheckedControl(page, 'react-accent')).toBeVisible();

  await page.evaluate(() => {
    document.documentElement.style.setProperty('--lab-fill-accent', 'rgb(1, 2, 3)');
  });
  await expect.poll(() => litDot.evaluate(bg)).toBe('rgb(1, 2, 3)');
  await expect.poll(() => reactDot.evaluate(bg)).toBe('rgb(1, 2, 3)');
});

test('theme: flipping [data-theme] re-skins both renderers with zero edits', async ({ page }) => {
  const litRing = litCheckedControl(page, 'lit-neutral');
  const reactRing = reactCheckedControl(page, 'react-neutral');
  await expect(reactRing).toBeVisible();

  const litDark = await litRing.evaluate(borderColor);
  const reactDark = await reactRing.evaluate(borderColor);

  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));

  await expect.poll(() => litRing.evaluate(borderColor)).not.toBe(litDark);
  await expect.poll(() => reactRing.evaluate(borderColor)).not.toBe(reactDark);
});
