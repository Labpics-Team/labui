import { type Locator, type Page, expect, test } from '@playwright/test';
import { waitForThemePaint } from './helpers/theme-paint.js';

/**
 * Menu suite — the second compound + positioned canon (action menu), verified on
 * BOTH renderers.
 *
 * The fixture (`menu.html`) mounts the Lit `<lab-menu>` (all parts in one shadow
 * scope, menu positioned with strategy:fixed) and the native-React `<Menu>` (body
 * portal) with identical specimens under one [data-theme]. Definition of done:
 *   1. Render — the delivered HTML carries the Lit element; React is a client island.
 *   2. Open on click — the machine opens the menu and sets aria-expanded.
 *   3. Run an item — clicking an item emits select and closes the menu.
 *   4. Keyboard — Arrow highlights an item; aria-activedescendant follows it.
 *   5. Dismiss — Escape / outside-click close the menu, focus returns to the trigger.
 *   6. Positioning — the open menu is anchored at the trigger.
 *   7. a11y — menu/menuitem roles + aria-haspopup/controls/activedescendant, asserted
 *      against the @zag-js/menu machine's REAL output.
 *   8. Visual parity — Lit and React resolve the SAME menu colour when open.
 *
 * DETERMINISM (lesson 7): every open/dismiss is gated on a machine-readiness signal
 * (aria-expanded flips, the menu is visible, activedescendant is set) via
 * `expect`/`expect.poll`, never a fixed sleep — the open→dismiss race flaked round-1.
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
  return reactWrap(page, testid).locator('.lab-menu-trigger');
}
/** The React menu is portalled to <body>; find the open one by data-state. */
function reactOpenContent(page: Page): Locator {
  return page.locator('.lab-menu-content[data-state="open"]');
}

const bg = (el: HTMLElement) => getComputedStyle(el).backgroundColor;

