import { type Locator, type Page, expect, test } from '@playwright/test';
import { litInputIds, probeInput } from './support/accessible-name.js';

/**
 * Switch suite — a PRODUCTION component that CONSUMES the @zag-js/switch machine
 * through the LabUI seam, verified on BOTH renderers.
 *
 * The fixture (`switch.html`) mounts the Lit `<lab-switch>` and the native-React
 * `<Switch>` with identical specimens under one [data-theme]. These checks are
 * the Switch's browser-side definition of done:
 *   1. Render — both renderers paint a real control with a token.
 *   2. Machine behaviour — clicking toggles the machine: the hidden checkbox
 *      input flips and the visual state follows (Lit host `checked` attribute /
 *      React `data-checked`). A keyboard Space toggles via the native input.
 *   3. Disabled — a disabled control does not toggle (machine blocks it).
 *   4. Visual parity — matching specimens resolve the SAME computed track colour.
 *   5. Tokens + theme — re-pointing a role / flipping [data-theme] re-skins both.
 */

/** The Lit host element (shadow-pierced for inner nodes). */
function litHost(page: Page, testid: string): Locator {
  return page.getByTestId(testid);
}
/** The React `[data-lab-switch]` label inside its testid wrapper. */
function reactSwitch(page: Page, testid: string): Locator {
  return page.getByTestId(testid).locator('[data-lab-switch]');
}

/** The painted track (control) for a Lit host or a React label. */
function litTrack(page: Page, testid: string): Locator {
  return litHost(page, testid).locator('.lab-switch-control, .control');
}
function reactTrack(page: Page, testid: string): Locator {
  return reactSwitch(page, testid).locator('.lab-switch-control');
}

/** The hidden native input — the a11y primitive — for a Lit host or React label. */
function litInput(page: Page, testid: string): Locator {
  return litHost(page, testid).locator('input');
}
function reactInput(page: Page, testid: string): Locator {
  return reactSwitch(page, testid).locator('input');
}

const bg = (el: HTMLElement) => getComputedStyle(el).backgroundColor;

test.beforeEach(async ({ page }) => {
  await page.goto('/switch.html');
});

test('delivered HTML carries the Lit element (React island mounts client-side)', async ({
  request,
}) => {
  const body = await (await request.get('/switch.html')).text();
  expect(body).toMatch(/<lab-switch/i);
  expect(body).toContain('id="react-root"');
});

test('SSR before JavaScript has the correct native value, name and icon-only geometry', async ({
  browser,
}) => {
  const { html, renderToString } = await import('../../../packages/core/dist/ssr/index.js');
  await import('../../../packages/core/dist/components/switch/index.js');
  const output = renderToString(
    html`<lab-switch icon aria-label="Off"></lab-switch><lab-switch icon checked aria-label="On"></lab-switch>`,
  );
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.setContent(output);
    await expect(page.getByRole('switch', { name: 'Off', exact: true })).not.toBeChecked();
    await expect(page.getByRole('switch', { name: 'On', exact: true })).toBeChecked();
    expect(
      await page
        .locator('lab-switch')
        .first()
        .evaluate((element) => element.getBoundingClientRect().width),
    ).toBe(36);
  } finally {
    await context.close();
  }
});

test('machine behaviour: clicking toggles checked on both renderers', async ({ page }) => {
  // Lit: the host reflects the machine's checked state as an attribute.
  const lit = litHost(page, 'lit-accent-off');
  await expect(lit).toBeVisible();
  await expect(lit).not.toHaveAttribute('checked', /.*/);
  // Click the inner track; the Zag machine flips the hidden input + state.
  await litTrack(page, 'lit-accent-off').click();
  await expect(lit).toHaveAttribute('checked', '');
  // The hidden input (the machine's real semantic element) agrees.
  expect(
    await lit.evaluate(
      (host) => (host as HTMLElement).shadowRoot?.querySelector('input')?.checked ?? null,
    ),
  ).toBe(true);

  // React: the label carries data-checked once the machine flips it.
  const react = reactSwitch(page, 'react-accent-off');
  await expect(react).toBeVisible();
  await expect(react).not.toHaveAttribute('data-checked', /.*/);
  await reactTrack(page, 'react-accent-off').click();
  await expect(react).toHaveAttribute('data-checked', 'true');
});

