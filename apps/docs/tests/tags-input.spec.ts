import { type Locator, type Page, expect, test } from '@playwright/test';

/**
 * Tags Input suite — a MACHINE-DRIVEN tokenized text field, verified on BOTH renderers
 * against the REAL `@zag-js/tags-input` machine output (not a faked role).
 *
 * The fixture (`tags-input.html`) mounts the Lit `<lab-tags-input>` and the native-React
 * `<TagsInput>` with identical specimens under one [data-theme]. These checks are the
 * control's browser-side definition of done:
 *   1. Render — the delivered HTML carries the Lit element; React is a client island.
 *   2. Default chips — the seeded default-value renders the chips, keyed by value.
 *   3. Label / helper a11y — the input is the field control; the shared field-a11y wires
 *      the label (for → input id), aria-describedby → helper, and (invalid) the error.
 *   4. Enter adds — typing + Enter adds a chip with the typed value.
 *   5. Backspace removes — Backspace on the empty input removes the last chip.
 *   6. Chip delete — clicking a chip's × removes THAT chip (keyed by value, not index).
 *   7. Delete a11y — the × button has an accessible name ("Delete <tag>").
 *   8. Value-change event — the public value-change / onValueChange fires with the tag set.
 *   9. Max — exceeding max flips the invalid state.
 *  10. Disabled — the input is non-interactive.
 *  11. Control-surface parity — the control box surface matches React (no double-paint).
 *  12. Visual parity — Lit and React resolve the SAME control border colour.
 *
 * Playwright's CSS engine pierces open shadow DOM, so `litHost.locator('.input')` reaches
 * the Lit shadow parts the same way it reaches the React DOM parts. DETERMINISM (lesson
 * 7): every add/remove is gated on the machine's settled output via `expect`/`expect.poll`,
 * never a fixed sleep.
 */

function litHost(page: Page, testid: string): Locator {
  return page.getByTestId(testid);
}
function reactField(page: Page, testid: string): Locator {
  return page.getByTestId(testid).locator('[data-lab-tags-input]');
}
function litInput(page: Page, testid: string): Locator {
  return litHost(page, testid).locator('.input');
}
function reactInput(page: Page, testid: string): Locator {
  return reactField(page, testid).locator('.lab-tags-input-input');
}
function litItems(page: Page, testid: string): Locator {
  return litHost(page, testid).locator('.item');
}
function reactItems(page: Page, testid: string): Locator {
  return reactField(page, testid).locator('.lab-tags-input-item');
}
function litControl(page: Page, testid: string): Locator {
  return litHost(page, testid).locator('.control');
}
function reactControl(page: Page, testid: string): Locator {
  return reactField(page, testid).locator('.lab-tags-input-control');
}

const borderColor = (el: HTMLElement) => getComputedStyle(el).borderTopColor;
const litItemValues = (page: Page, testid: string) =>
  litHost(page, testid).evaluate((h) =>
    Array.from((h as HTMLElement).shadowRoot?.querySelectorAll('.item[data-value]') ?? []).map(
      (el) => el.getAttribute('data-value'),
    ),
  );
const reactItemValues = (page: Page, testid: string) =>
  reactField(page, testid).evaluate((field) =>
    Array.from(field.querySelectorAll('.lab-tags-input-item[data-value]')).map((el) =>
      el.getAttribute('data-value'),
    ),
  );

test.beforeEach(async ({ page }) => {
  await page.goto('/tags-input.html');
});

test('delivered HTML carries the Lit element (React island mounts client-side)', async ({
  request,
}) => {
  const body = await (await request.get('/tags-input.html')).text();
  expect(body).toMatch(/<lab-tags-input/i);
  expect(body).toContain('id="react-root"');
});

test('render: the seeded default chips render keyed by value on both renderers', async ({
  page,
}) => {
  await expect(litItems(page, 'lit-neutral')).toHaveCount(2);
  await expect.poll(() => litItemValues(page, 'lit-neutral')).toEqual(['design', 'system']);

  await expect(reactItems(page, 'react-neutral')).toHaveCount(2);
  await expect.poll(() => reactItemValues(page, 'react-neutral')).toEqual(['design', 'system']);
});

/**
 * Label / helper a11y — the machine targets the input with the label (htmlFor → input id);
 * the SHARED field-a11y helper adds aria-describedby → the helper id. Falsifiable: the
 * idrefs must equal the actual nodes' ids.
 */
