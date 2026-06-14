import { type Locator, type Page, expect, test } from '@playwright/test';

/**
 * Slider suite — a MACHINE-DRIVEN value slider, verified on BOTH renderers against the
 * REAL `@zag-js/slider` machine output (not a faked role).
 *
 * The fixture (`slider.html`) mounts the Lit `<lab-slider>` and the native-React
 * `<Slider>` with identical specimens under one [data-theme]. These checks are the
 * control's browser-side definition of done:
 *   1. Render — the delivered HTML carries the Lit element; React is a client island.
 *   2. Slider a11y — the thumb is role="slider" with aria-valuenow/valuemin/valuemax +
 *      aria-orientation, asserted against the machine's REAL output.
 *   3. Group label — the shared field-a11y label is the thumb's accessible name
 *      (aria-labelledby → the label id) on BOTH renderers, plus helper/error wiring.
 *   4. Keyboard — Arrow/Home/End move the thumb value (the machine owns the keymap).
 *   5. Min/max — the value clamps at the bounds; Home/End hit min/max exactly.
 *   6. Range — a two-value slider renders two thumbs, keyed by index, each with its own
 *      aria-valuenow.
 *   7. Disabled — the thumb is not focusable / not interactive.
 *   8. Visual parity — Lit and React resolve the SAME range fill colour.
 *
 * Playwright's CSS engine pierces open shadow DOM, so `litHost.locator('.thumb')`
 * reaches the Lit shadow thumb the same way it reaches the React DOM thumb. DETERMINISM
 * (lesson 7): every value read is gated on the machine's settled output via
 * `expect`/`expect.poll`, never a fixed sleep; keyboard steps are gated on focus first.
 */

/** The Lit host element (shadow-pierced for inner nodes). */
function litHost(page: Page, testid: string): Locator {
  return page.getByTestId(testid);
}
/** The React `[data-lab-slider]` control inside its testid wrapper. */
function reactField(page: Page, testid: string): Locator {
  return page.getByTestId(testid).locator('[data-lab-slider]');
}
/** The thumb(s) of a Lit host or a React field. */
function litThumbs(page: Page, testid: string): Locator {
  return litHost(page, testid).locator('.thumb');
}
function reactThumbs(page: Page, testid: string): Locator {
  return reactField(page, testid).locator('.lab-slider-thumb');
}
/** The first thumb (the single-value thumb). */
function litThumb(page: Page, testid: string): Locator {
  return litThumbs(page, testid).first();
}
function reactThumb(page: Page, testid: string): Locator {
  return reactThumbs(page, testid).first();
}

const bgColor = (el: HTMLElement) => getComputedStyle(el).backgroundColor;

test.beforeEach(async ({ page }) => {
  await page.goto('/slider.html');
});

test('delivered HTML carries the Lit element (React island mounts client-side)', async ({
  request,
}) => {
  const body = await (await request.get('/slider.html')).text();
  expect(body).toMatch(/<lab-slider/i);
  expect(body).toContain('id="react-root"');
});

test('render: both renderers paint a thumb with role="slider"', async ({ page }) => {
  for (const thumb of [litThumb(page, 'lit-single'), reactThumb(page, 'react-single')]) {
    await expect(thumb).toBeVisible();
    await expect(thumb).toHaveAttribute('role', 'slider');
  }
});

/**
 * Slider a11y — the binding the @zag-js/slider machine REALLY emits: the thumb is
 * role="slider" with aria-valuemin/valuemax from the min/max props, aria-valuenow
 * tracking the value, and aria-orientation. Falsifiable: the numbers must equal the
 * configured bounds + value, not merely "be present".
 */
test('aria: the machine exposes slider value semantics (both renderers)', async ({ page }) => {
  for (const thumb of [litThumb(page, 'lit-single'), reactThumb(page, 'react-single')]) {
    await expect(thumb).toHaveAttribute('role', 'slider');
    await expect(thumb).toHaveAttribute('aria-orientation', 'horizontal');
    await expect(thumb).toHaveAttribute('aria-valuemin', '0');
    await expect(thumb).toHaveAttribute('aria-valuemax', '100');
    await expect(thumb).toHaveAttribute('aria-valuenow', '40');
  }
});