test('a11y: Space on the focused control toggles via the native input (keyboard)', async ({
  page,
}) => {
  // The Zag switch uses a real hidden <input type=checkbox>: focus it and press
  // Space — the browser toggles it natively and the machine reacts. No
  // re-implemented key handler.
  const lit = litHost(page, 'lit-accent-off');
  await lit.evaluate((host) => {
    (host as HTMLElement).shadowRoot?.querySelector('input')?.focus();
  });
  await page.keyboard.press('Space');
  await expect(lit).toHaveAttribute('checked', '');
});

test('a11y name: the hidden input is exposed and named by the visible label (both renderers)', async ({
  page,
}) => {
  // The control IS the hidden <input>. It must live in the a11y tree (NOT inside
  // an aria-hidden subtree) and carry a real name. The machine puts
  // aria-labelledby="switch:{id}:label" on it; that idref must resolve to the
  // rendered label element.
  await expect(reactSwitch(page, 'react-accent-off')).toBeVisible();

  const lit = await probeInput(litInput(page, 'lit-accent-off'));
  expect(lit.ariaHidden, 'Lit switch input must NOT be in an aria-hidden subtree').toBe(false);
  expect(lit.labelledbyResolves, 'Lit switch aria-labelledby must resolve').toBe(true);
  expect(lit.name).toBe('Wi-Fi');

  const react = await probeInput(reactInput(page, 'react-accent-off'));
  expect(react.ariaHidden, 'React switch input must NOT be in an aria-hidden subtree').toBe(false);
  expect(react.labelledbyResolves, 'React switch aria-labelledby must resolve').toBe(true);
  expect(react.name).toBe('Wi-Fi');
});

test('a11y name: an icon-only switch is named via aria-label (no visible label)', async ({
  page,
}) => {
  await expect(reactSwitch(page, 'react-icon-only')).toBeVisible();

  const lit = await probeInput(litInput(page, 'lit-icon-only'));
  expect(lit.ariaHidden).toBe(false);
  expect(lit.name).toBe('Mute');

  const react = await probeInput(reactInput(page, 'react-icon-only'));
  expect(react.ariaHidden).toBe(false);
  expect(react.name).toBe('Mute');
});

test('a dynamically created empty Switch keeps its name after activation', async ({ page }) => {
  await page.evaluate(() => {
    const host = document.createElement('lab-switch');
    host.id = 'dynamic-icon';
    host.setAttribute('icon', '');
    host.setAttribute('aria-label', 'Power');
    document.body.append(host);
  });
  const control = page.getByRole('switch', { name: 'Power', exact: true });
  await expect(control).not.toBeChecked();
  await page.locator('#dynamic-icon .lab-switch-control').click();
  await expect(control).toBeChecked();
});

test('a11y ids: every Lit switch instance has a UNIQUE input id (no :undefined collisions)', async ({
  page,
}) => {
  await expect(litHost(page, 'lit-accent-off')).toBeVisible();
  const ids = await litInputIds(litHost(page, 'lit-accent-off'), 'lab-switch');
  expect(ids.length).toBeGreaterThan(1);
  for (const id of ids)
    expect(id, 'id must be non-empty and not :undefined').not.toContain('undefined');
  expect(new Set(ids).size, `ids must be unique: ${ids.join(', ')}`).toBe(ids.length);
});

test('disabled: the machine blocks the toggle on both renderers', async ({ page }) => {
  const lit = litHost(page, 'lit-disabled');
  // The hidden input is disabled, so clicking the track cannot toggle it.
  expect(
    await lit.evaluate(
      (host) => (host as HTMLElement).shadowRoot?.querySelector('input')?.disabled ?? null,
    ),
  ).toBe(true);
  await expect(lit).not.toHaveAttribute('checked', /.*/);

  const react = reactSwitch(page, 'react-disabled');
  await expect(react).toHaveAttribute('data-disabled', 'true');
  expect(await react.locator('input').evaluate((el) => (el as HTMLInputElement).disabled)).toBe(
    true,
  );
});

test('visual parity: Lit and React resolve the same ON track colour', async ({ page }) => {
  await expect(reactSwitch(page, 'react-accent-on')).toBeVisible();

  for (const variant of ['accent-on', 'neutral-on', 'danger-on'] as const) {
    const litBg = await litTrack(page, `lit-${variant}`).evaluate(bg);
    const reactBg = await reactTrack(page, `react-${variant}`).evaluate(bg);
    expect(reactBg, `${variant}: track background parity`).toBe(litBg);
  }
});

