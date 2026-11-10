import { type Locator, type Page, expect, test } from '@playwright/test';
import { waitForThemePaint } from './helpers/theme-paint.js';

/**
 * Combobox suite — the COMPOUND + POSITIONED + FILTERED canon (the Select listbox ⊕ a
 * filterable text input ⊕ the shared field-a11y seam), verified on BOTH renderers.
 *
 * The fixture (`combobox.html`) mounts the Lit `<lab-combobox>` (all parts in one shadow
 * scope, listbox positioned with strategy:fixed) and the native-React `<Combobox>`
 * (body portal) with identical specimens under one [data-theme]. These checks are the
 * Combobox's browser-side definition of done:
 *   1. Render — the delivered HTML carries the Lit element; React is a client island.
 *   2. a11y — the input is role=combobox with aria-autocomplete/expanded/controls; the
 *      content is role=listbox; the label/helper association is field-a11y's (describedby).
 *   3. Open — focusing/typing opens the listbox and sets aria-expanded.
 *   4. Filter — typing NARROWS the rendered options to the matching subset.
 *   5. Selection — Enter / click selects the highlighted option and (single) closes.
 *   6. Keyboard — Arrow/Home/End move the highlight; aria-activedescendant follows it.
 *   7. Dismiss — Escape / outside-click close the listbox and restore focus to the input.
 *   8. Positioning — the open listbox is anchored at the input.
 *   9. Disabled — a disabled input does not open.
 *  10. Visual parity — Lit and React resolve the SAME listbox colour when open.
 *  11. Value-change EVENT — the public value-change / onValueChange fires with the value.
 *
 * Playwright's CSS engine pierces open shadow DOM, so `litHost.locator('.input')` reaches
 * the Lit shadow parts the same way it reaches the React DOM parts. DETERMINISM (lesson
 * 7): every open/dismiss is gated on a machine-readiness signal (aria-expanded flips, the
 * listbox is visible, activedescendant is set) via `expect`/`expect.poll`, never a fixed
 * sleep — the open→dismiss race is what flaked round-1 overlays.
 */

function litHost(page: Page, testid: string): Locator {
  return page.getByTestId(testid);
}
function litInput(page: Page, testid: string): Locator {
  return litHost(page, testid).locator('.input');
}
function litContent(page: Page, testid: string): Locator {
  return litHost(page, testid).locator('.content');
}
function reactWrap(page: Page, testid: string): Locator {
  return page.getByTestId(testid);
}
function reactInput(page: Page, testid: string): Locator {
  return reactWrap(page, testid).locator('.lab-combobox-input');
}
/** The React listbox is portalled to <body>; find the open one by data-state. */
function reactOpenContent(page: Page): Locator {
  return page.locator('.lab-combobox-content[data-state="open"]');
}

const bg = (el: HTMLElement) => getComputedStyle(el).backgroundColor;

/**
 * Wait until the machine has OPENED the listbox for the Lit specimen — aria-expanded on
 * the input flips true and the content is visible. Once open, the machine's document-level
 * Escape / outside-click listeners are live, so this is the honest gate that removes the
 * open→dismiss race (lesson 7, no arbitrary sleep).
 */
async function litOpen(page: Page, testid: string): Promise<void> {
  await expect(litInput(page, testid)).toHaveAttribute('aria-expanded', 'true');
  await expect(litContent(page, testid)).toBeVisible();
}
async function reactOpen(page: Page, testid: string): Promise<void> {
  await expect(reactInput(page, testid)).toHaveAttribute('aria-expanded', 'true');
  await expect(reactOpenContent(page)).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/combobox.html');
});

test('delivered HTML carries the Lit element (React island mounts client-side)', async ({
  request,
}) => {
  const body = await (await request.get('/combobox.html')).text();
  expect(body).toMatch(/<lab-combobox/i);
  expect(body).toContain('id="react-root"');
});

test('render: the input is a combobox with the listbox closed on both renderers', async ({
  page,
}) => {
  // The combobox role + aria-expanded=false are the machine's output at rest.
  await expect(litInput(page, 'lit-combobox')).toHaveAttribute('role', 'combobox');
  await expect(litInput(page, 'lit-combobox')).toHaveAttribute('aria-expanded', 'false');
  await expect(litContent(page, 'lit-combobox')).toBeHidden();

  await expect(reactInput(page, 'react-combobox')).toHaveAttribute('role', 'combobox');
  await expect(reactInput(page, 'react-combobox')).toHaveAttribute('aria-expanded', 'false');
});

