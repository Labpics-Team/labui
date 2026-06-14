import { type Locator, type Page, expect, test } from '@playwright/test';

/**
 * Input suite — a PRESENTATIONAL form field that OPTS OUT of the Zag seam (no
 * text-input machine in @zag-js: the native <input> owns value/caret/editing),
 * verified on BOTH renderers.
 *
 * Because there is no machine, these checks assert the FORM-FIELD A11Y WIRING the
 * field DOES own (real ARIA, not a faked role) + STRUCTURE + visual parity:
 *   1. Render — both renderers paint a real <input> control with a token.
 *   2. Label association — a real <label for> points at the control id.
 *   3. Description wiring — aria-describedby → helper id; when invalid + a message,
 *      it lists helper THEN error, aria-invalid="true", aria-errormessage → error id.
 *   4. Empty-error honesty — invalid with no message references nothing.
 *   5. Required — aria-required + the native required.
 *   6. Disabled / readonly — the native control reflects them and blocks editing.
 *   7. Focus delegation — clicking the label focuses the native control.
 *   8. Visual parity — matching specimens resolve the SAME computed border colour.
 *   9. Tokens + theme — re-pointing a role / flipping [data-theme] re-skins both.
 */

/** The Lit host element (shadow-pierced for inner nodes). */
function litHost(page: Page, testid: string): Locator {
  return page.getByTestId(testid);
}
/** The React `[data-lab-input]` field inside its testid wrapper. */
function reactField(page: Page, testid: string): Locator {
  return page.getByTestId(testid).locator('[data-lab-input]');
}
/** The native <input> control for a Lit host or a React field. */
function litControl(page: Page, testid: string): Locator {
  return litHost(page, testid).locator('input.lab-field-control, input.control');
}
function reactControl(page: Page, testid: string): Locator {
  return reactField(page, testid).locator('input.lab-field-control');
}

const borderColor = (el: HTMLElement) => getComputedStyle(el).borderTopColor;

test.beforeEach(async ({ page }) => {
  await page.goto('/input.html');
});

test('delivered HTML carries the Lit element (React island mounts client-side)', async ({
  request,
}) => {
  const body = await (await request.get('/input.html')).text();
  expect(body).toMatch(/<lab-input/i);
  expect(body).toContain('id="react-root"');
});

test('render: both renderers paint a real <input> control', async ({ page }) => {
  for (const control of [litControl(page, 'lit-neutral'), reactControl(page, 'react-neutral')]) {
    await expect(control).toBeVisible();
    expect(await control.evaluate((el) => el.tagName.toLowerCase())).toBe('input');
  }
});

test('label association: a real <label for> targets the control id (both renderers)', async ({
  page,
}) => {
  for (const [field, control] of [
    [litHost(page, 'lit-neutral'), litControl(page, 'lit-neutral')] as const,
    [reactField(page, 'react-neutral'), reactControl(page, 'react-neutral')] as const,
  ]) {
    const controlId = await control.getAttribute('id');
    expect(controlId, 'control has an id').toBeTruthy();
    const label = field.locator('label.lab-field-label, label.label');
    expect(await label.getAttribute('for')).toBe(controlId);
  }
});

test('description wiring: aria-describedby links the helper (both renderers)', async ({ page }) => {
  for (const [field, control] of [
    [litHost(page, 'lit-neutral'), litControl(page, 'lit-neutral')] as const,
    [reactField(page, 'react-neutral'), reactControl(page, 'react-neutral')] as const,
  ]) {
    const helper = field.locator('.lab-field-helper, .helper');
    const helperId = await helper.getAttribute('id');
    expect(helperId, 'helper has an id').toBeTruthy();
    const describedBy = await control.getAttribute('aria-describedby');
    expect(describedBy?.split(/\s+/)).toContain(helperId);
    // A valid field is not marked invalid and references no error.
    expect(await control.getAttribute('aria-invalid')).toBeNull();
    expect(await control.getAttribute('aria-errormessage')).toBeNull();
  }
});

test('invalid wiring: describedby lists helper THEN error, with aria-invalid + errormessage', async ({
  page,
}) => {
  for (const [field, control] of [
    [litHost(page, 'lit-invalid'), litControl(page, 'lit-invalid')] as const,
    [reactField(page, 'react-invalid'), reactControl(page, 'react-invalid')] as const,
  ]) {
    const helperId = await field.locator('.lab-field-helper, .helper').getAttribute('id');
    const error = field.locator('.lab-field-error, .error');
    const errorId = await error.getAttribute('id');
    expect(helperId).toBeTruthy();
    expect(errorId).toBeTruthy();

    // The error region is announced.
    expect(await error.getAttribute('role')).toBe('alert');

    // aria-invalid + aria-errormessage point at the real error region.
    expect(await control.getAttribute('aria-invalid')).toBe('true');
    expect(await control.getAttribute('aria-errormessage')).toBe(errorId);

    // describedby reading order: description first, then error.
    const describedBy = (await control.getAttribute('aria-describedby'))?.split(/\s+/) ?? [];
    expect(describedBy).toEqual([helperId, errorId]);
  }
});