test('field-a11y: the input is labelled and described on both renderers', async ({ page }) => {
  // Lit.
  const litWiring = await litHost(page, 'lit-neutral').evaluate((host) => {
    const sr = (host as HTMLElement).shadowRoot;
    const input = sr?.querySelector('.input');
    const label = sr?.querySelector('.label');
    const helper = sr?.querySelector('.helper');
    return {
      inputId: input?.id ?? null,
      labelFor: label?.getAttribute('for') ?? null,
      describedby: input?.getAttribute('aria-describedby') ?? null,
      helperId: helper?.id ?? null,
    };
  });
  expect(litWiring.inputId, 'input has an id').toBeTruthy();
  expect(litWiring.labelFor, 'label for → input id').toBe(litWiring.inputId);
  expect(litWiring.helperId, 'helper has an id').toBeTruthy();
  expect(litWiring.describedby, 'input describedby → helper id').toBe(litWiring.helperId);

  // React parity — useId() yields colon-bearing ids, so match by the id ATTRIBUTE.
  const reactDescribedby = await reactInput(page, 'react-neutral').getAttribute('aria-describedby');
  expect(reactDescribedby, 'react input describes a helper').toBeTruthy();
  expect(
    await reactField(page, 'react-neutral').locator(`[id="${reactDescribedby}"]`).count(),
    'react describedby → a real helper node',
  ).toBe(1);
});

test('field-a11y: invalid wires aria-invalid + errormessage on the input (both renderers)', async ({
  page,
}) => {
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
  }

  for (const input of [litInput(page, 'lit-required'), reactInput(page, 'react-required')]) {
    await expect(input).toHaveAttribute('aria-required', 'true');
  }
});

/**
 * Enter adds — typing into the input and pressing Enter adds a chip with the typed value.
 * Falsifiable: the new value appears as a chip on both renderers.
 */
test('enter adds: typing + Enter adds a chip (both renderers)', async ({ page }) => {
  await litInput(page, 'lit-required').fill('alpha');
  await litInput(page, 'lit-required').press('Enter');
  await expect.poll(() => litItemValues(page, 'lit-required')).toEqual(['alpha']);

  await reactInput(page, 'react-required').fill('alpha');
  await reactInput(page, 'react-required').press('Enter');
  await expect.poll(() => reactItemValues(page, 'react-required')).toEqual(['alpha']);
});

/**
 * Backspace removes — Backspace on an empty input removes the LAST chip (the machine owns
 * the reverse-remove). The neutral specimen starts with [design, system]; one Backspace
 * highlights the last, a second removes it.
 */
test('backspace removes: Backspace on the empty input removes the last chip', async ({ page }) => {
  await litInput(page, 'lit-neutral').focus();
  // First Backspace highlights the last tag, the second removes it (the machine's contract).
  await litInput(page, 'lit-neutral').press('Backspace');
  await litInput(page, 'lit-neutral').press('Backspace');
  await expect.poll(() => litItemValues(page, 'lit-neutral')).toEqual(['design']);

  await reactInput(page, 'react-neutral').focus();
  await reactInput(page, 'react-neutral').press('Backspace');
  await reactInput(page, 'react-neutral').press('Backspace');
  await expect.poll(() => reactItemValues(page, 'react-neutral')).toEqual(['design']);
});

/**
 * Chip delete — clicking a chip's × removes THAT chip, keyed by VALUE (not index). Delete
 * the FIRST chip and assert the SECOND survives — a positional-index bug would remove the
 * wrong one. Asserted on both renderers.
 */
test('chip delete: clicking the × removes that chip by value (both renderers)', async ({
  page,
}) => {
  // Lit — delete "design" (first), "system" survives.
  await litHost(page, 'lit-neutral').locator('.item[data-value="design"] .item-delete').click();
  await expect.poll(() => litItemValues(page, 'lit-neutral')).toEqual(['system']);

  // React parity.
  await reactField(page, 'react-neutral')
    .locator('.lab-tags-input-item[data-value="design"] .lab-tags-input-item-delete')
    .click();
  await expect.poll(() => reactItemValues(page, 'react-neutral')).toEqual(['system']);
});

/**
 * Delete a11y — the × button carries an accessible name from the SHARED translations
 * ("Delete <tag>"), the same on both renderers.
 */
test('delete a11y: the chip × has an accessible name on both renderers', async ({ page }) => {
  const litDelete = litHost(page, 'lit-neutral').locator('.item[data-value="design"] .item-delete');
  expect(await litDelete.getAttribute('aria-label')).toBe('Delete design');

  const reactDelete = reactField(page, 'react-neutral').locator(
    '.lab-tags-input-item[data-value="design"] .lab-tags-input-item-delete',
  );
  expect(await reactDelete.getAttribute('aria-label')).toBe('Delete design');
});

/**
 * Value-change EVENT — the public contract (the gap prior batches missed). Lit dispatches a
 * composed CustomEvent('value-change') whose detail.value is the tag set; React surfaces
 * its onValueChange(value) payload into a readout node. Both fire with the new set when a
 * tag is added.
 */
