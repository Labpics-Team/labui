import { type Locator, type Page, expect, test } from '@playwright/test';

/**
 * Popover suite — the first dismissable, focus-managed overlay, verified on BOTH
 * renderers.
 *
 * The fixture (`popover.html`) mounts the Lit `<lab-popover>` and the native-React
 * `<Popover>` with identical specimens under one [data-theme]. These checks are the
 * Popover's browser-side definition of done:
 *   1. Render — the delivered HTML carries the Lit element; React is a client island.
 *   2. Open on click — the Zag machine opens the dialog and sets aria-expanded.
 *   3. Escape dismiss + focus restore — Escape closes and focus returns to trigger.
 *   4. Outside-click dismiss — clicking outside closes the panel.
 *   5. Positioning — the open panel is placed on-screen near the trigger.
 *   6. Modal — the scrim is shown when modal.
 *   7. Visual parity — Lit and React resolve the SAME panel colour when open.
 */

function litHost(page: Page, testid: string): Locator {
  return page.getByTestId(testid);
}
function litContent(page: Page, testid: string): Locator {
  return litHost(page, testid).locator('.content');
}
function litBackdrop(page: Page, testid: string): Locator {
  return litHost(page, testid).locator('.backdrop');
}
function reactTrigger(page: Page, testid: string): Locator {
  return page.getByTestId(testid).locator('.lab-popover-trigger');
}
function reactOpenContent(page: Page): Locator {
  return page.locator('.lab-popover-content[data-state="open"]');
}

const bg = (el: HTMLElement) => getComputedStyle(el).backgroundColor;

/**
 * Wait until the machine's autoFocus has moved focus INTO the open dialog. Zag
 * attaches its document-level Escape/outside-click listeners as part of the same
 * open effects, so once focus is inside the panel those dismissers are live — this
 * is the honest gate that removes the open→dismiss race (no arbitrary sleep).
 */
async function litFocusInDialog(page: Page, testid: string): Promise<void> {
  // Zag's focus trap focuses the first focusable in the content's shadow subtree
  // (the close button, or the content itself); shadowRoot.activeElement then sits
  // inside .content (vs the trigger, which is outside it).
  await expect
    .poll(() =>
      litHost(page, testid).evaluate(
        (h) => (h as HTMLElement).shadowRoot?.activeElement?.closest('.content') != null,
      ),
    )
    .toBe(true);
}
async function reactFocusInDialog(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(() => document.activeElement?.closest('.lab-popover-content') != null),
    )
    .toBe(true);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/popover.html');
});

test('delivered HTML carries the Lit element (React island mounts client-side)', async ({
  request,
}) => {
  const body = await (await request.get('/popover.html')).text();
  expect(body).toMatch(/<lab-popover/i);
  expect(body).toContain('id="react-root"');
});

test('open on click: the Zag machine opens the dialog on both renderers', async ({ page }) => {
  // Lit.
  const lit = litContent(page, 'lit-pop');
  await expect(lit).toBeHidden();
  await litHost(page, 'lit-pop').locator('.trigger').click();
  await expect(lit).toBeVisible();
  await expect(lit).toHaveAttribute('role', 'dialog');
  await expect(litHost(page, 'lit-pop').locator('.trigger')).toHaveAttribute(
    'aria-expanded',
    'true',
  );

  // React.
  await reactTrigger(page, 'react-pop').click();
  await expect(reactOpenContent(page)).toBeVisible();
  await expect(reactTrigger(page, 'react-pop')).toHaveAttribute('aria-expanded', 'true');
});

test('a11y: Escape dismisses and restores focus to the trigger (keyboard)', async ({ page }) => {
  // Lit.
  const litTrigger = litHost(page, 'lit-pop').locator('.trigger');
  await litTrigger.click();
  await expect(litContent(page, 'lit-pop')).toBeVisible();
  await litFocusInDialog(page, 'lit-pop');
  await page.keyboard.press('Escape');
  await expect(litContent(page, 'lit-pop')).toBeHidden();
  await expect(litHost(page, 'lit-pop')).toBeFocused();

  // React.
  await reactTrigger(page, 'react-pop').click();
  await expect(reactOpenContent(page)).toBeVisible();
  await reactFocusInDialog(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('.lab-popover-content[data-state="open"]')).toHaveCount(0);
  await expect(reactTrigger(page, 'react-pop')).toBeFocused();
});

