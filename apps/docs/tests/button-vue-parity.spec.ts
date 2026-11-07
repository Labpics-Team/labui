import { type Locator, type Page, expect, test } from '@playwright/test';

/**
 * Button — Vue parity suite (companion to button.spec.ts's Lit↔React suite).
 *
 * ADR-0001 (A-prime): Vue is NOT a native renderer. The Vue `<Button>` is a
 * THIN wrapper that mounts the Lit `<lab-button>` custom element and forwards
 * props / events / slots onto it. So "parity" here does not compare two
 * independent implementations — it verifies the wrapper-mounted `<lab-button>`
 * produces the SAME observable result as a directly-authored `<lab-button>`
 * (the ones the Lit section of button.html renders). The fixture mounts both
 * under the SAME [data-theme] root.
 *
 * These checks are the Vue wrapper's browser-side definition of done:
 *   1. Consumption — the Vue island mounts a real `<lab-button>` custom element
 *      (shadow root + inner native <button>), never a re-implemented control.
 *   2. Visual parity — for matching specimens, the wrapper-mounted element
 *      resolves the SAME computed colours as a hand-authored `<lab-button>`.
 *   3. Behaviour — a click fires; a disabled/loading button does not; a
 *      default-type button inside a <form> does not submit it.
 *   4. a11y — keyboard activation (Enter), aria-busy/disabled, an icon-only
 *      button named via aria-label forwarded through the host (WCAG 4.1.2).
 *   5. Tokens + theme — re-pointing a role, and flipping [data-theme],
 *      re-skins the wrapper-mounted element exactly like the direct one.
 */

/** The `<lab-button>` custom-element host the Vue wrapper renders. */
function vueHost(page: Page, testid: string): Locator {
  return page.getByTestId(testid);
}
/**
 * The inner native <button> (shadow-pierced). Both the directly-authored Lit
 * specimen and the Vue-wrapper-mounted one are the SAME element type, so the
 * same locator reaches the real interactive button in either case.
 */
function innerButton(page: Page, testid: string): Locator {
  return page.getByTestId(testid).locator('button');
}

const bg = (el: HTMLElement) => getComputedStyle(el).backgroundColor;
const fg = (el: HTMLElement) => getComputedStyle(el).color;

test.beforeEach(async ({ page }) => {
  await page.goto('/button.html');
  await expect(page.locator('html')).toHaveAttribute('data-lab-colors-state', 'ready');
});

test('fixture: the delivered HTML carries the Lit reference and a Vue mount node', async ({
  request,
}) => {
  const body = await (await request.get('/button.html')).text();
  expect(body).toMatch(/<lab-button/i);
  expect(body).toContain('id="vue-root"');
});

test('consumption: the Vue island mounts a real <lab-button> custom element, not a re-implementation', async ({
  page,
}) => {
  const host = vueHost(page, 'vue-accent-fill');
  await expect(host).toBeVisible();

  // The node the Vue wrapper rendered IS the Lit custom element…
  expect(await host.evaluate((el) => el.tagName.toLowerCase())).toBe('lab-button');
  // …upgraded with a shadow root that carries the real interactive <button> —
  // the exact structure a directly-authored `<lab-button>` has.
  expect(
    await host.evaluate((el) => Boolean((el as HTMLElement & { shadowRoot: unknown }).shadowRoot)),
  ).toBe(true);
  await expect(innerButton(page, 'vue-accent-fill')).toBeVisible();
});

test('visual parity: the Vue-mounted element resolves the SAME fill colours as a direct <lab-button>', async ({
  page,
}) => {
  await expect(vueHost(page, 'vue-accent-fill')).toBeVisible();

  for (const variant of ['accent-fill', 'neutral-tinted', 'danger-border'] as const) {
    const lit = innerButton(page, `lit-${variant}`);
    const vue = innerButton(page, `vue-${variant}`);

    const litBg = await lit.evaluate(bg);
    const vueBg = await vue.evaluate(bg);
    const litFg = await lit.evaluate(fg);
    const vueFg = await vue.evaluate(fg);

    expect(vueBg, `${variant}: background parity`).toBe(litBg);
    expect(vueFg, `${variant}: label parity`).toBe(litFg);
  }
});

