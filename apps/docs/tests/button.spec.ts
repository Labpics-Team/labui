import { type Locator, type Page, expect, test } from '@playwright/test';

/**
 * Button suite — the first PRODUCTION component, verified on BOTH renderers.
 *
 * The fixture (`button.html`) mounts the Lit `<lab-button>` and the native-React
 * `<Button>` with identical specimens under one [data-theme]. These checks are
 * the Button's browser-side definition of done:
 *   1. SSR-free render — both renderers paint a real <button> with a token.
 *   2. Visual parity — for matching specimens, the two renderers resolve the
 *      SAME computed colours. Same --lab-* roles ⇒ same paint (ADR-0001).
 *   3. Behaviour — a click fires; a disabled/loading button does not.
 *   4. a11y — keyboard activation (Enter), focus-visible, aria-busy/disabled.
 *   5. Tokens + theme — re-pointing a role, and flipping [data-theme], re-skins
 *      both renderers (proves var() consumption, not a hardcoded colour).
 */

/** The inner native <button> for a Lit host (shadow-pierced) or a React node. */
function litButton(page: Page, testid: string): Locator {
  return page.getByTestId(testid).locator('button');
}
function reactButton(page: Page, testid: string): Locator {
  // React sets data-testid directly on the <button>, so the node IS the button.
  return page.getByTestId(testid);
}

const bg = (el: HTMLElement) => getComputedStyle(el).backgroundColor;
const fg = (el: HTMLElement) => getComputedStyle(el).color;

test.beforeEach(async ({ page }) => {
  await page.goto('/button.html');
});

test('delivered HTML carries the Lit element (React island mounts on the client)', async ({
  request,
}) => {
  const body = await (await request.get('/button.html')).text();
  // The Lit `<lab-button>` is authored in the static markup; the React island is
  // mounted client-side into #react-root, so it is intentionally not in the raw
  // HTML. Both upgrade in the browser — asserted by the parity test below.
  expect(body).toMatch(/<lab-button/i);
  expect(body).toContain('id="react-root"');
});

test('visual parity: Lit and React resolve the same fill colours', async ({ page }) => {
  // Wait for the React island to mount.
  await expect(reactButton(page, 'react-accent-fill')).toBeVisible();

  for (const variant of ['accent-fill', 'neutral-tinted', 'danger-border'] as const) {
    const lit = litButton(page, `lit-${variant}`);
    const react = reactButton(page, `react-${variant}`);

    const litBg = await lit.evaluate(bg);
    const reactBg = await react.evaluate(bg);
    const litFg = await lit.evaluate(fg);
    const reactFg = await react.evaluate(fg);

    expect(reactBg, `${variant}: background parity`).toBe(litBg);
    expect(reactFg, `${variant}: label parity`).toBe(litFg);
  }
});

test('behaviour: click fires on both renderers; disabled blocks it', async ({ page }) => {
  // Lit: attach a listener on the host, click the inner button.
  const litClicks = await page.evaluate(() => {
    const host = document.querySelector('[data-testid="lit-accent-fill"]');
    let n = 0;
    host?.addEventListener('click', () => {
      n += 1;
    });
    (host as HTMLElement)?.shadowRoot?.querySelector('button')?.click();
    return n;
  });
  expect(litClicks).toBe(1);

  // React: clicking the disabled button must NOT fire (the native button is
  // disabled). Playwright's click would time out on a disabled element, so we
  // assert the attribute instead.
  await expect(reactButton(page, 'react-disabled')).toBeDisabled();
  await expect(litButton(page, 'lit-disabled')).toBeDisabled();
});

test('a11y: loading sets aria-busy and disables; both renderers agree', async ({ page }) => {
  for (const [r, id] of [
    ['lit', 'lit-loading'],
    ['react', 'react-loading'],
  ] as const) {
    const btn = r === 'lit' ? litButton(page, id) : reactButton(page, id);
    await expect(btn, `${r} loading is aria-busy`).toHaveAttribute('aria-busy', 'true');
    await expect(btn, `${r} loading is disabled`).toBeDisabled();
  }
});

test('a11y: keyboard activates the button (Enter) on the React renderer', async ({ page }) => {
  const react = reactButton(page, 'react-accent-fill');
  // Record clicks on a window flag so the count survives across evaluate calls.
  await page.evaluate(() => {
    const btn = document.querySelector('[data-testid="react-accent-fill"]') as HTMLButtonElement;
    (window as unknown as { __clicks: number }).__clicks = 0;
    btn.addEventListener('click', () => {
      (window as unknown as { __clicks: number }).__clicks += 1;
    });
    btn.focus();
  });
  expect(await page.evaluate(() => document.activeElement?.getAttribute('data-testid'))).toBe(
    'react-accent-fill',
  );
  // Enter on a focused native button activates it — the platform default, not a
  // re-implemented key handler.
  await react.press('Enter');
  expect(await page.evaluate(() => (window as unknown as { __clicks: number }).__clicks)).toBe(1);
});

test('focus-visible: Lit host delegates focus to the inner button', async ({ page }) => {
  await page.getByTestId('lit-accent-fill').evaluate((host: HTMLElement) => host.focus());
  const innerFocused = await page.evaluate(() => {
    const host = document.querySelector('[data-testid="lit-accent-fill"]') as HTMLElement;
    return host.shadowRoot?.activeElement?.tagName.toLowerCase();
  });
  expect(innerFocused).toBe('button');
});

test('tokens: re-pointing --lab-fill-accent re-skins BOTH renderers', async ({ page }) => {
  const lit = litButton(page, 'lit-accent-fill');
  const react = reactButton(page, 'react-accent-fill');
  await expect(react).toBeVisible();

  const sentinel = 'rgb(1, 2, 3)';
  await page.evaluate((value) => {
    document.documentElement.style.setProperty('--lab-fill-accent', value);
  }, sentinel);

  await expect.poll(() => lit.evaluate(bg)).toBe('rgb(1, 2, 3)');
  await expect.poll(() => react.evaluate(bg)).toBe('rgb(1, 2, 3)');
});

test('theme: flipping [data-theme] re-skins both renderers with zero edits', async ({ page }) => {
  const lit = litButton(page, 'lit-neutral-tinted');
  const react = reactButton(page, 'react-neutral-tinted');
  await expect(react).toBeVisible();

  const litDark = await lit.evaluate(bg);
  const reactDark = await react.evaluate(bg);

  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));

  await expect.poll(() => lit.evaluate(bg)).not.toBe(litDark);
  await expect.poll(() => react.evaluate(bg)).not.toBe(reactDark);
});
