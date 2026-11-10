import { type Locator, type Page, expect, test } from '@playwright/test';
import { waitForThemePaint } from './helpers/theme-paint.js';

/**
 * Number Input suite — a MACHINE-DRIVEN numeric form field, verified on BOTH
 * renderers against the REAL `@zag-js/number-input` machine output (not a faked role).
 *
 * The fixture (`number-input.html`) mounts the Lit `<lab-number-input>` and the
 * native-React `<NumberInput>` with identical specimens under one [data-theme]. These
 * checks are the control's browser-side definition of done:
 *   1. Render — the delivered HTML carries the Lit element; React is a client island.
 *   2. Spinbutton a11y — the input is role="spinbutton" with aria-valuenow/valuemin/
 *      valuemax + aria-roledescription, asserted against the machine's REAL output.
 *   3. Label / helper / error — the shared field-a11y wiring (label association,
 *      aria-describedby → helper/error, aria-invalid, aria-required) on BOTH renderers.
 *   4. Triggers — clicking +/- steps the value through the machine.
 *   5. Keyboard — ArrowUp/ArrowDown step the value (the machine owns the keymap).
 *   6. Clamping — the value never crosses min/max; the triggers disable at the bounds.
 *   7. Disabled — the native control + triggers are non-interactive.
 *   8. Visual parity — Lit and React resolve the SAME control border colour.
 *
 * Playwright's CSS engine pierces open shadow DOM, so `litHost.locator('.input')`
 * reaches the Lit shadow input the same way it reaches the React DOM input. DETERMINISM
 * (lesson 7): every value read is gated on the machine's settled output via
 * `expect`/`expect.poll`, never a fixed sleep.
 */

/** The Lit host element (shadow-pierced for inner nodes). */
function litHost(page: Page, testid: string): Locator {
  return page.getByTestId(testid);
}
/** The React `[data-lab-number-input]` field inside its testid wrapper. */
function reactField(page: Page, testid: string): Locator {
  return page.getByTestId(testid).locator('[data-lab-number-input]');
}
/** The spinbutton input for a Lit host or a React field. */
function litInput(page: Page, testid: string): Locator {
  return litHost(page, testid).locator('input.input');
}
function reactInput(page: Page, testid: string): Locator {
  return reactField(page, testid).locator('input.lab-number-input-input');
}
function litInc(page: Page, testid: string): Locator {
  return litHost(page, testid).locator('.trigger-inc');
}
function litDec(page: Page, testid: string): Locator {
  return litHost(page, testid).locator('.trigger-dec');
}
function reactInc(page: Page, testid: string): Locator {
  return reactField(page, testid).locator('.lab-number-input-trigger-inc');
}
function reactDec(page: Page, testid: string): Locator {
  return reactField(page, testid).locator('.lab-number-input-trigger-dec');
}

const borderColor = (el: HTMLElement) => getComputedStyle(el).borderTopColor;
const numVal = (el: HTMLInputElement) => Number(el.value);

test.beforeEach(async ({ page }) => {
  await page.goto('/number-input.html');
});

test('delivered HTML carries the Lit element (React island mounts client-side)', async ({
  request,
}) => {
  const body = await (await request.get('/number-input.html')).text();
  expect(body).toMatch(/<lab-number-input/i);
  expect(body).toContain('id="react-root"');
});

test('render: both renderers paint a real spinbutton input', async ({ page }) => {
  for (const input of [litInput(page, 'lit-neutral'), reactInput(page, 'react-neutral')]) {
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute('role', 'spinbutton');
  }
});

/**
 * Spinbutton a11y — the binding the @zag-js/number-input machine REALLY emits: the
 * input is role="spinbutton" with aria-roledescription="numberfield" and
 * aria-valuemin/valuemax from the min/max props and aria-valuenow tracking the value.
 * Falsifiable: the numbers must equal the configured bounds, not merely "be present".
 */
test('aria: the machine exposes spinbutton value semantics (both renderers)', async ({ page }) => {
  for (const input of [litInput(page, 'lit-neutral'), reactInput(page, 'react-neutral')]) {
    await expect(input).toHaveAttribute('role', 'spinbutton');
    await expect(input).toHaveAttribute('aria-roledescription', 'numberfield');
    await expect(input).toHaveAttribute('aria-valuemin', '0');
    await expect(input).toHaveAttribute('aria-valuemax', '10');
    await expect(input).toHaveAttribute('aria-valuenow', '3');
  }
});

test('label association: a real <label for> targets the input id (both renderers)', async ({
  page,
}) => {
  for (const [host, input] of [
    [litHost(page, 'lit-neutral'), litInput(page, 'lit-neutral')] as const,
    [reactField(page, 'react-neutral'), reactInput(page, 'react-neutral')] as const,
  ]) {
    const inputId = await input.getAttribute('id');
    expect(inputId, 'input has an id').toBeTruthy();
    const label = host.locator('label');
    expect(await label.getAttribute('for')).toBe(inputId);
  }
});

/**
 * Description wiring — the shared field-a11y contract (identical to Input/Textarea):
 * aria-describedby → helper id; when invalid + a message, aria-invalid="true" and
 * aria-errormessage → the error id. The idref must equal the actual region's id.
 */
