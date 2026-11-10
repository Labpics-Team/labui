import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { type Locator, type Page, expect, test } from '@playwright/test';

async function holdBooleanModules(page: Page) {
  await page.route('**/_fixtures/boolean-ssr.html', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body: (await response.text()).replaceAll('type="module"', 'type="application/x-held-module"'),
    });
  });
  await page.goto('/_fixtures/boolean-ssr.html');
}

async function upgradeBooleanModules(page: Page) {
  await page.evaluate(async () => {
    const modules = document.querySelectorAll<HTMLScriptElement>(
      'script[type="application/x-held-module"]',
    );
    if (!modules.length) throw new Error('Missing held fixture modules');
    for (const module of modules) await import(module.src);
  });
}

test('boolean extensions: decorators, собственные setters и data properties сохраняют позднее значение', async ({
  page,
}) => {
  await holdBooleanModules(page);
  const detached = await page.evaluateHandle(() => {
    return ['decorated', 'manual', 'data', 'coercing'].map((kind) => {
      const element = document.querySelector(`lab-boolean-${kind}`) as HTMLElement & {
        flag: boolean;
        renders: number;
        requestUpdate(): void;
        updateComplete: Promise<boolean>;
      };
      const output = element.shadowRoot?.querySelector('output');
      if (!output) throw new Error(`Missing server output for ${kind}`);
      element.remove();
      element.flag = true;
      return { kind, element, output };
    });
  });
  await upgradeBooleanModules(page);
  expect(
    await detached.evaluate(async (cases) => {
      const results = [];
      for (const { kind, element, output } of cases) {
        customElements.upgrade(element);
        const afterUpgrade = element.flag;
        if (kind === 'coercing') {
          const input = { enabled: false };
          Reflect.set(element, 'flag', input);
          input.enabled = true;
        } else element.flag = false;
        document.body.append(element);
        await element.updateComplete;
        const descriptor = Object.getOwnPropertyDescriptor(element, 'flag');
        const first = {
          afterUpgrade,
          flag: element.flag,
          text: output.textContent,
          renders: element.renders,
          sameOutput: output === element.shadowRoot?.querySelector('output'),
          snapshotRemoved: !element.hasAttribute('data-lab-ssr-b1'),
          descriptorRestored:
            kind === 'data'
              ? descriptor?.value === false &&
                descriptor.writable === true &&
                descriptor.configurable === true &&
                descriptor.enumerable === true
              : descriptor === undefined,
        };
        element.flag = true;
        element.requestUpdate();
        await element.updateComplete;
        const next = output.textContent;
        element.flag = false;
        element.requestUpdate();
        await element.updateComplete;
        element.remove();
        document.body.append(element);
        await element.updateComplete;
        results.push({ first, next, reconnect: element.flag });
        element.remove();
      }
      return results;
    }),
  ).toEqual(
    Array.from({ length: 4 }, () => ({
      first: {
        afterUpgrade: false,
        flag: false,
        text: 'false',
        renders: 1,
        sameOutput: true,
        snapshotRemoved: true,
        descriptorRestored: true,
      },
      next: 'true',
      reconnect: false,
    })),
  );
});