test('dismiss: clicking outside closes the panel', async ({ page }) => {
  await litHost(page, 'lit-pop').locator('.trigger').click();
  await expect(litContent(page, 'lit-pop')).toBeVisible();
  // Click the page title — outside the panel and trigger.
  await page.getByTestId('popover-title').click();
  await expect(litContent(page, 'lit-pop')).toBeHidden();
});

test('positioning: the open panel is placed on-screen near the trigger', async ({ page }) => {
  await litHost(page, 'lit-pop').locator('.trigger').click();
  const content = litContent(page, 'lit-pop');
  await expect(content).toBeVisible();
  const box = await content.boundingBox();
  expect(box).not.toBeNull();
  expect(box?.y ?? -1).toBeGreaterThanOrEqual(0);
  expect(box?.width ?? 0).toBeGreaterThan(0);
});

test('modal: the scrim is shown when modal, on both renderers', async ({ page }) => {
  // Lit modal popover — the scrim covers the viewport while open.
  await litHost(page, 'lit-pop-modal').locator('.trigger').click();
  await expect(litContent(page, 'lit-pop-modal')).toBeVisible();
  await expect(litBackdrop(page, 'lit-pop-modal')).toBeVisible();

  // Close it before testing React, so its full-viewport scrim stops intercepting
  // pointer events over the React trigger.
  await litFocusInDialog(page, 'lit-pop-modal');
  await page.keyboard.press('Escape');
  await expect(litContent(page, 'lit-pop-modal')).toBeHidden();
  await expect(litBackdrop(page, 'lit-pop-modal')).toBeHidden();

  // React modal popover.
  await reactTrigger(page, 'react-pop-modal').click();
  await expect(page.locator('.lab-popover-backdrop')).toBeVisible();
});

test('visual parity: Lit and React resolve the same panel colour when open', async ({ page }) => {
  await litHost(page, 'lit-pop').locator('.trigger').click();
  const litPanelBg = await litContent(page, 'lit-pop').evaluate(bg);

  await reactTrigger(page, 'react-pop').click();
  const reactPanelBg = await reactOpenContent(page).evaluate(bg);

  expect(reactPanelBg, 'popover panel background parity').toBe(litPanelBg);
});

/**
 * ARIA wiring — the binding the @zag-js/popover machine REALLY emits (verified
 * against popover.connect.js): the trigger advertises a dialog with
 * aria-haspopup="dialog" + aria-controls→content id; the dialog names itself with
 * aria-labelledby→heading id and describes itself with aria-describedby→description
 * id. The `lit-pop` / `react-pop` specimens carry BOTH a heading and a description so
 * each association points at a REAL element (no dangling idref). Falsifiable: the
 * idref must equal the actual element's id, not merely "be present".
 */
test('aria: trigger advertises the dialog (haspopup + controls→content id)', async ({ page }) => {
  // Lit — trigger and content live in the shadow root.
  await litHost(page, 'lit-pop').locator('.trigger').click();
  const litWiring = await litHost(page, 'lit-pop').evaluate((host) => {
    const sr = (host as HTMLElement).shadowRoot;
    const trigger = sr?.querySelector('.trigger');
    const content = sr?.querySelector('.content');
    return {
      haspopup: trigger?.getAttribute('aria-haspopup') ?? null,
      controls: trigger?.getAttribute('aria-controls') ?? null,
      contentId: content?.id ?? null,
    };
  });
  expect(litWiring.haspopup).toBe('dialog');
  expect(litWiring.contentId, 'content has an id').toBeTruthy();
  expect(litWiring.controls, 'trigger aria-controls → content id').toBe(litWiring.contentId);

  // React — trigger in the wrapper, content portalled to <body>.
  await reactTrigger(page, 'react-pop').click();
  await expect(reactOpenContent(page)).toBeVisible();
  const reactTriggerEl = reactTrigger(page, 'react-pop');
  const reactContentId = await reactOpenContent(page).getAttribute('id');
  expect(await reactTriggerEl.getAttribute('aria-haspopup')).toBe('dialog');
  expect(reactContentId, 'react content has an id').toBeTruthy();
  expect(await reactTriggerEl.getAttribute('aria-controls')).toBe(reactContentId);
});

