import { type Locator, type Page, expect, test } from '@playwright/test';

/**
 * Tooltip suite — the FIRST positioned overlay, verified on BOTH renderers.
 *
 * The fixture (`tooltip.html`) mounts the Lit `<lab-tooltip>` and the native-React
 * `<Tooltip>` with identical specimens under one [data-theme]. These checks are the
 * Tooltip's browser-side definition of done:
 *   1. Render — the delivered HTML carries the Lit element; React is a client island.
 *   2. Open on hover — the Zag machine opens the floating layer after openDelay.
 *   3. Open on focus + Escape — keyboard users get it, Escape dismisses (machine).
 *   4. Positioning — the open surface is positioned on-screen near the trigger
 *      (Floating UI wrote --x/--y; it is NOT stuck off-screen).
 *   5. Disabled — a disabled tooltip never opens (machine blocks it).
 *   6. Visual parity — Lit and React resolve the SAME surface colour when open.
 */

/** The Lit host (shadow-pierced for inner nodes). */
function litHost(page: Page, testid: string): Locator {
  return page.getByTestId(testid);
}
/** The Lit floating surface inside a host's shadow root. */
function litContent(page: Page, testid: string): Locator {
  return litHost(page, testid).locator('.content');
}
/** The React trigger button inside its testid wrapper. */
function reactTrigger(page: Page, testid: string): Locator {
  return page.getByTestId(testid).locator('.lab-tooltip-trigger');
}
/** The single open, portalled React surface (only one tooltip opens at a time). */
function reactOpenContent(page: Page): Locator {
  return page.locator('.lab-tooltip-content[data-state="open"]');
}

const bg = (el: HTMLElement) => getComputedStyle(el).backgroundColor;

test.beforeEach(async ({ page }) => {
  await page.goto('/tooltip.html');
});

test('delivered HTML carries the Lit element (React island mounts client-side)', async ({
  request,
}) => {
  const body = await (await request.get('/tooltip.html')).text();
  expect(body).toMatch(/<lab-tooltip/i);
  expect(body).toContain('id="react-root"');
});

test('open on hover: the Zag machine opens the surface on both renderers', async ({ page }) => {
  // Lit — closed at rest, opens on hover.
  const lit = litContent(page, 'lit-tt-bottom');
  await expect(lit).toBeHidden();
  await litHost(page, 'lit-tt-bottom').hover();
  await expect(lit).toBeVisible();
  await expect(lit).toHaveAttribute('data-state', 'open');
  await expect(lit).toHaveAttribute('role', 'tooltip');

  // Move the pointer away → the machine closes it.
  await page.mouse.move(0, 0);
  await expect(lit).toBeHidden();

  // React — the portalled surface opens on hover too.
  await reactTrigger(page, 'react-tt-bottom').hover();
  await expect(reactOpenContent(page)).toBeVisible();
});

test('a11y: focus opens the tooltip and Escape dismisses it (keyboard)', async ({ page }) => {
  // Prime keyboard modality so the machine's focus-visible guard fires.
  await page.keyboard.press('Tab');
  const lit = litContent(page, 'lit-tt-top');
  await litHost(page, 'lit-tt-top').evaluate((host) => {
    (host as HTMLElement).shadowRoot?.querySelector<HTMLElement>('.trigger')?.focus();
  });
  await expect(lit).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(lit).toBeHidden();
});

test('positioning: the open surface is placed on-screen near the trigger', async ({ page }) => {
  await litHost(page, 'lit-tt-bottom').hover();
  const content = litContent(page, 'lit-tt-bottom');
  await expect(content).toBeVisible();
  const box = await content.boundingBox();
  expect(box).not.toBeNull();
  // Floating UI wrote --x/--y; an unpositioned surface sits at translate(0,-100vh)
  // (y far negative). A positioned one is within the viewport.
  expect(box?.y ?? -1).toBeGreaterThanOrEqual(0);
  expect(box?.width ?? 0).toBeGreaterThan(0);
});

test('disabled: the machine never opens on either renderer', async ({ page }) => {
  const lit = litContent(page, 'lit-tt-disabled');
  await litHost(page, 'lit-tt-disabled').hover();
  await expect(lit).toBeHidden();

  await reactTrigger(page, 'react-tt-disabled').hover();
  await expect(page.locator('.lab-tooltip-content[data-state="open"]')).toHaveCount(0);
});

test('visual parity: Lit and React resolve the same surface colour when open', async ({ page }) => {
  await litHost(page, 'lit-tt-bottom').hover();
  const litBg = await litContent(page, 'lit-tt-bottom').evaluate(bg);

  await reactTrigger(page, 'react-tt-bottom').hover();
  const reactBg = await reactOpenContent(page).evaluate(bg);

  expect(reactBg, 'tooltip surface background parity').toBe(litBg);
});

