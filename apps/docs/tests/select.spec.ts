import { type Locator, type Page, expect, test } from '@playwright/test';

/**
 * Select suite — the COMPOUND + POSITIONED canon (keyed-compound group machine ⊕
 * positioned, dismissable overlay), verified on BOTH renderers.
 *
 * The fixture (`select.html`) mounts the Lit `<lab-select>` (all parts in one shadow
 * scope, listbox positioned with strategy:fixed) and the native-React `<Select>`
 * (body portal) with identical specimens under one [data-theme]. These checks are the
 * Select's browser-side definition of done:
 *   1. Render — the delivered HTML carries the Lit element; React is a client island.
 *   2. Open on click — the machine opens the listbox and sets aria-expanded.
 *   3. Selection — clicking an option selects it (single) / accumulates (multiple).
 *   4. Keyboard — Arrow moves the active option; aria-activedescendant follows it.
 *   5. Dismiss — Escape / outside-click close the listbox.
 *   6. Positioning — the open listbox is anchored at the trigger.
 *   7. a11y — combobox/listbox/option roles + aria-selected/activedescendant/
 *      multiselectable, asserted against the @zag-js/select machine's REAL output.
 *   8. Visual parity — Lit and React resolve the SAME listbox colour when open.
 *
 * Playwright's CSS engine pierces open shadow DOM, so `litHost.locator('.trigger')`
 * reaches the Lit shadow parts the same way it reaches the React DOM parts. DETERMINISM
 * (lesson 7): every open/dismiss is gated on a machine-readiness signal (aria-expanded
 * flips, the listbox is visible, activedescendant is set) via `expect`/`expect.poll`,
 * never a fixed sleep — the open→dismiss race is what flaked round-1 overlays.
 */

function litHost(page: Page, testid: string): Locator {
  return page.getByTestId(testid);
}
function litTrigger(page: Page, testid: string): Locator {
  return litHost(page, testid).locator('.trigger');
}
function litContent(page: Page, testid: string): Locator {
  return litHost(page, testid).locator('.content');
}
function reactWrap(page: Page, testid: string): Locator {
  return page.getByTestId(testid);
}
function reactTrigger(page: Page, testid: string): Locator {
  return reactWrap(page, testid).locator('.lab-select-trigger');
}
/** The React listbox is portalled to <body>; find the open one by data-state. */
function reactOpenContent(page: Page): Locator {
  return page.locator('.lab-select-content[data-state="open"]');
}

const bg = (el: HTMLElement) => getComputedStyle(el).backgroundColor;

/**
 * Wait until the machine's setInitialFocus has moved focus INTO the open listbox.
 * Zag attaches its document-level Escape / outside-click listeners as part of the
 * same open effects, so once focus is inside the content those dismissers are live —
 * the honest gate that removes the open→dismiss race (lesson 7, no arbitrary sleep).
 * Select content has tabIndex 0 and the key handler, so focus lands inside `.content`.
 */
async function litFocusInContent(page: Page, testid: string): Promise<void> {
  await expect
    .poll(() =>
      litHost(page, testid).evaluate(
        (h) => (h as HTMLElement).shadowRoot?.activeElement?.closest('.content') != null,
      ),
    )
    .toBe(true);
}
async function reactFocusInContent(page: Page): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => document.activeElement?.closest('.lab-select-content') != null))
    .toBe(true);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/select.html');
});

test('delivered HTML carries the Lit element (React island mounts client-side)', async ({
  request,
}) => {
  const body = await (await request.get('/select.html')).text();
  expect(body).toMatch(/<lab-select/i);
  expect(body).toContain('id="react-root"');
});

test('render: the trigger is a combobox with the listbox closed on both renderers', async ({
  page,
}) => {
  // The combobox role + aria-expanded=false are the machine's output at rest.
  await expect(litTrigger(page, 'lit-select')).toHaveAttribute('role', 'combobox');
  await expect(litTrigger(page, 'lit-select')).toHaveAttribute('aria-expanded', 'false');
  await expect(litContent(page, 'lit-select')).toBeHidden();

  await expect(reactTrigger(page, 'react-select')).toHaveAttribute('role', 'combobox');
  await expect(reactTrigger(page, 'react-select')).toHaveAttribute('aria-expanded', 'false');
});