test('aria: dialog is labelled by its heading and described by its description', async ({
  page,
}) => {
  // Lit.
  await litHost(page, 'lit-pop').locator('.trigger').click();
  const litWiring = await litHost(page, 'lit-pop').evaluate((host) => {
    const sr = (host as HTMLElement).shadowRoot;
    const content = sr?.querySelector('.content');
    const heading = sr?.querySelector('.heading');
    const description = sr?.querySelector('.description');
    return {
      labelledby: content?.getAttribute('aria-labelledby') ?? null,
      describedby: content?.getAttribute('aria-describedby') ?? null,
      headingId: heading?.id ?? null,
      descriptionId: description?.id ?? null,
    };
  });
  expect(litWiring.headingId, 'heading element has an id').toBeTruthy();
  expect(litWiring.descriptionId, 'description element has an id').toBeTruthy();
  expect(litWiring.labelledby, 'aria-labelledby → heading id').toBe(litWiring.headingId);
  expect(litWiring.describedby, 'aria-describedby → description id').toBe(litWiring.descriptionId);

  // React.
  await reactTrigger(page, 'react-pop').click();
  await expect(reactOpenContent(page)).toBeVisible();
  const reactWiring = await reactOpenContent(page).evaluate((content) => {
    const root = content.getRootNode() as Document | ShadowRoot;
    const labelledby = content.getAttribute('aria-labelledby');
    const describedby = content.getAttribute('aria-describedby');
    return {
      labelledby,
      describedby,
      headingId: labelledby ? (root.getElementById(labelledby)?.id ?? null) : null,
      descriptionId: describedby ? (root.getElementById(describedby)?.id ?? null) : null,
    };
  });
  expect(reactWiring.headingId, 'react labelledby resolves to a real element').toBe(
    reactWiring.labelledby,
  );
  expect(reactWiring.descriptionId, 'react describedby resolves to a real element').toBe(
    reactWiring.describedby,
  );
});

/**
 * Modal contract — the machine sets aria-modal on the dialog only when modal, locks
 * body scroll, and traps focus. The Lit focus-trap caveat is honoured here, not
 * papered over: the trap covers the SHADOW-subtree focusable (the closable close
 * button) — that is what we assert stays focused. The slotted light-DOM `Action`
 * button is deliberately NOT trapped (it lives outside the content's shadow subtree
 * the trap walks), and the final assertion makes that limitation VISIBLE rather than
 * hiding it. See the focus-trap caveat in lab-popover.ts / popover.doc.ts.
 */
test('aria-modal: present+true on the modal dialog, absent on the non-modal one', async ({
  page,
}) => {
  // Non-modal: the machine omits aria-modal (ariaAttr(false) → undefined).
  await litHost(page, 'lit-pop').locator('.trigger').click();
  await expect(litContent(page, 'lit-pop')).toBeVisible();
  expect(await litContent(page, 'lit-pop').getAttribute('aria-modal')).toBeNull();
  await page.keyboard.press('Escape');
  await expect(litContent(page, 'lit-pop')).toBeHidden();

  // Modal: aria-modal="true".
  await litHost(page, 'lit-pop-modal').locator('.trigger').click();
  await expect(litContent(page, 'lit-pop-modal')).toBeVisible();
  await expect(litContent(page, 'lit-pop-modal')).toHaveAttribute('aria-modal', 'true');

  // React modal parity.
  await litFocusInDialog(page, 'lit-pop-modal');
  await page.keyboard.press('Escape');
  await expect(litContent(page, 'lit-pop-modal')).toBeHidden();
  await reactTrigger(page, 'react-pop-modal').click();
  await expect(page.locator('.lab-popover-content[data-state="open"]')).toHaveAttribute(
    'aria-modal',
    'true',
  );
});