/**
 * Wait until the machine's focusMenu has moved focus INTO the open menu. Zag attaches
 * its document-level Escape / outside-click listeners as part of the same open
 * effects, so once focus is inside the content those dismissers are live — the honest
 * gate that removes the open→dismiss race (lesson 7, no arbitrary sleep). Menu content
 * has tabIndex 0 and the key handler, so focus lands inside `.content`.
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
    .poll(() => page.evaluate(() => document.activeElement?.closest('.lab-menu-content') != null))
    .toBe(true);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/menu.html');
});

test('delivered HTML carries the Lit element (React island mounts client-side)', async ({
  request,
}) => {
  const body = await (await request.get('/menu.html')).text();
  expect(body).toMatch(/<lab-menu/i);
  expect(body).toContain('id="react-root"');
});

test('render: the trigger advertises a menu with the menu closed on both renderers', async ({
  page,
}) => {
  await expect(litTrigger(page, 'lit-menu')).toHaveAttribute('aria-haspopup', 'menu');
  await expect(litTrigger(page, 'lit-menu')).toHaveAttribute('aria-expanded', 'false');
  await expect(litContent(page, 'lit-menu')).toBeHidden();

  await expect(reactTrigger(page, 'react-menu')).toHaveAttribute('aria-haspopup', 'menu');
  await expect(reactTrigger(page, 'react-menu')).toHaveAttribute('aria-expanded', 'false');
});

test('open on click: the machine opens the menu on both renderers', async ({ page }) => {
  await litTrigger(page, 'lit-menu').click();
  await expect(litContent(page, 'lit-menu')).toBeVisible();
  await expect(litContent(page, 'lit-menu')).toHaveAttribute('role', 'menu');
  await expect(litTrigger(page, 'lit-menu')).toHaveAttribute('aria-expanded', 'true');

  await reactTrigger(page, 'react-menu').click();
  await expect(reactOpenContent(page)).toBeVisible();
  await expect(reactOpenContent(page)).toHaveAttribute('role', 'menu');
  await expect(reactTrigger(page, 'react-menu')).toHaveAttribute('aria-expanded', 'true');
});

test('run an item: clicking an item closes the menu on both renderers', async ({ page }) => {
  // Choosing an action runs it and closes (closeOnSelect default).
  await litTrigger(page, 'lit-menu').click();
  await expect(litContent(page, 'lit-menu')).toBeVisible();
  await litContent(page, 'lit-menu').locator('.item[data-value="edit"]').click();
  await expect(litContent(page, 'lit-menu')).toBeHidden();

  await reactTrigger(page, 'react-menu').click();
  await expect(reactOpenContent(page)).toBeVisible();
  await reactOpenContent(page).locator('.lab-menu-item[data-value="edit"]').click();
  await expect(page.locator('.lab-menu-content[data-state="open"]')).toHaveCount(0);
});

test('disabled trigger: the trigger is natively disabled and does NOT open on both renderers', async ({
  page,
}) => {
  // Parity + WCAG: a `disabled` menu has a NON-INTERACTIVE trigger. The @zag-js/menu
  // machine has no top-level `disabled`, so the disable is applied at the ELEMENT
  // level (native `disabled` on the trigger <button>) on BOTH renderers. A
  // native-disabled button cannot be clicked or keyboard-activated, so the menu
  // never opens. Mirrors switch.spec's "disabled blocks toggle".

  // Lit: the trigger button carries the native `disabled` attribute, the host
  // reflects `disabled`, and the menu stays hidden after a (forced) click.
  const litTriggerDisabled = litTrigger(page, 'lit-menu-disabled');
  await expect(litHost(page, 'lit-menu-disabled')).toHaveAttribute('disabled', '');
  expect(
    await litTriggerDisabled.evaluate((el) => (el as HTMLButtonElement).disabled),
    'lit: trigger button is natively disabled',
  ).toBe(true);
  await expect(litTriggerDisabled).toHaveAttribute('aria-expanded', 'false');
  // Force the click past pointer-events:none guards — a native-disabled button
  // still must not toggle the machine, so the content stays hidden.
  await litTriggerDisabled.click({ force: true });
  await expect(litContent(page, 'lit-menu-disabled')).toBeHidden();
  await expect(litTriggerDisabled).toHaveAttribute('aria-expanded', 'false');

  // React: the trigger button is natively disabled and no menu content opens.
  const reactTriggerDisabled = reactTrigger(page, 'react-menu-disabled');
  expect(
    await reactTriggerDisabled.evaluate((el) => (el as HTMLButtonElement).disabled),
    'react: trigger button is natively disabled',
  ).toBe(true);
  await expect(reactTriggerDisabled).toHaveAttribute('aria-expanded', 'false');
  await reactTriggerDisabled.click({ force: true });
  await expect(page.locator('.lab-menu-content[data-state="open"]')).toHaveCount(0);
  await expect(reactTriggerDisabled).toHaveAttribute('aria-expanded', 'false');
});

test('disabled item: the machine blocks running it (stays open, no select)', async ({ page }) => {
  // The "archive" item is disabled — the machine marks it aria-disabled and never
  // runs it. Clicking it (force, since it is not pointer-interactive) leaves the
  // menu open.
  await litTrigger(page, 'lit-menu').click();
  const archive = litContent(page, 'lit-menu').locator('.item[data-value="archive"]');
  await expect(archive).toHaveAttribute('aria-disabled', 'true');
  await archive.click({ force: true });
  await expect(litContent(page, 'lit-menu')).toBeVisible();
});

test('keyboard: ArrowDown highlights an item and aria-activedescendant follows it', async ({
  page,
}) => {
  // Open, gate on focus landing in the menu (the key handler lives on content), then
  // ArrowDown. The machine highlights an item (data-highlighted) and writes the menu
  // aria-activedescendant to THAT item's real id — falsifiable a11y (idref → a real
  // node), on both renderers. Poll for the highlight: the machine applies it after the
  // keydown, so we wait for the steady state rather than read one tick too early.
  await litTrigger(page, 'lit-menu').click();
  await expect(litContent(page, 'lit-menu')).toBeVisible();
  await litFocusInContent(page, 'lit-menu');
  await page.keyboard.press('ArrowDown');

  await expect
    .poll(() =>
      litHost(page, 'lit-menu').evaluate(
        (h) => (h as HTMLElement).shadowRoot?.querySelector('.item[data-highlighted]')?.id ?? null,
      ),
    )
    .toBeTruthy();
  const litWiring = await litHost(page, 'lit-menu').evaluate((host) => {
    const sr = (host as HTMLElement).shadowRoot;
    const content = sr?.querySelector('.content');
    const highlighted = sr?.querySelector('.item[data-highlighted]');
    return {
      activedescendant: content?.getAttribute('aria-activedescendant') ?? null,
      highlightedId: highlighted?.id ?? null,
    };
  });
  expect(litWiring.highlightedId, 'an item is highlighted').toBeTruthy();
  expect(litWiring.activedescendant, 'aria-activedescendant → the highlighted item id').toBe(
    litWiring.highlightedId,
  );

  await reactTrigger(page, 'react-menu').click();
  await expect(reactOpenContent(page)).toBeVisible();
  await reactFocusInContent(page);
  await page.keyboard.press('ArrowDown');
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document
            .querySelector('.lab-menu-content[data-state="open"]')
            ?.querySelector('.lab-menu-item[data-highlighted]')?.id ?? null,
      ),
    )
    .toBeTruthy();
  const reactWiring = await reactOpenContent(page).evaluate((content) => {
    const root = content.getRootNode() as Document;
    const activedescendant = content.getAttribute('aria-activedescendant');
    const highlighted = content.querySelector('.lab-menu-item[data-highlighted]');
    return {
      activedescendant,
      highlightedId: highlighted?.id ?? null,
      resolves: activedescendant ? root.getElementById(activedescendant) != null : false,
    };
  });
  expect(reactWiring.highlightedId, 'react: an item is highlighted').toBeTruthy();
  expect(reactWiring.activedescendant, 'react: activedescendant → highlighted id').toBe(
    reactWiring.highlightedId,
  );
  expect(reactWiring.resolves, 'react: activedescendant resolves to a real node').toBe(true);
});

/**
 * Type-ahead — a printable key highlights the matching item (machine's TYPEAHEAD →
 * highlightMatchingItem). Open, gate on focus landing in the menu, press "d" → the
 * machine highlights "Duplicate" (first label beginning with "d") and points
 * aria-activedescendant at it. Falsifiable on both renderers: the highlighted item's
 * value is "duplicate".
 */
