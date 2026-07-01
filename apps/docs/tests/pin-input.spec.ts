import { type Locator, type Page, expect, test } from '@playwright/test';

/**
 * Pin Input suite — a MACHINE-DRIVEN segmented code field, verified on BOTH renderers
 * against the REAL `@zag-js/pin-input` machine output (not a faked role).
 *
 * The fixture (`pin-input.html`) mounts the Lit `<lab-pin-input>` and the native-React
 * `<PinInput>` with identical specimens under one [data-theme]. These checks are the
 * control's browser-side definition of done:
 *   1. Render — the delivered HTML carries the Lit element; React is a client island.
 *   2. Segments — N real single-character inputs, one per `count`, on both renderers.
 *   3. Group a11y — the control is role="group", aria-labelledby → the field label, and
 *      (shared field-a11y) aria-describedby → helper/error, aria-invalid, aria-required.
 *   4. Focus auto-advance — typing a character moves focus to the NEXT box (machine).
 *   5. Backspace — removes and steps back (the machine owns the reverse focus).
 *   6. Paste-fill — pasting a code distributes it across the boxes.
 *   7. Masking — the masked specimen renders type=password boxes.
 *   8. Complete event — filling all boxes fires the public complete event with the value.
 *   9. Disabled — the boxes are non-interactive.
 *  10. Control-surface parity — the group wrapper carries NO field surface (the surface is
 *      on each segment), and the segment surface matches React (the combobox double-paint
 *      lesson).
 *  11. Visual parity — Lit and React resolve the SAME segment border colour.
 *
 * Playwright's CSS engine pierces open shadow DOM, so `litHost.locator('.segment')`
 * reaches the Lit shadow boxes the same way it reaches the React DOM boxes. DETERMINISM
 * (lesson 7): every value/focus read is gated on the machine's settled output via
 * `expect`/`expect.poll`, never a fixed sleep.
 */

/** The Lit host element (shadow-pierced for inner nodes). */
function litHost(page: Page, testid: string): Locator {
  return page.getByTestId(testid);
}
/** The React `[data-lab-pin-input]` field inside its testid wrapper. */
function reactField(page: Page, testid: string): Locator {
  return page.getByTestId(testid).locator('[data-lab-pin-input]');
}
/** The Nth segment input for a Lit host or a React field (0-based). */
function litSegment(page: Page, testid: string, index: number): Locator {
  return litHost(page, testid).locator(`.segment[data-index="${index}"]`);
}
function reactSegment(page: Page, testid: string, index: number): Locator {
  return reactField(page, testid).locator('.lab-pin-input-segment').nth(index);
}
function litControl(page: Page, testid: string): Locator {
  return litHost(page, testid).locator('.control');
}
function reactControl(page: Page, testid: string): Locator {
  return reactField(page, testid).locator('.lab-pin-input-control');
}

const borderColor = (el: HTMLElement) => getComputedStyle(el).borderTopColor;

test.beforeEach(async ({ page }) => {
  await page.goto('/pin-input.html');
});

test('delivered HTML carries the Lit element (React island mounts client-side)', async ({
  request,
}) => {
  const body = await (await request.get('/pin-input.html')).text();
  expect(body).toMatch(/<lab-pin-input/i);
  expect(body).toContain('id="react-root"');
});

test('render: both renderers paint N single-character segment inputs', async ({ page }) => {
  // count=4 → exactly 4 segment inputs on each renderer.
  await expect(litHost(page, 'lit-neutral').locator('.segment')).toHaveCount(4);
  await expect(reactField(page, 'react-neutral').locator('.lab-pin-input-segment')).toHaveCount(4);
  for (const seg of [litSegment(page, 'lit-neutral', 0), reactSegment(page, 'react-neutral', 0)]) {
    await expect(seg).toBeVisible();
    // The machine tags each segment with its index (data-index) — the per-box key it
    // spreads its getters by. A real <input>, not a div.
    await expect(seg).toHaveAttribute('data-index', '0');
    expect(await seg.evaluate((el) => el.tagName)).toBe('INPUT');
  }
});

