import { type Locator, type Page, expect, test } from '@playwright/test';
import { litInputIds, probeInput } from './support/accessible-name.js';

/**
 * Checkbox suite — a PRODUCTION component CONSUMING the @zag-js/checkbox machine
 * through the LabUI seam, with the HONEST tri-state, verified on BOTH renderers.
 *
 * The fixture (`checkbox.html`) mounts the Lit `<lab-checkbox>` and native-React
 * `<Checkbox>` with identical specimens — including the real indeterminate
 * (mixed) state. Definition of done:
 *   1. Render — both renderers paint a real box with a token.
 *   2. Machine behaviour — clicking toggles the machine: the host state follows.
 *   3. HONEST mixed state — the indeterminate specimen carries the machine's real
 *      "indeterminate" value (data-state="indeterminate" / host attribute), and
 *      clicking it resolves to a concrete checked value — not a faked glyph.
 *   4. Disabled — the machine blocks the toggle.
 *   5. Visual parity + tokens + theme across both renderers.
 */

function litHost(page: Page, testid: string): Locator {
  return page.getByTestId(testid);
}
function reactBox(page: Page, testid: string): Locator {
  return page.getByTestId(testid).locator('[data-lab-checkbox]');
}
function litControl(page: Page, testid: string): Locator {
  return litHost(page, testid).locator('.control, .lab-checkbox-control');
}
function reactControl(page: Page, testid: string): Locator {
  return reactBox(page, testid).locator('.lab-checkbox-control');
}

/** The hidden native input — the a11y primitive — for a Lit host or React label. */
function litInput(page: Page, testid: string): Locator {
  return litHost(page, testid).locator('input');
}
function reactInput(page: Page, testid: string): Locator {
  return reactBox(page, testid).locator('input');
}

const bg = (el: HTMLElement) => getComputedStyle(el).backgroundColor;

type CheckedValue = boolean | 'indeterminate';
type CheckedBox = HTMLElement & {
  checked: boolean;
  indeterminate: boolean;
  defaultChecked: boolean;
  defaultIndeterminate: boolean;
  updateComplete: Promise<boolean>;
  checkedEvents?: CheckedValue[];
};

async function observeChecked(host: Locator): Promise<void> {
  await host.evaluate((element) => {
    const control = element as CheckedBox;
    control.checkedEvents = [];
    control.addEventListener('checked-change', (event) => {
      control.checkedEvents?.push((event as CustomEvent<{ checked: CheckedValue }>).detail.checked);
    });
  });
}

async function expectChecked(
  host: Locator,
  value: CheckedValue,
  events: CheckedValue[],
): Promise<void> {
  const checked = value === true;
  const mixed = value === 'indeterminate';
  // Mixed проверяется через нативное свойство, а не только через нарисованный знак.
  await expect
    .poll(() =>
      host.evaluate(async (element) => {
        const control = element as CheckedBox;
        await control.updateComplete;
        const input = control.shadowRoot?.querySelector('input');
        return {
          property: control.checked,
          attribute: control.hasAttribute('checked'),
          mixedProperty: control.indeterminate,
          mixedAttribute: control.hasAttribute('indeterminate'),
          native: input?.checked,
          nativeMixed: input?.indeterminate,
          state: control.shadowRoot?.querySelector('.control')?.getAttribute('data-state'),
          events: control.checkedEvents ?? [],
        };
      }),
    )
    .toEqual({
      property: checked,
      attribute: checked,
      mixedProperty: mixed,
      mixedAttribute: mixed,
      native: checked,
      nativeMixed: mixed,
      state: mixed ? 'indeterminate' : checked ? 'checked' : 'unchecked',
      events,
    });
}

/** The machine's data-state on the Lit control (checked | unchecked | indeterminate). */
function litControlState(page: Page, testid: string): Promise<string | null> {
  return litHost(page, testid).evaluate(
    (host) =>
      (host as HTMLElement).shadowRoot?.querySelector('.control')?.getAttribute('data-state') ??
      null,
  );
}

test.beforeEach(async ({ page }) => {
  await page.goto('/checkbox.html');
});

test('delivered HTML carries the Lit element (React island mounts client-side)', async ({
  request,
}) => {
  const body = await (await request.get('/checkbox.html')).text();
  expect(body).toMatch(/<lab-checkbox/i);
  expect(body).toContain('id="react-root"');
});

test('machine behaviour: clicking toggles checked on both renderers', async ({ page }) => {
  const lit = litHost(page, 'lit-unchecked');
  await expect(lit).toBeVisible();
  await expect(lit).not.toHaveAttribute('checked', /.*/);
  await litControl(page, 'lit-unchecked').click();
  await expect(lit).toHaveAttribute('checked', '');
  expect(await litControlState(page, 'lit-unchecked')).toBe('checked');

  const react = reactBox(page, 'react-unchecked');
  await expect(react).not.toHaveAttribute('data-checked', /.*/);
  await reactControl(page, 'react-unchecked').click();
  await expect(react).toHaveAttribute('data-checked', 'true');
});

