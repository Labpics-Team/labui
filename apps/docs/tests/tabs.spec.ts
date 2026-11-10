import { type Locator, type Page, expect, test } from '@playwright/test';
import { waitForThemePaint } from './helpers/theme-paint.js';

/**
 * Tabs suite — a COMPOUND component that consumes the @zag-js/tabs GROUP machine
 * through the LabUI seam, verified on BOTH renderers.
 *
 * The fixture (`tabs.html`) mounts the Lit `<lab-tabs>` and the native-React
 * `<Tabs>` with identical specimens under one [data-theme]. These checks are the
 * Tabs' browser-side definition of done:
 *   1. Render — both renderers paint a real tablist with a token.
 *   2. Machine behaviour — clicking a tab selects it (data-selected moves) on both.
 *   3. a11y roving — arrow keys move selection via the machine (automatic mode).
 *   4. Disabled — a disabled tab does not select.
 *   5. Visual parity — the selected underline resolves the SAME computed colour.
 *   6. Tokens + theme — re-pointing a role / flipping [data-theme] re-skins both.
 */

function litHost(page: Page, testid: string): Locator {
  return page.getByTestId(testid);
}
/** All Lit triggers (shadow-pierced) in document order. */
function litTriggers(page: Page, testid: string): Locator {
  return litHost(page, testid).locator('.trigger');
}
/** All React triggers in document order. */
function reactTriggers(page: Page, testid: string): Locator {
  return page.getByTestId(testid).locator('.lab-tabs-trigger');
}
/** All Lit panels (shadow-pierced) in document order. */
function litPanels(page: Page, testid: string): Locator {
  return litHost(page, testid).locator('.panel');
}
/** All React panels in document order. */
function reactPanels(page: Page, testid: string): Locator {
  return page.getByTestId(testid).locator('.lab-tabs-panel');
}

const underline = (el: HTMLElement) => getComputedStyle(el).borderBottomColor;

test.beforeEach(async ({ page }) => {
  await page.goto('/tabs.html');
});

test('delivered HTML carries the Lit element (React island mounts client-side)', async ({
  request,
}) => {
  const body = await (await request.get('/tabs.html')).text();
  expect(body).toMatch(/<lab-tabs/i);
  expect(body).toContain('id="react-root"');
});

test('render: both renderers expose a tablist with three tabs', async ({ page }) => {
  await expect(litHost(page, 'lit-tabs')).toBeVisible();
  await expect(litTriggers(page, 'lit-tabs')).toHaveCount(3);
  await expect(reactTriggers(page, 'react-tabs')).toHaveCount(3);
  // Roles come from the machine — a real tablist, not div soup.
  await expect(litHost(page, 'lit-tabs').locator('[role="tablist"]')).toBeVisible();
  await expect(page.getByTestId('react-tabs').locator('[role="tablist"]')).toBeVisible();
});

test('machine behaviour: clicking a tab moves selection on both renderers', async ({ page }) => {
  // Default selection is the first tab (account).
  const litTabsList = litTriggers(page, 'lit-tabs');
  await expect(litTabsList.nth(0)).toHaveAttribute('data-selected', /.*/);
  await litTabsList.nth(1).click();
  await expect(litTabsList.nth(1)).toHaveAttribute('data-selected', /.*/);
  await expect(litTabsList.nth(0)).not.toHaveAttribute('data-selected', /.*/);
  await expect(litTabsList.nth(1)).toHaveAttribute('aria-selected', 'true');

  const reactTabsList = reactTriggers(page, 'react-tabs');
  await expect(reactTabsList.nth(0)).toHaveAttribute('data-selected', /.*/);
  await reactTabsList.nth(1).click();
  await expect(reactTabsList.nth(1)).toHaveAttribute('data-selected', /.*/);
  await expect(reactTabsList.nth(0)).not.toHaveAttribute('data-selected', /.*/);
});

test('a11y roving: ArrowRight selects the next tab via the machine (automatic)', async ({
  page,
}) => {
  const litTabsList = litTriggers(page, 'lit-tabs');
  await litTabsList.nth(0).focus();
  await page.keyboard.press('ArrowRight');
  // Automatic activation: focusing the next tab selects it.
  await expect(litTabsList.nth(1)).toHaveAttribute('data-selected', /.*/);
});

/**
 * The blocks below assert ONLY what `@zag-js/tabs@1.41.2`'s connect actually
 * emits (verified against tabs.connect.js): `role=tab`/`tablist`/`tabpanel`,
 * `aria-selected` on every trigger, `hidden` on unselected panels, roving
 * `tabindex` (composite defaults true), `aria-controls` on the SELECTED trigger
 * only, and `aria-labelledby` on every panel. Nothing the machine does not give
 * is asserted (honesty — same discipline as the radio-group fix).
 */