/**
 * Group a11y — the machine wires each box; the SHARED field-a11y helper adds the group
 * association the machine does not: role="group", aria-labelledby → the label id, and
 * aria-describedby → the helper id. Falsifiable: the idrefs must equal the actual nodes'
 * ids, not merely "be present".
 */
test('group a11y: the control is a labelled, described group on both renderers', async ({
  page,
}) => {
  // Lit.
  const litWiring = await litHost(page, 'lit-neutral').evaluate((host) => {
    const sr = (host as HTMLElement).shadowRoot;
    const control = sr?.querySelector('.control');
    const label = sr?.querySelector('.label');
    const helper = sr?.querySelector('.helper');
    return {
      role: control?.getAttribute('role') ?? null,
      labelledby: control?.getAttribute('aria-labelledby') ?? null,
      describedby: control?.getAttribute('aria-describedby') ?? null,
      labelId: label?.id ?? null,
      helperId: helper?.id ?? null,
    };
  });
  expect(litWiring.role).toBe('group');
  expect(litWiring.labelId, 'label has an id').toBeTruthy();
  expect(litWiring.labelledby, 'group aria-labelledby → label id').toBe(litWiring.labelId);
  expect(litWiring.helperId, 'helper has an id').toBeTruthy();
  expect(litWiring.describedby, 'group aria-describedby → helper id').toBe(litWiring.helperId);

  // React parity.
  const reactControlEl = reactControl(page, 'react-neutral');
  await expect(reactControlEl).toHaveAttribute('role', 'group');
  const reactLabelledby = await reactControlEl.getAttribute('aria-labelledby');
  expect(reactLabelledby, 'react group labelledby is set').toBeTruthy();
  expect(
    await reactField(page, 'react-neutral').locator(`[id="${reactLabelledby}"]`).count(),
    'react labelledby → a real label node',
  ).toBe(1);
  const reactDescribedby = await reactControlEl.getAttribute('aria-describedby');
  expect(reactDescribedby, 'react group describedby is set').toBeTruthy();
  expect(
    await reactField(page, 'react-neutral').locator(`[id="${reactDescribedby}"]`).count(),
    'react describedby → a real helper node',
  ).toBe(1);
});

/**
 * Invalid/required — the field-a11y contract on the group: aria-invalid="true" +
 * aria-errormessage → the error id (invalid specimen), aria-required="true" (required
 * specimen). The error region is role="alert" and its id is the errormessage idref.
 */
test('field-a11y: invalid + required are wired on the group (both renderers)', async ({ page }) => {
  for (const [host, control] of [
    [litHost(page, 'lit-invalid'), litControl(page, 'lit-invalid')] as const,
    [reactField(page, 'react-invalid'), reactControl(page, 'react-invalid')] as const,
  ]) {
    const error = host.locator('.error, .lab-field-error');
    const errorId = await error.getAttribute('id');
    expect(errorId, 'error has an id').toBeTruthy();
    await expect(error).toHaveAttribute('role', 'alert');
    await expect(control).toHaveAttribute('aria-invalid', 'true');
    expect(await control.getAttribute('aria-errormessage')).toBe(errorId);
    expect(await control.getAttribute('aria-describedby')).toContain(errorId ?? '');
  }

  for (const control of [litControl(page, 'lit-required'), reactControl(page, 'react-required')]) {
    await expect(control).toHaveAttribute('aria-required', 'true');
  }
});

/**
 * Focus auto-advance — the machine's signature behaviour: typing a character into a box
 * moves focus to the NEXT box. Falsifiable: after typing into box 0, box 1 is focused and
 * box 0 carries the typed value. Asserted on BOTH renderers.
 */