test('HONEST mixed state: the machine carries a real "indeterminate" value', async ({ page }) => {
  // The Lit mixed specimen reflects the host `indeterminate` attribute, and the
  // machine reports data-state="indeterminate" on the control — a real third
  // state, not a faked dash.
  const lit = litHost(page, 'lit-mixed');
  await expect(lit).toHaveAttribute('indeterminate', '');
  expect(await litControlState(page, 'lit-mixed')).toBe('indeterminate');

  // The React mixed specimen agrees via data-indeterminate.
  const react = reactBox(page, 'react-mixed');
  await expect(react).toHaveAttribute('data-indeterminate', 'true');

  // Clicking a mixed box runs the machine, which RESOLVES it to a concrete
  // checked value. Zag is deterministic here: from indeterminate it always goes
  // to checked (machine `toggleChecked`: indeterminate ? true : !checked), and a
  // native checkbox click sets .checked=true first — so the outcome is `checked`.
  await litControl(page, 'lit-mixed').click();
  await expect(lit).not.toHaveAttribute('indeterminate', /.*/);
  expect(await litControlState(page, 'lit-mixed')).toBe('checked');
});

test('a11y: Space on the focused box toggles via the native input (keyboard)', async ({ page }) => {
  const lit = litHost(page, 'lit-unchecked');
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
    const host = litHost(page, 'lit-unchecked');
    await observeChecked(host);
    const events: CheckedValue[] = [];
    await expectChecked(host, false, events);
    for (const checked of [true, false, true, false]) {
      if (activation === 'Space') await host.locator('input').press('Space');
      else await host.locator('.control').click();
      events.push(checked);
      await expectChecked(host, checked, events);
    }
  });
}

for (const initial of [true, 'indeterminate'] as const) {
  test(`checked state: default ${initial} initializes once and survives external updates and reconnect`, async ({
    page,
  }) => {
    await page.evaluate((value) => {
      const host = document.createElement('lab-checkbox') as CheckedBox;
      host.dataset.testid = 'checked-default';
      host.textContent = 'Default checkbox';
      host.defaultChecked = value === true;
      host.defaultIndeterminate = value === 'indeterminate';
      document.body.append(host);
    }, initial);
    const host = page.getByTestId('checked-default');
    await observeChecked(host);
    await expectChecked(host, initial, []);
    await host.locator('input').press('Space');
    const first = initial === 'indeterminate';
    await expectChecked(host, first, [first]);
    await host.evaluate((element) => {
      const control = element as CheckedBox;
      control.defaultChecked = !control.defaultChecked;
      control.defaultIndeterminate = !control.defaultIndeterminate;
    });
    await expectChecked(host, first, [first]);
    await host.evaluate((element) => {
      element.remove();
      document.body.append(element);
    });
    await expectChecked(host, first, [first]);
    await host.evaluate((element) => {
      (element as CheckedBox).checked = true;
    });
    await expectChecked(host, true, [first]);
    await host.evaluate((element) => {
      (element as CheckedBox).checked = false;
    });
    await expectChecked(host, false, [first]);
    await host.evaluate((element) => element.setAttribute('checked', ''));
    await expectChecked(host, true, [first]);
    await host.evaluate((element) => element.removeAttribute('checked'));
    await expectChecked(host, false, [first]);
    await host.evaluate((element) => {
      (element as CheckedBox).indeterminate = true;
    });
    await expectChecked(host, 'indeterminate', [first]);
    await host.evaluate((element) => {
      (element as CheckedBox).indeterminate = false;
    });
    await expectChecked(host, false, [first]);
    await host.locator('.control').click();
    await expectChecked(host, true, [first, true]);
  });
}