test('empty-error honesty: invalid with no message references nothing', async ({ page }) => {
  // A field marked invalid but given no error message must NOT set aria-invalid or
  // aria-errormessage — an empty error region is never referenced (it would point a
  // reader at nothing). Drive a valid specimen invalid WITHOUT setting an error.
  const control = litControl(page, 'lit-warning'); // a type=warning specimen, no helper/error
  await litHost(page, 'lit-warning').evaluate((host) => host.setAttribute('invalid', ''));
  await expect.poll(() => control.getAttribute('aria-invalid')).toBeNull();
  expect(await control.getAttribute('aria-errormessage')).toBeNull();
});

test('required: aria-required + the native required (both renderers)', async ({ page }) => {
  for (const control of [litControl(page, 'lit-required'), reactControl(page, 'react-required')]) {
    expect(await control.getAttribute('aria-required')).toBe('true');
    expect(await control.evaluate((el) => (el as HTMLInputElement).required)).toBe(true);
  }
});

test('disabled / readonly: the native control reflects them (both renderers)', async ({ page }) => {
  for (const control of [litControl(page, 'lit-disabled'), reactControl(page, 'react-disabled')]) {
    expect(await control.evaluate((el) => (el as HTMLInputElement).disabled)).toBe(true);
  }
  for (const control of [litControl(page, 'lit-readonly'), reactControl(page, 'react-readonly')]) {
    expect(await control.evaluate((el) => (el as HTMLInputElement).readOnly)).toBe(true);
  }
});

test('focus delegation: clicking the label focuses the native control (both renderers)', async ({
  page,
}) => {
  // Lit: the host delegates focus; the <label for> + delegatesFocus put focus on
  // the inner input when the label is clicked.
  const litLabel = litHost(page, 'lit-neutral').locator('label.label, label.lab-field-label');
  await litLabel.click();
  expect(
    await litHost(page, 'lit-neutral').evaluate(
      (host) => host.shadowRoot?.activeElement?.tagName.toLowerCase() ?? null,
    ),
  ).toBe('input');

  // React: native <label for> focuses the input on click.
  await reactField(page, 'react-neutral').locator('label.lab-field-label').click();
  await expect(reactControl(page, 'react-neutral')).toBeFocused();
});

test('visual parity: Lit and React resolve the same resting border colour', async ({ page }) => {
  await expect(reactControl(page, 'react-neutral')).toBeVisible();
  for (const variant of ['neutral', 'warning', 'success', 'invalid'] as const) {
    const litBorder = await litControl(page, `lit-${variant}`).evaluate(borderColor);
    const reactBorder = await reactControl(page, `react-${variant}`).evaluate(borderColor);
    expect(reactBorder, `${variant}: border colour parity`).toBe(litBorder);
  }
});

test('size parity: small and large resolve matching control font sizes', async ({ page }) => {
  const fontSize = (el: HTMLElement) => getComputedStyle(el).fontSize;
  for (const size of ['s', 'l'] as const) {
    const litFont = await litControl(page, `lit-size-${size}`).evaluate(fontSize);
    const reactFont = await reactControl(page, `react-size-${size}`).evaluate(fontSize);
    expect(reactFont, `size ${size}: control font parity`).toBe(litFont);
  }
});

test('tokens: re-pointing --lab-border-danger re-skins BOTH invalid controls', async ({ page }) => {
  const lit = litControl(page, 'lit-invalid');
  const react = reactControl(page, 'react-invalid');
  await expect(react).toBeVisible();

  await page.evaluate(() => {
    document.documentElement.style.setProperty('--lab-border-danger', 'rgb(1, 2, 3)');
  });
  await expect.poll(() => lit.evaluate(borderColor)).toBe('rgb(1, 2, 3)');
  await expect.poll(() => react.evaluate(borderColor)).toBe('rgb(1, 2, 3)');
});

test('theme: flipping [data-theme] re-skins both renderers with zero edits', async ({ page }) => {
  const lit = litControl(page, 'lit-neutral');
  const react = reactControl(page, 'react-neutral');
  await expect(react).toBeVisible();

  const litDark = await lit.evaluate((el) => getComputedStyle(el).color);
  const reactDark = await react.evaluate((el) => getComputedStyle(el).color);

  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));

  await expect.poll(() => lit.evaluate((el) => getComputedStyle(el).color)).not.toBe(litDark);
  await expect.poll(() => react.evaluate((el) => getComputedStyle(el).color)).not.toBe(reactDark);
});
