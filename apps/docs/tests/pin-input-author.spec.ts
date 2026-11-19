import { type Locator, expect, test } from '@playwright/test';

const values = (root: Locator) =>
  root
    .locator('.lab-pin-input-segment')
    .evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value));
async function paste(input: Locator, value: string) {
  await input.focus();
  await input.evaluate((node, value) => {
    const clipboardData = new DataTransfer();
    clipboardData.setData('text/plain', value);
    node.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }),
    );
  }, value);
}
test.beforeEach(async ({ page }) => {
  await page.goto('/pin-input.html');
  await page.evaluate(() => {
    const form = document.createElement('form');
    form.id = 'lit-pin-form';
    form.innerHTML =
      '<lab-pin-input name="code" label="Form code" default-value="12" count="4" required otp></lab-pin-input><button type="reset">Reset code</button>';
    document.body.append(form);
  });
});
for (const renderer of ['lit', 'react']) {
  test(`${renderer}: completion can synchronously submit the accepted code`, async ({ page }) => {
    const form = page.locator(`#${renderer}-pin-form`);
    const field =
      renderer === 'lit' ? form.locator('lab-pin-input') : form.locator('[data-lab-pin-input]');
    await form.evaluate((node, renderer) => {
      const form = node as HTMLFormElement;
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        form.dataset.submitted = String(new FormData(form).get('code'));
      });
      form.addEventListener(renderer === 'lit' ? 'value-complete' : 'pin-complete', () => {
        form.dataset.completionValue = String(new FormData(form).get('code'));
        form.dataset.completionValid = String(form.checkValidity());
        form.requestSubmit();
      });
    }, renderer);
    await paste(field.locator('.lab-pin-input-segment').first(), '1234');
    await expect(form).toHaveAttribute('data-completion-value', '1234');
    await expect(form).toHaveAttribute('data-completion-valid', 'true');
    await expect(form).toHaveAttribute('data-submitted', '1234');
  });
  test(`${renderer}: authored cells, form submission, reset cancellation and dynamic count`, async ({
    page,
  }) => {
    const form = page.locator(`#${renderer}-pin-form`);
    const field =
      renderer === 'lit' ? form.locator('lab-pin-input') : form.locator('[data-lab-pin-input]');
    const inputs = field.locator('.lab-pin-input-segment');
    const geometry = await inputs.first().evaluate((node) => {
      const cell = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return {
        width: cell.width,
        height: cell.height,
        radius: style.borderRadius,
        stroke: style.borderWidth,
      };
    });
    expect(geometry).toEqual({ width: 48, height: 56, radius: '12px', stroke: '2px' });
    await expect(inputs.first()).toHaveAttribute('autocomplete', 'one-time-code');
    expect(await form.evaluate((node) => (node as HTMLFormElement).checkValidity())).toBe(false);
    await paste(inputs.first(), '3456');
    await expect.poll(() => values(field)).toEqual(['3', '4', '5', '6']);
    expect(await form.evaluate((node) => new FormData(node as HTMLFormElement).get('code'))).toBe(
      '3456',
    );
    expect(await form.evaluate((node) => (node as HTMLFormElement).checkValidity())).toBe(true);
    await form.evaluate((node) => {
      node.addEventListener('reset', (event) => event.preventDefault(), { once: true });
      (node as HTMLFormElement).reset();
    });
    await expect.poll(() => values(field)).toEqual(['3', '4', '5', '6']);
    await form.getByText('Reset code').click();
    await expect.poll(() => values(field)).toEqual(['1', '2', '', '']);
    if (renderer === 'lit') await field.evaluate((node) => node.setAttribute('count', '6'));
    else await form.getByText('Change length').click();
    await expect(inputs).toHaveCount(6);
    await paste(inputs.first(), '123456');
    await expect.poll(() => values(field)).toEqual(['1', '2', '3', '4', '5', '6']);
    if (renderer === 'lit') await field.evaluate((node) => node.setAttribute('count', '4'));
    else await form.getByText('Change length').click();
    await expect(inputs).toHaveCount(4);
    expect(await form.evaluate((node) => new FormData(node as HTMLFormElement).get('code'))).toBe(
      '1234',
    );
  });
  test(`${renderer}: IME stays on its cell until commit and autofill fills the code`, async ({
    page,
  }) => {
    const field =
      renderer === 'lit'
        ? page.getByTestId('lit-alphabetic')
        : page.getByTestId('react-alphabetic');
    const input = field.locator('.lab-pin-input-segment').first();
    await input.focus();
    await input.evaluate((node) => {
      const input = node as HTMLInputElement;
      input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, 'a');
      input.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          data: 'a',
          inputType: 'insertCompositionText',
          isComposing: true,
        }),
      );
    });
    await expect(input).toBeFocused();
    await input.dispatchEvent('compositionend', { data: 'a' });
    await input.evaluate((node) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(node, 'a');
      node.dispatchEvent(
        new InputEvent('input', { bubbles: true, data: 'a', inputType: 'insertFromComposition' }),
      );
    });
    await expect(field.locator('.lab-pin-input-segment').nth(1)).toBeFocused();
    await expect.poll(() => values(field)).toEqual(['a', '', '', '']);
    await input.focus();
    await input.evaluate((node) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(node, 'abcd');
      node.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          data: 'abcd',
          inputType: 'insertReplacementText',
        }),
      );
    });
    await expect.poll(() => values(field)).toEqual(['a', 'b', 'c', 'd']);
  });
}
test('validating multiple React codes does not move focus or start a focus cycle', async ({
  page,
}) => {
  const form = page.locator('#react-multiple-pin-form');
  const submit = form.getByRole('button', { name: 'Verify both codes' });
  await submit.focus();
  const passive = await form.evaluate((node) => {
    const form = node as HTMLFormElement;
    const active = document.activeElement;
    return { valid: form.checkValidity(), unchanged: document.activeElement === active };
  });
  expect(passive).toEqual({ valid: false, unchanged: true });
  await expect(submit).toBeFocused();
  await form.evaluate((node) => (node as HTMLFormElement).requestSubmit());
  await expect(form.locator('.lab-pin-input-segment').first()).toBeFocused();
  await page.waitForTimeout(100);
  await expect(form.locator('.lab-pin-input-segment').first()).toBeFocused();
});