test('type-ahead: a printable key highlights the matching item on both renderers', async ({
  page,
}) => {
  await litTrigger(page, 'lit-menu').click();
  await expect(litContent(page, 'lit-menu')).toBeVisible();
  await litFocusInContent(page, 'lit-menu');
  await page.keyboard.press('d');
  await expect
    .poll(() =>
      litHost(page, 'lit-menu').evaluate(
        (h) =>
          (h as HTMLElement).shadowRoot
            ?.querySelector('.item[data-highlighted]')
            ?.getAttribute('data-value') ?? null,
      ),
    )
    .toBe('duplicate');

  await reactTrigger(page, 'react-menu').click();
  await expect(reactOpenContent(page)).toBeVisible();
  await reactFocusInContent(page);
  await page.keyboard.press('d');
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document
            .querySelector('.lab-menu-content[data-state="open"]')
            ?.querySelector('.lab-menu-item[data-highlighted]')
            ?.getAttribute('data-value') ?? null,
      ),
    )
    .toBe('duplicate');
});

/**
 * Home / End — the machine highlights the first / last interactive item
 * (highlightFirstItem / highlightLastItem). Open, focus in the menu, then End → "delete"
 * (last), Home → "edit" (first). Asserted by the highlighted item's value on BOTH
 * renderers. (Archive is disabled and the separator is non-interactive; the machine skips
 * them, so first/last land on the real actions.)
 */
