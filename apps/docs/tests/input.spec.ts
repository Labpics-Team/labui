import type { LabInput } from '@labpics/ui-core/input';
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

const borderColor = (el: HTMLElement) => {
  const border = el.closest('.lab-input-frame')?.querySelector('.lab-input-outline');
  if (!border) throw new Error('Input outline is missing');
  return getComputedStyle(border).borderTopColor;
};

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
    expect(await control.evaluate((input: HTMLInputElement) => input.validationMessage)).toBe(
      await error.textContent(),
    );

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

test('авторские размеры и подпись в прозрачном разрыве рамки', async ({ page }) => {
  for (const [suffix, height, radius] of [
    ['size-s', 36, 16],
    ['neutral', 48, 12],
    ['size-l', 56, 12],
  ] as const) {
    for (const host of [litHost(page, `lit-${suffix}`), reactField(page, `react-${suffix}`)]) {
      const frame = host.locator('.lab-input-frame');
      await expect(frame).toBeVisible();
      const geometry = await frame.evaluate((element) => {
        const box = element.getBoundingClientRect();
        const label = element.querySelector('label')?.getBoundingClientRect();
        return {
          height: box.height,
          radius: getComputedStyle(element).borderRadius,
          background: getComputedStyle(element).backgroundColor,
          labelTop: (label?.top ?? 0) - box.top,
        };
      });
      expect(geometry).toEqual({
        height,
        radius: `${radius}px`,
        background: 'rgba(0, 0, 0, 0)',
        labelTop: -8,
      });
    }
  }
});

test('Lit участвует в FormData, validation, reset и disabled fieldset', async ({ page }) => {
  await page.evaluate(() => {
    const form = document.createElement('form');
    form.id = 'native-form';
    const group = document.createElement('fieldset');
    group.id = 'native-group';
    const field = document.createElement('lab-input');
    field.id = 'native-field';
    field.name = 'address';
    field.label = 'Почта';
    field.inputType = 'email';
    field.required = true;
    field.value = 'studio@example.com';
    group.append(field);
    form.append(group);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      form.dataset.submitted = 'true';
    });
    document.body.append(form);
  });
  const host = page.locator('#native-field');
  const input = host.getByRole('textbox', { name: 'Почта' });
  const form = page.locator('#native-form');
  await expect(input).toHaveValue('studio@example.com');
  await input.fill('new@example.com');
  expect(
    await form.evaluate((element: HTMLFormElement) => new FormData(element).get('address')),
  ).toBe('new@example.com');
  await input.press('Enter');
  await expect(form).toHaveAttribute('data-submitted', 'true');
  await input.fill('wrong');
  expect(await form.evaluate((element: HTMLFormElement) => element.checkValidity())).toBe(false);
  expect(
    await form.evaluate((element: HTMLFormElement) => {
      element.reset();
      return new FormData(element).get('address');
    }),
  ).toBe('studio@example.com');
  await expect(input).toHaveValue('studio@example.com');
  await page.locator('#native-group').evaluate((element: HTMLFieldSetElement) => {
    element.disabled = true;
  });
  await expect(input).toBeDisabled();
  expect(
    await form.evaluate((element: HTMLFormElement) => new FormData(element).has('address')),
  ).toBe(false);
  await page.locator('#native-group').evaluate((element: HTMLFieldSetElement) => {
    element.disabled = false;
  });
  await expect(input).toBeEnabled();
  await host.evaluate((element: LabInput) =>
    element.formStateRestoreCallback('restored@example.com'),
  );
  await expect(input).toHaveValue('restored@example.com');
});

test('Lit сохраняет нативное minlength после пользовательского ввода и render', async ({
  page,
}) => {
  const host = litHost(page, 'lit-neutral');
  await host.evaluate((element: LabInput) => {
    element.inputType = 'text';
    element.minLength = 5;
  });
  const input = host.getByRole('textbox');
  await input.pressSequentially('abc');
  await host.evaluate((element: LabInput) => element.updateComplete);
  expect(await input.evaluate((element: HTMLInputElement) => element.validity.tooShort)).toBe(true);
  expect(await host.evaluate((element: LabInput) => element.checkValidity())).toBe(false);
  await input.pressSequentially('de');
  await host.evaluate((element: LabInput) => element.updateComplete);
  expect(await host.evaluate((element: LabInput) => element.checkValidity())).toBe(true);
});

