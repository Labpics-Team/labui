import { fileURLToPath } from 'node:url';
import type { LabTextarea } from '@labpics/ui-core/textarea';
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
    const litBorder = await litHost(page, `lit-${variant}`)
      .locator('.lab-input-outline')
      .evaluate(borderColor);
    const reactBorder = await reactField(page, `react-${variant}`)
      .locator('.lab-input-outline')
      .evaluate(borderColor);
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
  const lit = litHost(page, 'lit-invalid').locator('.lab-input-outline');
  const react = reactField(page, 'react-invalid').locator('.lab-input-outline');
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

test('author geometry and transparent outline match in both themes', async ({ page }) => {
  for (const theme of ['light', 'dark']) {
    await page.evaluate((theme) => {
      document.documentElement.dataset.theme = theme;
    }, theme);
    for (const control of [litControl(page, 'lit-neutral'), reactControl(page, 'react-neutral')]) {
      const geometry = await control.evaluate((control) => {
        const frame = control.closest('.lab-input-frame') as HTMLElement;
        const label = frame.querySelector('label') as HTMLElement;
        const style = getComputedStyle(control);
        return {
          height: frame.getBoundingClientRect().height,
          radius: getComputedStyle(frame).borderRadius,
          background: style.backgroundColor,
          font: style.fontSize,
          line: style.lineHeight,
          labelFont: getComputedStyle(label).fontSize,
          labelOffset: label.getBoundingClientRect().top - frame.getBoundingClientRect().top,
        };
      });
      expect(geometry).toEqual({
        height: 112,
        radius: '12px',
        background: 'rgba(0, 0, 0, 0)',
        font: '16px',
        line: '24px',
        labelFont: '14px',
        labelOffset: -8,
      });
    }
  }
});

test('Active uses the authored focus role while semantic states retain their border', async ({
  page,
}) => {
  for (const theme of ['light', 'dark']) {
    await page.evaluate((theme) => {
      document.documentElement.dataset.theme = theme;
    }, theme);
    await page.evaluate(() => {
      document.documentElement.style.setProperty('--lab-border-focus', 'rgb(1, 2, 3)');
      document.documentElement.style.setProperty('--lab-border-danger', 'rgb(4, 5, 6)');
      document.documentElement.style.setProperty('--lab-border-warning-strong', 'rgb(7, 8, 9)');
      document.documentElement.style.setProperty('--lab-border-success-strong', 'rgb(10, 11, 12)');
    });
    for (const [state, color] of [
      ['neutral', 'rgb(1, 2, 3)'],
      ['invalid', 'rgb(4, 5, 6)'],
      ['warning', 'rgb(7, 8, 9)'],
      ['success', 'rgb(10, 11, 12)'],
    ] as const) {
      for (const [field, control] of [
        [litHost(page, `lit-${state}`), litControl(page, `lit-${state}`)],
        [reactField(page, `react-${state}`), reactControl(page, `react-${state}`)],
      ] as const) {
        await control.focus();
        await control.hover();
        expect(
          await field
            .locator('.lab-input-outline')
            .evaluate((el) => getComputedStyle(el).borderColor),
        ).toBe(color);
      }
    }
  }
});

test('form values, reset, readonly and inherited disabled preserve native behavior', async ({
  page,
}) => {
  await page.evaluate(async () => {
    const form = document.createElement('form');
    form.dataset.testid = 'lit-form';
    form.innerHTML =
      '<fieldset><lab-textarea name="notes" label="Form notes" value="Initial" rows="2" auto-resize></lab-textarea></fieldset><button type="reset">Reset notes</button>';
    document.body.append(form);
    await (form.querySelector('lab-textarea') as LabTextarea).updateComplete;
  });
  for (const renderer of ['lit', 'react']) {
    const form = page.getByTestId(`${renderer}-form`);
    const control = form.locator('textarea');
    const initialHeight = await control.evaluate((el) => el.clientHeight);
    const multiline = Array.from({ length: 8 }, (_, i) => `Line ${i}`).join('\n');
    await control.fill(multiline);
    await expect
      .poll(() => form.evaluate((form: HTMLFormElement) => new FormData(form).get('notes')))
      .toBe(multiline);
    await form.getByRole('button', { name: 'Reset notes' }).click();
    await expect(control).toHaveValue('Initial');
    await expect.poll(() => control.evaluate((el) => el.clientHeight)).toBe(initialHeight);
    await form
      .locator('fieldset')
      .first()
      .evaluate((el: HTMLFieldSetElement) => {
        el.disabled = true;
      });
    await expect(control).toBeDisabled();
    await expect
      .poll(() => form.evaluate((form: HTMLFormElement) => new FormData(form).has('notes')))
      .toBe(false);
    await form
      .locator('fieldset')
      .first()
      .evaluate((el: HTMLFieldSetElement) => {
        el.disabled = false;
      });
    await expect(control).toBeEnabled();
    await control.evaluate((el: HTMLTextAreaElement) => {
      el.readOnly = true;
      el.required = true;
    });
    expect(await form.evaluate((form: HTMLFormElement) => new FormData(form).get('notes'))).toBe(
      'Initial',
    );
  }
});