test('tokens: re-pointing --lab-fill-accent re-skins BOTH ON tracks', async ({ page }) => {
  const lit = litTrack(page, 'lit-accent-on');
  const react = reactTrack(page, 'react-accent-on');
  await expect(reactSwitch(page, 'react-accent-on')).toBeVisible();

  await page.evaluate(() => {
    document.documentElement.style.setProperty('--lab-fill-accent', 'rgb(1, 2, 3)');
  });
  await expect.poll(() => lit.evaluate(bg)).toBe('rgb(1, 2, 3)');
  await expect.poll(() => react.evaluate(bg)).toBe('rgb(1, 2, 3)');
});

test('theme: flipping [data-theme] re-skins both renderers with zero edits', async ({ page }) => {
  const lit = litTrack(page, 'lit-neutral-on');
  const react = reactTrack(page, 'react-neutral-on');
  await expect(reactSwitch(page, 'react-neutral-on')).toBeVisible();

  const litDark = await lit.evaluate(bg);
  const reactDark = await react.evaluate(bg);

  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));

  await expect.poll(() => lit.evaluate(bg)).not.toBe(litDark);
  await expect.poll(() => react.evaluate(bg)).not.toBe(reactDark);
});

for (const renderer of ['lit', 'react']) {
  test(`${renderer}: native form submission, required, reset and disabled fieldset`, async ({
    page,
  }) => {
    const form = page.getByTestId(`${renderer}-form`);
    const input = form.locator('input[name="alerts"]');
    await expect(input).toBeChecked();
    const data = () => form.evaluate((element) => [...new FormData(element as HTMLFormElement)]);
    expect(await data()).toEqual([['alerts', 'yes']]);
    await input.focus();
    await page.keyboard.press('Space');
    await expect(input).not.toBeChecked();
    expect(await data()).toEqual([]);
    expect(await form.evaluate((element) => (element as HTMLFormElement).checkValidity())).toBe(
      false,
    );
    await form.getByRole('button', { name: 'Сбросить' }).click();
    await expect(input).toBeChecked();
    expect(await data()).toEqual([['alerts', 'yes']]);
    expect(await form.evaluate((element) => (element as HTMLFormElement).checkValidity())).toBe(
      true,
    );
    await expect(form.locator('input[name="disabled"]')).toBeDisabled();
  });

  test(`${renderer}: all authored sizes and pressed/hover geometry`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const host =
      renderer === 'lit' ? litHost(page, 'lit-icon-only') : reactSwitch(page, 'react-icon-only');
    const track = host.locator('.lab-switch-control');
    const thumb = host.locator('.lab-switch-thumb');
    for (const [size, width, height] of [
      ['s', 28, 16],
      ['m', 36, 20],
      ['l', 44, 24],
    ] as const) {
      await host.evaluate((node, size) => {
        node.setAttribute(node.tagName === 'LAB-SWITCH' ? 'size' : 'data-size', size);
      }, size);
      await expect
        .poll(() =>
          track.evaluate((node) => [
            node.getBoundingClientRect().width,
            node.getBoundingClientRect().height,
          ]),
        )
        .toEqual([width, height]);
      await track.hover();
      await expect
        .poll(() => thumb.evaluate((node) => node.getBoundingClientRect().width))
        .toBe(height - 2);
      await page.mouse.down();
      await expect
        .poll(() => thumb.evaluate((node) => node.getBoundingClientRect().width))
        .toBe(height - 8);
      await page.mouse.up();
      await page.mouse.move(0, 0);
      await expect
        .poll(() => thumb.evaluate((node) => node.getBoundingClientRect().width))
        .toBe(height - 4);
    }
  });

  test(`${renderer}: authored icon is a transparent thumb mask and the label keeps its color when disabled`, async ({
    page,
  }) => {
    const host =
      renderer === 'lit' ? litHost(page, 'lit-icon-only') : reactSwitch(page, 'react-icon-only');
    const mask = await host
      .locator('.lab-switch-thumb')
      .evaluate((node) => getComputedStyle(node, '::before').maskImage);
    expect(mask).toContain('data:image/svg+xml');
    expect(decodeURIComponent(mask)).toContain('mask=');
    const disabled =
      renderer === 'lit' ? litHost(page, 'lit-disabled') : reactSwitch(page, 'react-disabled');
    expect(await disabled.evaluate((node) => getComputedStyle(node).opacity)).toBe('1');
  });

  for (const width of [320, 390]) {
    test(`${renderer}: full Russian label at ${width}px with 200% type`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1300 });
      await page.evaluate(() => {
        document.documentElement.style.fontSize = '32px';
      });
      const host = page.getByTestId(`${renderer}-long`);
      await expect(host).toContainText(
        'Отправлять уведомления о завершении обработки фотографий автоматически',
      );
      expect(
        await host.evaluate((element) => {
          const box = element.getBoundingClientRect();
          return box.right <= innerWidth && element.scrollWidth <= element.clientWidth + 1;
        }),
      ).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    });
  }
}