test('boolean extensions: отклонённый capture не оставляет частичных accessors; CSR не получает их', async ({
  page,
}) => {
  await page.goto('/_fixtures/boolean-ssr.html');
  await page.waitForFunction(() => customElements.get('lab-boolean-manual'));
  const results = await page.evaluate(async () => {
    const errors: string[] = [];
    const capture = (event: ErrorEvent) => {
      errors.push(event.error?.name);
      event.preventDefault();
    };
    window.addEventListener('error', capture);
    try {
      const unsupported = document.createElement('lab-boolean-unobservable');
      const blocked = Object.getOwnPropertyDescriptor(unsupported, 'blocked');
      unsupported.setAttribute('data-lab-ssr-b1', '[["flag",false],["blocked",false]]');
      const invalid = {
        errors: [...errors],
        noPartialAccessor: !Object.hasOwn(unsupported, 'flag'),
        blockedUnchanged:
          JSON.stringify(Object.getOwnPropertyDescriptor(unsupported, 'blocked')) ===
          JSON.stringify(blocked),
      };
      errors.length = 0;
      const sealed = document.createElement('lab-boolean-manual');
      Object.preventExtensions(sealed);
      sealed.setAttribute('data-lab-ssr-b1', '[["flag",false]]');
      const notExtensible = {
        errors: [...errors],
        noPartialAccessor: !Object.hasOwn(sealed, 'flag'),
      };
      window.removeEventListener('error', capture);
      const csr = [];
      for (const kind of ['decorated', 'manual', 'data', 'coercing']) {
        const element = document.createElement(`lab-boolean-${kind}`) as HTMLElement & {
          flag: boolean;
          updateComplete: Promise<boolean>;
        };
        element.flag = true;
        const descriptor = Object.getOwnPropertyDescriptor(element, 'flag');
        document.body.append(element);
        await element.updateComplete;
        csr.push({
          flag: element.flag,
          ownData: descriptor?.value === true,
          ownAccessor: !!descriptor?.set,
        });
        element.remove();
      }
      return { invalid, notExtensible, csr };
    } finally {
      window.removeEventListener('error', capture);
    }
  });
  expect(results).toEqual({
    invalid: { errors: ['TypeError'], noPartialAccessor: true, blockedUnchanged: true },
    notExtensible: { errors: ['TypeError'], noPartialAccessor: true },
    csr: [false, false, true, false].map((ownData) => ({
      flag: true,
      ownData,
      ownAccessor: false,
    })),
  });
});

test('boolean mixed history: запись после detached upgrade сильнее preupgrade JS и SSR', async ({
  page,
}) => {
  await holdBooleanModules(page);
  const detached = await page.evaluateHandle(() => {
    return (
      [
        ['lab-switch', 'checked'],
        ['lab-checkbox', 'checked'],
        ['lab-checkbox', 'indeterminate'],
        ['lab-progress', 'showValueText'],
      ] as const
    ).flatMap(([tag, property]) => {
      return [true, false].map((snapshot) => {
        const element = document.createElement(tag);
        Reflect.set(element, property, true);
        element.setAttribute('data-lab-ssr-b1', JSON.stringify([[property, snapshot]]));
        return { element, property };
      });
    });
  });
  await upgradeBooleanModules(page);
  expect(
    await detached.evaluate(async (cases) => {
      return Promise.all(
        cases.map(async ({ element, property }) => {
          customElements.upgrade(element);
          Reflect.set(element, property, false);
          document.body.append(element);
          await (element as HTMLElement & { updateComplete: Promise<boolean> }).updateComplete;
          const input = element.shadowRoot?.querySelector('input');
          return {
            value: Reflect.get(element, property),
            native: input?.[property === 'indeterminate' ? 'indeterminate' : 'checked'] ?? false,
            inputCount: element.shadowRoot?.querySelectorAll('input').length,
          };
        }),
      );
    }),
  ).toEqual(
    [1, 1, 1, 1, 1, 1, 0, 0].map((inputCount) => ({ value: false, native: false, inputCount })),
  );
});

