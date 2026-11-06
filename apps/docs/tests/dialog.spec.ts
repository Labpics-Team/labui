import { type Locator, type Page, expect, test } from '@playwright/test';
import { modalFocus } from './helpers/modal-focus.js';

/**
 * Dialog suite — the first TRUE modal overlay, verified on BOTH renderers.
 *
 * The fixture (`dialog.html`) mounts the Lit `<lab-dialog>` and the native-React
 * `<Dialog>` with identical specimens under one [data-theme]. The dialog's browser-side
 * definition of done:
 *   1. Render — the delivered HTML carries the Lit element; React is a client island.
 *   2. Open on click — the Zag machine opens the dialog and sets aria-expanded.
 *   3. role + aria-modal — the machine renders role="dialog" + aria-modal="true".
 *   4. aria wiring — aria-labelledby → heading id, aria-describedby → description id.
 *   5. Escape dismiss + focus restore — Escape closes and focus returns to the trigger.
 *   6. Outside-click dismiss — clicking the scrim closes a modal dialog.
 *   7. Scroll-lock — body overflow:hidden while a modal dialog is open.
 *   8. REAL focus trap — Tab cycles WITHIN the dialog and the SLOTTED body focusables
 *      доступны через нативные слоты без переноса потребительского DOM.
 *   9. Visual parity — Lit and React resolve the SAME panel colour when open.
 *
 * Determinism: every dismiss is gated on the machine having moved focus INTO the dialog
 * (the same effect that arms Zag's document-level Escape / outside-click listeners), so
 * there is no open→dismiss race and no arbitrary sleep.
 */

const PORTAL = (testid: string) => `[data-portal-for="${testid}"]`;

function litHost(page: Page, testid: string): Locator {
  return page.getByTestId(testid);
}
/** Floating content находится в shadow root поверхности LabModal. */
function litContent(page: Page, testid: string): Locator {
  return page.locator(PORTAL(testid)).locator('.content');
}
function litBackdrop(page: Page, testid: string): Locator {
  return page.locator(PORTAL(testid)).locator('.backdrop');
}
function litTrigger(page: Page, testid: string): Locator {
  return litHost(page, testid).locator('.trigger');
}
function reactWrap(page: Page, testid: string): Locator {
  return page.getByTestId(testid);
}
function reactTrigger(page: Page, testid: string): Locator {
  return reactWrap(page, testid).locator('.lab-dialog-trigger');
}
function reactOpenContent(page: Page): Locator {
  return page.locator('.lab-dialog-content[data-state="open"]');
}

const bg = (el: HTMLElement) => getComputedStyle(el).backgroundColor;

/**
 * Wait until the machine's focus management has moved focus INTO the open dialog. Zag
 * attaches its document-level Escape / outside-click listeners as part of the same open
 * effects, so once focus is inside the panel those dismissers are live — the honest gate
 * that removes the open→dismiss race (no arbitrary sleep). The Lit content lives in the
 * portal host's shadow root; its activeElement sits inside .content.
 */
async function litFocusInDialog(page: Page, testid: string): Promise<void> {
  await expect
    .poll(() =>
      page
        .locator(PORTAL(testid))
        .evaluate(modalFocus)
        .then((focus) => focus.inside),
    )
    .toBe(true);
}
async function reactFocusInDialog(page: Page): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => document.activeElement?.closest('.lab-dialog-content') != null))
    .toBe(true);
}

/**
 * Close an open Lit modal dialog before driving the OTHER renderer. A modal locks the
 * page (body { pointer-events: none }) and its full-viewport scrim/positioner overlay
 * intercepts pointer events over the React trigger, so a cross-renderer test MUST
 * dismiss the first modal before clicking the second. This mirrors the popover suite's
 * close-first step (popover.spec.ts) and removes a race the same honest way: gate on
 * focus having moved into the dialog (which arms Zag's Escape listener), press Escape,
 * then assert the content + scrim are gone — no arbitrary sleep.
 */
async function closeLitModal(page: Page, testid: string): Promise<void> {
  await litFocusInDialog(page, testid);
  await page.keyboard.press('Escape');
  await expect(litContent(page, testid)).toBeHidden();
  await expect(litBackdrop(page, testid)).toBeHidden();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/dialog.html');
});

test('delivered HTML carries the Lit element (React island mounts client-side)', async ({
  request,
}) => {
  const body = await (await request.get('/dialog.html')).text();
  expect(body).toMatch(/<lab-dialog/i);
  expect(body).toContain('id="react-root"');
});

test('open on click: the Zag machine opens the dialog on both renderers', async ({ page }) => {
  // Lit.
  const lit = litContent(page, 'lit-dialog');
  await expect(lit).toBeHidden();
  await litTrigger(page, 'lit-dialog').click();
  await expect(lit).toBeVisible();
  await expect(lit).toHaveAttribute('role', 'dialog');
  await expect(litTrigger(page, 'lit-dialog')).toHaveAttribute('aria-expanded', 'true');

  // Close the Lit modal before the React renderer (its scrim would block the click).
  await closeLitModal(page, 'lit-dialog');

  // React.
  await reactTrigger(page, 'react-dialog').click();
  await expect(reactOpenContent(page)).toBeVisible();
  await expect(reactOpenContent(page)).toHaveAttribute('role', 'dialog');
  await expect(reactTrigger(page, 'react-dialog')).toHaveAttribute('aria-expanded', 'true');
});