test('behaviour: a click fires through the Vue-mounted element', async ({ page }) => {
  const vue = innerButton(page, 'vue-accent-fill');
  await expect(vue).toBeVisible();

  const clicks = await vue.evaluate((btn: HTMLButtonElement) => {
    let n = 0;
    btn.addEventListener('click', () => {
      n += 1;
    });
    btn.click();
    return n;
  });
  expect(clicks).toBe(1);
});

test('a11y: loading sets aria-busy and disables the inner button', async ({ page }) => {
  const btn = innerButton(page, 'vue-loading');
  await expect(btn, 'vue loading is aria-busy').toHaveAttribute('aria-busy', 'true');
  await expect(btn, 'vue loading is disabled').toBeDisabled();
});

test('a11y: keyboard activates the button (Enter) on the Vue-mounted element', async ({ page }) => {
  const vue = innerButton(page, 'vue-accent-fill');
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

test('a11y name: an icon-only Vue button is named via aria-label forwarded through the host (WCAG 4.1.2)', async ({
  page,
}) => {
  const btn = innerButton(page, 'vue-icon-only');
  await expect(btn).toBeVisible();

  await expect(
    btn,
    'icon-only inner button must be named by the forwarded aria-label',
  ).toHaveAccessibleName('Add item');
  // Exactly "Add item" — the decorative icon must not leak a competing name.
  await expect(btn).toHaveAccessibleName(/^Add item$/);
});

test('behaviour: a default-type Vue button inside a <form> does NOT submit it', async ({
  page,
}) => {
  await expect(vueHost(page, 'vue-in-form')).toBeVisible();

  const submits = await page.evaluate(() => {
    const form = document.querySelector('[data-testid="vue-form"]') as HTMLFormElement;
    let n = 0;
    form.addEventListener('submit', () => {
      n += 1;
    });
    const host = document.querySelector('[data-testid="vue-in-form"]') as HTMLElement;
    (host.shadowRoot?.querySelector('button') as HTMLButtonElement | null)?.click();
    return n;
  });
  expect(submits, 'Vue: a type=button button must not submit the form').toBe(0);
});

test('behaviour: a disabled Vue button does NOT fire click (count stays zero)', async ({
  page,
}) => {
  const btn = innerButton(page, 'vue-disabled');
  await expect(btn).toBeDisabled();

  const clicks = await btn.evaluate((el: HTMLButtonElement) => {
    let n = 0;
    el.addEventListener('click', () => {
      n += 1;
    });
    el.click();
    return n;
  });
  expect(clicks, 'Vue: disabled button must dispatch no click').toBe(0);
});

test('tokens: re-pointing --lab-fill-accent re-skins the Vue-mounted element, matching the direct one', async ({
  page,
}) => {
  const lit = innerButton(page, 'lit-accent-fill');
  const vue = innerButton(page, 'vue-accent-fill');
  await expect(vue).toBeVisible();

  const sentinel = 'rgb(1, 2, 3)';
  await page.evaluate((value) => {
    document.documentElement.style.setProperty('--lab-fill-accent', value);
  }, sentinel);

  await expect.poll(() => lit.evaluate(bg)).toBe('rgb(1, 2, 3)');
  await expect.poll(() => vue.evaluate(bg)).toBe('rgb(1, 2, 3)');
});

test('theme: flipping [data-theme] re-skins the Vue-mounted element, matching the direct one', async ({
  page,
}) => {
  const lit = innerButton(page, 'lit-neutral-tinted');
  const vue = innerButton(page, 'vue-neutral-tinted');
  await expect(vue).toBeVisible();

  const litDark = await lit.evaluate(bg);
  const vueDark = await vue.evaluate(bg);

  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));

  await expect.poll(() => lit.evaluate(bg)).not.toBe(litDark);
  await expect.poll(() => vue.evaluate(bg)).not.toBe(vueDark);
});