test('boolean subclass: shouldUpdate видит последнюю запись и сохраняется после отказа или ошибки', async ({
  page,
}) => {
  await page.goto('/_fixtures/boolean-ssr.html');
  await page.waitForFunction(() => customElements.get('lab-switch'));
  const results = await page.evaluate(async () => {
    const Base = customElements.get('lab-switch');
    if (!Base) throw new Error('Missing real Switch constructor');
    const results = [];
    for (const [index, mode] of ['accept', 'reject', 'throw', 'own'].entries()) {
      const seen: boolean[] = [];
      class Probe extends Base {
        shouldUpdate() {
          const checked = Reflect.get(this, 'checked');
          if (typeof checked !== 'boolean') throw new TypeError('Expected Boolean checked');
          seen.push(checked);
          if (Reflect.get(this, 'mode') === 'throw') throw new Error('Expected hook failure');
          return Reflect.get(this, 'mode') !== 'reject';
        }
      }
      const tag = `lab-ssr-probe-${index}`;
      const element = document.createElement(tag) as HTMLElement & {
        checked: boolean;
        mode: string;
        requestUpdate(): void;
        updateComplete: Promise<boolean>;
      };
      element.checked = true;
      element.setAttribute('data-lab-ssr-b1', '[["checked",false]]');
      customElements.define(tag, Probe);
      customElements.upgrade(element);
      element.mode = mode;
      element.checked = false;
      const ownHook = () => Probe.prototype.shouldUpdate.call(element);
      if (mode === 'own')
        Object.defineProperty(element, 'shouldUpdate', {
          value: ownHook,
          configurable: true,
          enumerable: true,
          writable: false,
        });
      document.body.append(element);
      let error = '';
      try {
        await element.updateComplete;
      } catch (failure) {
        error = (failure as Error).message;
      }
      const descriptor = Object.getOwnPropertyDescriptor(element, 'shouldUpdate');
      const first = {
        observed: seen[0],
        checked: element.checked,
        error,
        hookPreserved:
          mode === 'own'
            ? descriptor?.value === ownHook &&
              descriptor.enumerable === true &&
              descriptor.writable === false &&
              descriptor.configurable === true
            : descriptor === undefined,
      };
      element.mode = 'accept';
      element.checked = true;
      element.requestUpdate();
      await element.updateComplete;
      results.push({ first, next: element.shadowRoot?.querySelector('input')?.checked });
      element.remove();
    }
    return results;
  });
  expect(results).toEqual(
    ['accept', 'reject', 'throw', 'own'].map((mode) => ({
      first: {
        observed: false,
        checked: false,
        error: mode === 'throw' ? 'Expected hook failure' : '',
        hookPreserved: true,
      },
      next: true,
    })),
  );
});

async function copyAstroFixture() {
  const directory = await mkdtemp(resolve('../../packages/astro/test/.mixed-'));
  await cp(resolve('../../packages/astro/test/fixtures/mixed'), directory, { recursive: true });
  return directory;
}

test('Astro dev: directives и SSR используют совместимый hydration runtime', async ({ page }) => {
  test.setTimeout(90_000);
  const fixture = await copyAstroFixture();
  const server = spawn(process.execPath, [resolve(fixture, 'serve.mjs')], {
    cwd: fixture,
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    windowsHide: true,
  });
  let output = '';
  server.stdout?.on('data', (data) => {
    output += data;
  });
  server.stderr?.on('data', (data) => {
    output += data;
  });
  const exited = once(server, 'exit');
  const startup = setTimeout(() => server.kill(), 45_000);
  try {
    const ready = await Promise.race([
      once(server, 'message'),
      exited.then(() => {
        throw new Error(`Astro dev exited before ready: ${output}`);
      }),
    ]);
    const { port } = ready[0] as { port: number };
    clearTimeout(startup);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${port}/`);
    await expectCheckedState(page.locator('lab-switch'), true);
    await expectCheckedState(page.locator('lab-checkbox'), 'indeterminate');
    await page.goto(`http://127.0.0.1:${port}/client/`);
    await expectCheckedState(page.locator('lab-switch'), false);
    await page.waitForFunction(() => customElements.get('lab-tabs'));
    expect(
      await page.locator('lab-tabs').evaluate(async (element) => {
        await (element as HTMLElement & { updateComplete: Promise<boolean> }).updateComplete;
        return element.shadowRoot?.querySelectorAll('.list').length;
      }),
    ).toBe(1);
    expect(errors).toEqual([]);
  } finally {
    clearTimeout(startup);
    if (server.connected) server.send('stop');
    const kill = setTimeout(() => server.kill(), 5_000);
    try {
      await exited;
    } finally {
      clearTimeout(kill);
    }
    await rm(fixture, { recursive: true, force: true });
  }
});