test('controlled values only change when the consumer accepts the request', async ({ page }) => {
  const lit = page.getByTestId('lit-controlled');
  await lit.locator('.lab-switch-control').click();
  await expect(lit.locator('input')).not.toBeChecked();
  const react = page.getByTestId('react-controlled');
  await react.locator('.lab-switch-control').nth(0).click();
  await expect(react.locator('input').nth(0)).toBeChecked();
  await react.locator('.lab-switch-control').nth(1).click();
  await expect(react.locator('input').nth(1)).not.toBeChecked();
});

test('Lit participates in an external form and external label activates once', async ({ page }) => {
  await page.evaluate(async () => {
    const form = document.createElement('form');
    form.id = 'outside-form';
    const label = document.createElement('label');
    label.htmlFor = 'outside-switch';
    label.textContent = 'Внешняя подпись';
    const host = document.createElement('lab-switch');
    host.id = 'outside-switch';
    host.setAttribute('form', form.id);
    host.setAttribute('name', 'outside');
    document.body.append(form, label, host);
  });
  await expect(
    page.locator('#outside-switch').getByRole('switch', { name: 'Внешняя подпись', exact: true }),
  ).not.toBeChecked();
  await page.locator('label[for="outside-switch"]').evaluate((element) => {
    element.textContent = 'Обновлённая подпись';
  });
  await expect(
    page
      .locator('#outside-switch')
      .getByRole('switch', { name: 'Обновлённая подпись', exact: true }),
  ).not.toBeChecked();
  await page.locator('label[for="outside-switch"]').click();
  await expect(
    page
      .locator('#outside-switch')
      .getByRole('switch', { name: 'Обновлённая подпись', exact: true }),
  ).toBeChecked();
  await expect(page.locator('#outside-switch input')).toBeChecked();
  expect(
    await page
      .locator('#outside-form')
      .evaluate((element) => [...new FormData(element as HTMLFormElement)]),
  ).toEqual([['outside', 'on']]);
});

test('updating defaultChecked preserves the edit and changes the next form reset', async ({
  page,
}) => {
  const litForm = page.getByTestId('lit-form');
  await litForm.locator('lab-switch[name="alerts"]').evaluate((element) => {
    (element as HTMLElement & { defaultChecked: boolean }).defaultChecked = false;
  });
  await expect(litForm.locator('input[name="alerts"]')).toBeChecked();
  await litForm.getByRole('button', { name: 'Сбросить' }).click();
  await expect(litForm.locator('input[name="alerts"]')).not.toBeChecked();
  const reactForm = page.getByTestId('react-changing-default');
  await reactForm.getByRole('button', { name: 'Обновить исходное значение' }).click();
  await expect(reactForm.locator('input')).toBeChecked();
  await reactForm.getByRole('button', { name: 'Сбросить' }).click();
  await expect(reactForm.locator('input')).not.toBeChecked();
});

test('Motion retargets from the visible pose and reduced motion settles immediately', async ({
  page,
}) => {
  const host = litHost(page, 'lit-accent-off');
  const root = host.locator('[data-lab-switch]');
  await expect(root).toHaveAttribute('data-lab-motion', '');
  const samples = await host.evaluate(async (element) => {
    const root = element.shadowRoot?.querySelector<HTMLElement>('[data-lab-switch]');
    const input = element.shadowRoot?.querySelector<HTMLInputElement>('input');
    if (!root || !input) throw new Error('Switch did not render its input and frame');
    const read = () => Number(getComputedStyle(root).getPropertyValue('--_switch-progress'));
    const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    input.click();
    const frames: number[] = [];
    for (let i = 0; i < 5; i++) {
      await frame();
      frames.push(read());
    }
    const before = read();
    input.click();
    await frame();
    return { frames, before, after: read() };
  });
  expect(samples.frames.some((value) => value > 0 && value < 1)).toBe(true);
  expect(Math.abs(samples.after - samples.before)).toBeLessThan(0.35);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect
    .poll(() =>
      root.evaluate((node) =>
        Number(getComputedStyle(node).getPropertyValue('--_switch-progress')),
      ),
    )
    .toBe(0);
});