/**
 * a11y — the binding the @zag-js/combobox machine REALLY emits on the input: role=combobox,
 * aria-autocomplete, aria-controls → the content id, aria-expanded. PLUS the field-a11y
 * seam: aria-describedby → the helper id (the specimen carries `helper`), so the machine's
 * combobox ARIA and the field's describedby coexist on ONE input. Falsifiable: the idref
 * must equal the actual element's id, not merely "be present".
 */
test('aria: the input advertises the listbox AND the field helper association on both renderers', async ({
  page,
}) => {
  await litInput(page, 'lit-combobox').click();
  const litWiring = await litHost(page, 'lit-combobox').evaluate((host) => {
    const sr = (host as HTMLElement).shadowRoot;
    const input = sr?.querySelector('.input');
    const content = sr?.querySelector('.content');
    const helper = sr?.querySelector('.helper');
    return {
      role: input?.getAttribute('role') ?? null,
      autocomplete: input?.getAttribute('aria-autocomplete') ?? null,
      controls: input?.getAttribute('aria-controls') ?? null,
      describedby: input?.getAttribute('aria-describedby') ?? null,
      contentId: content?.id ?? null,
      contentRole: content?.getAttribute('role') ?? null,
      helperId: helper?.id ?? null,
    };
  });
  expect(litWiring.role).toBe('combobox');
  expect(litWiring.autocomplete, 'machine sets aria-autocomplete').toBeTruthy();
  expect(litWiring.contentRole).toBe('listbox');
  expect(litWiring.contentId, 'content has an id').toBeTruthy();
  expect(litWiring.controls, 'input aria-controls → content id').toBe(litWiring.contentId);
  // field-a11y: the helper is described, by its real id.
  expect(litWiring.helperId, 'helper region has an id').toBeTruthy();
  expect(litWiring.describedby, 'input aria-describedby → helper id').toBe(litWiring.helperId);

  // React parity.
  await reactInput(page, 'react-combobox').click();
  await reactOpen(page, 'react-combobox');
  const reactContentId = await reactOpenContent(page).getAttribute('id');
  expect(await reactInput(page, 'react-combobox').getAttribute('role')).toBe('combobox');
  expect(reactContentId, 'react content has an id').toBeTruthy();
  expect(await reactInput(page, 'react-combobox').getAttribute('aria-controls')).toBe(
    reactContentId,
  );
  const reactDescribedBy = await reactInput(page, 'react-combobox').getAttribute(
    'aria-describedby',
  );
  expect(reactDescribedBy, 'react input describes a helper').toBeTruthy();
  // React's useId() yields colon-bearing ids (`:r0:-helper`) that break a CSS `#id`
  // selector, so match by the id ATTRIBUTE — a falsifiable "the describedby points at a
  // real node" check that is selector-syntax safe.
  expect(
    await reactWrap(page, 'react-combobox').locator(`[id="${reactDescribedBy}"]`).count(),
    'react describedby → a real helper node',
  ).toBe(1);
});

test('open: focusing the input opens the listbox on both renderers', async ({ page }) => {
  // Lit.
  await litInput(page, 'lit-combobox').click();
  await litOpen(page, 'lit-combobox');
  await expect(litContent(page, 'lit-combobox')).toHaveAttribute('role', 'listbox');

  // React.
  await reactInput(page, 'react-combobox').click();
  await reactOpen(page, 'react-combobox');
  await expect(reactOpenContent(page)).toHaveAttribute('role', 'listbox');
});

/**
 * Filter — typing NARROWS the rendered options. The full list has 6 fruits; typing "ap"
 * leaves only "Apple" + "Apricot" (label substring, case-insensitive), so exactly 2 option
 * rows remain on BOTH renderers. Falsifiable two ways: the surviving values are exactly
 * {apple, apricot}, and a non-matching query ("zzz") leaves zero options (the empty state).
 */