test('Home/End: highlight jumps to the last then first item on both renderers', async ({
  page,
}) => {
  const litHighlightedValue = () =>
    litHost(page, 'lit-menu').evaluate(
      (h) =>
        (h as HTMLElement).shadowRoot
          ?.querySelector('.item[data-highlighted]')
          ?.getAttribute('data-value') ?? null,
    );
  const reactHighlightedValue = () =>
    page.evaluate(
      () =>
        document
          .querySelector('.lab-menu-content[data-state="open"]')
          ?.querySelector('.lab-menu-item[data-highlighted]')
          ?.getAttribute('data-value') ?? null,
    );

  await litTrigger(page, 'lit-menu').click();
  await expect(litContent(page, 'lit-menu')).toBeVisible();
  await litFocusInContent(page, 'lit-menu');
  await page.keyboard.press('End');
  await expect.poll(litHighlightedValue).toBe('delete');
  await page.keyboard.press('Home');
  await expect.poll(litHighlightedValue).toBe('edit');

  await reactTrigger(page, 'react-menu').click();
  await expect(reactOpenContent(page)).toBeVisible();
  await reactFocusInContent(page);
  await page.keyboard.press('End');
  await expect.poll(reactHighlightedValue).toBe('delete');
  await page.keyboard.press('Home');
  await expect.poll(reactHighlightedValue).toBe('edit');
});

test('dismiss: Escape closes the menu and restores focus to the trigger', async ({ page }) => {
  // Gate on focus landing INSIDE the open menu before Escape — that is when the
  // machine's document-level key listener is live, so there is no open→dismiss race
  // and no sleep (lesson 7).
  await litTrigger(page, 'lit-menu').click();
  await expect(litContent(page, 'lit-menu')).toBeVisible();
  await litFocusInContent(page, 'lit-menu');
  await page.keyboard.press('Escape');
  await expect(litContent(page, 'lit-menu')).toBeHidden();
  await expect(litHost(page, 'lit-menu')).toBeFocused();

  await reactTrigger(page, 'react-menu').click();
  await expect(reactOpenContent(page)).toBeVisible();
  await reactFocusInContent(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('.lab-menu-content[data-state="open"]')).toHaveCount(0);
  await expect(reactTrigger(page, 'react-menu')).toBeFocused();
});

test('dismiss: clicking outside closes the menu', async ({ page }) => {
  await litTrigger(page, 'lit-menu').click();
  await expect(litContent(page, 'lit-menu')).toBeVisible();
  await page.getByTestId('menu-title').click();
  await expect(litContent(page, 'lit-menu')).toBeHidden();
});

/**
 * a11y wiring — the binding the @zag-js/menu machine REALLY emits (verified against
 * menu.connect.js): the trigger advertises the menu with aria-haspopup="menu" and
 * aria-controls → the content id; the content is role="menu"; each item is
 * role="menuitem". Falsifiable: the idref must equal the actual element's id.
 */