test('open on click: the machine opens the listbox on both renderers', async ({ page }) => {
  // Lit.
  await litTrigger(page, 'lit-select').click();
  await expect(litContent(page, 'lit-select')).toBeVisible();
  await expect(litContent(page, 'lit-select')).toHaveAttribute('role', 'listbox');
  await expect(litTrigger(page, 'lit-select')).toHaveAttribute('aria-expanded', 'true');

  // React.
  await reactTrigger(page, 'react-select').click();
  await expect(reactOpenContent(page)).toBeVisible();
  await expect(reactOpenContent(page)).toHaveAttribute('role', 'listbox');
  await expect(reactTrigger(page, 'react-select')).toHaveAttribute('aria-expanded', 'true');
});

test('selection (single): clicking an option selects it and closes on both renderers', async ({
  page,
}) => {
  // Lit starts on "banana" (uncontrolled default). Open, pick Cherry → value-change
  // to cherry; the listbox closes (closeOnSelect default) and aria-selected moves.
  await litTrigger(page, 'lit-select').click();
  await expect(litContent(page, 'lit-select')).toBeVisible();
  await litContent(page, 'lit-select').locator('.item[data-value="cherry"]').click();
  await expect(litContent(page, 'lit-select')).toBeHidden();
  // The hidden native <select> mirrors the chosen value (form contract).
  expect(
    await litHost(page, 'lit-select')
      .locator('select')
      .evaluate((el) => (el as HTMLSelectElement).value),
  ).toBe('cherry');

  // React.
  await reactTrigger(page, 'react-select').click();
  await expect(reactOpenContent(page)).toBeVisible();
  await reactOpenContent(page).locator('.lab-select-item[data-value="cherry"]').click();
  await expect(page.locator('.lab-select-content[data-state="open"]')).toHaveCount(0);
  await expect(reactTrigger(page, 'react-select').locator('.lab-select-value-text')).toHaveText(
    'Cherry',
  );
});