test('filter: typing narrows the options to the matching subset on both renderers', async ({
  page,
}) => {
  const litValues = () =>
    litHost(page, 'lit-combobox').evaluate((h) =>
      Array.from((h as HTMLElement).shadowRoot?.querySelectorAll('.item[data-value]') ?? []).map(
        (el) => el.getAttribute('data-value'),
      ),
    );

  await litInput(page, 'lit-combobox').click();
  await litOpen(page, 'lit-combobox');
  await litInput(page, 'lit-combobox').fill('ap');
  await expect.poll(litValues).toEqual(['apple', 'apricot']);

  // A non-matching query collapses to the empty state (no option rows).
  await litInput(page, 'lit-combobox').fill('zzz');
  await expect.poll(litValues).toEqual([]);
  await expect(litContent(page, 'lit-combobox').locator('.empty')).toBeVisible();

  // React parity.
  const reactValues = () =>
    page.evaluate(() =>
      Array.from(
        document
          .querySelector('.lab-combobox-content[data-state="open"]')
          ?.querySelectorAll('.lab-combobox-item[data-value]') ?? [],
      ).map((el) => el.getAttribute('data-value')),
    );
  await reactInput(page, 'react-combobox').click();
  await reactOpen(page, 'react-combobox');
  await reactInput(page, 'react-combobox').fill('ap');
  await expect.poll(reactValues).toEqual(['apple', 'apricot']);
  await reactInput(page, 'react-combobox').fill('zzz');
  await expect.poll(reactValues).toEqual([]);
});

/**
 * Selection (single) — typing to narrow, then clicking the matching option selects it,
 * fills the input with its label (selectionBehavior:"replace" default), and closes the
 * listbox (closeOnSelect default). Asserted on BOTH renderers.
 */
test('selection (single): clicking a filtered option selects it and closes on both renderers', async ({
  page,
}) => {
  await litInput(page, 'lit-combobox').click();
  await litOpen(page, 'lit-combobox');
  await litInput(page, 'lit-combobox').fill('cher');
  await litContent(page, 'lit-combobox').locator('.item[data-value="cherry"]').click();
  await expect(litContent(page, 'lit-combobox')).toBeHidden();
  await expect(litInput(page, 'lit-combobox')).toHaveValue('Cherry');

  // React.
  await reactInput(page, 'react-combobox').click();
  await reactOpen(page, 'react-combobox');
  await reactInput(page, 'react-combobox').fill('cher');
  await reactOpenContent(page).locator('.lab-combobox-item[data-value="cherry"]').click();
  await expect(page.locator('.lab-combobox-content[data-state="open"]')).toHaveCount(0);
  await expect(reactInput(page, 'react-combobox')).toHaveValue('Cherry');
});

/**
 * Keyboard — ArrowDown highlights an option and the input's aria-activedescendant follows
 * it to THAT option's real id (the falsifiable a11y contract: idref → a real node). Poll
 * for the steady state — the machine moves the highlight after the keydown and the input +
 * option are re-spread separately, so wait until activedescendant equals the highlighted
 * option id rather than read mid-update (the round-1 one-step desync).
 */
test('keyboard: ArrowDown highlights an option and aria-activedescendant follows it', async ({
  page,
}) => {
  await litInput(page, 'lit-combobox').click();
  await litOpen(page, 'lit-combobox');
  await litInput(page, 'lit-combobox').press('ArrowDown');

  await expect
    .poll(() =>
      litHost(page, 'lit-combobox').evaluate((host) => {
        const sr = (host as HTMLElement).shadowRoot;
        const ad = sr?.querySelector('.input')?.getAttribute('aria-activedescendant') ?? null;
        const hl = sr?.querySelector('.item[data-highlighted]')?.id ?? null;
        return ad !== null && ad === hl;
      }),
    )
    .toBe(true);

  // React parity — the activedescendant must resolve to a real node in the portal.
  await reactInput(page, 'react-combobox').click();
  await reactOpen(page, 'react-combobox');
  await reactInput(page, 'react-combobox').press('ArrowDown');
  await expect
    .poll(() =>
      page.evaluate(() => {
        const input = document.querySelector('[data-testid="react-combobox"] .lab-combobox-input');
        const content = document.querySelector('.lab-combobox-content[data-state="open"]');
        const ad = input?.getAttribute('aria-activedescendant') ?? null;
        const hl = content?.querySelector('.lab-combobox-item[data-highlighted]')?.id ?? null;
        return ad !== null && ad === hl;
      }),
    )
    .toBe(true);
  const reactResolves = await page.evaluate(() => {
    const input = document.querySelector('[data-testid="react-combobox"] .lab-combobox-input');
    const ad = input?.getAttribute('aria-activedescendant');
    return ad ? document.getElementById(ad) != null : false;
  });
  expect(reactResolves, 'react: activedescendant resolves to a real node').toBe(true);
});

/**
 * Home / End — the machine highlights the first / last VISIBLE option. With the full list
 * open, End → "elderberry" (last), Home → "apple" (first). Asserted by the highlighted
 * option's value on the Lit renderer (the canonical machine output).
 */