test('focus auto-advance: typing a digit advances to the next box (both renderers)', async ({
  page,
}) => {
  // Lit.
  await litSegment(page, 'lit-neutral', 0).focus();
  await page.keyboard.press('1');
  await expect(litSegment(page, 'lit-neutral', 0)).toHaveValue('1');
  await expect(litSegment(page, 'lit-neutral', 1)).toBeFocused();
  await page.keyboard.press('2');
  await expect(litSegment(page, 'lit-neutral', 1)).toHaveValue('2');
  await expect(litSegment(page, 'lit-neutral', 2)).toBeFocused();

  // React parity.
  await reactSegment(page, 'react-neutral', 0).focus();
  await page.keyboard.press('1');
  await expect(reactSegment(page, 'react-neutral', 0)).toHaveValue('1');
  await expect(reactSegment(page, 'react-neutral', 1)).toBeFocused();
});

/**
 * Backspace — the machine clears the current box and steps focus back. Type two digits,
 * then Backspace twice: the value empties and focus returns to box 0.
 */
test('backspace: removes and steps focus back (the machine owns reverse focus)', async ({
  page,
}) => {
  await litSegment(page, 'lit-required', 0).focus();
  await page.keyboard.press('5');
  await page.keyboard.press('6');
  // Focus is now on box 2; Backspace clears box 1 (the previous) and moves back.
  await page.keyboard.press('Backspace');
  await expect.poll(() => litSegment(page, 'lit-required', 1).inputValue()).toBe('');
  await page.keyboard.press('Backspace');
  await expect.poll(() => litSegment(page, 'lit-required', 0).inputValue()).toBe('');
});

/**
 * Paste-fill — pasting a multi-character code distributes it across the boxes (the machine
 * owns the distribution). Falsifiable: after pasting "1234" the four boxes read 1,2,3,4.
 * Driven via the clipboard API in-page so the machine's onPaste runs for real.
 */
test('paste-fill: pasting a code distributes across the boxes (both renderers)', async ({
  page,
}) => {
  const pasteInto = async (input: Locator) => {
    await input.focus();
    await input.evaluate((el) => {
      const dt = new DataTransfer();
      dt.setData('text/plain', '1234');
      el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }));
    });
  };

  await pasteInto(litSegment(page, 'lit-neutral', 0));
  await expect.poll(() => litSegment(page, 'lit-neutral', 0).inputValue()).toBe('1');
  await expect.poll(() => litSegment(page, 'lit-neutral', 1).inputValue()).toBe('2');
  await expect.poll(() => litSegment(page, 'lit-neutral', 2).inputValue()).toBe('3');
  await expect.poll(() => litSegment(page, 'lit-neutral', 3).inputValue()).toBe('4');

  await pasteInto(reactSegment(page, 'react-neutral', 0));
  await expect.poll(() => reactSegment(page, 'react-neutral', 0).inputValue()).toBe('1');
  await expect.poll(() => reactSegment(page, 'react-neutral', 3).inputValue()).toBe('4');
});

/** Masking — the masked specimen renders each box as type=password (the machine owns it). */
test('masking: the masked specimen renders password boxes (both renderers)', async ({ page }) => {
  await expect(litSegment(page, 'lit-masked', 0)).toHaveAttribute('type', 'password');
  await expect(reactSegment(page, 'react-masked', 0)).toHaveAttribute('type', 'password');
});

/**
 * Complete event — the public contract. Lit dispatches a composed
 * CustomEvent('value-complete'); React surfaces its onValueComplete payload into a readout.
 * Both fire with "1234" once all four boxes are filled.
 */
test('event contract: filling all boxes fires the public complete event (both renderers)', async ({
  page,
}) => {
  // Lit — listen for the composed event, then fill the boxes.
  const litDetail = page.evaluate(
    () =>
      new Promise<string>((resolve) => {
        const host = document.querySelector('[data-testid="lit-neutral"]');
        host?.addEventListener(
          'value-complete',
          (e) => resolve((e as CustomEvent<{ valueAsString: string }>).detail.valueAsString),
          { once: true },
        );
      }),
  );
  await litSegment(page, 'lit-neutral', 0).focus();
  await page.keyboard.type('1234');
  expect(await litDetail).toBe('1234');

  // React — the readout starts empty (no spurious fire on mount) and fills once complete.
  const readout = page.getByTestId('react-pin-event-value');
  await expect(readout).toBeEmpty();
  await page.getByTestId('react-pin-event').locator('.lab-pin-input-segment').first().focus();
  await page.keyboard.type('1234');
  await expect(readout).toHaveText('1234');
});

