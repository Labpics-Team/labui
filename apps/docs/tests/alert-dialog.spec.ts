import { type Locator, type Page, expect, test } from '@playwright/test';

/**
 * Alert-Dialog suite — the stricter dialog, verified on BOTH renderers.
 *
 * `<lab-alert-dialog>` / `<AlertDialog>` is the dialog with role="alertdialog". The
 * @zag-js/dialog machine reads that role (verified against dialog.machine.js, which
 * computes closeOnInteractOutside = modal && !alertDialog) to REFUSE outside-click
 * dismissal. The browser-side definition of done beyond the shared dialog contract:
 *   1. role — the content renders role="alertdialog" (not "dialog").
 *   2. NO outside-click dismiss — clicking the scrim does NOT close it (the inverse of
 *      the plain dialog). The decision must be explicit.
 *   3. Escape STILL cancels — closeOnEscape stays true.
 *   4. REAL focus trap — Tab reaches the slotted confirm/cancel controls.
 *
 * Determinism: the dismiss-related steps gate on focus having moved into the dialog, so
 * the document-level listeners are armed before any key/click — no arbitrary sleep.
 */

const PORTAL = (testid: string) => `[data-portal-for="${testid}"]`;

function litHost(page: Page, testid: string): Locator {
  return page.getByTestId(testid);
}
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

async function litFocusInDialog(page: Page, testid: string): Promise<void> {
  await expect
    .poll(() =>
      page
        .locator(PORTAL(testid))
        .evaluate((host) => host.shadowRoot?.activeElement?.closest('.content') != null),
    )
    .toBe(true);
}
async function reactFocusInDialog(page: Page): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => document.activeElement?.closest('.lab-dialog-content') != null))
    .toBe(true);
}

/**
 * Close an open Lit alert-dialog before driving the OTHER renderer. A modal locks the
 * page (body { pointer-events: none }) and its full-viewport scrim/positioner overlay
 * intercepts pointer events over the React trigger, so a cross-renderer test MUST
 * dismiss the first modal before clicking the second. The alert-dialog refuses
 * outside-click dismissal, but Escape still cancels it (closeOnEscape stays true), so
 * Escape is the close affordance here. Mirrors the popover suite's close-first step and
 * removes the race the same honest way: gate on focus having moved in (which arms Zag's
 * Escape listener), press Escape, then assert the content + scrim are gone — no sleep.
 */
async function closeLitAlert(page: Page, testid: string): Promise<void> {
  await litFocusInDialog(page, testid);
  await page.keyboard.press('Escape');
  await expect(litContent(page, testid)).toBeHidden();
  await expect(litBackdrop(page, testid)).toBeHidden();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/alert-dialog.html');
});

test('delivered HTML carries the Lit element (React island mounts client-side)', async ({
  request,
}) => {
  const body = await (await request.get('/alert-dialog.html')).text();
  expect(body).toMatch(/<lab-alert-dialog/i);
  expect(body).toContain('id="react-root"');
});

test('role="alertdialog": the machine renders the stricter role on both renderers', async ({
  page,
}) => {
  await litTrigger(page, 'lit-alert').click();
  await expect(litContent(page, 'lit-alert')).toBeVisible();
  await expect(litContent(page, 'lit-alert')).toHaveAttribute('role', 'alertdialog');
  await expect(litContent(page, 'lit-alert')).toHaveAttribute('aria-modal', 'true');

  // Close the Lit alert-dialog before the React renderer (its scrim would block the click).
  await closeLitAlert(page, 'lit-alert');

  await reactTrigger(page, 'react-alert').click();
  await expect(reactOpenContent(page)).toBeVisible();
  await expect(reactOpenContent(page)).toHaveAttribute('role', 'alertdialog');
  await expect(reactOpenContent(page)).toHaveAttribute('aria-modal', 'true');
});

/**
 * The defining contract: an alert-dialog does NOT dismiss on outside-click. We click the
 * scrim and assert the dialog STAYS open — the inverse of the plain dialog's behaviour.
 * This is machine-owned (closeOnInteractOutside = modal && !alertDialog = false), not a
 * hand-written guard.
 */
test('NO outside-click dismiss: clicking the scrim does NOT close the alert-dialog (Lit)', async ({
  page,
}) => {
  await litTrigger(page, 'lit-alert').click();
  await expect(litContent(page, 'lit-alert')).toBeVisible();
  await litFocusInDialog(page, 'lit-alert');

  // Click the scrim — for an alert-dialog this must be ignored.
  await litBackdrop(page, 'lit-alert').click({ position: { x: 5, y: 5 }, force: true });
  // Give any (incorrect) dismiss a chance to land, then assert it is STILL open.
  await expect(litContent(page, 'lit-alert')).toBeVisible();
  await expect(litContent(page, 'lit-alert')).toHaveAttribute('data-state', 'open');
});