test('Home/End: highlight jumps to the last then first option', async ({ page }) => {
  const litHighlightedValue = () =>
    litHost(page, 'lit-combobox').evaluate(
      (h) =>
        (h as HTMLElement).shadowRoot
          ?.querySelector('.item[data-highlighted]')
          ?.getAttribute('data-value') ?? null,
    );

  await litInput(page, 'lit-combobox').click();
  await litOpen(page, 'lit-combobox');
  await litInput(page, 'lit-combobox').press('End');
  await expect.poll(litHighlightedValue).toBe('elderberry');
  await litInput(page, 'lit-combobox').press('Home');
  await expect.poll(litHighlightedValue).toBe('apple');
});

test('selection (multiple): the machine accumulates values and stays open', async ({ page }) => {
  // The multiple specimen keeps the listbox open across picks (closeOnSelect false in
  // multi-mode) and marks each chosen option aria-selected=true.
  await litInput(page, 'lit-combobox-multi').click();
  await litOpen(page, 'lit-combobox-multi');
  const content = litContent(page, 'lit-combobox-multi');
  await content.locator('.item[data-value="apple"]').click();
  await content.locator('.item[data-value="cherry"]').click();
  // The listbox is still open (multi); both stay selected.
  await expect(content).toBeVisible();
  await expect(content.locator('.item[data-value="apple"]')).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(content.locator('.item[data-value="cherry"]')).toHaveAttribute(
    'aria-selected',
    'true',
  );
});

test('aria-multiselectable: present on the multi listbox, absent on the single one', async ({
  page,
}) => {
  // Single: the machine omits aria-multiselectable.
  await litInput(page, 'lit-combobox').click();
  await litOpen(page, 'lit-combobox');
  expect(await litContent(page, 'lit-combobox').getAttribute('aria-multiselectable')).toBeNull();
  await litInput(page, 'lit-combobox').press('Escape');
  await expect(litContent(page, 'lit-combobox')).toBeHidden();

  // Multiple: aria-multiselectable="true".
  await litInput(page, 'lit-combobox-multi').click();
  await litOpen(page, 'lit-combobox-multi');
  await expect(litContent(page, 'lit-combobox-multi')).toHaveAttribute(
    'aria-multiselectable',
    'true',
  );

  // React parity (multi specimen).
  await reactInput(page, 'react-combobox-multi').click();
  await reactOpen(page, 'react-combobox-multi');
  await expect(reactOpenContent(page)).toHaveAttribute('aria-multiselectable', 'true');
});

test('dismiss: Escape closes the listbox and restores focus to the input', async ({ page }) => {
  await litInput(page, 'lit-combobox').click();
  await litOpen(page, 'lit-combobox');
  await litInput(page, 'lit-combobox').press('Escape');
  await expect(litContent(page, 'lit-combobox')).toBeHidden();
  await expect(litInput(page, 'lit-combobox')).toBeFocused();

  await reactInput(page, 'react-combobox').click();
  await reactOpen(page, 'react-combobox');
  await reactInput(page, 'react-combobox').press('Escape');
  await expect(page.locator('.lab-combobox-content[data-state="open"]')).toHaveCount(0);
  await expect(reactInput(page, 'react-combobox')).toBeFocused();
});

test('dismiss: clicking outside closes the listbox', async ({ page }) => {
  await litInput(page, 'lit-combobox').click();
  await litOpen(page, 'lit-combobox');
  await page.getByTestId('combobox-title').click();
  await expect(litContent(page, 'lit-combobox')).toBeHidden();
});

test('disabled: a disabled input does not open', async ({ page }) => {
  // The matrix/live specimens are interactive; assert the at-rest disabled contract on a
  // dedicated disabled clone created in-page so we never weaken the real specimens.
  await page.evaluate(() => {
    const el = document.createElement('lab-combobox');
    el.setAttribute('data-testid', 'lit-combobox-disabled');
    el.setAttribute('label', 'Disabled');
    el.setAttribute('disabled', '');
    el.setAttribute('items', '[{"value":"a","label":"Apple"}]');
    document.querySelector('[data-testid="lit-renderer"] .specimens')?.appendChild(el);
  });
  const disabled = litHost(page, 'lit-combobox-disabled');
  await expect(disabled.locator('.input')).toBeDisabled();
  await disabled.locator('.input').click({ force: true });
  await expect(disabled.locator('.content')).toBeHidden();
});

