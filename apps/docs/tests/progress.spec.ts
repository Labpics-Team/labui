import { type Locator, type Page, expect, test } from '@playwright/test';

/**
 * Progress suite — a component that CONSUMES the @zag-js/progress machine through
 * the LabUI seam, verified on BOTH renderers.
 *
 * The fixture (`progress.html`) mounts the Lit `<lab-progress>` and the
 * native-React `<Progress>` with identical specimens under one [data-theme].
 *
 * a11y assertions below assert ONLY what `@zag-js/progress@1.41.2`'s connect
 * actually emits (verified against progress.connect.js):
 *   - track: `role="progressbar"`, `aria-valuemin` = min, `aria-valuemax` = max,
 *     `aria-valuenow` = value (DETERMINATE) / ABSENT (INDETERMINATE), `data-state`
 *     loading / complete / indeterminate.
 *   - root: `data-state` mirrors the same, with the `--percent` custom property
 *     for determinate.
 * The indeterminate honesty is the load-bearing check: the machine drops
 * aria-valuenow when value is null — we assert its ABSENCE, never a faked number.
 */

function litRoot(page: Page, testid: string): Locator {
  return page.getByTestId(testid).locator('.root');
}
function litTrack(page: Page, testid: string): Locator {
  return page.getByTestId(testid).locator('.track');
}
function reactRoot(page: Page, testid: string): Locator {
  return page.getByTestId(testid).locator('[data-lab-progress]');
}
function reactTrack(page: Page, testid: string): Locator {
  return page.getByTestId(testid).locator('.lab-progress-track');
}

const bg = (el: HTMLElement) => getComputedStyle(el).backgroundColor;

test.beforeEach(async ({ page }) => {
  await page.goto('/progress.html');
});

test('delivered HTML carries the Lit element (React island mounts client-side)', async ({
  request,
}) => {
  const body = await (await request.get('/progress.html')).text();
  expect(body).toMatch(/<lab-progress/i);
  expect(body).toContain('id="react-root"');
});

test('render: both renderers expose a progressbar with a token-filled track', async ({ page }) => {
  for (const track of [litTrack(page, 'lit-determinate'), reactTrack(page, 'react-determinate')]) {
    await expect(track).toBeVisible();
    await expect(track).toHaveAttribute('role', 'progressbar');
  }
});

test('determinate: aria-valuenow carries the real value + min/max (both renderers)', async ({
  page,
}) => {
  for (const track of [litTrack(page, 'lit-determinate'), reactTrack(page, 'react-determinate')]) {
    await expect(track).toHaveAttribute('aria-valuenow', '60');
    await expect(track).toHaveAttribute('aria-valuemin', '0');
    await expect(track).toHaveAttribute('aria-valuemax', '100');
    // Loading state: a value that is neither min-absent nor max.
    await expect(track).toHaveAttribute('data-state', 'loading');
  }
});

test('complete: value at max reports data-state=complete (both renderers)', async ({ page }) => {
  for (const track of [litTrack(page, 'lit-complete'), reactTrack(page, 'react-complete')]) {
    await expect(track).toHaveAttribute('aria-valuenow', '100');
    await expect(track).toHaveAttribute('data-state', 'complete');
  }
});

test('indeterminate HONESTY: aria-valuenow is ABSENT, state is indeterminate (both renderers)', async ({
  page,
}) => {
  // The load-bearing honesty check. The machine drops aria-valuenow entirely for a
  // null value — the bar never fabricates a percent it does not have.
  for (const track of [
    litTrack(page, 'lit-indeterminate'),
    reactTrack(page, 'react-indeterminate'),
  ]) {
    await expect(track).toHaveAttribute('role', 'progressbar');
    await expect(track).not.toHaveAttribute('aria-valuenow', /.*/);
    await expect(track).toHaveAttribute('data-state', 'indeterminate');
    // min/max are still present — the range is known even when the value is not.
    await expect(track).toHaveAttribute('aria-valuemin', '0');
    await expect(track).toHaveAttribute('aria-valuemax', '100');
  }
});

test('root data-state mirrors the machine on both renderers', async ({ page }) => {
  await expect(litRoot(page, 'lit-determinate')).toHaveAttribute('data-state', 'loading');
  await expect(reactRoot(page, 'react-determinate')).toHaveAttribute('data-state', 'loading');
  await expect(litRoot(page, 'lit-indeterminate')).toHaveAttribute('data-state', 'indeterminate');
  await expect(reactRoot(page, 'react-indeterminate')).toHaveAttribute(
    'data-state',
    'indeterminate',
  );
});

test('visual parity: Lit and React resolve the same track colour', async ({ page }) => {
  const litBg = await litTrack(page, 'lit-determinate').evaluate(bg);
  const reactBg = await reactTrack(page, 'react-determinate').evaluate(bg);
  expect(reactBg).toBe(litBg);
});

test('tokens: re-pointing --lab-fill-neutral-tinted re-skins BOTH tracks', async ({ page }) => {
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--lab-fill-neutral-tinted', 'rgb(1, 2, 3)');
  });
  await expect.poll(() => litTrack(page, 'lit-determinate').evaluate(bg)).toBe('rgb(1, 2, 3)');
  await expect.poll(() => reactTrack(page, 'react-determinate').evaluate(bg)).toBe('rgb(1, 2, 3)');
});

test('theme: flipping [data-theme] re-skins both renderers with zero edits', async ({ page }) => {
  const litDark = await litTrack(page, 'lit-determinate').evaluate(bg);
  const reactDark = await reactTrack(page, 'react-determinate').evaluate(bg);

  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));

  await expect.poll(() => litTrack(page, 'lit-determinate').evaluate(bg)).not.toBe(litDark);
  await expect.poll(() => reactTrack(page, 'react-determinate').evaluate(bg)).not.toBe(reactDark);
});