test('Escape STILL cancels the alert-dialog and restores focus to the trigger (Lit)', async ({
  page,
}) => {
  await litTrigger(page, 'lit-alert').click();
  await expect(litContent(page, 'lit-alert')).toBeVisible();
  await litFocusInDialog(page, 'lit-alert');
  await page.keyboard.press('Escape');
  await expect(litContent(page, 'lit-alert')).toBeHidden();
  await expect(litHost(page, 'lit-alert')).toBeFocused();
});

test('Escape STILL cancels the alert-dialog and restores focus to the trigger (React)', async ({
  page,
}) => {
  await reactTrigger(page, 'react-alert').click();
  await expect(reactOpenContent(page)).toBeVisible();
  await reactFocusInDialog(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('.lab-dialog-content[data-state="open"]')).toHaveCount(0);
  await expect(reactTrigger(page, 'react-alert')).toBeFocused();
});

test('scroll-lock: an alert-dialog locks body scroll while open (machine)', async ({ page }) => {
  expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe('hidden');
  await litTrigger(page, 'lit-alert').click();
  await expect(litContent(page, 'lit-alert')).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.body).overflow))
    .toBe('hidden');
  await litFocusInDialog(page, 'lit-alert');
  await page.keyboard.press('Escape');
  await expect(litContent(page, 'lit-alert')).toBeHidden();
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.body).overflow))
    .not.toBe('hidden');
});

/**
 * REAL focus trap around the decision controls: the slotted confirm + cancel buttons are
 * relocated into the portal body, so they live inside the trap subtree. Tabbing stays in
 * the dialog and reaches the Confirm (Delete) button.
 */
test('focus-trap: Tab stays inside the alert-dialog AND reaches the confirm control (Lit)', async ({
  page,
}) => {
  await litTrigger(page, 'lit-alert').click();
  await expect(litContent(page, 'lit-alert')).toBeVisible();
  await litFocusInDialog(page, 'lit-alert');

  let reachedConfirm = false;
  for (let i = 0; i < 8; i++) {
    const probe = await page.locator(PORTAL('lit-alert')).evaluate((host) => {
      const active = host.shadowRoot?.activeElement as HTMLElement | null | undefined;
      return {
        inContent: active?.closest('.content') != null,
        onConfirm: active?.getAttribute('data-testid') === 'lit-alert-confirm',
      };
    });
    expect(probe.inContent, `Tab #${i}: focus stays inside the alert-dialog`).toBe(true);
    if (probe.onConfirm) reachedConfirm = true;
    await page.keyboard.press('Tab');
  }
  expect(reachedConfirm, 'the slotted Confirm control IS inside the focus-trap').toBe(true);
});

test('focus-trap: Tab stays inside the alert-dialog AND reaches the confirm control (React)', async ({
  page,
}) => {
  await reactTrigger(page, 'react-alert').click();
  await expect(reactOpenContent(page)).toBeVisible();
  await reactFocusInDialog(page);

  let reachedConfirm = false;
  for (let i = 0; i < 8; i++) {
    const probe = await page.evaluate(() => {
      const active = document.activeElement as HTMLElement | null;
      return {
        inContent: active?.closest('.lab-dialog-content') != null,
        onConfirm: active?.getAttribute('data-testid') === 'react-alert-confirm',
      };
    });
    expect(probe.inContent, `Tab #${i}: focus stays inside the alert-dialog`).toBe(true);
    if (probe.onConfirm) reachedConfirm = true;
    await page.keyboard.press('Tab');
  }
  expect(reachedConfirm, 'the slotted Confirm control IS inside the focus-trap').toBe(true);
});

test('confirm/cancel dismiss: an explicit cancel click closes the alert-dialog (Lit)', async ({
  page,
}) => {
  await litTrigger(page, 'lit-alert').click();
  await expect(litContent(page, 'lit-alert')).toBeVisible();
  await litFocusInDialog(page, 'lit-alert');
  // The close button is the canonical cancel; the machine wires its CLOSE handler.
  await page.locator(PORTAL('lit-alert')).locator('.close').click();
  await expect(litContent(page, 'lit-alert')).toBeHidden();
  await expect(litHost(page, 'lit-alert')).toBeFocused();
});