test('controlled edits and programmatic values grow and shrink without replacing the native control', async ({
  page,
}) => {
  const control = page.getByTestId('react-controlled').locator('textarea');
  const initialHeight = await control.evaluate((el) => el.clientHeight);
  await control.evaluate((el) => {
    (window as unknown as { textareaNode: Element }).textareaNode = el;
  });
  await page.getByRole('button', { name: 'Replace notes' }).click();
  await expect.poll(() => control.evaluate((el) => el.clientHeight)).toBeGreaterThan(initialHeight);
  await page.getByRole('button', { name: 'Clear notes' }).click();
  await expect(control).toHaveValue('');
  await expect.poll(() => control.evaluate((el) => el.clientHeight)).toBe(initialHeight);
  expect(
    await control.evaluate(
      (el) => (window as unknown as { textareaNode: Element }).textareaNode === el,
    ),
  ).toBe(true);
});

test('Enter and composition preserve multiline value, selection and input identity', async ({
  page,
}) => {
  for (const control of [
    litControl(page, 'lit-neutral'),
    page.getByTestId('react-controlled').locator('textarea'),
  ]) {
    await control.fill('Alpha Beta');
    await control.evaluate((el: HTMLTextAreaElement) => {
      el.focus();
      el.setSelectionRange(5, 5);
    });
    await control.press('Enter');
    await expect(control).toHaveValue('Alpha\n Beta');
    await control.evaluate((el: HTMLTextAreaElement) => {
      (window as unknown as { textareaNode: Element }).textareaNode = el;
      el.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '' }));
      el.setRangeText('日本語', 6, 6, 'end');
      el.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          composed: true,
          data: '日本語',
          inputType: 'insertCompositionText',
          isComposing: true,
        }),
      );
      el.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '日本語' }));
    });
    await expect(control).toHaveValue('Alpha\n日本語 Beta');
    expect(
      await control.evaluate((el: HTMLTextAreaElement) => [el.selectionStart, el.selectionEnd]),
    ).toEqual([9, 9]);
    expect(
      await control.evaluate(
        (el) => (window as unknown as { textareaNode: Element }).textareaNode === el,
      ),
    ).toBe(true);
  }
});

test('long labels reflow at 100, 125 and 200 percent without intersecting content', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const label = 'Описание проекта и дополнительных материалов для публикации';
  await litHost(page, 'lit-neutral').evaluate((host, text) => {
    (host as LabTextarea).label = text;
  }, label);
  await reactField(page, 'react-neutral')
    .locator('label .lab-field-label-text')
    .evaluate((el, text) => {
      el.textContent = text;
    }, label);
  await reactField(page, 'react-neutral')
    .locator('legend')
    .evaluate((el, text) => {
      el.textContent = text;
    }, label);
  for (const scale of [100, 125, 200]) {
    await page.evaluate((scale) => {
      document.documentElement.style.fontSize = `${scale}%`;
    }, scale);
    for (const control of [litControl(page, 'lit-neutral'), reactControl(page, 'react-neutral')]) {
      const result = await control.evaluate((control) => {
        const frame = control.closest('.lab-input-frame') as HTMLElement;
        const label = frame.querySelector('label') as HTMLElement;
        const helper = frame.nextElementSibling as HTMLElement;
        const content = control.getBoundingClientRect();
        return {
          labelFits: label.scrollWidth <= label.clientWidth + 1,
          labelBottom: label.getBoundingClientRect().bottom,
          textTop: content.top + Number.parseFloat(getComputedStyle(control).paddingTop),
          helperTop: helper.getBoundingClientRect().top,
          frameBottom: frame.getBoundingClientRect().bottom,
          frameFits: frame.scrollWidth <= frame.clientWidth + 1,
        };
      });
      expect(result.labelFits).toBe(true);
      expect(result.frameFits).toBe(true);
      expect(result.textTop).toBeGreaterThan(result.labelBottom);
      expect(result.helperTop).toBeGreaterThanOrEqual(result.frameBottom);
    }
  }
});