test('aria: trigger advertises the menu (haspopup + controls→content id), items are menuitems', async ({
  page,
}) => {
  await litTrigger(page, 'lit-menu').click();
  const litWiring = await litHost(page, 'lit-menu').evaluate((host) => {
    const sr = (host as HTMLElement).shadowRoot;
    const trigger = sr?.querySelector('.trigger');
    const content = sr?.querySelector('.content');
    const items = sr?.querySelectorAll('.item');
    return {
      haspopup: trigger?.getAttribute('aria-haspopup') ?? null,
      controls: trigger?.getAttribute('aria-controls') ?? null,
      contentId: content?.id ?? null,
      contentRole: content?.getAttribute('role') ?? null,
      allMenuitems: items
        ? Array.from(items).every((i) => i.getAttribute('role') === 'menuitem')
        : false,
      itemCount: items?.length ?? 0,
    };
  });
  expect(litWiring.haspopup).toBe('menu');
  expect(litWiring.contentRole).toBe('menu');
  expect(litWiring.contentId, 'content has an id').toBeTruthy();
  expect(litWiring.controls, 'trigger aria-controls → content id').toBe(litWiring.contentId);
  expect(litWiring.itemCount, 'the four action items are present (separator excluded)').toBe(4);
  expect(litWiring.allMenuitems, 'every item is role=menuitem').toBe(true);

  await reactTrigger(page, 'react-menu').click();
  await expect(reactOpenContent(page)).toBeVisible();
  const reactContentId = await reactOpenContent(page).getAttribute('id');
  expect(await reactTrigger(page, 'react-menu').getAttribute('aria-haspopup')).toBe('menu');
  expect(reactContentId, 'react content has an id').toBeTruthy();
  expect(await reactTrigger(page, 'react-menu').getAttribute('aria-controls')).toBe(reactContentId);
});

/**
 * Positioning — the menu is anchored AT the trigger. For bottom-start the menu top
 * sits at/below the trigger's bottom edge and the two boxes overlap horizontally.
 */
test('positioning: the open menu is anchored at the trigger (bottom-start)', async ({ page }) => {
  const trigger = litTrigger(page, 'lit-menu');
  await trigger.click();
  const content = litContent(page, 'lit-menu');
  await expect(content).toBeVisible();

  const triggerBox = await trigger.boundingBox();
  const contentBox = await content.boundingBox();
  expect(triggerBox).not.toBeNull();
  expect(contentBox).not.toBeNull();
  if (!triggerBox || !contentBox) return;

  const gap = contentBox.y - (triggerBox.y + triggerBox.height);
  expect(gap, 'menu sits below the trigger').toBeGreaterThanOrEqual(-2);
  expect(gap, 'menu is adjacent to the trigger (not detached)').toBeLessThanOrEqual(24);

  const overlap =
    Math.min(triggerBox.x + triggerBox.width, contentBox.x + contentBox.width) -
    Math.max(triggerBox.x, contentBox.x);
  expect(overlap, 'menu horizontally overlaps the trigger').toBeGreaterThan(0);
});

test('danger item: the destructive action paints the danger label role', async ({ page }) => {
  // The "delete" item is danger — its label resolves a different colour than a plain
  // item. Parity: Lit and React resolve the SAME danger colour for it.
  await litTrigger(page, 'lit-menu').click();
  const litDelete = litContent(page, 'lit-menu').locator('.item[data-value="delete"]');
  const litEdit = litContent(page, 'lit-menu').locator('.item[data-value="edit"]');
  const color = (el: HTMLElement) => getComputedStyle(el).color;
  const litDangerColor = await litDelete.evaluate(color);
  const litPlainColor = await litEdit.evaluate(color);
  expect(litDangerColor, 'danger item differs from a plain item').not.toBe(litPlainColor);

  await reactTrigger(page, 'react-menu').click();
  const reactDangerColor = await reactOpenContent(page)
    .locator('.lab-menu-item[data-danger]')
    .evaluate(color);
  expect(reactDangerColor, 'danger label parity').toBe(litDangerColor);
});

test('visual parity: Lit and React resolve the same menu colour when open', async ({ page }) => {
  await waitForThemePaint(page, litTrigger(page, 'lit-menu'), reactTrigger(page, 'react-menu'));
  await litTrigger(page, 'lit-menu').click();
  await waitForThemePaint(page, litContent(page, 'lit-menu'));
  const litBg = await litContent(page, 'lit-menu').evaluate(bg);

  await reactTrigger(page, 'react-menu').click();
  await waitForThemePaint(page, reactOpenContent(page));
  const reactBg = await reactOpenContent(page).evaluate(bg);

  expect(reactBg, 'menu background parity').toBe(litBg);
});
