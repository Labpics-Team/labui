import { type Locator, type Page, expect, test } from '@playwright/test';

/**
 * Button — Vue parity suite (companion to button.spec.ts's Lit↔React suite).
 *
 * The fixture (`button.html`) now ALSO mounts the native-Vue `<Button>` with
 * the identical specimens, under the SAME [data-theme] root as the Lit and
 * React renderers. These checks are the Vue twin's browser-side definition of
 * done, against the Lit `<lab-button>` as the reference implementation
 * (ADR-0001, A-prime — parity is a CSS/markup question, not a second
 * behaviour implementation):
 *   1. Real render — the Vue island mounts a real native <button>.
 *   2. Visual parity — for matching specimens, Vue resolves the SAME computed
 *      colours as Lit. Same --lab-* roles ⇒ same paint.
 *   3. Behaviour — a click fires; a disabled/loading button does not; a
 *      default-type button inside a <form> does not submit it.
 *   4. a11y — keyboard activation (Enter), aria-busy/disabled, an icon-only
 *      button named via aria-label (WCAG 4.1.2).
 *   5. Tokens + theme — re-pointing a role, and flipping [data-theme],
 *      re-skins the Vue renderer exactly like the other two.
 */

/** The inner native <button> for a Lit host (shadow-pierced). */
function litButton(page: Page, testid: string): Locator {
  return page.getByTestId(testid).locator('button');
}
/** Vue sets data-testid directly on the native <button>, so the node IS the button. */
function vueButton(page: Page, testid: string): Locator {
  return page.getByTestId(testid);
}

const bg = (el: HTMLElement) => getComputedStyle(el).backgroundColor;
const fg = (el: HTMLElement) => getComputedStyle(el).color;

test.beforeEach(async ({ page }) => {
  await page.goto('/button.html');
});

test('delivered HTML carries the Lit element; the Vue island mounts on the client', async ({
  request,
}) => {
  const body = await (await request.get('/button.html')).text();
  expect(body).toMatch(/<lab-button/i);
  expect(body).toContain('id="vue-root"');
});

test('visual parity: Vue resolves the SAME fill colours as the Lit reference', async ({ page }) => {
  await expect(vueButton(page, 'vue-accent-fill')).toBeVisible();

  for (const variant of ['accent-fill', 'neutral-tinted', 'danger-border'] as const) {
    const lit = litButton(page, `lit-${variant}`);
    const vue = vueButton(page, `vue-${variant}`);

    const litBg = await lit.evaluate(bg);
    const vueBg = await vue.evaluate(bg);
    const litFg = await lit.evaluate(fg);
    const vueFg = await vue.evaluate(fg);

    expect(vueBg, `${variant}: background parity`).toBe(litBg);
    expect(vueFg, `${variant}: label parity`).toBe(litFg);
  }
});

test('behaviour: click fires on the Vue renderer; disabled blocks it', async ({ page }) => {
  await expect(vueButton(page, 'vue-disabled')).toBeVisible();

  const vueClicks = await page.evaluate(() => {
    const btn = document.querySelector('[data-testid="vue-accent-fill"]') as HTMLButtonElement;
    let n = 0;
    btn.addEventListener('click', () => {
      n += 1;
    });
    btn.click();
    return n;
  });
  expect(vueClicks).toBe(1);

  await expect(vueButton(page, 'vue-disabled')).toBeDisabled();
});

test('a11y: loading sets aria-busy and disables on the Vue renderer', async ({ page }) => {
  const btn = vueButton(page, 'vue-loading');
  await expect(btn, 'vue loading is aria-busy').toHaveAttribute('aria-busy', 'true');
  await expect(btn, 'vue loading is disabled').toBeDisabled();
});

test('a11y: keyboard activates the button (Enter) on the Vue renderer', async ({ page }) => {
  const vue = vueButton(page, 'vue-accent-fill');
  await vue.waitFor();
  await vue.evaluate((btn: HTMLButtonElement) => {
    (window as unknown as { __vueClicks: number }).__vueClicks = 0;
    btn.addEventListener('click', () => {
      (window as unknown as { __vueClicks: number }).__vueClicks += 1;
    });
  });
  await vue.focus();
  await expect(vue).toBeFocused();
  await vue.press('Enter');
  expect(
    await page.evaluate(() => (window as unknown as { __vueClicks: number }).__vueClicks),
  ).toBe(1);
});

test('a11y name: an icon-only Vue button is named via aria-label, matching Lit (WCAG 4.1.2)', async ({
  page,
}) => {
  await expect(vueButton(page, 'vue-icon-only')).toBeVisible();

  await expect(
    vueButton(page, 'vue-icon-only'),
    'Vue icon-only button must be named by aria-label',
  ).toHaveAccessibleName('Add item');

  // Exactly "Add item" — the decorative icon must not leak a competing name.
  await expect(vueButton(page, 'vue-icon-only')).toHaveAccessibleName(/^Add item$/);
});

test('behaviour: a default-type Vue button inside a <form> does NOT submit it', async ({
  page,
}) => {
  await expect(vueButton(page, 'vue-in-form')).toBeVisible();

  const vueSubmits = await page.evaluate(() => {
    const form = document.querySelector('[data-testid="vue-form"]') as HTMLFormElement;
    let n = 0;
    form.addEventListener('submit', () => {
      n += 1;
    });
    (document.querySelector('[data-testid="vue-in-form"]') as HTMLButtonElement)?.click();
    return n;
  });
  expect(vueSubmits, 'Vue: a type=button button must not submit the form').toBe(0);
});

test('behaviour: a disabled Vue button does NOT fire click (count stays zero)', async ({
  page,
}) => {
  await expect(vueButton(page, 'vue-disabled')).toBeDisabled();

  const vueClicks = await page.evaluate(() => {
    const btn = document.querySelector('[data-testid="vue-disabled"]') as HTMLButtonElement;
    let n = 0;
    btn.addEventListener('click', () => {
      n += 1;
    });
    btn.click();
    return n;
  });
  expect(vueClicks, 'Vue: disabled button must dispatch no click').toBe(0);
});

test('tokens: re-pointing --lab-fill-accent re-skins the Vue renderer, matching Lit', async ({
  page,
}) => {
  const lit = litButton(page, 'lit-accent-fill');
  const vue = vueButton(page, 'vue-accent-fill');
  await expect(vue).toBeVisible();

  const sentinel = 'rgb(1, 2, 3)';
  await page.evaluate((value) => {
    document.documentElement.style.setProperty('--lab-fill-accent', value);
  }, sentinel);

  await expect.poll(() => lit.evaluate(bg)).toBe('rgb(1, 2, 3)');
  await expect.poll(() => vue.evaluate(bg)).toBe('rgb(1, 2, 3)');
});

test('theme: flipping [data-theme] re-skins the Vue renderer, matching Lit', async ({ page }) => {
  const lit = litButton(page, 'lit-neutral-tinted');
  const vue = vueButton(page, 'vue-neutral-tinted');
  await expect(vue).toBeVisible();

  const litDark = await lit.evaluate(bg);
  const vueDark = await vue.evaluate(bg);

  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));

  await expect.poll(() => lit.evaluate(bg)).not.toBe(litDark);
  await expect.poll(() => vue.evaluate(bg)).not.toBe(vueDark);
});