test('Astro MPA: ранняя гидрация сохраняет единственные input рядом с обычной CSR-страницей', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const output = await mkdtemp(resolve(tmpdir(), 'labui-astro-'));
  const fixture = await copyAstroFixture();
  try {
    const build = spawnSync(process.execPath, [resolve(fixture, 'build.mjs'), output], {
      cwd: fixture,
      encoding: 'utf8',
      timeout: 60_000,
      windowsHide: true,
    });
    expect(build.error, build.stderr).toBeUndefined();
    expect(build.status, build.stdout + build.stderr).toBe(0);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('http://labui-astro.test/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      const file = path.endsWith('/') ? `${path}index.html` : path;
      await route.fulfill({
        body: await readFile(resolve(output, `.${file}`)),
        contentType: file.endsWith('.js') ? 'text/javascript' : 'text/html',
      });
    });
    await page.goto('http://labui-astro.test/');
    const toggle = page.locator('lab-switch');
    const checkbox = page.locator('lab-checkbox');
    await expectCheckedState(toggle, true);
    await expectCheckedState(checkbox, 'indeterminate');
    await expect(page.locator('lab-button button')).toHaveCount(1);
    await expect(page.locator('lab-button button')).toBeDisabled();
    await toggle.locator('input').press('Space');
    await expectCheckedState(toggle, false);
    await checkbox.locator('input').press('Space');
    await expectCheckedState(checkbox, true);
    await page.goto('http://labui-astro.test/client/');
    await expectCheckedState(page.locator('lab-switch'), false);
    await page.waitForFunction(() => customElements.get('lab-tabs'));
    expect(
      await page.locator('lab-tabs').evaluate(async (element) => {
        await (element as HTMLElement & { updateComplete: Promise<boolean> }).updateComplete;
        return element.shadowRoot?.querySelectorAll('.list').length;
      }),
    ).toBe(1);
    await page.locator('lab-switch input').press('Space');
    await expectCheckedState(page.locator('lab-switch'), true);
    expect(errors).toEqual([]);
  } finally {
    await rm(output, { recursive: true, force: true });
    await rm(fixture, { recursive: true, force: true });
  }
});

for (const [id, tag, properties] of [
  ['progress-value', 'lab-progress', { showValueText: true }],
  ['number-wheel', 'lab-number-input', { allowMouseWheel: true }],
  ['tooltip-no-arrow', 'lab-tooltip', { arrow: false }],
] as const) {
  test(`boolean transport: ${tag} сохраняет значения, не представимые обычным host-атрибутом`, async ({
    page,
  }) => {
    await holdBooleanModules(page);
    const host = page.getByTestId(id).locator(tag);
    expect(await host.evaluate((element) => element.shadowRoot !== null)).toBe(true);
    await upgradeBooleanModules(page);
    expect(
      await host.evaluate(async (element, names) => {
        await (element as HTMLElement & { updateComplete: Promise<boolean> }).updateComplete;
        return Object.fromEntries(names.map((name) => [name, Reflect.get(element, name)]));
      }, Object.keys(properties)),
    ).toEqual(properties);
  });
}

test('boolean decoder: отклоняет весь повреждённый payload, допускает исправление и запрещает replay', async ({
  page,
}) => {
  await page.goto('/_fixtures/boolean-ssr.html');
  await page.waitForFunction(() => customElements.get('lab-switch'));
  const cases = [
    '{',
    'null',
    '{}',
    '[["disabled",true],["checked","false"]]',
    '[["disabled",true],["checked",true,0]]',
    '[["disabled",true],[0,true]]',
    '[["disabled",true],["disabled",false]]',
    '[["disabled",true],["unknown",true]]',
    '[["disabled",true],["size",true]]',
    ...['__proto__', 'prototype', 'constructor'].map((name) =>
      JSON.stringify([
        ['disabled', true],
        [name, true],
      ]),
    ),
  ];
  const results = await page.evaluate((payloads) => {
    const errors: string[] = [];
    const capture = (event: ErrorEvent) => {
      errors.push(event.error?.name);
      event.preventDefault();
    };
    window.addEventListener('error', capture);
    try {
      return payloads.map((payload) => {
        errors.length = 0;
        const element = document.createElement('lab-switch') as HTMLElement & { disabled: boolean };
        element.disabled = false;
        element.setAttribute('data-lab-ssr-b1', payload);
        const rejected = {
          errors: [...errors],
          disabled: element.disabled,
          payload: element.getAttribute('data-lab-ssr-b1'),
        };
        errors.length = 0;
        element.setAttribute('data-lab-ssr-b1', '[["disabled",true]]');
        const recovered = {
          errors: [...errors],
          disabled: element.disabled,
          removed: !element.hasAttribute('data-lab-ssr-b1'),
        };
        errors.length = 0;
        element.setAttribute('data-lab-ssr-b1', '[["disabled",false]]');
        return { rejected, recovered, replay: { errors: [...errors], disabled: element.disabled } };
      });
    } finally {
      window.removeEventListener('error', capture);
    }
  }, cases);
  expect(results).toEqual(
    cases.map((payload) => ({
      rejected: { errors: ['TypeError'], disabled: false, payload },
      recovered: { errors: [], disabled: true, removed: true },
      replay: { errors: ['TypeError'], disabled: true },
    })),
  );
});