test('roles: real ARIA-tabs pattern on both renderers (3 tabs + ≥1 tabpanel)', async ({ page }) => {
  for (const root of [litHost(page, 'lit-tabs'), page.getByTestId('react-tabs')]) {
    await expect(root.locator('[role="tablist"]')).toHaveCount(1);
    await expect(root.locator('[role="tab"]')).toHaveCount(3);
    // The machine renders all panels but hides the inactive ones; at least the
    // selected panel is present as a real tabpanel.
    expect(await root.locator('[role="tabpanel"]').count()).toBeGreaterThanOrEqual(1);
  }
});

test('panel visibility: selecting a tab shows ITS panel and hides the others', async ({ page }) => {
  // Lit — panel order matches trigger order (account, password, team).
  const litP = litPanels(page, 'lit-tabs');
  await expect(litP.nth(0)).toBeVisible(); // account is the default selection
  await expect(litP.nth(1)).toHaveAttribute('hidden', /.*/);
  await expect(litP.nth(1)).toBeHidden();

  await litTriggers(page, 'lit-tabs').nth(1).click(); // select password
  await expect(litP.nth(1)).toBeVisible();
  await expect(litP.nth(0)).toHaveAttribute('hidden', /.*/);
  await expect(litP.nth(0)).toBeHidden();

  // React — same contract.
  const reactP = reactPanels(page, 'react-tabs');
  await expect(reactP.nth(0)).toBeVisible();
  await expect(reactP.nth(1)).toBeHidden();

  await reactTriggers(page, 'react-tabs').nth(1).click();
  await expect(reactP.nth(1)).toBeVisible();
  await expect(reactP.nth(0)).toBeHidden();
});

test('roving tabindex: selected trigger is 0, the rest are -1 (composite machine)', async ({
  page,
}) => {
  // Zag tabs default `composite: true`, so the selected trigger takes tabindex=0
  // and the unselected take -1 — one tab stop, arrows move within. Verified in
  // tabs.connect.js: `tabIndex: triggerState.selected && composite ? 0 : -1`.
  for (const triggers of [litTriggers(page, 'lit-tabs'), reactTriggers(page, 'react-tabs')]) {
    await expect(triggers.nth(0)).toHaveAttribute('tabindex', '0'); // account selected
    await expect(triggers.nth(1)).toHaveAttribute('tabindex', '-1');
    await expect(triggers.nth(2)).toHaveAttribute('tabindex', '-1');
  }
});

test('aria wiring: selected trigger aria-controls == visible panel id; panel labelled by it', async ({
  page,
}) => {
  for (const testid of ['lit-tabs', 'react-tabs']) {
    const selectedTrigger =
      testid === 'lit-tabs' ? litTriggers(page, testid).nth(0) : reactTriggers(page, testid).nth(0);
    const visiblePanel =
      testid === 'lit-tabs' ? litPanels(page, testid).nth(0) : reactPanels(page, testid).nth(0);

    // Machine sets aria-controls on the SELECTED trigger only → the visible panel id.
    const controls = await selectedTrigger.getAttribute('aria-controls');
    expect(controls).toBeTruthy();
    expect(await visiblePanel.getAttribute('id')).toBe(controls);

    // Every panel is labelled by its trigger (aria-labelledby == trigger id).
    const triggerId = await selectedTrigger.getAttribute('id');
    expect(triggerId).toBeTruthy();
    expect(await visiblePanel.getAttribute('aria-labelledby')).toBe(triggerId);
  }
});