test('aria-modal: present + true on the open modal dialog (both renderers)', async ({ page }) => {
  await litTrigger(page, 'lit-dialog').click();
  await expect(litContent(page, 'lit-dialog')).toBeVisible();
  await expect(litContent(page, 'lit-dialog')).toHaveAttribute('aria-modal', 'true');

  // Close the Lit modal before the React renderer (its scrim would block the click).
  await closeLitModal(page, 'lit-dialog');

  await reactTrigger(page, 'react-dialog').click();
  await expect(reactOpenContent(page)).toHaveAttribute('aria-modal', 'true');
});

/**
 * ARIA wiring — the binding the @zag-js/dialog machine REALLY emits (verified against
 * dialog.connect.js): the trigger advertises a dialog (aria-haspopup="dialog" +
 * aria-controls → content id); the dialog names itself with aria-labelledby → heading id
 * and describes itself with aria-describedby → description id. The specimens carry BOTH a
 * heading and a description so each idref points at a REAL element. Falsifiable: the idref
 * must equal the actual element's id, not merely be present.
 */
test('aria: trigger advertises the dialog, and labelledby/describedby resolve to real nodes', async ({
  page,
}) => {
  // Lit — trigger in the element shadow root, content/heading/description in the portal.
  await litTrigger(page, 'lit-dialog').click();
  await expect(litContent(page, 'lit-dialog')).toBeVisible();

  const triggerWiring = await litHost(page, 'lit-dialog').evaluate((host) => {
    const sr = host.shadowRoot;
    const trigger = sr?.querySelector('.trigger');
    const portal = sr?.querySelector('.portal-plane');
    const references =
      trigger && 'ariaControlsElements' in trigger ? trigger.ariaControlsElements : null;
    const controls = trigger?.getAttribute('aria-controls') ?? null;
    return {
      haspopup: trigger?.getAttribute('aria-haspopup') ?? null,
      controls,
      portalId: portal?.id ?? null,
      resolves: controls !== null && sr?.getElementById(controls) === portal,
      reflected: Array.isArray(references) && references.includes(portal),
    };
  });
  const contentWiring = await page.locator(PORTAL('lit-dialog')).evaluate((host) => {
    const sr = host.shadowRoot;
    const content = sr?.querySelector('.content');
    const heading = sr?.querySelector('.heading');
    const description = sr?.querySelector('.description');
    return {
      contentId: content?.id ?? null,
      labelledby: content?.getAttribute('aria-labelledby') ?? null,
      describedby: content?.getAttribute('aria-describedby') ?? null,
      headingId: heading?.id ?? null,
      descriptionId: description?.id ?? null,
    };
  });
  expect(triggerWiring.haspopup).toBe('dialog');
  expect(contentWiring.contentId, 'content has an id').toBeTruthy();
  expect(triggerWiring.portalId, 'controlled portal host has an id').toBeTruthy();
  expect(triggerWiring.controls, 'trigger aria-controls → same-root portal container').toBe(
    triggerWiring.portalId,
  );
  expect(triggerWiring.resolves, 'IDREF resolves to the actual controlled container').toBe(true);
  expect(triggerWiring.reflected, 'ARIA property returns the controlled container').toBe(true);
  expect(contentWiring.headingId, 'heading has an id').toBeTruthy();
  expect(contentWiring.descriptionId, 'description has an id').toBeTruthy();
  expect(contentWiring.labelledby, 'aria-labelledby → heading id').toBe(contentWiring.headingId);
  expect(contentWiring.describedby, 'aria-describedby → description id').toBe(
    contentWiring.descriptionId,
  );

  // Close the Lit modal before the React renderer (its scrim would block the click).
  await closeLitModal(page, 'lit-dialog');

  // React — content portalled to <body>.
  await reactTrigger(page, 'react-dialog').click();
  await expect(reactOpenContent(page)).toBeVisible();
  const reactWiring = await reactOpenContent(page).evaluate((content) => {
    const root = content.getRootNode() as Document | ShadowRoot;
    const labelledby = content.getAttribute('aria-labelledby');
    const describedby = content.getAttribute('aria-describedby');
    return {
      labelledby,
      describedby,
      headingResolves: labelledby ? root.getElementById(labelledby) != null : false,
      descriptionResolves: describedby ? root.getElementById(describedby) != null : false,
    };
  });
  expect(reactWiring.labelledby, 'react labelledby present').toBeTruthy();
  expect(reactWiring.headingResolves, 'react labelledby resolves to a real element').toBe(true);
  expect(reactWiring.describedby, 'react describedby present').toBeTruthy();
  expect(reactWiring.descriptionResolves, 'react describedby resolves to a real element').toBe(
    true,
  );
});