test('boolean decoder: preupgrade JS, последующая запись и reconnect сохраняют приоритет владельца', async ({
  page,
}) => {
  await holdBooleanModules(page);
  const host = page.getByTestId('switch-default').locator('lab-switch');
  await host.evaluate((element) => Reflect.set(element, 'checked', false));
  await upgradeBooleanModules(page);
  await expectCheckedState(host, false);
  expect(
    await page.evaluate(async () => {
      const element = document.createElement('lab-switch') as HTMLElement & {
        checked: boolean;
        updateComplete: Promise<boolean>;
      };
      element.setAttribute('data-lab-ssr-b1', '[["checked",true]]');
      const restored = element.checked;
      element.checked = false;
      document.body.append(element);
      await element.updateComplete;
      element.remove();
      document.body.append(element);
      await element.updateComplete;
      const result = {
        restored,
        checked: element.checked,
        native: element.shadowRoot?.querySelector('input')?.checked,
        removed: !element.hasAttribute('data-lab-ssr-b1'),
      };
      element.remove();
      return result;
    }),
  ).toEqual({ restored: true, checked: false, native: false, removed: true });
});

type CheckedValue = boolean | 'indeterminate';

async function expectCheckedState(host: Locator, value: CheckedValue) {
  await expect(host.locator('input')).toHaveCount(1);
  await expect
    .poll(() =>
      host.evaluate(async (element) => {
        const control = element as HTMLElement & {
          checked: boolean;
          indeterminate?: boolean;
          updateComplete: Promise<boolean>;
        };
        await control.updateComplete;
        const input = control.shadowRoot?.querySelector('input');
        return {
          checked: control.checked,
          attribute: control.hasAttribute('checked'),
          mixed: control.indeterminate ?? false,
          mixedAttribute: control.hasAttribute('indeterminate'),
          native: input?.checked,
          nativeMixed: input?.indeterminate,
        };
      }),
    )
    .toEqual({
      checked: value === true,
      attribute: value === true,
      mixed: value === 'indeterminate',
      mixedAttribute: value === 'indeterminate',
      native: value === true,
      nativeMixed: value === 'indeterminate',
    });
}

for (const component of ['switch', 'checkbox'] as const) {
  test(`boolean SSR: ${component} сохраняет состояние после разбора HTML, upgrade и двух вводов`, async ({
    page,
  }) => {
    await page.route('**/_fixtures/boolean-ssr.html', async (route) => {
      const response = await route.fetch();
      await route.fulfill({
        response,
        body: (await response.text()).replaceAll(
          'type="module"',
          'type="application/x-held-module"',
        ),
      });
    });
    await page.goto('/_fixtures/boolean-ssr.html');
    const cases: Array<[string, CheckedValue]> =
      component === 'switch'
        ? [
            ['switch-empty', false],
            ['switch-default', true],
            ['switch-false', false],
          ]
        : [
            ['checkbox-default', true],
            ['checkbox-mixed', 'indeterminate'],
            ['checkbox-false', false],
            ['checkbox-not-mixed', false],
          ];
    for (const [id, value] of cases) {
      const host = page.getByTestId(id).locator(`lab-${component}`);
      expect(
        await host.evaluate((element) => ({
          checked: element.hasAttribute('checked'),
          mixed: element.hasAttribute('indeterminate'),
          shadow: element.shadowRoot !== null,
        })),
      ).toEqual({ checked: value === true, mixed: value === 'indeterminate', shadow: true });
    }
    const originalInputs = await Promise.all(
      cases.map(([id]) => page.getByTestId(id).locator(`lab-${component} input`).elementHandle()),
    );
    await upgradeBooleanModules(page);
    for (const input of originalInputs) {
      expect(input).not.toBeNull();
      expect(await input?.evaluate((element) => element.isConnected)).toBe(true);
    }
    for (const [id, value] of cases) {
      const host = page.getByTestId(id).locator(`lab-${component}`);
      await expectCheckedState(host, value);
      const first = value !== true;
      await host.locator('input').press('Space');
      await expectCheckedState(host, first);
      await host.locator('input').press('Space');
      await expectCheckedState(host, !first);
    }
  });
}