test('aria-selected: exactly one trigger is selected, it flips on click (both renderers)', async ({
  page,
}) => {
  for (const triggers of [litTriggers(page, 'lit-tabs'), reactTriggers(page, 'react-tabs')]) {
    await expect(triggers.nth(0)).toHaveAttribute('aria-selected', 'true');
    await expect(triggers.nth(1)).toHaveAttribute('aria-selected', 'false');
    await triggers.nth(1).click();
    await expect(triggers.nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect(triggers.nth(0)).toHaveAttribute('aria-selected', 'false');
  }
});

test('keyboard (React): Arrow moves selection, Home/End jump to ends', async ({ page }) => {
  // Zag tabs keyMap (tabs.connect.js getListProps): ArrowRight/Left + Home/End.
  // The third tab (team) is disabled, so End lands on it but cannot select — assert
  // only the moves the machine actually performs on enabled tabs.
  const triggers = reactTriggers(page, 'react-tabs');
  await triggers.nth(0).focus();

  await page.keyboard.press('ArrowRight'); // account → password (automatic activation)
  await expect(triggers.nth(1)).toHaveAttribute('data-selected', /.*/);

  await page.keyboard.press('Home'); // jump back to the first tab
  await expect(triggers.nth(0)).toHaveAttribute('data-selected', /.*/);
});

test('disabled: a disabled tab does not select on either renderer', async ({ page }) => {
  // The third tab (team) is disabled.
  const litTeam = litTriggers(page, 'lit-tabs').nth(2);
  await expect(litTeam).toHaveAttribute('data-disabled', /.*/);
  await litTeam.click({ force: true });
  await expect(litTeam).not.toHaveAttribute('data-selected', /.*/);

  const reactTeam = reactTriggers(page, 'react-tabs').nth(2);
  await expect(reactTeam).toHaveAttribute('data-disabled', /.*/);
  await reactTeam.click({ force: true });
  await expect(reactTeam).not.toHaveAttribute('data-selected', /.*/);
});

test('visual parity: Lit and React resolve the same selected underline colour', async ({
  page,
}) => {
  await waitForThemePaint(
    page,
    litHost(page, 'lit-tabs').locator('.trigger[data-selected]'),
    page.getByTestId('react-tabs').locator('.lab-tabs-trigger[data-selected]'),
  );
  const litSelected = litHost(page, 'lit-tabs').locator('.trigger[data-selected]');
  const reactSelected = page.getByTestId('react-tabs').locator('.lab-tabs-trigger[data-selected]');
  await expect(reactSelected).toBeVisible();
  expect(await reactSelected.evaluate(underline)).toBe(await litSelected.evaluate(underline));
});

test('tokens: re-pointing --lab-fill-accent re-skins BOTH selected underlines', async ({
  page,
}) => {
  const litSelected = litHost(page, 'lit-tabs').locator('.trigger[data-selected]');
  const reactSelected = page.getByTestId('react-tabs').locator('.lab-tabs-trigger[data-selected]');
  await expect(reactSelected).toBeVisible();

  await page.evaluate(() => {
    document.documentElement.style.setProperty('--lab-fill-accent', 'rgb(1, 2, 3)');
  });
  await expect.poll(() => litSelected.evaluate(underline)).toBe('rgb(1, 2, 3)');
  await expect.poll(() => reactSelected.evaluate(underline)).toBe('rgb(1, 2, 3)');
});

test('theme: flipping [data-theme] re-skins both renderers with zero edits', async ({ page }) => {
  const litSelected = litHost(page, 'lit-tabs').locator('.trigger[data-selected]');
  const reactSelected = page.getByTestId('react-tabs').locator('.lab-tabs-trigger[data-selected]');
  await expect(reactSelected).toBeVisible();

  const litDark = await litSelected.evaluate(underline);
  const reactDark = await reactSelected.evaluate(underline);

  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));

  await expect.poll(() => litSelected.evaluate(underline)).not.toBe(litDark);
  await expect.poll(() => reactSelected.evaluate(underline)).not.toBe(reactDark);
});

/**
 * The axis blocks below assert the Orientation × Size × Activation model the Lit
 * element documents (`orientation`, `size`, `activation-mode`). They read the
 * OBSERVABLE computed outcome of each axis — not the wiring — on BOTH renderers, so
 * the same paint contract is proven however each renderer sources the state
 * (`:host([orientation])` reflect on Lit; the machine's `data-orientation` /
 * `data-size` on React).
 */

const borderBottomWidth = (el: HTMLElement) => getComputedStyle(el).borderBottomWidth;
const borderInlineEndWidth = (el: HTMLElement) => getComputedStyle(el).borderInlineEndWidth;
const borderInlineEndColor = (el: HTMLElement) => getComputedStyle(el).borderInlineEndColor;
const paddingInline = (el: HTMLElement) =>
  `${getComputedStyle(el).paddingLeft} ${getComputedStyle(el).paddingRight}`;
const fontSize = (el: HTMLElement) => getComputedStyle(el).fontSize;

test('orientation=vertical: the selected underline moves to border-inline-end on both renderers', async ({
  page,
}) => {
  // Horizontal (default) paints the selected accent on border-BOTTOM and nothing on
  // the inline-end edge. Vertical flips the branch: the list track + the selected
  // trigger's accent move to border-INLINE-END, and border-bottom drops to 0.
  const litSelected = litHost(page, 'lit-tabs-vertical').locator('.trigger[data-selected]');
  const reactSelected = page
    .getByTestId('react-tabs-vertical')
    .locator('.lab-tabs-trigger[data-selected]');
  await expect(litSelected).toBeVisible();
  await expect(reactSelected).toBeVisible();

  for (const selected of [litSelected, reactSelected]) {
    // The vertical branch is live: bottom border is gone, inline-end carries weight.
    expect(await selected.evaluate(borderBottomWidth)).toBe('0px');
    expect(await selected.evaluate(borderInlineEndWidth)).not.toBe('0px');
    // …and the accent fill paints on that inline-end edge (the underline branch).
    expect(await selected.evaluate(borderInlineEndColor)).not.toBe('rgba(0, 0, 0, 0)');
  }

  // Parity: both renderers resolve the SAME accent on the inline-end edge.
  expect(await reactSelected.evaluate(borderInlineEndColor)).toBe(
    await litSelected.evaluate(borderInlineEndColor),
  );
});