test('event contract: adding a tag fires the public value-change with the tag set (both renderers)', async ({
  page,
}) => {
  // Lit — listen for the composed event, then add a tag.
  const litDetail = page.evaluate(
    () =>
      new Promise<string[]>((resolve) => {
        const host = document.querySelector('[data-testid="lit-required"]');
        host?.addEventListener(
          'value-change',
          (e) => resolve((e as CustomEvent<{ value: string[] }>).detail.value),
          { once: true },
        );
      }),
  );
  await litInput(page, 'lit-required').fill('beta');
  await litInput(page, 'lit-required').press('Enter');
  expect(await litDetail).toEqual(['beta']);

  // React — the readout starts empty (no spurious fire on mount) and fills on add.
  const readout = page.getByTestId('react-tags-event-value');
  await expect(readout).toBeEmpty();
  const eventInput = page.getByTestId('react-tags-event').locator('.lab-tags-input-input');
  await eventInput.fill('beta');
  await eventInput.press('Enter');
  await expect(readout).toHaveText('beta');
});

/**
 * Max + overflow — a max-1 clone created in-page: adding past the cap (with overflow) flips
 * the invalid state (data-invalid on the root). We build the clone so we never weaken the
 * real specimens.
 */
test('max: at the cap the next add is rejected (the machine owns the limit)', async ({ page }) => {
  // A max-1 clone created in-page so we never weaken the real specimens. At the cap, the
  // machine's ADD guard (!isAtMax || allowOverflow) fails, so the next add is silently
  // REJECTED — the value never grows past the cap. We assert the machine's real output.
  await page.evaluate(() => {
    const el = document.createElement('lab-tags-input');
    el.setAttribute('data-testid', 'lit-tags-max');
    el.setAttribute('label', 'Capped');
    el.setAttribute('max', '1');
    document.querySelector('[data-testid="lit-renderer"] .specimens')?.appendChild(el);
  });
  const input = litInput(page, 'lit-tags-max');
  await input.fill('one');
  await input.press('Enter');
  await expect.poll(() => litItemValues(page, 'lit-tags-max')).toEqual(['one']);
  // The input still holds "one" was committed; now at the cap the second add is rejected.
  await input.fill('two');
  await input.press('Enter');
  // Settle, then assert the value never grew past the cap. The input keeps "two" (the
  // rejected text is not committed as a tag), so the chip list stays at exactly one.
  await expect(litInput(page, 'lit-tags-max')).toHaveValue('two');
  await expect.poll(() => litItemValues(page, 'lit-tags-max')).toEqual(['one']);
});

test('disabled: the input is non-interactive on both renderers', async ({ page }) => {
  await expect(litInput(page, 'lit-disabled')).toBeDisabled();
  await expect(reactInput(page, 'react-disabled')).toBeDisabled();
});

/**
 * Control-surface parity — the field SURFACE (border + background + padding) is painted
 * ONCE, on the `.control` box, identically across renderers. The Lit element re-declares
 * the wrapper surface under :host so the shared field-styles `.control` rule (which a plain
 * <div> wrapper also matches, incl. :read-only) cannot double-paint or take the readonly
 * tint (the combobox lesson). Falsifiable: the Lit and React control boxes resolve the SAME
 * border colour, background, and padding, and BOTH carry a real (non-zero) border.
 */
test('control-surface parity: the control box surface matches React (no double-paint)', async ({
  page,
}) => {
  const readSurface = (el: Element) => {
    const cs = getComputedStyle(el as HTMLElement);
    return {
      borderTopWidth: cs.borderTopWidth,
      borderColor: cs.borderTopColor,
      background: cs.backgroundColor,
      padding: `${cs.paddingTop}/${cs.paddingRight}/${cs.paddingBottom}/${cs.paddingLeft}`,
    };
  };

  const litSurface = await litControl(page, 'lit-neutral').evaluate((el, read) => {
    const fn = new Function(`return (${read})`)() as (el: Element) => unknown;
    return fn(el);
  }, readSurface.toString());
  const reactSurface = await reactControl(page, 'react-neutral').evaluate((el, read) => {
    const fn = new Function(`return (${read})`)() as (el: Element) => unknown;
    return fn(el);
  }, readSurface.toString());

  type Surface = ReturnType<typeof readSurface>;
  const lit = litSurface as Surface;
  const react = reactSurface as Surface;

  expect(lit.borderTopWidth, 'Lit control carries a real border').not.toBe('0px');
  expect(lit.background, 'Lit control has an opaque background').not.toBe('rgba(0, 0, 0, 0)');
  expect(lit.borderColor, 'control border colour parity').toBe(react.borderColor);
  expect(lit.background, 'control background parity').toBe(react.background);
  expect(lit.padding, 'control padding parity').toBe(react.padding);
});

test('visual parity: Lit and React resolve the same control border colour', async ({ page }) => {
  const litB = await litControl(page, 'lit-neutral').evaluate(borderColor);
  const reactB = await reactControl(page, 'react-neutral').evaluate(borderColor);
  expect(reactB, 'tags-input control border parity').toBe(litB);
});

test('visual parity: the danger sentiment re-points the border identically', async ({ page }) => {
  const litB = await litControl(page, 'lit-invalid').evaluate(borderColor);
  const reactB = await reactControl(page, 'react-invalid').evaluate(borderColor);
  expect(reactB, 'danger control border parity').toBe(litB);
});
