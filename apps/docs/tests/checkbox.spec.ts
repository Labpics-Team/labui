import { type Locator, type Page, expect, test } from '@playwright/test';
import { litInputIds, probeInput } from './support/accessible-name.js';

/**
 * Native checkbox behavior, mixed state, accessible names and authored paint
 * on the Lit and React renderers mounted by checkbox.html.
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

/** The hidden native input — the a11y primitive — for a Lit host or React label. */
function litInput(page: Page, testid: string): Locator {
  return litHost(page, testid).locator('input');
}
function reactInput(page: Page, testid: string): Locator {
  return reactBox(page, testid).locator('input');
}

const bg = (el: HTMLElement) => getComputedStyle(el).backgroundColor;

/** Current visual state on the Lit control (checked | unchecked | indeterminate). */
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

test('native selection: clicking toggles checked on both renderers', async ({ page }) => {
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

test('mixed state: activation resolves indeterminate to checked', async ({ page }) => {
  // Mixed is reflected on the host and on the visual control.
  const lit = litHost(page, 'lit-mixed');
  await expect(lit).toHaveAttribute('indeterminate', '');
  expect(await litControlState(page, 'lit-mixed')).toBe('indeterminate');

  // The React mixed specimen agrees via data-indeterminate.
  const react = reactBox(page, 'react-mixed');
  await expect(react).toHaveAttribute('data-indeterminate', 'true');

  // The native input resolves mixed to checked on activation.
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

test('a11y name: the hidden input is exposed and named by the visible label (both renderers)', async ({
  page,
}) => {
  // The control IS the hidden <input>. It must live in the a11y tree (NOT inside
  // an aria-hidden subtree) and be named by its resolved aria-labelledby.
  await expect(reactBox(page, 'react-unchecked')).toBeVisible();

  const lit = await probeInput(litInput(page, 'lit-unchecked'));
  expect(lit.ariaHidden, 'Lit checkbox input must NOT be in an aria-hidden subtree').toBe(false);
  expect(lit.labelledbyResolves, 'Lit checkbox aria-labelledby must resolve').toBe(true);
  expect(lit.name).toBe('Terms');

  const react = await probeInput(reactInput(page, 'react-unchecked'));
  expect(react.ariaHidden, 'React checkbox input must NOT be in an aria-hidden subtree').toBe(
    false,
  );
  expect(react.labelledbyResolves, 'React checkbox aria-labelledby must resolve').toBe(true);
  expect(react.name).toBe('Terms');
});

test('a11y name: a checkbox with no visible label is named via aria-label', async ({ page }) => {
  await expect(reactBox(page, 'react-aria-label')).toBeVisible();

  const lit = await probeInput(litInput(page, 'lit-aria-label'));
  expect(lit.ariaHidden).toBe(false);
  expect(lit.name).toBe('Select all');

  const react = await probeInput(reactInput(page, 'react-aria-label'));
  expect(react.ariaHidden).toBe(false);
  expect(react.name).toBe('Select all');
});

test('a11y ids: every Lit checkbox instance has a UNIQUE input id (no :undefined collisions)', async ({
  page,
}) => {
  await expect(litHost(page, 'lit-unchecked')).toBeVisible();
  const ids = await litInputIds(litHost(page, 'lit-unchecked'), 'lab-checkbox');
  expect(ids.length).toBeGreaterThan(1);
  for (const id of ids) expect(id, 'id must not be :undefined').not.toContain('undefined');
  expect(new Set(ids).size, `ids must be unique: ${ids.join(', ')}`).toBe(ids.length);
});

test('a11y checked: the native input reflects checked AND the mixed (indeterminate) state', async ({
  page,
}) => {
  await expect(reactBox(page, 'react-unchecked')).toBeVisible();

  // Unchecked specimen: native checked=false, indeterminate=false.
  const off = await probeInput(litInput(page, 'lit-unchecked'));
  expect(off.checked).toBe(false);
  expect(off.indeterminate).toBe(false);

  // Checked specimen: native checked=true (the a11y "checked" state).
  const on = await probeInput(litInput(page, 'lit-checked'));
  expect(on.checked).toBe(true);
  expect(on.indeterminate).toBe(false);

  // Mixed specimen: native indeterminate=true (the a11y "mixed" state) on BOTH.
  const litMixed = await probeInput(litInput(page, 'lit-mixed'));
  expect(litMixed.indeterminate, 'Lit mixed input must be indeterminate').toBe(true);
  const reactMixed = await probeInput(reactInput(page, 'react-mixed'));
  expect(reactMixed.indeterminate, 'React mixed input must be indeterminate').toBe(true);
});

test('disabled: the native input blocks the toggle on both renderers', async ({ page }) => {
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
