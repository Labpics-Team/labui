import { type Locator, type Page, expect, test } from '@playwright/test';

/**
 * Textarea suite — a PRESENTATIONAL multi-line form field that OPTS OUT of the Zag
 * seam (no text-input machine in @zag-js), verified on BOTH renderers.
 *
 * Mirrors the Input suite (it shares the same form-field a11y wiring via the shared
 * field-a11y helper) and adds the multi-line extras:
 *   1. Render — both renderers paint a real <textarea> control with a token.
 *   2. Label association — a real <label for> points at the control id.
 *   3. Description wiring — aria-describedby → helper; invalid lists helper THEN
 *      error, aria-invalid="true", aria-errormessage → error id, role="alert".
 *   4. Empty-error honesty — invalid with no message references nothing.
 *   5. Required — aria-required + the native required.
 *   6. Disabled / readonly — the native control reflects them.
 *   7. Focus delegation — clicking the label focuses the native control.
 *   8. Auto-resize — the control's height grows to fit content (local view state).
 *   9. Visual parity + tokens + theme — Lit and React resolve the same paint.
 */

function litHost(page: Page, testid: string): Locator {
  return page.getByTestId(testid);
}
function reactField(page: Page, testid: string): Locator {
  return page.getByTestId(testid).locator('[data-lab-textarea]');
}
function litControl(page: Page, testid: string): Locator {
  return litHost(page, testid).locator('textarea.lab-field-control, textarea.control');
}
function reactControl(page: Page, testid: string): Locator {
  return reactField(page, testid).locator('textarea.lab-field-control');
}

const borderColor = (el: HTMLElement) => getComputedStyle(el).borderTopColor;

test.beforeEach(async ({ page }) => {
  await page.goto('/textarea.html');
});

test('delivered HTML carries the Lit element (React island mounts client-side)', async ({
  request,
}) => {
  const body = await (await request.get('/textarea.html')).text();
  expect(body).toMatch(/<lab-textarea/i);
  expect(body).toContain('id="react-root"');
});

test('render: both renderers paint a real <textarea> control', async ({ page }) => {
  for (const control of [litControl(page, 'lit-neutral'), reactControl(page, 'react-neutral')]) {
    await expect(control).toBeVisible();
    expect(await control.evaluate((el) => el.tagName.toLowerCase())).toBe('textarea');
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
    expect(controlId).toBeTruthy();
    const label = field.locator('label.lab-field-label, label.label');
    expect(await label.getAttribute('for')).toBe(controlId);
  }
});

test('description wiring: aria-describedby links the helper (both renderers)', async ({ page }) => {
  for (const [field, control] of [
    [litHost(page, 'lit-neutral'), litControl(page, 'lit-neutral')] as const,
    [reactField(page, 'react-neutral'), reactControl(page, 'react-neutral')] as const,
  ]) {
    const helperId = await field.locator('.lab-field-helper, .helper').getAttribute('id');
    expect(helperId).toBeTruthy();
    const describedBy = await control.getAttribute('aria-describedby');
    expect(describedBy?.split(/\s+/)).toContain(helperId);
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
    expect(await error.getAttribute('role')).toBe('alert');
    expect(await control.getAttribute('aria-invalid')).toBe('true');
    expect(await control.getAttribute('aria-errormessage')).toBe(errorId);
    const describedBy = (await control.getAttribute('aria-describedby'))?.split(/\s+/) ?? [];
    expect(describedBy).toEqual([helperId, errorId]);
  }
});

test('empty-error honesty: invalid with no message references nothing', async ({ page }) => {
  const control = litControl(page, 'lit-warning');
  await litHost(page, 'lit-warning').evaluate((host) => host.setAttribute('invalid', ''));
  await expect.poll(() => control.getAttribute('aria-invalid')).toBeNull();
  expect(await control.getAttribute('aria-errormessage')).toBeNull();
});

test('required: aria-required + the native required (both renderers)', async ({ page }) => {
  for (const control of [litControl(page, 'lit-required'), reactControl(page, 'react-required')]) {
    expect(await control.getAttribute('aria-required')).toBe('true');
    expect(await control.evaluate((el) => (el as HTMLTextAreaElement).required)).toBe(true);
  }
});

test('disabled / readonly: the native control reflects them (both renderers)', async ({ page }) => {
  for (const control of [litControl(page, 'lit-disabled'), reactControl(page, 'react-disabled')]) {
    expect(await control.evaluate((el) => (el as HTMLTextAreaElement).disabled)).toBe(true);
  }
  for (const control of [litControl(page, 'lit-readonly'), reactControl(page, 'react-readonly')]) {
    expect(await control.evaluate((el) => (el as HTMLTextAreaElement).readOnly)).toBe(true);
  }
});

test('focus delegation: clicking the label focuses the native control (both renderers)', async ({
  page,
}) => {
  const litLabel = litHost(page, 'lit-neutral').locator('label.label, label.lab-field-label');
  await litLabel.click();
  expect(
    await litHost(page, 'lit-neutral').evaluate(
      (host) => host.shadowRoot?.activeElement?.tagName.toLowerCase() ?? null,
    ),
  ).toBe('textarea');

  await reactField(page, 'react-neutral').locator('label.lab-field-label').click();
  await expect(reactControl(page, 'react-neutral')).toBeFocused();
});

test('auto-resize: the control grows to fit content on input (both renderers)', async ({
  page,
}) => {
  // Auto-resize is honest LOCAL view state: the height tracks scrollHeight. Type a
  // long, multi-line value and assert the control got taller than its initial height.
  const longText = 'line one\nline two\nline three\nline four\nline five\nline six';

  for (const control of [
    litControl(page, 'lit-autoresize'),
    reactControl(page, 'react-autoresize'),
  ]) {
    const before = await control.evaluate((el) => el.getBoundingClientRect().height);
    await control.fill(longText);
    await expect
      .poll(() => control.evaluate((el) => el.getBoundingClientRect().height))
      .toBeGreaterThan(before);
  }
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