test('Enter использует default submitter и уважает отмену события и правила HTML', async ({
  page,
}) => {
  for (const mode of [
    'submitter',
    'disabled',
    'cancel-key',
    'cancel-click',
    'two-fields',
    'one-field',
    'novalidate',
  ]) {
    await page.evaluate((mode) => {
      document.querySelector('#enter-form')?.remove();
      const form = document.createElement('form');
      form.id = 'enter-form';
      form.dataset.submits = '0';
      form.dataset.clicks = '0';
      const field = document.createElement('lab-input');
      field.label = 'Поле отправки';
      field.name = 'text';
      field.required = true;
      field.value = mode === 'novalidate' ? '' : 'value';
      form.append(field);
      if (mode === 'two-fields') {
        const another = document.createElement('lab-input');
        another.name = 'second';
        another.label = 'Другое поле';
        form.append(another);
      }
      if (!['two-fields', 'one-field'].includes(mode)) {
        const submit = document.createElement('button');
        submit.type = 'submit';
        submit.name = 'action';
        submit.value = 'save';
        submit.disabled = mode === 'disabled';
        submit.formNoValidate = mode === 'novalidate';
        submit.textContent = 'Сохранить форму';
        submit.addEventListener('click', (event) => {
          form.dataset.clicks = String(Number(form.dataset.clicks) + 1);
          if (mode === 'cancel-click') event.preventDefault();
        });
        form.append(submit);
      }
      if (mode === 'cancel-key')
        document.addEventListener('keydown', (event) => event.preventDefault(), { once: true });
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        form.dataset.submits = String(Number(form.dataset.submits) + 1);
        form.dataset.submitter = event.submitter?.getAttribute('value') ?? '';
        form.dataset.action = new FormData(form, event.submitter).get('action')?.toString() ?? '';
      });
      document.body.append(form);
    }, mode);
    const form = page.locator('#enter-form');
    await form.getByRole('textbox', { name: 'Поле отправки', exact: true }).press('Enter');
    // Observe the queued default action before asserting its absence/presence.
    await form.evaluate(() => new Promise((resolve) => setTimeout(resolve, 0)));
    const submitted = ['submitter', 'one-field', 'novalidate'].includes(mode);
    await expect(form).toHaveAttribute('data-submits', submitted ? '1' : '0');
    if (mode === 'submitter' || mode === 'novalidate') {
      await expect(form).toHaveAttribute('data-clicks', '1');
      await expect(form).toHaveAttribute('data-submitter', 'save');
      await expect(form).toHaveAttribute('data-action', 'save');
    }
  }
});

test('слоты и длинная подпись сохраняют доступное имя и ширину поля', async ({ page }) => {
  const host = litHost(page, 'lit-neutral');
  await host.evaluate((element: LabInput) => {
    element.style.width = '240px';
    element.label = 'Электронная почта администратора рабочего пространства';
    for (const name of ['leading', 'trailing']) {
      const icon = document.createElement('span');
      icon.slot = name;
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = name === 'leading' ? '@' : '✓';
      element.append(icon);
    }
  });
  const frame = host.locator('.lab-input-frame');
  const input = host.getByRole('textbox', {
    name: 'Электронная почта администратора рабочего пространства',
  });
  await expect(input).toBeVisible();
  await expect
    .poll(async () =>
      frame.evaluate((element) => {
        const box = element.getBoundingClientRect();
        const label = element.querySelector('label')?.getBoundingClientRect();
        return [box.width, (label?.left ?? 0) - box.left, element.scrollWidth];
      }),
    )
    .toEqual([240, 32, 240]);
  await host.evaluate((element) => element.querySelector('[slot=leading]')?.remove());
  await expect
    .poll(async () =>
      frame.evaluate((element) => {
        const box = element.getBoundingClientRect();
        return (element.querySelector('label')?.getBoundingClientRect().left ?? 0) - box.left;
      }),
    )
    .toBe(16);
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

/**
 * FORCED-COLORS skeleton (T4 / E2 per playbook A3 for #135).
 * emulateMedia + outline check on fields. Covers input here; skeleton for 7:
 * combobox, input, number-input, pin-input, tags-input, textarea, slider.
 * Criterion (ADR-0007): outline-based ring survives forced-colors (box-shadow UA-stripped).
 * Run: pnpm --filter @labpics/ui-docs test:e2e -- --project=chromium
 */
test('forced-colors: outline-based focus ring visible on field (survives emulateMedia)', async ({
  page,
}) => {
  await page.emulateMedia({ forcedColors: 'active' });

  // Key fields: both renderers (input fields use box-shadow today — this catches the class)
  for (const control of [litControl(page, 'lit-neutral'), reactControl(page, 'react-neutral')]) {
    await control.focus();
    await expect(control).toBeFocused();

    const outlineInfo = await control.evaluate((el) => {
      const frame = el.closest('.lab-input-frame');
      if (!frame) throw new Error('Input frame is missing');
      const cs = getComputedStyle(frame);
      return { style: cs.outlineStyle, width: cs.outlineWidth, color: cs.outlineColor };
    });
    // Per canon (#135, foundation-contract, core-CONTRACT §4): outline must be visible (not removed)
    // Note: current field impls use box-shadow (UA drops under forced) → expect will surface the gap.
    expect(outlineInfo.style, 'outline style visible under forced-colors for input field').not.toBe(
      'none',
    );
    expect(outlineInfo.width, 'outline has width under forced-colors').not.toBe('0px');
  }

  // Reset
  await page.emulateMedia({ forcedColors: null });
});

test('reduced-transparency: focus ring outline visible on input fields (CDP emulate)', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'CDP emulation is Chromium-only');
  const session = await page.context().newCDPSession(page);
  await session.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }],
  });

  for (const control of [litControl(page, 'lit-neutral'), reactControl(page, 'react-neutral')]) {
    await control.focus();
    await expect(control).toBeFocused();

    const outlineInfo = await control.evaluate((el) => {
      const frame = el.closest('.lab-input-frame');
      if (!frame) throw new Error('Input frame is missing');
      const cs = getComputedStyle(frame);
      return { style: cs.outlineStyle, width: cs.outlineWidth };
    });
    // a11y ring must remain under reduced-transp (ties to perf: no regression for a11y users)
    expect(outlineInfo.style, 'outline visible under reduced-transparency').not.toBe('none');
    expect(outlineInfo.width, 'outline width under reduced-transparency').not.toBe('0px');
  }
});
