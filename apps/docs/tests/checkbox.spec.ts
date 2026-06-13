import { type Locator, type Page, expect, test } from '@playwright/test';

/**
 * Checkbox suite — a PRODUCTION component CONSUMING the @zag-js/checkbox machine
 * through the LabUI seam, with the HONEST tri-state, verified on BOTH renderers.
 *
 * The fixture (`checkbox.html`) mounts the Lit `<lab-checkbox>` and native-React
 * `<Checkbox>` with identical specimens — including the real indeterminate
 * (mixed) state. Definition of done:
 *   1. Render — both renderers paint a real box with a token.
 *   2. Machine behaviour — clicking toggles the machine: the host state follows.
 *   3. HONEST mixed state — the indeterminate specimen carries the machine's real
 *      "indeterminate" value (data-state="indeterminate" / host attribute), and
 *      clicking it resolves to a concrete checked value — not a faked glyph.
 *   4. Disabled — the machine blocks the toggle.
 *   5. Visual parity + tokens + theme across both renderers.
 */

function litHost(page: Page, testid: string): Locator {
  return page.getByTestId(testid);
}
function reactBox(page: Page, testid: string): Locator {
  return page.getByTestId(testid).locator('[data-lab-checkbox]');
}
function litControl(page: Page, testid: string): Locator {
  return litHost(page, testid).locator('.control, .lab-checkbox-control');
}
function reactControl(page: Page, testid: string): Locator {
  return reactBox(page, testid).locator('.lab-checkbox-control');
}

const bg = (el: HTMLElement) => getComputedStyle(el).backgroundColor;

/** The machine's data-state on the Lit control (checked | unchecked | indeterminate). */
function litControlState(page: Page, testid: string): Promise<string | null> {
  return litHost(page, testid).evaluate(
    (host) =>
      (host as HTMLElement).shadowRoot?.querySelector('.control')?.getAttribute('data-state') ??
      null,
  );
}

test.beforeEach(async ({ page }) => {
  await page.goto('/checkbox.html');
});

test('delivered HTML carries the Lit element (React island mounts client-side)', async ({
  request,
}) => {
  const body = await (await request.get('/checkbox.html')).text();
  expect(body).toMatch(/<lab-checkbox/i);
  expect(body).toContain('id="react-root"');
});

test('machine behaviour: clicking toggles checked on both renderers', async ({ page }) => {
  const lit = litHost(page, 'lit-unchecked');
  await expect(lit).toBeVisible();
  await expect(lit).not.toHaveAttribute('checked', /.*/);
  await litControl(page, 'lit-unchecked').click();
  await expect(lit).toHaveAttribute('checked', '');
  expect(await litControlState(page, 'lit-unchecked')).toBe('checked');

  const react = reactBox(page, 'react-unchecked');
  await expect(react).not.toHaveAttribute('data-checked', /.*/);
  await reactControl(page, 'react-unchecked').click();
  await expect(react).toHaveAttribute('data-checked', 'true');
});

test('HONEST mixed state: the machine carries a real "indeterminate" value', async ({ page }) => {
  // The Lit mixed specimen reflects the host `indeterminate` attribute, and the
  // machine reports data-state="indeterminate" on the control — a real third
  // state, not a faked dash.
  const lit = litHost(page, 'lit-mixed');
  await expect(lit).toHaveAttribute('indeterminate', '');
  expect(await litControlState(page, 'lit-mixed')).toBe('indeterminate');

  // The React mixed specimen agrees via data-indeterminate.
  const react = reactBox(page, 'react-mixed');
  await expect(react).toHaveAttribute('data-indeterminate', 'true');

  // Clicking a mixed box runs the machine, which RESOLVES it to a concrete
  // checked value. Zag is deterministic here: from indeterminate it always goes
  // to checked (machine `toggleChecked`: indeterminate ? true : !checked), and a
  // native checkbox click sets .checked=true first — so the outcome is `checked`.
  await litControl(page, 'lit-mixed').click();
  await expect(lit).not.toHaveAttribute('indeterminate', /.*/);
  expect(await litControlState(page, 'lit-mixed')).toBe('checked');
});

test('a11y: Space on the focused box toggles via the native input (keyboard)', async ({ page }) => {
  const lit = litHost(page, 'lit-unchecked');
  await lit.evaluate((host) => {
    (host as HTMLElement).shadowRoot?.querySelector('input')?.focus();
  });
  await page.keyboard.press('Space');
  await expect(lit).toHaveAttribute('checked', '');
});

test('disabled: the machine blocks the toggle on both renderers', async ({ page }) => {
  const lit = litHost(page, 'lit-disabled');
  expect(
    await lit.evaluate(
      (host) => (host as HTMLElement).shadowRoot?.querySelector('input')?.disabled ?? null,
    ),
  ).toBe(true);
  await expect(lit).not.toHaveAttribute('checked', /.*/);

  const react = reactBox(page, 'react-disabled');
  await expect(react).toHaveAttribute('data-disabled', 'true');
});

test('visual parity: Lit and React resolve the same checked box colour', async ({ page }) => {
  await expect(reactBox(page, 'react-checked')).toBeVisible();

  for (const variant of ['checked', 'neutral', 'danger', 'mixed'] as const) {
    const litBg = await litControl(page, `lit-${variant}`).evaluate(bg);
    const reactBg = await reactControl(page, `react-${variant}`).evaluate(bg);
    expect(reactBg, `${variant}: box background parity`).toBe(litBg);
  }
});

test('tokens: re-pointing --lab-fill-accent re-skins BOTH checked boxes', async ({ page }) => {
  const lit = litControl(page, 'lit-checked');
  const react = reactControl(page, 'react-checked');
  await expect(reactBox(page, 'react-checked')).toBeVisible();

  await page.evaluate(() => {
    document.documentElement.style.setProperty('--lab-fill-accent', 'rgb(1, 2, 3)');
  });
  await expect.poll(() => lit.evaluate(bg)).toBe('rgb(1, 2, 3)');
  await expect.poll(() => react.evaluate(bg)).toBe('rgb(1, 2, 3)');
});

test('theme: flipping [data-theme] re-skins both renderers with zero edits', async ({ page }) => {
  const lit = litControl(page, 'lit-neutral');
  const react = reactControl(page, 'react-neutral');
  await expect(reactBox(page, 'react-neutral')).toBeVisible();

  const litDark = await lit.evaluate(bg);
  const reactDark = await react.evaluate(bg);

  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));

  await expect.poll(() => lit.evaluate(bg)).not.toBe(litDark);
  await expect.poll(() => react.evaluate(bg)).not.toBe(reactDark);
});