test('fallback sizing avoids measurement loops and returns manual sizing on disable', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = CSS.supports.bind(CSS);
    CSS.supports = ((property: string, value?: string) =>
      property === 'field-sizing'
        ? false
        : value === undefined
          ? original(property)
          : original(property, value)) as typeof CSS.supports;
  });
  await page.reload();
  await page.evaluate(() => document.fonts.ready);
  const control = litControl(page, 'lit-autoresize');
  await control.evaluate((el: HTMLTextAreaElement) => {
    el.style.setProperty('field-sizing', 'fixed');
  });
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  await control.evaluate((el: HTMLTextAreaElement) => {
    const getter = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollHeight')?.get;
    if (!getter) throw new Error('Missing native scrollHeight');
    let reads = 0;
    Object.defineProperty(el, 'scrollHeight', {
      get() {
        reads++;
        return getter.call(el);
      },
    });
    (el as unknown as { measurements: () => number }).measurements = () => reads;
  });
  await control.fill(Array.from({ length: 8 }, (_, i) => `Line ${i}`).join('\n'));
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  const reads = await control.evaluate((el) =>
    (el as unknown as { measurements: () => number }).measurements(),
  );
  expect(reads).toBe(1);
  await litHost(page, 'lit-autoresize').evaluate((host: LabTextarea) => {
    host.helper = 'A helper update';
  });
  expect(
    await control.evaluate((el) =>
      (el as unknown as { measurements: () => number }).measurements(),
    ),
  ).toBe(reads);
  await litHost(page, 'lit-autoresize').evaluate((host: LabTextarea) => {
    host.autoResize = false;
  });
  await expect.poll(() => control.evaluate((el: HTMLTextAreaElement) => el.style.height)).toBe('');
  expect(await control.evaluate((el) => getComputedStyle(el).resize)).toBe('vertical');
  await expect(litHost(page, 'lit-autoresize').locator('[data-lab-textarea-measure]')).toHaveCount(
    0,
  );
});

test('fallback sizing updates loaded glyph metrics without a computed-font change', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = CSS.supports.bind(CSS);
    CSS.supports = ((property: string, value?: string) =>
      property === 'field-sizing'
        ? false
        : value === undefined
          ? original(property)
          : original(property, value)) as typeof CSS.supports;
  });
  await page.route('**/late-font.woff2', (route) =>
    route.fulfill({
      path: fileURLToPath(
        new URL('../../../packages/fonts/fonts/GeistMono-Variable.woff2', import.meta.url),
      ),
      contentType: 'font/woff2',
    }),
  );
  await page.reload();
  await page.evaluate(() => document.fonts.ready);
  const controls = [litControl(page, 'lit-autoresize'), reactControl(page, 'react-autoresize')];
  const initial = [];
  for (const control of controls) {
    await control.evaluate((el: HTMLTextAreaElement) => {
      el.style.setProperty('field-sizing', 'fixed');
      el.style.width = '280px';
      el.style.fontFamily = 'TextareaLateFont, Arial';
    });
    await control.fill('iiii iiii iiii iiii '.repeat(30));
    initial.push({
      control,
      ...(await control.evaluate((el) => ({
        height: el.clientHeight,
        font: getComputedStyle(el).font,
      }))),
    });
  }
  await page.evaluate(async () => {
    const face = new FontFace('TextareaLateFont', 'url("/late-font.woff2")');
    document.fonts.add(face);
    await face.load();
    await document.fonts.ready;
  });
  for (const { control, height, font } of initial) {
    await expect.poll(() => control.evaluate((el) => el.clientHeight)).toBeGreaterThan(height);
    expect(await control.evaluate((el) => getComputedStyle(el).font)).toBe(font);
    expect(await control.evaluate((el) => el.scrollHeight <= el.clientHeight)).toBe(true);
  }
});

test('validation preserves native minlength after editing and readonly bypasses constraints', async ({
  page,
}) => {
  await page.evaluate(async () => {
    const form = document.createElement('form');
    form.dataset.testid = 'validation-form';
    form.innerHTML =
      '<lab-textarea name="notes" label="Notes" minlength="3" required></lab-textarea>';
    document.body.append(form);
    await (form.querySelector('lab-textarea') as LabTextarea).updateComplete;
  });
  const form = page.getByTestId('validation-form');
  const control = form.locator('textarea');
  await control.fill('a');
  expect(await form.evaluate((form: HTMLFormElement) => form.checkValidity())).toBe(false);
  await form.locator('lab-textarea').evaluate((host: LabTextarea) => {
    host.readonly = true;
  });
  await expect
    .poll(() => form.evaluate((form: HTMLFormElement) => form.checkValidity()))
    .toBe(true);
  await form.locator('lab-textarea').evaluate((host: LabTextarea) => {
    host.readonly = false;
    host.invalid = true;
    host.error = 'Server error';
    host.type = 'warning';
  });
  await expect
    .poll(() => control.evaluate((el: HTMLTextAreaElement) => el.validationMessage))
    .toBe('Server error');
  await form.evaluate((el) => el.style.setProperty('--lab-border-danger', 'rgb(1, 2, 3)'));
  expect(
    await form.locator('.lab-input-outline').evaluate((el) => getComputedStyle(el).borderColor),
  ).toBe('rgb(1, 2, 3)');
});