/**
 * Group label — the shared field-a11y label is the thumb's accessible name. The
 * machine points each thumb's aria-labelledby at the label part's id; the idref must
 * equal the actual label's id. The field-a11y helper also links the helper region.
 */
test('group label: the thumb is named by the field-a11y label (both renderers)', async ({
  page,
}) => {
  for (const [host, thumb] of [
    [litHost(page, 'lit-single'), litThumb(page, 'lit-single')] as const,
    [reactField(page, 'react-single'), reactThumb(page, 'react-single')] as const,
  ]) {
    const label = host.locator('.label, .lab-slider-label');
    const labelId = await label.getAttribute('id');
    expect(labelId, 'label has an id').toBeTruthy();
    expect(await thumb.getAttribute('aria-labelledby')).toBe(labelId);

    // The field-a11y helper links the helper region from the focusable THUMB's
    // describedby — the element a reader lands on, not the inert label (#36 audit
    // HIGH-1). Asserting it on the label would pass green while a reader hears nothing.
    const helper = host.locator('.helper, .lab-slider-helper');
    const helperId = await helper.getAttribute('id');
    expect(helperId, 'helper has an id').toBeTruthy();
    expect(await thumb.getAttribute('aria-describedby')).toContain(helperId ?? '');
  }
});

test('field-a11y: the error is announced + referenced only when invalid (both renderers)', async ({
  page,
}) => {
  for (const [host, thumb] of [
    [litHost(page, 'lit-invalid'), litThumb(page, 'lit-invalid')] as const,
    [reactField(page, 'react-invalid'), reactThumb(page, 'react-invalid')] as const,
  ]) {
    const error = host.locator('.error, .lab-slider-error');
    const errorId = await error.getAttribute('id');
    expect(errorId, 'error has an id').toBeTruthy();
    await expect(error).toHaveAttribute('role', 'alert');
    // The error is referenced from the focusable THUMB (errormessage + describedby),
    // not the inert label (#36 audit HIGH-1) — the label never receives focus, so an
    // errormessage there is never announced.
    expect(await thumb.getAttribute('aria-errormessage')).toBe(errorId);
    expect(await thumb.getAttribute('aria-describedby')).toContain(errorId ?? '');
  }
});

/**
 * The value-text renders the live value under show-value (#36 audit HIGH-2). The Zag
 * `getValueTextProps()` carries only id + data-attrs — the renderer must WRITE the text.
 * React joins the thumb values with ' – '; the Lit twin must render the SAME content so
 * the visible readout is not an empty box. Falsifiable: the trimmed text must equal the
 * joined value — `40` single, `20 – 80` range — on BOTH renderers, AND it must stay in
 * sync with the machine when the value changes (the Lit twin's valueText() is reactive,
 * not a one-shot first-paint write).
 */
test('value-text: the live value renders + tracks changes under show-value (both renderers)', async ({
  page,
}) => {
  const litValueText = (testid: string) => litHost(page, testid).locator('.value-text');
  const reactValueText = (testid: string) =>
    reactField(page, testid).locator('.lab-slider-value-text');

  await expect(litValueText('lit-single')).toHaveText('40');
  await expect(reactValueText('react-single')).toHaveText('40');

  await expect(litValueText('lit-range')).toHaveText('20 – 80');
  await expect(reactValueText('react-range')).toHaveText('20 – 80');

  // Reactive: the readout follows the machine value, not just the first paint. Step the
  // thumb and the displayed text must move with it on BOTH renderers.
  const litT = litThumb(page, 'lit-single');
  await litT.focus();
  await page.keyboard.press('ArrowRight');
  await expect(litValueText('lit-single')).toHaveText('41');

  const reactT = reactThumb(page, 'react-single');
  await reactT.focus();
  await page.keyboard.press('ArrowRight');
  await expect(reactValueText('react-single')).toHaveText('41');
});