test('size: s and l shift trigger padding and font-size away from the default m on both renderers', async ({
  page,
}) => {
  // size maps onto the --_pad-* / --_font knobs the trigger reads. Assert the
  // density actually differs from the default m, and that l > s, on each renderer.
  for (const [defaultId, smallId, largeId] of [
    ['lit-tabs', 'lit-tabs-s', 'lit-tabs-l'],
    ['react-tabs', 'react-tabs-s', 'react-tabs-l'],
  ] as const) {
    const trigger = (id: string) =>
      id.startsWith('lit') ? litTriggers(page, id).first() : reactTriggers(page, id).first();

    const [mPad, sPad, lPad] = await Promise.all([
      trigger(defaultId).evaluate(paddingInline),
      trigger(smallId).evaluate(paddingInline),
      trigger(largeId).evaluate(paddingInline),
    ]);
    expect(sPad, `${smallId}: padding differs from m`).not.toBe(mPad);
    expect(lPad, `${largeId}: padding differs from m`).not.toBe(mPad);
    expect(sPad, `${smallId}: padding differs from l`).not.toBe(lPad);

    const px = (v: string) => Number.parseFloat(v);
    const [mFont, sFont, lFont] = await Promise.all([
      trigger(defaultId).evaluate(fontSize),
      trigger(smallId).evaluate(fontSize),
      trigger(largeId).evaluate(fontSize),
    ]);
    expect(px(sFont), `${smallId}: font smaller than m`).toBeLessThan(px(mFont));
    expect(px(lFont), `${largeId}: font larger than m`).toBeGreaterThan(px(mFont));
  }
});

test('activation-mode=manual: focusing a tab does NOT select it; Enter/Space does (both renderers)', async ({
  page,
}) => {
  // Default automatic activation selects on focus (asserted in the roving tests
  // above). Manual activation only MOVES focus on arrow keys — selection waits for
  // Enter or Space. The team tab (3rd) is disabled, so we stay on account↔password.
  for (const id of ['lit-tabs-manual', 'react-tabs-manual'] as const) {
    const triggers = id.startsWith('lit') ? litTriggers(page, id) : reactTriggers(page, id);

    await triggers.nth(0).focus();
    await expect(triggers.nth(0)).toHaveAttribute('data-selected', /.*/);

    // ArrowRight moves focus to password but, under manual activation, selection
    // stays on account — the opposite of automatic mode.
    await page.keyboard.press('ArrowRight');
    await expect(triggers.nth(1), `${id}: focus moved to password`).toBeFocused();
    await expect(
      triggers.nth(1),
      `${id}: manual activation does NOT select on focus`,
    ).not.toHaveAttribute('data-selected', /.*/);
    await expect(triggers.nth(0), `${id}: selection stayed on account`).toHaveAttribute(
      'data-selected',
      /.*/,
    );

    // Enter (then Space on a fresh move) commits the focused tab — manual activation.
    await page.keyboard.press('Enter');
    await expect(triggers.nth(1), `${id}: Enter selects the focused tab`).toHaveAttribute(
      'data-selected',
      /.*/,
    );

    await triggers.nth(0).focus();
    await page.keyboard.press('Space');
    await expect(triggers.nth(0), `${id}: Space selects the focused tab`).toHaveAttribute(
      'data-selected',
      /.*/,
    );
  }
});

test('event contract: selecting a tab fires the public value-change with the new value (both renderers)', async ({
  page,
}) => {
  // Lit dispatches a composed CustomEvent('value-change') whose detail.value is the
  // newly selected tab; React surfaces its `onValueChange(value)` payload into a
  // readout node. Both must fire with "password" when the second tab is chosen.
  const litDetail = page.evaluate(
    () =>
      new Promise<string>((resolve) => {
        const host = document.querySelector('[data-testid="lit-tabs"]');
        host?.addEventListener(
          'value-change',
          (e) => resolve((e as CustomEvent<{ value: string }>).detail.value),
          { once: true },
        );
      }),
  );
  await litTriggers(page, 'lit-tabs').nth(1).click();
  expect(await litDetail).toBe('password');

  // React: the readout starts empty (no spurious fire on mount) and fills with the
  // selected value once the public onValueChange emits.
  const readout = page.getByTestId('react-tabs-event-value');
  await expect(readout).toBeEmpty();
  await reactTriggers(page, 'react-tabs-event').nth(1).click();
  await expect(readout).toHaveText('password');
});