test('selection (multiple): the machine accumulates values and stays open', async ({ page }) => {
  // The multiple specimen keeps the listbox open across picks (closeOnSelect is false
  // in multi-mode) and marks each chosen option aria-selected=true.
  await litTrigger(page, 'lit-select-multi').click();
  const content = litContent(page, 'lit-select-multi');
  await expect(content).toBeVisible();
  await content.locator('.item[data-value="apple"]').click();
  await content.locator('.item[data-value="cherry"]').click();
  // Both stay selected; the listbox is still open (multi).
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

test('keyboard: ArrowDown highlights an option and aria-activedescendant follows it', async ({
  page,
}) => {
  // Open, gate on focus landing in the listbox (the key handler lives on content),
  // then ArrowDown. The machine highlights an option (data-highlighted) and writes the
  // listbox aria-activedescendant to THAT option's real id — the falsifiable a11y
  // contract (idref → a real node). Poll for the steady state: the machine moves the
  // highlight after the keydown, and content + option are re-spread separately, so we
  // wait until aria-activedescendant equals the highlighted option id rather than read
  // mid-update (the source of the round-1 one-step desync).
  await litTrigger(page, 'lit-select').click();
  await expect(litContent(page, 'lit-select')).toBeVisible();
  await litFocusInContent(page, 'lit-select');
  await page.keyboard.press('ArrowDown');

  await expect
    .poll(() =>
      litHost(page, 'lit-select').evaluate((host) => {
        const sr = (host as HTMLElement).shadowRoot;
        const ad = sr?.querySelector('.content')?.getAttribute('aria-activedescendant') ?? null;
        const hl = sr?.querySelector('.item[data-highlighted]')?.id ?? null;
        return ad !== null && ad === hl;
      }),
    )
    .toBe(true);
  const litWiring = await litHost(page, 'lit-select').evaluate((host) => {
    const sr = (host as HTMLElement).shadowRoot;
    const content = sr?.querySelector('.content');
    const highlighted = sr?.querySelector('.item[data-highlighted]');
    return {
      activedescendant: content?.getAttribute('aria-activedescendant') ?? null,
      highlightedId: highlighted?.id ?? null,
    };
  });
  expect(litWiring.highlightedId, 'an option is highlighted').toBeTruthy();
  expect(litWiring.activedescendant, 'aria-activedescendant → the highlighted option id').toBe(
    litWiring.highlightedId,
  );

  // React parity.
  await reactTrigger(page, 'react-select').click();
  await expect(reactOpenContent(page)).toBeVisible();
  await reactFocusInContent(page);
  await page.keyboard.press('ArrowDown');
  await expect
    .poll(() =>
      page.evaluate(() => {
        const content = document.querySelector('.lab-select-content[data-state="open"]');
        const ad = content?.getAttribute('aria-activedescendant') ?? null;
        const hl = content?.querySelector('.lab-select-item[data-highlighted]')?.id ?? null;
        return ad !== null && ad === hl;
      }),
    )
    .toBe(true);
  const reactWiring = await reactOpenContent(page).evaluate((content) => {
    const root = content.getRootNode() as Document;
    const activedescendant = content.getAttribute('aria-activedescendant');
    const highlighted = content.querySelector('.lab-select-item[data-highlighted]');
    return {
      activedescendant,
      highlightedId: highlighted?.id ?? null,
      resolves: activedescendant ? root.getElementById(activedescendant) != null : false,
    };
  });
  expect(reactWiring.highlightedId, 'react: an option is highlighted').toBeTruthy();
  expect(reactWiring.activedescendant, 'react: activedescendant → highlighted id').toBe(
    reactWiring.highlightedId,
  );
  expect(reactWiring.resolves, 'react: activedescendant resolves to a real node').toBe(true);
});

test('dismiss: Escape closes the listbox and restores focus to the trigger', async ({ page }) => {
  // Gate on focus landing INSIDE the open listbox before Escape — that is when the
  // machine's document-level key listener is live, so there is no open→dismiss race
  // and no sleep (lesson 7).
  await litTrigger(page, 'lit-select').click();
  await expect(litContent(page, 'lit-select')).toBeVisible();
  await litFocusInContent(page, 'lit-select');
  await page.keyboard.press('Escape');
  await expect(litContent(page, 'lit-select')).toBeHidden();
  await expect(litHost(page, 'lit-select')).toBeFocused();

  await reactTrigger(page, 'react-select').click();
  await expect(reactOpenContent(page)).toBeVisible();
  await reactFocusInContent(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('.lab-select-content[data-state="open"]')).toHaveCount(0);
  await expect(reactTrigger(page, 'react-select')).toBeFocused();
});

test('dismiss: clicking outside closes the listbox', async ({ page }) => {
  await litTrigger(page, 'lit-select').click();
  await expect(litContent(page, 'lit-select')).toBeVisible();
  await page.getByTestId('select-title').click();
  await expect(litContent(page, 'lit-select')).toBeHidden();
});

/**
 * a11y wiring — the binding the @zag-js/select machine REALLY emits (verified against
 * select.connect.js): the trigger is role="combobox" with aria-haspopup="listbox" and
 * aria-controls → the content id; the content is role="listbox" with aria-labelledby →
 * the label id; each option is role="option" with aria-selected. Falsifiable: the
 * idref must equal the actual element's id, not merely "be present".
 */
test('aria: trigger advertises the listbox (combobox + haspopup + controls→content id)', async ({
  page,
}) => {
  await litTrigger(page, 'lit-select').click();
  const litWiring = await litHost(page, 'lit-select').evaluate((host) => {
    const sr = (host as HTMLElement).shadowRoot;
    const trigger = sr?.querySelector('.trigger');
    const content = sr?.querySelector('.content');
    return {
      role: trigger?.getAttribute('role') ?? null,
      haspopup: trigger?.getAttribute('aria-haspopup') ?? null,
      controls: trigger?.getAttribute('aria-controls') ?? null,
      contentId: content?.id ?? null,
      contentRole: content?.getAttribute('role') ?? null,
    };
  });
  expect(litWiring.role).toBe('combobox');
  expect(litWiring.haspopup).toBe('listbox');
  expect(litWiring.contentRole).toBe('listbox');
  expect(litWiring.contentId, 'content has an id').toBeTruthy();
  expect(litWiring.controls, 'trigger aria-controls → content id').toBe(litWiring.contentId);

  await reactTrigger(page, 'react-select').click();
  await expect(reactOpenContent(page)).toBeVisible();
  const reactContentId = await reactOpenContent(page).getAttribute('id');
  expect(await reactTrigger(page, 'react-select').getAttribute('aria-haspopup')).toBe('listbox');
  expect(reactContentId, 'react content has an id').toBeTruthy();
  expect(await reactTrigger(page, 'react-select').getAttribute('aria-controls')).toBe(
    reactContentId,
  );
});

test('aria-multiselectable: present on the multi listbox, absent on the single one', async ({
  page,
}) => {
  // Single: the machine omits aria-multiselectable.
  await litTrigger(page, 'lit-select').click();
  await expect(litContent(page, 'lit-select')).toBeVisible();
  expect(await litContent(page, 'lit-select').getAttribute('aria-multiselectable')).toBeNull();
  await page.keyboard.press('Escape');
  await expect(litContent(page, 'lit-select')).toBeHidden();

  // Multiple: aria-multiselectable="true".
  await litTrigger(page, 'lit-select-multi').click();
  await expect(litContent(page, 'lit-select-multi')).toBeVisible();
  await expect(litContent(page, 'lit-select-multi')).toHaveAttribute(
    'aria-multiselectable',
    'true',
  );

  // React parity (multi specimen).
  await page.keyboard.press('Escape');
  await reactTrigger(page, 'react-select-multi').click();
  await expect(page.locator('.lab-select-content[data-state="open"]')).toHaveAttribute(
    'aria-multiselectable',
    'true',
  );
});

/**
 * Positioning — the listbox is anchored AT the trigger, not merely on-screen. For the
 * default bottom-start placement the listbox top sits at/below the trigger's bottom
 * edge (within a small gap tolerance) and the two boxes overlap horizontally. This
 * catches a surface that rendered visible but detached from its trigger.
 */
test('positioning: the open listbox is anchored at the trigger (bottom-start)', async ({
  page,
}) => {
  const trigger = litTrigger(page, 'lit-select');
  await trigger.click();
  const content = litContent(page, 'lit-select');
  await expect(content).toBeVisible();

  const triggerBox = await trigger.boundingBox();
  const contentBox = await content.boundingBox();
  expect(triggerBox).not.toBeNull();
  expect(contentBox).not.toBeNull();
  if (!triggerBox || !contentBox) return;

  const gap = contentBox.y - (triggerBox.y + triggerBox.height);
  expect(gap, 'listbox sits below the trigger').toBeGreaterThanOrEqual(-2);
  expect(gap, 'listbox is adjacent to the trigger (not detached)').toBeLessThanOrEqual(24);

  const overlap =
    Math.min(triggerBox.x + triggerBox.width, contentBox.x + contentBox.width) -
    Math.max(triggerBox.x, contentBox.x);
  expect(overlap, 'listbox horizontally overlaps the trigger').toBeGreaterThan(0);
});

test('visual parity: Lit and React resolve the same listbox colour when open', async ({ page }) => {
  await litTrigger(page, 'lit-select').click();
  const litBg = await litContent(page, 'lit-select').evaluate(bg);

  await reactTrigger(page, 'react-select').click();
  const reactBg = await reactOpenContent(page).evaluate(bg);

  expect(reactBg, 'select listbox background parity').toBe(litBg);
});