test('scroll-lock: a modal popover locks body scroll while open (machine)', async ({ page }) => {
  const overflowBefore = await page.evaluate(() => getComputedStyle(document.body).overflow);
  expect(overflowBefore).not.toBe('hidden');

  await litHost(page, 'lit-pop-modal').locator('.trigger').click();
  await expect(litContent(page, 'lit-pop-modal')).toBeVisible();
  // @zag-js/remove-scroll sets body { overflow: hidden } for the modal lifetime.
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.body).overflow))
    .toBe('hidden');

  // Closing the modal restores scroll.
  await litFocusInDialog(page, 'lit-pop-modal');
  await page.keyboard.press('Escape');
  await expect(litContent(page, 'lit-pop-modal')).toBeHidden();
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.body).overflow))
    .not.toBe('hidden');
});

test('focus-trap: Tab stays on the shadow-subtree focusable; slotted light-DOM is NOT trapped (Lit caveat)', async ({
  page,
}) => {
  await litHost(page, 'lit-pop-modal').locator('.trigger').click();
  await expect(litContent(page, 'lit-pop-modal')).toBeVisible();
  await litFocusInDialog(page, 'lit-pop-modal');

  // Tab repeatedly: the trap recycles focus among the content's SHADOW-subtree
  // focusables (here the closable close button). shadowRoot.activeElement must
  // remain inside .content the whole time — that is the trap actually working.
  for (let i = 0; i < 5; i++) {
    const inContent = await litHost(page, 'lit-pop-modal').evaluate(
      (h) => (h as HTMLElement).shadowRoot?.activeElement?.closest('.content') != null,
    );
    expect(inContent, `Tab #${i}: focus stays in the shadow content`).toBe(true);
    await page.keyboard.press('Tab');
  }

  // HONESTY GUARD — the documented limitation, asserted: the slotted light-DOM
  // `Action` button lives OUTSIDE the content's shadow subtree the trap walks, so the
  // trap never lands on it. If a future change made the Lit trap also cover slotted
  // light-DOM, this assertion would flip and force the caveat docs to be revisited.
  const slottedActionFocused = await page.evaluate(
    () =>
      document.activeElement?.getAttribute('data-testid') === 'lit-pop-modal-action' ||
      document.querySelector('[data-testid="lit-pop-modal-action"]')?.matches(':focus') === true,
  );
  expect(
    slottedActionFocused,
    'slotted light-DOM Action is NOT inside the Lit shadow focus-trap (documented caveat)',
  ).toBe(false);
});

/**
 * Positioning — the panel is anchored AT the trigger, not merely on-screen. For
 * placement="bottom" the panel's top edge sits at/below the trigger's bottom edge
 * (within a small gap+arrow tolerance) and the two boxes overlap horizontally. This
 * catches a surface that rendered visible but detached from its trigger — which the
 * old `box.y >= 0` check would miss.
 */
test('positioning: the open panel is anchored at the trigger (bottom placement)', async ({
  page,
}) => {
  const trigger = litHost(page, 'lit-pop').locator('.trigger');
  await trigger.click();
  const content = litContent(page, 'lit-pop');
  await expect(content).toBeVisible();
  await litFocusInDialog(page, 'lit-pop');

  const triggerBox = await trigger.boundingBox();
  const contentBox = await content.boundingBox();
  expect(triggerBox).not.toBeNull();
  expect(contentBox).not.toBeNull();
  if (!triggerBox || !contentBox) return;

  // bottom placement: panel top is near the trigger bottom (gap + arrow ≈ ≤ 24px),
  // and never above the trigger top.
  const gap = contentBox.y - (triggerBox.y + triggerBox.height);
  expect(gap, 'panel sits below the trigger').toBeGreaterThanOrEqual(-2);
  expect(gap, 'panel is adjacent to the trigger (not detached)').toBeLessThanOrEqual(24);

  // Horizontal overlap: the panel and trigger share x-extent (anchored, not adrift).
  const overlap =
    Math.min(triggerBox.x + triggerBox.width, contentBox.x + contentBox.width) -
    Math.max(triggerBox.x, contentBox.x);
  expect(overlap, 'panel horizontally overlaps the trigger').toBeGreaterThan(0);
});