/**
 * ARIA wiring — the binding the @zag-js/tooltip machine REALLY emits (verified
 * against tooltip.connect.js): once OPEN, the trigger gains aria-describedby pointing
 * at the content id, and the content carries role="tooltip" + that same id. Closed,
 * the machine emits no aria-describedby (it is `open ? contentId : undefined`). This
 * is the contract on the machine's output — falsifiable: idref must equal the content
 * element's id, not just be present.
 */
test('aria: open trigger is described by the tooltip content (describedby→content id)', async ({
  page,
}) => {
  // Lit — closed: no aria-describedby yet (machine gates it on open).
  const litTriggerClosed = await litHost(page, 'lit-tt-bottom').evaluate(
    (h) =>
      (h as HTMLElement).shadowRoot?.querySelector('.trigger')?.getAttribute('aria-describedby') ??
      null,
  );
  expect(litTriggerClosed, 'closed Lit tooltip emits no aria-describedby').toBeNull();

  await litHost(page, 'lit-tt-bottom').hover();
  await expect(litContent(page, 'lit-tt-bottom')).toBeVisible();
  const litWiring = await litHost(page, 'lit-tt-bottom').evaluate((h) => {
    const sr = (h as HTMLElement).shadowRoot;
    const trigger = sr?.querySelector('.trigger');
    const content = sr?.querySelector('.content');
    return {
      describedby: trigger?.getAttribute('aria-describedby') ?? null,
      contentId: content?.id ?? null,
      role: content?.getAttribute('role') ?? null,
    };
  });
  expect(litWiring.contentId, 'open Lit tooltip content has an id').toBeTruthy();
  expect(litWiring.role).toBe('tooltip');
  expect(litWiring.describedby, 'trigger aria-describedby → content id').toBe(litWiring.contentId);

  // React — the portalled surface; the trigger is in the wrapper.
  await reactTrigger(page, 'react-tt-bottom').hover();
  await expect(reactOpenContent(page)).toBeVisible();
  const reactContentId = await reactOpenContent(page).getAttribute('id');
  const reactDescribedby = await reactTrigger(page, 'react-tt-bottom').getAttribute(
    'aria-describedby',
  );
  expect(reactContentId, 'open React tooltip content has an id').toBeTruthy();
  expect(await reactOpenContent(page).getAttribute('role')).toBe('tooltip');
  expect(reactDescribedby, 'React trigger aria-describedby → content id').toBe(reactContentId);
});

/**
 * Positioning — the surface is anchored AT the trigger, not merely on-screen. For
 * placement="bottom" the surface top sits at/below the trigger bottom (within a small
 * gap+arrow tolerance) and the boxes overlap horizontally. The old `box.y >= 0` check
 * only caught an off-screen surface; this catches a visible-but-detached one.
 */
test('positioning: the open surface is anchored at the trigger (bottom placement)', async ({
  page,
}) => {
  const trigger = litHost(page, 'lit-tt-bottom');
  await trigger.hover();
  const content = litContent(page, 'lit-tt-bottom');
  await expect(content).toBeVisible();

  const triggerBox = await trigger.boundingBox();
  const contentBox = await content.boundingBox();
  expect(triggerBox).not.toBeNull();
  expect(contentBox).not.toBeNull();
  if (!triggerBox || !contentBox) return;

  const gap = contentBox.y - (triggerBox.y + triggerBox.height);
  expect(gap, 'surface sits below the trigger').toBeGreaterThanOrEqual(-2);
  expect(gap, 'surface is adjacent to the trigger (not detached)').toBeLessThanOrEqual(24);

  const overlap =
    Math.min(triggerBox.x + triggerBox.width, contentBox.x + contentBox.width) -
    Math.max(triggerBox.x, contentBox.x);
  expect(overlap, 'surface horizontally overlaps the trigger').toBeGreaterThan(0);
});

test('tokens: re-pointing --lab-bg-inverted re-skins both surfaces', async ({ page }) => {
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--lab-bg-inverted', 'rgb(1, 2, 3)');
  });
  await litHost(page, 'lit-tt-bottom').hover();
  await expect.poll(() => litContent(page, 'lit-tt-bottom').evaluate(bg)).toBe('rgb(1, 2, 3)');

  await reactTrigger(page, 'react-tt-bottom').hover();
  await expect.poll(() => reactOpenContent(page).evaluate(bg)).toBe('rgb(1, 2, 3)');
});