test('disabled: the segments are non-interactive on both renderers', async ({ page }) => {
  await expect(litSegment(page, 'lit-disabled', 0)).toBeDisabled();
  await expect(reactSegment(page, 'react-disabled', 0)).toBeDisabled();
});

/**
 * Control-surface parity — the field SURFACE (border + background) is painted on each
 * SEGMENT, never on the control GROUP wrapper. The Lit element neutralises the shared
 * field-styles `.control` rule so the wrapper stays a bare transparent track (the combobox
 * double-paint lesson); React's `.lab-pin-input-control` is transparent by construction.
 *
 * Falsifiable: (1) both wrappers carry NO border + a transparent background; (2) each
 * segment carries the field border + an opaque fill; (3) the wrapper and segment surfaces
 * MATCH across renderers.
 */
test('control-surface parity: the group wrapper is bare; the segment carries the surface', async ({
  page,
}) => {
  const readSurface = (el: Element) => {
    const cs = getComputedStyle(el as HTMLElement);
    return {
      borderTopWidth: cs.borderTopWidth,
      borderColor: cs.borderTopColor,
      background: cs.backgroundColor,
    };
  };

  const lit = await litHost(page, 'lit-neutral').evaluate((host, read) => {
    const fn = new Function(`return (${read})`)() as (el: Element) => unknown;
    const sr = (host as HTMLElement).shadowRoot;
    const wrapper = sr?.querySelector('.control');
    const segment = sr?.querySelector('.segment');
    if (!wrapper || !segment) throw new Error('Lit pin parts not found');
    return { wrapper: fn(wrapper), segment: fn(segment) };
  }, readSurface.toString());

  const react = await reactField(page, 'react-neutral').evaluate((field, read) => {
    const fn = new Function(`return (${read})`)() as (el: Element) => unknown;
    const wrapper = field.querySelector('.lab-pin-input-control');
    const segment = field.querySelector('.lab-pin-input-segment');
    if (!wrapper || !segment) throw new Error('React pin parts not found');
    return { wrapper: fn(wrapper), segment: fn(segment) };
  }, readSurface.toString());

  type Surface = ReturnType<typeof readSurface>;
  const litW = lit.wrapper as Surface;
  const litS = lit.segment as Surface;
  const reactW = react.wrapper as Surface;
  const reactS = react.segment as Surface;

  // (1) Both group wrappers carry NO field surface.
  expect(litW.borderTopWidth, 'Lit group wrapper has no border (no double box)').toBe('0px');
  expect(litW.background, 'Lit group wrapper background is transparent').toBe('rgba(0, 0, 0, 0)');
  expect(reactW.borderTopWidth, 'React group wrapper has no border').toBe('0px');
  expect(reactW.background, 'React group wrapper background is transparent').toBe(
    'rgba(0, 0, 0, 0)',
  );

  // (2) Each segment is the ONE painted surface.
  expect(litS.borderTopWidth, 'Lit segment carries the field border').not.toBe('0px');
  expect(litS.background, 'Lit segment has an opaque field background').not.toBe(
    'rgba(0, 0, 0, 0)',
  );

  // (3) Parity across renderers.
  expect(litS.borderColor, 'segment border colour parity').toBe(reactS.borderColor);
  expect(litS.background, 'segment background parity').toBe(reactS.background);
});

test('visual parity: Lit and React resolve the same segment border colour', async ({ page }) => {
  const litB = await litSegment(page, 'lit-neutral', 0).evaluate(borderColor);
  const reactB = await reactSegment(page, 'react-neutral', 0).evaluate(borderColor);
  expect(reactB, 'pin segment border parity').toBe(litB);
});

test('visual parity: the danger sentiment re-points the segment border identically', async ({
  page,
}) => {
  const litB = await litSegment(page, 'lit-invalid', 0).evaluate(borderColor);
  const reactB = await reactSegment(page, 'react-invalid', 0).evaluate(borderColor);
  expect(reactB, 'danger segment border parity').toBe(litB);
});