/**
 * Core-scaffold PROOF smoke — proves the whole seam works on the Lit renderer.
 *
 * `<lab-proof>` is a PROOF element, not the production Button. These checks are
 * the scaffold's definition of done on the browser side:
 *   1. SSR — the delivered HTML carries declarative shadow DOM (styled first
 *      paint, no FOUC) before any JS runs.
 *   2. Render — the element upgrades and shows its inner button.
 *   3. Behavior — a click runs the Zag toggle machine: aria-pressed flips and
 *      the host's reflected `pressed` attribute follows.
 *   4. Tokens — the pressed surface resolves a `--lab-*` role, and re-pointing
 *      that role on the root re-skins the element (proves var() consumption, not
 *      a hardcoded colour).
 *   5. Theme — flipping `[data-theme]` on the root re-skins the element with
 *      zero element edits.
 */

test('SSR: delivered HTML carries declarative shadow DOM with a token', async ({ request }) => {
  // Read the raw HTML the server delivers — NOT the hydrated DOM. The SSR island
  // must already contain the DSD template before any client JS runs.
  const res = await request.get('/_fixtures/proof.html');
  const body = await res.text();
  expect(body).toMatch(/shadowrootmode="open"/i);
  expect(body).toMatch(/<button/i);
  expect(body).toMatch(/var\(--lab-/);
});

test('render + toggle behavior: click flips aria-pressed and the host attribute', async ({
  page,
}) => {
  await page.goto('/_fixtures/proof.html');
  const proof = page.getByTestId('proof-client');
  await expect(proof).toBeVisible();

  // The inner button is in the shadow root; Playwright pierces it.
  const button = proof.locator('button');
  await expect(button).toBeVisible();
  await expect(button).toHaveAttribute('aria-pressed', 'false');
  await expect(proof).not.toHaveAttribute('pressed', /.*/);

  await button.click();

  // The Zag machine drove the transition: ARIA + reflected host attribute agree.
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await expect(proof).toHaveAttribute('pressed', '');

  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'false');
});

test('tokens: pressed surface follows the --lab-fill-accent role', async ({ page }) => {
  await page.goto('/_fixtures/proof.html');
  const proof = page.getByTestId('proof-client');
  const button = proof.locator('button');
  await button.click(); // press → accent fill role
  // Wait for the machine→reflect cycle to land before reading paint.
  await expect(proof).toHaveAttribute('pressed', '');

  // Re-point the role on the root; the pressed button must follow it. Only true
  // var() consumption can do this — a hardcoded hex would not move.
  const sentinel = 'rgb(1, 2, 3)';
  await page.evaluate((value) => {
    document.documentElement.style.setProperty('--lab-fill-accent', value);
  }, sentinel);

  await expect
    .poll(() => button.evaluate((el) => getComputedStyle(el).backgroundColor))
    .toBe('rgb(1, 2, 3)');
});

test('theme: flipping [data-theme] re-skins the proof with zero element edits', async ({
  page,
}) => {
  await page.goto('/_fixtures/proof.html');
  const proof = page.getByTestId('proof-client');
  const button = proof.locator('button');

  // Read a role the theme rebinds: the unpressed border uses --lab-border-base,
  // which the demo theme defines distinctly per theme.
  const darkBorder = await button.evaluate((el) => getComputedStyle(el).borderTopColor);

  // One attribute flip on the root — the element does not know about themes.
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));

  await expect
    .poll(() => button.evaluate((el) => getComputedStyle(el).borderTopColor))
    .not.toBe(darkBorder);
});