/**
 * Positioning — the listbox is anchored AT the input, not merely on-screen. Floating UI
 * legitimately FLIPS the listbox above the input when there is not enough room below
 * (the start-placement preference is honoured only when it fits), so this asserts the
 * machine-positioned surface is adjacent to the input on the RESOLVED edge — its top
 * meets the input's bottom (default) OR its bottom meets the input's top (flipped) —
 * within a small gap, and the two boxes overlap horizontally. This still catches a
 * surface that rendered visible but DETACHED from its anchor (the failure mode), without
 * over-constraining a placement Floating UI is correct to flip.
 */
test('positioning: the open listbox is anchored at the input', async ({ page }) => {
  const input = litInput(page, 'lit-combobox');
  await input.scrollIntoViewIfNeeded();
  await input.click();
  await litOpen(page, 'lit-combobox');
  const content = litContent(page, 'lit-combobox');

  const inputBox = await input.boundingBox();
  const contentBox = await content.boundingBox();
  expect(inputBox).not.toBeNull();
  expect(contentBox).not.toBeNull();
  if (!inputBox || !contentBox) return;

  // Adjacency on the resolved edge: either the listbox top meets the input bottom
  // (bottom placement) or the listbox bottom meets the input top (flipped to top).
  const gapBelow = contentBox.y - (inputBox.y + inputBox.height);
  const gapAbove = inputBox.y - (contentBox.y + contentBox.height);
  const adjacency = Math.min(Math.abs(gapBelow), Math.abs(gapAbove));
  expect(adjacency, 'listbox is adjacent to the input on the resolved edge').toBeLessThanOrEqual(
    24,
  );

  const overlap =
    Math.min(inputBox.x + inputBox.width, contentBox.x + contentBox.width) -
    Math.max(inputBox.x, contentBox.x);
  expect(overlap, 'listbox horizontally overlaps the input').toBeGreaterThan(0);
});

/**
 * Control-surface parity — the field SURFACE (border + background + padding + box size)
 * must be painted ONCE, on the INPUT, never a second time on the wrapper. The Lit element
 * reuses the shared field-styles `.control` rule, which matches BOTH the wrapper
 * `<div class="control">` AND the input (`class="input control"`); a regression that lets
 * the wrapper take that surface paints a SECOND padded, bordered, filled box around the
 * input (the double-box defect — wrapper 269×60 around a 235×42 input). The React twin
 * avoids it with distinct classes (`.lab-combobox-control` = transparent flex container,
 * `.lab-combobox-input` = the surface), so React is the ground truth.
 *
 * Falsifiable three ways: (1) the Lit wrapper carries NO surface — border-width 0,
 * transparent background, zero padding — like React's `.lab-combobox-control`; (2) the Lit
 * wrapper box COINCIDES with the input box (one box, not a larger one around it); (3) the
 * Lit input surface (border colour + background) MATCHES the React input, and the two
 * control boxes are the SAME size. The pre-fix double-paint fails (1), (2) and (3).
 */
