import { type Locator, type Page, expect, test } from '@playwright/test';
import { waitForThemePaint } from './helpers/theme-paint.js';
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

type CheckedSwitch = HTMLElement & {
  checked: boolean;
  defaultChecked: boolean;
  updateComplete: Promise<boolean>;
  checkedEvents?: boolean[];
};

async function observeChecked(host: Locator): Promise<void> {
  await host.evaluate((element) => {
    const control = element as CheckedSwitch;
    control.checkedEvents = [];
    control.addEventListener('checked-change', (event) => {
      control.checkedEvents?.push((event as CustomEvent<{ checked: boolean }>).detail.checked);
    });
  });
}

async function expectChecked(host: Locator, checked: boolean, events: boolean[]): Promise<void> {
  // Нативное состояние, отражение для CSS и состояние поведения должны совпадать.
  await expect
    .poll(() =>
      host.evaluate(async (element) => {
        const control = element as CheckedSwitch;
        await control.updateComplete;
        const input = control.shadowRoot?.querySelector('input');
        return {
          property: control.checked,
          attribute: control.hasAttribute('checked'),
          native: input?.checked,
          state: control.shadowRoot?.querySelector('.control')?.getAttribute('data-state'),
          events: control.checkedEvents ?? [],
        };
      }),
    )
    .toEqual({
      property: checked,
      attribute: checked,
      native: checked,
      state: checked ? 'checked' : 'unchecked',
      events,
    });
}

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

for (const activation of ['Space', 'click'] as const) {
  test(`checked state: repeated ${activation} keeps every projection and event in sync`, async ({
    page,
  }) => {
    const host = litHost(page, 'lit-accent-off');
    await observeChecked(host);
    const events: boolean[] = [];
    await expectChecked(host, false, events);
    for (const checked of [true, false, true, false]) {
      if (activation === 'Space') await host.locator('input').press('Space');
      else await host.locator('.control').click();
      events.push(checked);
      await expectChecked(host, checked, events);
    }
  });
}

test('checked state: defaults initialize once, external false and reconnect preserve current state', async ({
  page,
}) => {
  await page.evaluate(() => {
    const host = document.createElement('lab-switch') as CheckedSwitch;
    host.dataset.testid = 'checked-default';
    host.textContent = 'Default switch';
    host.defaultChecked = true;
    document.body.append(host);
  });
  const host = page.getByTestId('checked-default');
  await observeChecked(host);
  await expectChecked(host, true, []);
  await host.locator('input').press('Space');
  await expectChecked(host, false, [false]);
  await host.evaluate((element) => {
    (element as CheckedSwitch).defaultChecked = false;
  });
  await expectChecked(host, false, [false]);
  await host.evaluate((element) => {
    (element as CheckedSwitch).defaultChecked = true;
  });
  await expectChecked(host, false, [false]);
  await host.evaluate((element) => {
    element.remove();
    document.body.append(element);
  });
  await expectChecked(host, false, [false]);
  await host.evaluate((element) => {
    (element as CheckedSwitch).checked = true;
  });
  await expectChecked(host, true, [false]);
  await host.evaluate((element) => {
    (element as CheckedSwitch).checked = false;
  });
  await expectChecked(host, false, [false]);
  await host.evaluate((element) => element.setAttribute('checked', ''));
  await expectChecked(host, true, [false]);
  await host.evaluate((element) => element.removeAttribute('checked'));
  await expectChecked(host, false, [false]);
  await host.locator('.control').click();
  await expectChecked(host, true, [false, true]);
});

test('checked state: an initially checked element and a consumer override keep false explicit', async ({
  page,
}) => {
  const host = litHost(page, 'lit-accent-on');
  await observeChecked(host);
  await expectChecked(host, true, []);
  await host.locator('input').press('Space');
  await expectChecked(host, false, [false]);
  await host.evaluate((element) => {
    element.addEventListener('checked-change', () => {
      (element as CheckedSwitch).checked = false;
    });
  });
  for (const events of [
    [false, true],
    [false, true, true],
  ]) {
    await host.locator('input').press('Space');
    await expectChecked(host, false, events);
  }
});

test('checked state: false assigned before connection wins over a true default', async ({
  page,
}) => {
  await page.evaluate(() => {
    const host = document.createElement('lab-switch') as CheckedSwitch;
    host.dataset.testid = 'checked-before-connect';
    host.textContent = 'Before connection';
    host.defaultChecked = true;
    host.checked = false;
    document.body.append(host);
  });
  const host = page.getByTestId('checked-before-connect');
  await observeChecked(host);
  await expectChecked(host, false, []);
  await host.locator('input').press('Space');
  await expectChecked(host, true, [true]);
});

test('checked state: a pre-upgrade false property wins over a true default', async ({ page }) => {
  await page.route('**/switch.html', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body: (await response.text()).replaceAll('type="module"', 'type="application/x-held-module"'),
    });
  });
  await page.goto('/switch.html');
  await page.evaluate(async () => {
    const host = document.createElement('lab-switch') as CheckedSwitch;
    host.dataset.testid = 'checked-before-upgrade';
    host.textContent = 'Before upgrade';
    host.defaultChecked = true;
    host.checked = false;
    document.body.append(host);
    const module = document.querySelector<HTMLScriptElement>(
      'script[type="application/x-held-module"]',
    );
    if (!module) throw new Error('Missing held fixture module');
    await import(module.src);
    await customElements.whenDefined('lab-switch');
  });
  const host = page.getByTestId('checked-before-upgrade');
  await observeChecked(host);
  await expectChecked(host, false, []);
  await host.locator('input').press('Space');
  await expectChecked(host, true, [true]);
  await host.locator('input').press('Space');
  await expectChecked(host, false, [true, false]);
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
  await waitForThemePaint(
    page,
    litTrack(page, 'lit-accent-on'),
    reactTrack(page, 'react-accent-on'),
  );
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
