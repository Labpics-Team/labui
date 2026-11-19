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

test('Figma button metrics survive themes, text scaling and both renderers', async ({ page }) => {
  await expect(reactButton(page, 'react-size-m')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  // Figma 6227:8249 / 8347 / 8445. These are component metrics, not control-scale steps.
  for (const theme of ['light', 'dark']) {
    await page.getByTestId('theme-select').selectOption(theme);
    for (const scale of [1, 2]) {
      await page.evaluate((value) => {
        document.documentElement.style.fontSize = `${16 * value}px`;
      }, scale);
      for (const [size, height, font, line] of [
        ['s', 36, 14, 12],
        ['m', 48, 16, 24],
        ['l', 56, 16, 24],
      ] as const) {
        const measurements = [];
        for (const renderer of ['lit', 'react']) {
          const control =
            renderer === 'lit'
              ? litButton(page, `lit-size-${size}`)
              : reactButton(page, `react-size-${size}`);
          const measured = await control.evaluate((element: HTMLElement) => {
            const style = getComputedStyle(element);
            return {
              height: element.getBoundingClientRect().height,
              font: Number.parseFloat(style.fontSize),
              line: Number.parseFloat(style.lineHeight),
              weight: style.fontWeight,
              gradient: style.backgroundImage,
              shadow: style.boxShadow,
            };
          });
          expect(measured.height, `${renderer}/${size}/${theme}/${scale}`).toBeCloseTo(
            height * scale,
            1,
          );
          expect(measured.font).toBe(font * scale);
          expect(measured.line).toBeCloseTo(line * scale, 2);
          expect(measured.weight).toBe('500');
          expect(measured.gradient).toContain('linear-gradient');
          expect(measured.shadow).toContain('inset');
          measurements.push(measured);
        }
        expect(measurements[0]).toEqual(measurements[1]);
      }
    }
  }
});

test('Figma highlight responds to hover and press without changing the action fill', async ({
  page,
}) => {
  for (const renderer of ['lit', 'react']) {
    const control =
      renderer === 'lit' ? litButton(page, 'lit-size-m') : reactButton(page, 'react-size-m');
    await page.mouse.move(0, 0);
    const before = await control.evaluate((el) => ({
      fill: getComputedStyle(el).backgroundColor,
      gradient: getComputedStyle(el).backgroundImage,
    }));
    await control.hover();
    const hovered = await control.evaluate((el) => ({
      fill: getComputedStyle(el).backgroundColor,
      gradient: getComputedStyle(el).backgroundImage,
    }));
    expect(hovered.fill).toBe(before.fill);
    expect(hovered.gradient).not.toBe(before.gradient);
    await page.mouse.down();
    const pressed = await control.evaluate((el) => getComputedStyle(el).backgroundImage);
    expect(pressed).not.toBe(hovered.gradient);
    expect(await control.evaluate((el) => getComputedStyle(el).boxShadow)).toMatch(/0px 1px 1px/);
    await page.mouse.up();
  }
});

test('anatomy: secondary label and both icons preserve geometry and name during loading', async ({
  page,
}) => {
  const measured = [];
  for (const renderer of ['lit', 'react']) {
    const ready =
      renderer === 'lit' ? litButton(page, 'lit-anatomy') : reactButton(page, 'react-anatomy');
    const pending =
      renderer === 'lit'
        ? litButton(page, 'lit-anatomy-loading')
        : reactButton(page, 'react-anatomy-loading');
    await expect(ready).toHaveAccessibleName('Main Description');
    await expect(pending).toHaveAccessibleName('Main Description');
    await expect(pending).toBeDisabled();
    const host = page.getByTestId(`${renderer}-anatomy`);
    const busyHost = page.getByTestId(`${renderer}-anatomy-loading`);
    for (const icon of await busyHost.locator('svg').all())
      await expect(icon).toHaveCSS('visibility', 'hidden');
    const description = host.locator('[slot="description"], .lab-button-description');
    await expect(description).toHaveCSS('font-weight', '400');
    await expect(description).toHaveCSS('letter-spacing', '-0.25px');
    const busyDescription = busyHost.locator('[slot="description"], .lab-button-description');
    const busyTextColor = await busyDescription.evaluate((el) => getComputedStyle(el).color);
    expect(busyTextColor).not.toBe('rgba(0, 0, 0, 0)');
    const loader = busyHost.locator('.main .spinner, .lab-button-main .lab-button-spinner');
    await expect(loader).toHaveCSS('width', '24px');
    await expect(loader).toHaveCSS('height', '24px');
    expect(await loader.evaluate((el) => getComputedStyle(el).maskImage)).toContain(
      'data:image/svg+xml',
    );
    const dimensions = await ready.boundingBox();
    const busyDimensions = await pending.boundingBox();
    expect(busyDimensions?.width).toBeCloseTo(dimensions?.width ?? 0, 1);
    expect(busyDimensions?.height).toBe(dimensions?.height);
    measured.push({
      width: dimensions?.width,
      height: dimensions?.height,
      color: await description.evaluate((el) => getComputedStyle(el).color),
    });
  }
  expect(measured[0]).toEqual(measured[1]);
});

test('Figma plain button surfaces respond to hover, press and disable', async ({ page }) => {
  for (const renderer of ['lit', 'react']) {
    const host = page.getByTestId(`${renderer}-anatomy`);
    const button = renderer === 'lit' ? host.locator('button') : host;
    await expect(button).toBeVisible();
    for (const kind of ['border', 'ghost']) {
      await host.evaluate(
        (el, value) => el.setAttribute(el.localName === 'lab-button' ? 'kind' : 'data-kind', value),
        kind,
      );
      await page.mouse.move(0, 0);
      await expect(button).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      const label = await button.evaluate(fg);
      await host.hover();
      await expect.poll(() => button.evaluate(bg)).not.toBe('rgba(0, 0, 0, 0)');
      await expect(button).toHaveCSS('color', label);
      await page.mouse.down();
      await expect(button).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      await page.mouse.up();
      await host.evaluate((el) => el.setAttribute('disabled', ''));
      await expect(button).toBeDisabled();
      await expect(button).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      if (kind === 'border') {
        const border = await button.evaluate((el) => getComputedStyle(el).borderTopColor);
        expect(border).toMatch(/rgba\(120, 120, 128,/);
      }
      await host.evaluate((el) => el.removeAttribute('disabled'));
    }
  }
});

test('Lit slot content can arrive after the icon-only first render', async ({ page }) => {
  const host = page.getByTestId('lit-icon-only');
  await host.evaluate((el) => {
    el.removeAttribute('icon');
    el.removeAttribute('aria-label');
    el.append(document.createTextNode('Добавить строку'));
  });
  await expect(host.getByRole('button')).toHaveAccessibleName('Добавить строку');
  await expect(host.locator('.label')).toBeVisible();
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
  // Wait for the React island to mount before any raw `querySelector` touches it —
  // a bare `page.evaluate` does not auto-wait the way a locator action does, so
  // attaching the listener too early raced against React's client mount (null
  // button). Resolving the locator first guarantees the node exists.
  await react.waitFor();
  // Record clicks on a window flag so the count survives across evaluate calls.
  await react.evaluate((btn: HTMLButtonElement) => {
    (window as unknown as { __clicks: number }).__clicks = 0;
    btn.addEventListener('click', () => {
      (window as unknown as { __clicks: number }).__clicks += 1;
    });
  });
  // Focus via the locator action and assert with the auto-retrying matcher so the
  // focus-and-check is atomic. Focusing in one `page.evaluate` and reading
  // `document.activeElement` in a SEPARATE round-trip raced on WebKit, which can
  // drop button focus between protocol calls (the same engine quirk the accordion
  // fix addresses). `toBeFocused()` proves the same thing without the race.
  await react.focus();
  await expect(react).toBeFocused();
  // Enter on a focused native button activates it — the platform default, not a
  // re-implemented key handler.
  await react.press('Enter');
  expect(await page.evaluate(() => (window as unknown as { __clicks: number }).__clicks)).toBe(1);
});

test('a11y name: an icon-only button is named via aria-label on BOTH renderers (WCAG 4.1.2)', async ({
  page,
}) => {
  // The icon-only specimen has an EMPTY default slot/children — the icon is the
  // only visible content and is decorative (aria-hidden). The accessible name can
  // therefore come ONLY from the consumer-set `aria-label`. On the Lit element that
  // host attribute must cross the shadow boundary onto the inner <button>; on the
  // React twin it must reach the native <button>. `getByRole(..., { name })` runs
  // the browser's REAL accessible-name computation, identically on Chromium + WebKit
  // — the definition of "has a name" an AT would use, not an attribute proxy.
  await expect(reactButton(page, 'react-icon-only')).toBeVisible();

  // React: the native <button> (the testid node) must resolve the name "Add item".
  await expect(
    reactButton(page, 'react-icon-only'),
    'React icon-only button must be named by aria-label',
  ).toHaveAccessibleName('Add item');

  // Lit: the inner shadow <button> must resolve the SAME name. Scoping the role
  // query under the host pierces the shadow root, so this asserts the host
  // aria-label was forwarded across the boundary onto the inner button (it is NOT a
  // light-DOM ancestor of the shadow button, so nothing names it implicitly).
  await expect(
    page.getByTestId('lit-icon-only').getByRole('button'),
    'Lit icon-only inner <button> must be named by the forwarded aria-label',
  ).toHaveAccessibleName('Add item');

  // The decorative icon must NOT contribute a competing name on either renderer:
  // the resolved name is EXACTLY "Add item", with no leaked glyph/text.
  await expect(page.getByTestId('lit-icon-only').getByRole('button')).toHaveAccessibleName(
    /^Add item$/,
  );
  await expect(reactButton(page, 'react-icon-only')).toHaveAccessibleName(/^Add item$/);
});

test('behaviour: a default-type button inside a <form> does NOT submit (htmlType=button)', async ({
  page,
}) => {
  // htmlType defaults to "button" on both renderers, so activating the button must
  // not submit the surrounding form. We record submit events on the form and click
  // the button; the count must stay zero.
  await expect(reactButton(page, 'react-in-form')).toBeVisible();

  // Lit: the inner <button> lives in the shadow root but the <form> is in light DOM.
  const litSubmits = await page.evaluate(() => {
    const form = document.querySelector('[data-testid="lit-form"]') as HTMLFormElement;
    let n = 0;
    form.addEventListener('submit', () => {
      n += 1;
    });
    const host = document.querySelector('[data-testid="lit-in-form"]') as HTMLElement;
    host.shadowRoot?.querySelector('button')?.click();
    return n;
  });
  expect(litSubmits, 'Lit: a type=button button must not submit the form').toBe(0);

  // React.
  const reactSubmits = await page.evaluate(() => {
    const form = document.querySelector('[data-testid="react-form"]') as HTMLFormElement;
    let n = 0;
    form.addEventListener('submit', () => {
      n += 1;
    });
    (document.querySelector('[data-testid="react-in-form"]') as HTMLButtonElement)?.click();
    return n;
  });
  expect(reactSubmits, 'React: a type=button button must not submit the form').toBe(0);
});

test('behaviour: a disabled button does NOT fire click (count stays zero), not just disabled', async ({
  page,
}) => {
  // toBeDisabled() proves the attribute; this proves the BEHAVIOUR: a native
  // disabled <button> dispatches no click event even when `.click()` is called
  // programmatically, so any handler never runs.
  await expect(reactButton(page, 'react-disabled')).toBeDisabled();
  await expect(litButton(page, 'lit-disabled')).toBeDisabled();

  // Lit: attach a counter on the host AND the inner button, then click the inner
  // disabled button programmatically. The count must remain zero.
  const litClicks = await page.evaluate(() => {
    const host = document.querySelector('[data-testid="lit-disabled"]') as HTMLElement;
    let n = 0;
    host.addEventListener('click', () => {
      n += 1;
    });
    const btn = host.shadowRoot?.querySelector('button');
    btn?.addEventListener('click', () => {
      n += 1;
    });
    btn?.click();
    return n;
  });
  expect(litClicks, 'Lit: disabled button must dispatch no click').toBe(0);

  // React.
  const reactClicks = await page.evaluate(() => {
    const btn = document.querySelector('[data-testid="react-disabled"]') as HTMLButtonElement;
    let n = 0;
    btn.addEventListener('click', () => {
      n += 1;
    });
    btn.click();
    return n;
  });
  expect(reactClicks, 'React: disabled button must dispatch no click').toBe(0);
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