test('control-surface parity: the Lit wrapper is a bare container; the surface matches React', async ({
  page,
}) => {
  await waitForThemePaint(page, litInput(page, 'lit-combobox'), reactInput(page, 'react-combobox'));
  const readSurface = (el: Element) => {
    const cs = getComputedStyle(el as HTMLElement);
    const r = (el as HTMLElement).getBoundingClientRect();
    return {
      borderTopWidth: cs.borderTopWidth,
      borderColor: cs.borderTopColor,
      background: cs.backgroundColor,
      padding: `${cs.paddingTop}/${cs.paddingRight}/${cs.paddingBottom}/${cs.paddingLeft}`,
      width: Math.round(r.width),
      height: Math.round(r.height),
    };
  };

  const lit = await litHost(page, 'lit-combobox').evaluate((host, read) => {
    const fn = new Function(`return (${read})`)() as (el: Element) => unknown;
    const sr = (host as HTMLElement).shadowRoot;
    const wrapper = sr?.querySelector('.control:not(.input)');
    const input = sr?.querySelector('.input');
    if (!wrapper || !input) throw new Error('Lit control parts not found');
    return { wrapper: fn(wrapper), input: fn(input) };
  }, readSurface.toString());

  const react = await reactWrap(page, 'react-combobox').evaluate((host, read) => {
    const fn = new Function(`return (${read})`)() as (el: Element) => unknown;
    const wrapper = (host as HTMLElement).querySelector('.lab-combobox-control');
    const input = (host as HTMLElement).querySelector('.lab-combobox-input');
    if (!wrapper || !input) throw new Error('React control parts not found');
    return { wrapper: fn(wrapper), input: fn(input) };
  }, readSurface.toString());

  type Surface = ReturnType<typeof readSurface>;
  const litW = lit.wrapper as Surface;
  const litI = lit.input as Surface;
  const reactW = react.wrapper as Surface;
  const reactI = react.input as Surface;

  // (1) The Lit wrapper carries NO field surface — a bare flex container, like React's.
  expect(litW.borderTopWidth, 'Lit wrapper has no border (no double box)').toBe('0px');
  expect(litW.background, 'Lit wrapper background is transparent').toBe('rgba(0, 0, 0, 0)');
  expect(litW.padding, 'Lit wrapper has zero padding').toBe('0px/0px/0px/0px');

  // (2) The Lit wrapper box COINCIDES with the input box — one box, not a larger outer one.
  expect(litW.width, 'Lit wrapper width == input width (single box)').toBe(litI.width);
  expect(litW.height, 'Lit wrapper height == input height (single box)').toBe(litI.height);

  // The input is the ONE painted surface (non-zero border + an opaque fill).
  expect(litI.borderTopWidth, 'Lit input carries the field border').not.toBe('0px');
  expect(litI.background, 'Lit input has an opaque field background').not.toBe('rgba(0, 0, 0, 0)');

  // (3) Parity with React: the wrapper is bare on both, and the input surface + control box
  // are identical across renderers.
  expect(litW.borderTopWidth, 'wrapper border parity').toBe(reactW.borderTopWidth);
  expect(litW.background, 'wrapper background parity').toBe(reactW.background);
  expect(litW.padding, 'wrapper padding parity').toBe(reactW.padding);
  expect(litI.borderColor, 'input border colour parity').toBe(reactI.borderColor);
  expect(litI.background, 'input background parity').toBe(reactI.background);
  expect(litI.padding, 'input padding parity').toBe(reactI.padding);
  expect(litW.width, 'control box width parity').toBe(reactW.width);
  expect(litW.height, 'control box height parity').toBe(reactW.height);
});

test('visual parity: Lit and React resolve the same listbox colour when open', async ({ page }) => {
  await waitForThemePaint(page, litInput(page, 'lit-combobox'), reactInput(page, 'react-combobox'));
  await litInput(page, 'lit-combobox').click();
  await litOpen(page, 'lit-combobox');
  await waitForThemePaint(page, litContent(page, 'lit-combobox'));
  const litBg = await litContent(page, 'lit-combobox').evaluate(bg);

  await reactInput(page, 'react-combobox').click();
  await reactOpen(page, 'react-combobox');
  await waitForThemePaint(page, reactOpenContent(page));
  const reactBg = await reactOpenContent(page).evaluate(bg);

  expect(reactBg, 'combobox listbox background parity').toBe(litBg);
});

/**
 * Value-change EVENT — the public contract (the gap prior batches missed). Lit dispatches
 * a composed CustomEvent('value-change') whose detail.value is the chosen value(s); React
 * surfaces its `onValueChange(value)` payload into a readout node. Both must fire with
 * ["cherry"] / "cherry" when Cherry is chosen.
 */
test('event contract: selecting an option fires the public value-change with the value (both renderers)', async ({
  page,
}) => {
  // Lit — listen for the composed event, then narrow + pick Cherry.
  const litDetail = page.evaluate(
    () =>
      new Promise<string[]>((resolve) => {
        const host = document.querySelector('[data-testid="lit-combobox"]');
        host?.addEventListener(
          'value-change',
          (e) => resolve((e as CustomEvent<{ value: string[] }>).detail.value),
          { once: true },
        );
      }),
  );
  await litInput(page, 'lit-combobox').click();
  await litOpen(page, 'lit-combobox');
  await litInput(page, 'lit-combobox').fill('cher');
  await litContent(page, 'lit-combobox').locator('.item[data-value="cherry"]').click();
  expect(await litDetail).toEqual(['cherry']);

  // React — the readout starts empty (no spurious fire on mount) and fills with the
  // selected value once the public onValueChange emits.
  const readout = page.getByTestId('react-combobox-event-value');
  await expect(readout).toBeEmpty();
  await reactInput(page, 'react-combobox-event').click();
  await reactOpen(page, 'react-combobox-event');
  await reactInput(page, 'react-combobox-event').fill('cher');
  await reactOpenContent(page).locator('.lab-combobox-item[data-value="cherry"]').click();
  await expect(readout).toHaveText('cherry');
});