test('a11y: Escape dismisses and restores focus to the trigger (keyboard, both renderers)', async ({
  page,
}) => {
  // Lit.
  await litTrigger(page, 'lit-dialog').click();
  await expect(litContent(page, 'lit-dialog')).toBeVisible();
  await litFocusInDialog(page, 'lit-dialog');
  await page.keyboard.press('Escape');
  await expect(litContent(page, 'lit-dialog')).toBeHidden();
  await expect(litHost(page, 'lit-dialog')).toBeFocused();

  // React.
  await reactTrigger(page, 'react-dialog').click();
  await expect(reactOpenContent(page)).toBeVisible();
  await reactFocusInDialog(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('.lab-dialog-content[data-state="open"]')).toHaveCount(0);
  await expect(reactTrigger(page, 'react-dialog')).toBeFocused();
});

test('dismiss: clicking the scrim (outside) closes a modal dialog', async ({ page }) => {
  await litTrigger(page, 'lit-dialog').click();
  await expect(litContent(page, 'lit-dialog')).toBeVisible();
  await litFocusInDialog(page, 'lit-dialog');
  // The backdrop covers the viewport; clicking it is an outside-click for a modal dialog.
  await litBackdrop(page, 'lit-dialog').click({ position: { x: 5, y: 5 } });
  await expect(litContent(page, 'lit-dialog')).toBeHidden();
});

test('scroll-lock: a modal dialog locks body scroll while open (machine)', async ({ page }) => {
  const overflowBefore = await page.evaluate(() => getComputedStyle(document.body).overflow);
  expect(overflowBefore).not.toBe('hidden');

  await litTrigger(page, 'lit-dialog').click();
  await expect(litContent(page, 'lit-dialog')).toBeVisible();
  // @zag-js/remove-scroll sets body { overflow: hidden } for the modal lifetime.
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.body).overflow))
    .toBe('hidden');

  await litFocusInDialog(page, 'lit-dialog');
  await page.keyboard.press('Escape');
  await expect(litContent(page, 'lit-dialog')).toBeHidden();
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.body).overflow))
    .not.toBe('hidden');
});

/**
 * REAL focus trap — the dialog's defining contract, and the inverse of the popover
 * caveat. The dialog RELOCATES the projected
 * slot="content" body into it, so the slotted focusables (a link + an Action button)
 * physically live inside the content subtree Zag's trap walks. Tabbing must therefore:
 *   - keep focus INSIDE the dialog the whole cycle (never escape to the trigger/body);
 *   - actually LAND on the slotted Action button (proof the body is trapped, not just
 *     the shadow-rendered close button as in the popover).
 */
test('focus-trap: Tab stays inside the dialog AND reaches the slotted body (Lit, real trap)', async ({
  page,
}) => {
  await litTrigger(page, 'lit-dialog').click();
  await expect(litContent(page, 'lit-dialog')).toBeVisible();
  await litFocusInDialog(page, 'lit-dialog');

  let reachedSlottedAction = false;
  // Tab остаётся в панели и достигает действия в потребительском content slot.
  for (let i = 0; i < 8; i++) {
    const probe = await page.locator(PORTAL('lit-dialog')).evaluate(modalFocus);
    expect(probe.inside, `Tab #${i}: focus stays inside the dialog`).toBe(true);
    if (probe.testId === 'lit-dialog-action') reachedSlottedAction = true;
    await page.keyboard.press('Tab');
  }
  expect(reachedSlottedAction, 'the slotted Action button IS inside the focus-trap').toBe(true);
});

test('focus-trap: Tab stays inside the dialog AND reaches the slotted body (React, real trap)', async ({
  page,
}) => {
  await reactTrigger(page, 'react-dialog').click();
  await expect(reactOpenContent(page)).toBeVisible();
  await reactFocusInDialog(page);

  let reachedSlottedAction = false;
  for (let i = 0; i < 8; i++) {
    const probe = await page.evaluate(() => {
      const active = document.activeElement as HTMLElement | null;
      return {
        inContent: active?.closest('.lab-dialog-content') != null,
        onAction: active?.getAttribute('data-testid') === 'react-dialog-action',
      };
    });
    expect(probe.inContent, `Tab #${i}: focus stays inside the dialog`).toBe(true);
    if (probe.onAction) reachedSlottedAction = true;
    await page.keyboard.press('Tab');
  }
  expect(reachedSlottedAction, 'the slotted Action button IS inside the focus-trap').toBe(true);
});

test('visual parity: Lit and React resolve the same panel colour when open', async ({ page }) => {
  await litTrigger(page, 'lit-dialog').click();
  await expect(litContent(page, 'lit-dialog')).toBeVisible();
  const litPanelBg = await litContent(page, 'lit-dialog').evaluate(bg);

  // Close the Lit modal before the React renderer (its scrim would block the click).
  await closeLitModal(page, 'lit-dialog');

  await reactTrigger(page, 'react-dialog').click();
  await expect(reactOpenContent(page)).toBeVisible();
  const reactPanelBg = await reactOpenContent(page).evaluate(bg);

  expect(reactPanelBg, 'dialog panel background parity').toBe(litPanelBg);
});