test('checked state: an initially checked element and a consumer override keep false explicit', async ({
  page,
}) => {
  const host = litHost(page, 'lit-checked');
  await observeChecked(host);
  await expectChecked(host, true, []);
  await host.locator('input').press('Space');
  await expectChecked(host, false, [false]);
  await host.evaluate((element) => {
    element.addEventListener('checked-change', () => {
      (element as CheckedBox).checked = false;
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
    const host = document.createElement('lab-checkbox') as CheckedBox;
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
  await page.route('**/checkbox.html', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body: (await response.text()).replaceAll('type="module"', 'type="application/x-held-module"'),
    });
  });
  await page.goto('/checkbox.html');
  await page.evaluate(async () => {
    const host = document.createElement('lab-checkbox') as CheckedBox;
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
    await customElements.whenDefined('lab-checkbox');
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
  // an aria-hidden subtree) and be named by the machine's resolved aria-labelledby.
  await expect(reactBox(page, 'react-unchecked')).toBeVisible();

  const lit = await probeInput(litInput(page, 'lit-unchecked'));
  expect(lit.ariaHidden, 'Lit checkbox input must NOT be in an aria-hidden subtree').toBe(false);
  expect(lit.labelledbyResolves, 'Lit checkbox aria-labelledby must resolve').toBe(true);
  expect(lit.name).toBe('Terms');

  const react = await probeInput(reactInput(page, 'react-unchecked'));
  expect(react.ariaHidden, 'React checkbox input must NOT be in an aria-hidden subtree').toBe(
    false,
  );
  expect(react.labelledbyResolves, 'React checkbox aria-labelledby must resolve').toBe(true);
  expect(react.name).toBe('Terms');
});

test('a11y name: a checkbox with no visible label is named via aria-label', async ({ page }) => {
  await expect(reactBox(page, 'react-aria-label')).toBeVisible();

  const lit = await probeInput(litInput(page, 'lit-aria-label'));
  expect(lit.ariaHidden).toBe(false);
  expect(lit.name).toBe('Select all');

  const react = await probeInput(reactInput(page, 'react-aria-label'));
  expect(react.ariaHidden).toBe(false);
  expect(react.name).toBe('Select all');
});

test('a11y ids: every Lit checkbox instance has a UNIQUE input id (no :undefined collisions)', async ({
  page,
}) => {
  await expect(litHost(page, 'lit-unchecked')).toBeVisible();
  const ids = await litInputIds(litHost(page, 'lit-unchecked'), 'lab-checkbox');
  expect(ids.length).toBeGreaterThan(1);
  for (const id of ids) expect(id, 'id must not be :undefined').not.toContain('undefined');
  expect(new Set(ids).size, `ids must be unique: ${ids.join(', ')}`).toBe(ids.length);
});

test('a11y checked: the native input reflects checked AND the mixed (indeterminate) state', async ({
  page,
}) => {
  await expect(reactBox(page, 'react-unchecked')).toBeVisible();

  // Unchecked specimen: native checked=false, indeterminate=false.
  const off = await probeInput(litInput(page, 'lit-unchecked'));
  expect(off.checked).toBe(false);
  expect(off.indeterminate).toBe(false);

  // Checked specimen: native checked=true (the a11y "checked" state).
  const on = await probeInput(litInput(page, 'lit-checked'));
  expect(on.checked).toBe(true);
  expect(on.indeterminate).toBe(false);

  // Mixed specimen: native indeterminate=true (the a11y "mixed" state) on BOTH.
  const litMixed = await probeInput(litInput(page, 'lit-mixed'));
  expect(litMixed.indeterminate, 'Lit mixed input must be indeterminate').toBe(true);
  const reactMixed = await probeInput(reactInput(page, 'react-mixed'));
  expect(reactMixed.indeterminate, 'React mixed input must be indeterminate').toBe(true);
});

test('disabled: the machine blocks the toggle on both renderers', async ({ page }) => {
  const lit = litHost(page, 'lit-disabled');
  expect(
    await lit.evaluate(
      (host) => (host as HTMLElement).shadowRoot?.querySelector('input')?.disabled ?? null,
    ),
  ).toBe(true);
  await expect(lit).not.toHaveAttribute('checked', /.*/);

  const react = reactBox(page, 'react-disabled');
  await expect(react).toHaveAttribute('data-disabled', 'true');
});

test('visual parity: Lit and React resolve the same checked box colour', async ({ page }) => {
  await expect(reactBox(page, 'react-checked')).toBeVisible();

  for (const variant of ['checked', 'neutral', 'danger', 'mixed'] as const) {
    const litBg = await litControl(page, `lit-${variant}`).evaluate(bg);
    const reactBg = await reactControl(page, `react-${variant}`).evaluate(bg);
    expect(reactBg, `${variant}: box background parity`).toBe(litBg);
  }
});

test('tokens: re-pointing --lab-fill-accent re-skins BOTH checked boxes', async ({ page }) => {
  const lit = litControl(page, 'lit-checked');
  const react = reactControl(page, 'react-checked');
  await expect(reactBox(page, 'react-checked')).toBeVisible();

  await page.evaluate(() => {
    document.documentElement.style.setProperty('--lab-fill-accent', 'rgb(1, 2, 3)');
  });
  await expect.poll(() => lit.evaluate(bg)).toBe('rgb(1, 2, 3)');
  await expect.poll(() => react.evaluate(bg)).toBe('rgb(1, 2, 3)');
});

test('theme: flipping [data-theme] re-skins both renderers with zero edits', async ({ page }) => {
  const lit = litControl(page, 'lit-neutral');
  const react = reactControl(page, 'react-neutral');
  await expect(reactBox(page, 'react-neutral')).toBeVisible();

  const litDark = await lit.evaluate(bg);
  const reactDark = await react.evaluate(bg);

  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));

  await expect.poll(() => lit.evaluate(bg)).not.toBe(litDark);
  await expect.poll(() => react.evaluate(bg)).not.toBe(reactDark);
});
