import { type Locator, type Page, expect, test } from '@playwright/test';

/**
 * Accordion suite — a COMPOUND component that consumes the @zag-js/accordion GROUP
 * machine through the LabUI seam, verified on BOTH renderers.
 *
 * The fixture (`accordion.html`) mounts the Lit `<lab-accordion>` and the
 * native-React `<Accordion>` with identical specimens under one [data-theme].
 *
 * a11y assertions below assert ONLY what `@zag-js/accordion@1.41.2`'s connect
 * actually emits (verified against accordion.connect.js):
 *   - itemTrigger: a real <button>, `aria-expanded` (bool), `aria-controls` → the
 *     content id, `data-state` open/closed, `disabled` on disabled items.
 *   - itemContent: `role="region"`, `aria-labelledby` → the trigger id, `hidden`
 *     when closed, `data-state`.
 *   - keyboard: ArrowDown/Up (vertical) move focus across enabled headers, and
 *     Home/End jump focus to the first/last enabled header; the machine moves FOCUS
 *     (it does not auto-open — accordion is click/Enter to open).
 *   - disclosure axes: `multiple` (many panels open at once) and `collapsible` (a
 *     single open panel can close back to none) are asserted on dedicated specimens,
 *     each with three ENABLED headers so Home/End land on genuine first/last triggers.
 * Nothing the machine does not give is asserted (honesty — same discipline as Tabs).
 */

function litHost(page: Page, testid: string): Locator {
  return page.getByTestId(testid);
}
function litTriggers(page: Page, testid: string): Locator {
  return litHost(page, testid).locator('.trigger');
}
function reactTriggers(page: Page, testid: string): Locator {
  return page.getByTestId(testid).locator('.lab-accordion-trigger');
}
function litContents(page: Page, testid: string): Locator {
  return litHost(page, testid).locator('.content');
}
function reactContents(page: Page, testid: string): Locator {
  return page.getByTestId(testid).locator('.lab-accordion-content');
}

const labelColor = (el: HTMLElement) => getComputedStyle(el).color;

test.beforeEach(async ({ page }) => {
  await page.goto('/accordion.html');
});

test('delivered HTML carries the Lit element (React island mounts client-side)', async ({
  request,
}) => {
  const body = await (await request.get('/accordion.html')).text();
  expect(body).toMatch(/<lab-accordion/i);
  expect(body).toContain('id="react-root"');
});

test('render: both renderers expose three headers as real buttons', async ({ page }) => {
  await expect(litHost(page, 'lit-accordion')).toBeVisible();
  await expect(litTriggers(page, 'lit-accordion')).toHaveCount(3);
  await expect(reactTriggers(page, 'react-accordion')).toHaveCount(3);
  // Triggers are real <button>s (the machine uses normalize.button).
  for (const trigger of [
    litTriggers(page, 'lit-accordion').first(),
    reactTriggers(page, 'react-accordion').first(),
  ]) {
    expect(await trigger.evaluate((el) => el.tagName.toLowerCase())).toBe('button');
  }
});

test('machine behaviour: clicking a header toggles its panel on both renderers', async ({
  page,
}) => {
  // Default open is the first panel (what).
  const litT = litTriggers(page, 'lit-accordion');
  const litC = litContents(page, 'lit-accordion');
  await expect(litT.nth(0)).toHaveAttribute('aria-expanded', 'true');
  await expect(litC.nth(0)).toBeVisible();

  // Open the second (single mode: opening it closes the first).
  await litT.nth(1).click();
  await expect(litT.nth(1)).toHaveAttribute('aria-expanded', 'true');
  await expect(litT.nth(0)).toHaveAttribute('aria-expanded', 'false');
  await expect(litC.nth(1)).toBeVisible();
  await expect(litC.nth(0)).toBeHidden();

  const reactT = reactTriggers(page, 'react-accordion');
  const reactC = reactContents(page, 'react-accordion');
  await expect(reactT.nth(0)).toHaveAttribute('aria-expanded', 'true');
  await reactT.nth(1).click();
  await expect(reactT.nth(1)).toHaveAttribute('aria-expanded', 'true');
  await expect(reactT.nth(0)).toHaveAttribute('aria-expanded', 'false');
  await expect(reactC.nth(1)).toBeVisible();
  await expect(reactC.nth(0)).toBeHidden();
});

test('aria wiring: trigger aria-controls == its panel id; panel labelled by trigger', async ({
  page,
}) => {
  for (const testid of ['lit-accordion', 'react-accordion']) {
    const triggers =
      testid === 'lit-accordion' ? litTriggers(page, testid) : reactTriggers(page, testid);
    const contents =
      testid === 'lit-accordion' ? litContents(page, testid) : reactContents(page, testid);

    const trigger = triggers.nth(0);
    const panel = contents.nth(0);

    // The machine sets aria-controls on every trigger → its content id.
    const controls = await trigger.getAttribute('aria-controls');
    expect(controls).toBeTruthy();
    expect(await panel.getAttribute('id')).toBe(controls);

    // Every panel is a region labelled by its trigger.
    await expect(panel).toHaveAttribute('role', 'region');
    const triggerId = await trigger.getAttribute('id');
    expect(triggerId).toBeTruthy();
    expect(await panel.getAttribute('aria-labelledby')).toBe(triggerId);
  }
});

test('closed panels are hidden via the machine [hidden] (both renderers)', async ({ page }) => {
  // Default open = first; the second and third start closed and hidden.
  const litC = litContents(page, 'lit-accordion');
  await expect(litC.nth(1)).toHaveAttribute('hidden', /.*/);
  await expect(litC.nth(1)).toBeHidden();

  const reactC = reactContents(page, 'react-accordion');
  await expect(reactC.nth(1)).toBeHidden();
});