test('keyboard: ArrowRight / ArrowLeft step the value (the machine owns the keymap)', async ({
  page,
}) => {
  const valueNow = (el: HTMLElement) => Number(el.getAttribute('aria-valuenow'));

  const litT = litThumb(page, 'lit-single');
  await litT.focus();
  await expect(litT).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => litT.evaluate(valueNow)).toBe(41);
  await page.keyboard.press('ArrowLeft');
  await expect.poll(() => litT.evaluate(valueNow)).toBe(40);

  const reactT = reactThumb(page, 'react-single');
  await reactT.focus();
  await expect(reactT).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => reactT.evaluate(valueNow)).toBe(41);
  await page.keyboard.press('ArrowLeft');
  await expect.poll(() => reactT.evaluate(valueNow)).toBe(40);
});

test('keyboard: Home / End clamp to min / max exactly (both renderers)', async ({ page }) => {
  const valueNow = (el: HTMLElement) => Number(el.getAttribute('aria-valuenow'));

  const litT = litThumb(page, 'lit-single');
  await litT.focus();
  await page.keyboard.press('Home');
  await expect.poll(() => litT.evaluate(valueNow)).toBe(0);
  await page.keyboard.press('End');
  await expect.poll(() => litT.evaluate(valueNow)).toBe(100);

  const reactT = reactThumb(page, 'react-single');
  await reactT.focus();
  await page.keyboard.press('Home');
  await expect.poll(() => reactT.evaluate(valueNow)).toBe(0);
  await page.keyboard.press('End');
  await expect.poll(() => reactT.evaluate(valueNow)).toBe(100);
});

test('range: a two-value slider renders two thumbs with their own value-now', async ({ page }) => {
  await expect(litThumbs(page, 'lit-range')).toHaveCount(2);
  await expect(litThumbs(page, 'lit-range').nth(0)).toHaveAttribute('aria-valuenow', '20');
  await expect(litThumbs(page, 'lit-range').nth(1)).toHaveAttribute('aria-valuenow', '80');

  await expect(reactThumbs(page, 'react-range')).toHaveCount(2);
  await expect(reactThumbs(page, 'react-range').nth(0)).toHaveAttribute('aria-valuenow', '20');
  await expect(reactThumbs(page, 'react-range').nth(1)).toHaveAttribute('aria-valuenow', '80');
});

test('step: ArrowRight moves by the step prop (10), through the machine', async ({ page }) => {
  const valueNow = (el: HTMLElement) => Number(el.getAttribute('aria-valuenow'));

  const litT = litThumb(page, 'lit-step');
  await litT.focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => litT.evaluate(valueNow)).toBe(60);

  const reactT = reactThumb(page, 'react-step');
  await reactT.focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => reactT.evaluate(valueNow)).toBe(60);
});

test('disabled: the thumb is not focusable on both renderers', async ({ page }) => {
  // The machine drops tabIndex on a disabled thumb, so it cannot receive focus.
  for (const thumb of [litThumb(page, 'lit-disabled'), reactThumb(page, 'react-disabled')]) {
    expect(await thumb.getAttribute('tabindex')).not.toBe('0');
  }
});

test('visual parity: Lit and React resolve the same range fill colour', async ({ page }) => {
  const litRange = await litHost(page, 'lit-single').locator('.range').evaluate(bgColor);
  const reactRange = await reactField(page, 'react-single')
    .locator('.lab-slider-range')
    .evaluate(bgColor);
  expect(reactRange, 'slider range fill parity').toBe(litRange);
});

test('visual parity: the invalid range re-points the fill identically', async ({ page }) => {
  const litRange = await litHost(page, 'lit-invalid').locator('.range').evaluate(bgColor);
  const reactRange = await reactField(page, 'react-invalid')
    .locator('.lab-slider-range')
    .evaluate(bgColor);
  expect(reactRange, 'invalid range fill parity').toBe(litRange);
});