test('field-a11y: helper + error are linked the same on both renderers', async ({ page }) => {
  for (const [host, input] of [
    [litHost(page, 'lit-neutral'), litInput(page, 'lit-neutral')] as const,
    [reactField(page, 'react-neutral'), reactInput(page, 'react-neutral')] as const,
  ]) {
    const helper = host.locator('.helper, .lab-field-helper');
    const helperId = await helper.getAttribute('id');
    expect(helperId, 'helper has an id').toBeTruthy();
    expect(await input.getAttribute('aria-describedby')).toContain(helperId ?? '');
  }

  for (const [host, input] of [
    [litHost(page, 'lit-invalid'), litInput(page, 'lit-invalid')] as const,
    [reactField(page, 'react-invalid'), reactInput(page, 'react-invalid')] as const,
  ]) {
    const error = host.locator('.error, .lab-field-error');
    const errorId = await error.getAttribute('id');
    expect(errorId, 'error has an id').toBeTruthy();
    await expect(error).toHaveAttribute('role', 'alert');
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(await input.getAttribute('aria-errormessage')).toBe(errorId);
    expect(await input.getAttribute('aria-describedby')).toContain(errorId ?? '');
  }
});

test('required: aria-required + the native required are set (both renderers)', async ({ page }) => {
  for (const input of [litInput(page, 'lit-required'), reactInput(page, 'react-required')]) {
    await expect(input).toHaveAttribute('aria-required', 'true');
    await expect(input).toHaveAttribute('required', '');
  }
});

test('triggers: clicking + / - steps the value through the machine (both renderers)', async ({
  page,
}) => {
  // Lit: starts at 3, increment → 4, decrement twice → 2.
  await litInc(page, 'lit-neutral').click();
  await expect.poll(() => litInput(page, 'lit-neutral').evaluate(numVal)).toBe(4);
  await litDec(page, 'lit-neutral').click();
  await litDec(page, 'lit-neutral').click();
  await expect.poll(() => litInput(page, 'lit-neutral').evaluate(numVal)).toBe(2);
  // The machine keeps aria-valuenow in lockstep with the value.
  await expect(litInput(page, 'lit-neutral')).toHaveAttribute('aria-valuenow', '2');

  // React parity.
  await reactInc(page, 'react-neutral').click();
  await expect.poll(() => reactInput(page, 'react-neutral').evaluate(numVal)).toBe(4);
  await reactDec(page, 'react-neutral').click();
  await reactDec(page, 'react-neutral').click();
  await expect.poll(() => reactInput(page, 'react-neutral').evaluate(numVal)).toBe(2);
  await expect(reactInput(page, 'react-neutral')).toHaveAttribute('aria-valuenow', '2');
});

test('keyboard: ArrowUp / ArrowDown step the value (the machine owns the keymap)', async ({
  page,
}) => {
  const litI = litInput(page, 'lit-neutral');
  await litI.focus();
  await page.keyboard.press('ArrowUp');
  await expect.poll(() => litI.evaluate(numVal)).toBe(4);
  await page.keyboard.press('ArrowDown');
  await expect.poll(() => litI.evaluate(numVal)).toBe(3);

  const reactI = reactInput(page, 'react-neutral');
  await reactI.focus();
  await page.keyboard.press('ArrowUp');
  await expect.poll(() => reactI.evaluate(numVal)).toBe(4);
  await page.keyboard.press('ArrowDown');
  await expect.poll(() => reactI.evaluate(numVal)).toBe(3);
});

test('clamping: the value never crosses max; the increment trigger disables at the max', async ({
  page,
}) => {
  // The min specimen starts at 0 (min); the decrement trigger is disabled there.
  await expect(litDec(page, 'lit-at-min')).toHaveAttribute('data-disabled', '');
  await expect(reactDec(page, 'react-at-min')).toHaveAttribute('data-disabled', '');

  // Step the input to the max (10) with the keyboard (the input never disables, only
  // the trigger does), then assert the value CLAMPS at 10 and the inc trigger disables.
  // PageUp on a spinbutton jumps by a larger step, so a couple of presses overshoots
  // the bound and the machine clamps it.
  const litI = litInput(page, 'lit-at-min');
  await litI.focus();
  for (let i = 0; i < 12; i++) await page.keyboard.press('ArrowUp');
  await expect.poll(() => litI.evaluate(numVal)).toBe(10);
  await expect(litInc(page, 'lit-at-min')).toHaveAttribute('data-disabled', '');

  const reactI = reactInput(page, 'react-at-min');
  await reactI.focus();
  for (let i = 0; i < 12; i++) await page.keyboard.press('ArrowUp');
  await expect.poll(() => reactI.evaluate(numVal)).toBe(10);
  await expect(reactInc(page, 'react-at-min')).toHaveAttribute('data-disabled', '');
});

test('disabled: the native input is non-interactive on both renderers', async ({ page }) => {
  await expect(litInput(page, 'lit-disabled')).toBeDisabled();
  await expect(reactInput(page, 'react-disabled')).toBeDisabled();
});

test('visual parity: Lit and React resolve the same control border colour', async ({ page }) => {
  await waitForThemePaint(
    page,
    litHost(page, 'lit-neutral').locator('.control'),
    reactField(page, 'react-neutral').locator('.lab-field-control'),
  );
  const litBorder = await litHost(page, 'lit-neutral').locator('.control').evaluate(borderColor);
  const reactBorder = await reactField(page, 'react-neutral')
    .locator('.lab-field-control')
    .evaluate(borderColor);
  expect(reactBorder, 'number-input control border parity').toBe(litBorder);
});

test('visual parity: the danger sentiment re-points the border identically', async ({ page }) => {
  await waitForThemePaint(
    page,
    litHost(page, 'lit-invalid').locator('.control'),
    reactField(page, 'react-invalid').locator('.lab-field-control'),
  );
  const litBorder = await litHost(page, 'lit-invalid').locator('.control').evaluate(borderColor);
  const reactBorder = await reactField(page, 'react-invalid')
    .locator('.lab-field-control')
    .evaluate(borderColor);
  expect(reactBorder, 'danger border parity').toBe(litBorder);
});
