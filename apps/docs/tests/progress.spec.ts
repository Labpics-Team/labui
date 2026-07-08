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
 *
 * A non-default RANGE specimen (min=10, max=50, value=30) pins the percent maths:
 * the machine computes (value-min)/(max-min) = 50%, NOT value/100. We assert the
 * real min/now/max land on aria-* and the rendered percent text is 50% — proving the
 * range is honoured, not assumed to be 0..100.
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
function litValueText(page: Page, testid: string): Locator {
  return page.getByTestId(testid).locator('.value-text');
}
function reactValueText(page: Page, testid: string): Locator {
  return page.getByTestId(testid).locator('.lab-progress-value-text');
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

test('accessible NAME (Chromium AX tree): the progressbar is named by its visible label, both renderers', async ({
  page,
  browserName,
}) => {
  // WCAG 4.1.2 (Name, Role, Value). @zag-js/progress@1.41.2 names the track via
  // `aria-label` set to the formatted VALUE ("60%" determinate / "loading..."
  // indeterminate) and emits NO `aria-labelledby`, so the visible task label
  // ("Uploading") is NOT the progressbar's accessible name. The component overrides
  // this: it points `aria-labelledby` at the label part's id and drops the value
  // `aria-label`. We assert the COMPUTED accessible name from the real AX tree — the
  // name a screen reader announces — equals the visible label on BOTH renderers.
  test.skip(browserName !== 'chromium', 'page.accessibility.snapshot is Chromium-only');

  const snapshot = await page.accessibility.snapshot({ interestingOnly: false });
  const names: string[] = [];
  const walk = (node: { role?: string; name?: string; children?: unknown[] } | null): void => {
    if (!node) return;
    if (node.role === 'progressbar') names.push(node.name ?? '');
    for (const child of node.children ?? []) walk(child as typeof node);
  };
  walk(snapshot as never);

  // 8 progressbars (4 Lit + 4 React), each named by its visible label — NOT by a value
  // string. The label set appears once per renderer ⇒ Lit/React resolve the SAME names.
  const expectedPerRenderer = ['Uploading', 'Done', 'Working', 'Ranged'];
  expect(names).toEqual([...expectedPerRenderer, ...expectedPerRenderer]);
  // Guard against regression to the machine default: no progressbar is named "60%" etc.
  expect(names.some((n) => /%$/.test(n) || n === 'loading...')).toBe(false);
});

test('accessible NAME wiring (cross-engine): track is labelledby its visible label, value aria-label dropped, both renderers', async ({
  page,
}) => {
  // The engine-portable half of the WCAG 4.1.2 fix (runs on Chromium AND WebKit, where
  // the AX-tree API is unavailable): the track must carry `aria-labelledby` pointing at
  // the label part — whose text is the visible label — and must NOT carry the machine's
  // value `aria-label` (which would otherwise be the name). Asserted on BOTH renderers.
  const cases = [
    { track: litTrack(page, 'lit-determinate'), label: '.label' },
    { track: reactTrack(page, 'react-determinate'), label: '.lab-progress-label' },
  ];
  for (const { track } of cases) {
    await expect(track).toHaveAttribute('role', 'progressbar');
    // The value aria-label that the machine sets must be gone (else it names the bar).
    await expect(track).not.toHaveAttribute('aria-label', /.*/);
    // labelledby is present and resolves to an element whose text is the visible label.
    const labelledby = await track.getAttribute('aria-labelledby');
    expect(labelledby).toBeTruthy();
    const referencedText = await track.evaluate((el, id) => {
      const root = el.getRootNode() as ShadowRoot | Document;
      const ref = (root as Document | ShadowRoot).getElementById?.(id ?? '');
      return ref?.textContent ?? null;
    }, labelledby);
    expect(referencedText).toBe('Uploading');
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

test('non-default range: percent maths spans min..max, not 0..100 (both renderers)', async ({
  page,
}) => {
  // min=10, max=50, value=30 ⇒ the machine's percent is (30-10)/(50-10) = 50%. The
  // real range lands on aria-valuemin/now/max; the value-text shows 50%. If the bar
  // assumed a 0..100 range it would mis-report 30% — this is the proof it does not.
  const cases = [
    { track: litTrack(page, 'lit-ranged'), valueText: litValueText(page, 'lit-ranged') },
    { track: reactTrack(page, 'react-ranged'), valueText: reactValueText(page, 'react-ranged') },
  ];

  for (const { track, valueText } of cases) {
    await expect(track).toHaveAttribute('role', 'progressbar');
    // The real range — min/max are NOT the default 0/100.
    await expect(track).toHaveAttribute('aria-valuemin', '10');
    await expect(track).toHaveAttribute('aria-valuemax', '50');
    await expect(track).toHaveAttribute('aria-valuenow', '30');
    // Value below max ⇒ still loading (not complete).
    await expect(track).toHaveAttribute('data-state', 'loading');
    // The rendered percent is 50 (of the RANGE), not 30 (of an assumed 0..100). The
    // machine formats via Intl.NumberFormat(style:'percent'); some locales place a
    // (possibly non-breaking) space before '%', so match the number, not the spacing.
    await expect(valueText).toHaveText(/^50\s*%$/);
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

test('tokens: re-pointing --lab-fill-primary re-skins BOTH tracks', async ({ page }) => {
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--lab-fill-primary', 'rgb(1, 2, 3)');
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