test('keyboard: ArrowDown moves header focus via the machine (vertical, both renderers)', async ({
  page,
}) => {
  // Zag accordion keyMap: ArrowDown → GOTO.NEXT in vertical orientation. The
  // machine moves FOCUS across enabled headers (it does not auto-open). The third
  // header (ssr) is disabled, so focus stops at the second.
  for (const testid of ['lit-accordion', 'react-accordion']) {
    const triggers =
      testid === 'lit-accordion' ? litTriggers(page, testid) : reactTriggers(page, testid);
    await triggers.nth(0).focus();
    await page.keyboard.press('ArrowDown');
    await expect(triggers.nth(1)).toBeFocused();
  }
});

test('multiple: opening a 2nd panel keeps the 1st open (both renderers)', async ({ page }) => {
  // The `multiple` specimen lets many panels stay open at once. The machine owns
  // this axis — opening the second header must NOT close the first (the single-mode
  // suite above asserts the opposite for the default specimen, so this is the real
  // proof the axis is wired, not assumed).
  for (const testid of ['lit-accordion-multiple', 'react-accordion-multiple']) {
    const triggers =
      testid === 'lit-accordion-multiple' ? litTriggers(page, testid) : reactTriggers(page, testid);

    // First panel opens by default (default-value="one").
    await expect(triggers.nth(0)).toHaveAttribute('aria-expanded', 'true');

    // Open the second — in multi mode the first stays open.
    await triggers.nth(1).click();
    await expect(triggers.nth(1)).toHaveAttribute('aria-expanded', 'true');
    await expect(triggers.nth(0)).toHaveAttribute('aria-expanded', 'true');
  }
});

test('collapsible: a single open panel can close back to none (both renderers)', async ({
  page,
}) => {
  // The `collapsible` specimen is single-mode but allows the one open panel to
  // close to nothing. Clicking the already-open header must collapse it — the
  // machine's collapsible axis. (The default single specimen is NOT collapsible:
  // re-clicking its open header is a no-op there, so this proves the axis.)
  for (const testid of ['lit-accordion-collapsible', 'react-accordion-collapsible']) {
    const triggers =
      testid === 'lit-accordion-collapsible'
        ? litTriggers(page, testid)
        : reactTriggers(page, testid);

    // First panel opens by default; click its header to collapse to none.
    await expect(triggers.nth(0)).toHaveAttribute('aria-expanded', 'true');
    await triggers.nth(0).click();
    await expect(triggers.nth(0)).toHaveAttribute('aria-expanded', 'false');
  }
});

test('keyboard: Home/End focus the first/last header via the machine (both renderers)', async ({
  page,
}) => {
  // Zag accordion keyMap: Home → GOTO.FIRST, End → GOTO.LAST. The machine moves
  // FOCUS across the enabled headers (it does not auto-open). The multiple specimen
  // has three ENABLED headers, so End lands on the genuine last trigger and Home on
  // the first — no disabled item skews the endpoints.
  for (const testid of ['lit-accordion-multiple', 'react-accordion-multiple']) {
    const triggers =
      testid === 'lit-accordion-multiple' ? litTriggers(page, testid) : reactTriggers(page, testid);

    // From the middle header, End focuses the last; Home focuses the first.
    await triggers.nth(1).focus();
    await page.keyboard.press('End');
    await expect(triggers.nth(2)).toBeFocused();

    await page.keyboard.press('Home');
    await expect(triggers.nth(0)).toBeFocused();
  }
});

test('disabled: a disabled header does not open on either renderer', async ({ page }) => {
  // The third header (ssr) is disabled.
  const litSsr = litTriggers(page, 'lit-accordion').nth(2);
  await expect(litSsr).toBeDisabled();
  await litSsr.click({ force: true });
  await expect(litSsr).toHaveAttribute('aria-expanded', 'false');

  const reactSsr = reactTriggers(page, 'react-accordion').nth(2);
  await expect(reactSsr).toBeDisabled();
  await reactSsr.click({ force: true });
  await expect(reactSsr).toHaveAttribute('aria-expanded', 'false');
});

test('visual parity: Lit and React resolve the same open-header label colour', async ({ page }) => {
  const litOpen = litTriggers(page, 'lit-accordion').nth(0);
  const reactOpen = reactTriggers(page, 'react-accordion').nth(0);
  await expect(litOpen).toHaveAttribute('data-state', 'open');
  await expect(reactOpen).toHaveAttribute('data-state', 'open');
  expect(await reactOpen.evaluate(labelColor)).toBe(await litOpen.evaluate(labelColor));
});

test('tokens: re-pointing --lab-label-accent re-skins BOTH open headers', async ({ page }) => {
  const litOpen = litTriggers(page, 'lit-accordion').nth(0);
  const reactOpen = reactTriggers(page, 'react-accordion').nth(0);

  await page.evaluate(() => {
    document.documentElement.style.setProperty('--lab-label-accent', 'rgb(1, 2, 3)');
  });
  await expect.poll(() => litOpen.evaluate(labelColor)).toBe('rgb(1, 2, 3)');
  await expect.poll(() => reactOpen.evaluate(labelColor)).toBe('rgb(1, 2, 3)');
});

test('theme: flipping [data-theme] re-skins both renderers with zero edits', async ({ page }) => {
  const litOpen = litTriggers(page, 'lit-accordion').nth(0);
  const reactOpen = reactTriggers(page, 'react-accordion').nth(0);

  const litDark = await litOpen.evaluate(labelColor);
  const reactDark = await reactOpen.evaluate(labelColor);

  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));

  await expect.poll(() => litOpen.evaluate(labelColor)).not.toBe(litDark);
  await expect.poll(() => reactOpen.evaluate(labelColor)).not.toBe(reactDark);
});