test('property-controlled Lit and React refuse edits until the consumer accepts', async ({
  page,
}) => {
  const lit = page.locator('#lit-pin-form lab-pin-input');
  await lit.evaluate((node) => {
    (node as HTMLElement & { value: string[] }).value = ['9', '8', '7', '6'];
  });
  for (const field of [lit, page.getByTestId('react-controlled')]) {
    const first = field.locator('.lab-pin-input-segment').first();
    await first.focus();
    await first.press('3');
    await expect.poll(() => values(field)).toEqual(['9', '8', '7', '6']);
    await paste(first, '1234');
    await expect.poll(() => values(field)).toEqual(['9', '8', '7', '6']);
  }
  await page.getByTestId('react-controlled').getByText('Accept input').click();
  await paste(page.getByTestId('react-controlled').locator('input').first(), '1234');
  await expect
    .poll(() => values(page.getByTestId('react-controlled')))
    .toEqual(['1', '2', '3', '4']);
});

test('two-character autofill is distributed, not reduced to its last digit', async ({ page }) => {
  const field = page.locator('#lit-pin-form lab-pin-input');
  await field.evaluate((node) => {
    node.setAttribute('count', '2');
    node.removeAttribute('default-value');
  });
  const input = field.locator('.lab-pin-input-segment').first();
  await input.focus();
  await input.evaluate((node) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(node, '98');
    node.dispatchEvent(
      new InputEvent('input', { bubbles: true, data: '98', inputType: 'insertReplacementText' }),
    );
  });
  await expect.poll(() => values(field)).toEqual(['9', '8']);
});
test('Lit fieldset disabled semantics, reset and state restoration keep one named form value', async ({
  page,
}) => {
  const form = page.locator('#lit-pin-form');
  const field = form.locator('lab-pin-input');
  await field.evaluate((node) => {
    const fieldset = document.createElement('fieldset');
    node.replaceWith(fieldset);
    fieldset.append(node);
    fieldset.disabled = true;
  });
  await expect(field.locator('input').first()).toBeDisabled();
  expect(await form.evaluate((node) => new FormData(node as HTMLFormElement).has('code'))).toBe(
    false,
  );
  await form.locator('fieldset').evaluate((node) => {
    (node as HTMLFieldSetElement).disabled = false;
  });
  await field.evaluate((node) =>
    (
      node as HTMLElement & { formStateRestoreCallback(value: string): void }
    ).formStateRestoreCallback('["4","3","2","1"]'),
  );
  await expect.poll(() => values(field)).toEqual(['4', '3', '2', '1']);
  expect(
    await form.evaluate((node) => new FormData(node as HTMLFormElement).getAll('code')),
  ).toEqual(['4321']);
});
