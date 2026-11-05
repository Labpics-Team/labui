import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { build } from 'esbuild';

let fixture;
let coreFixture;
let evidence;
const pageErrors = new WeakMap();

async function bundleCoreScrollFixture(consumer, format) {
  const core =
    format === 'esm' ? "import '@labpics/ui-core/sheet';" : "require('@labpics/ui-core/sheet');";
  const dialog =
    format === 'cjs'
      ? "const {Dialog} = require('@labpics/ui-react/dialog');"
      : "import {Dialog} from '@labpics/ui-react/dialog';";
  const source = `
import '@labui/colors/contract.css';
import '@labpics/ui-tokens/tokens.css';
import '@labpics/ui-tokens/motion.css';
import '@labpics/ui-core/theme.css';
import '@labpics/ui-core/shadow.css';
import React from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
${core}
${dialog}
const config = window.sheetFocusConfig;
const root = createRoot(document.getElementById('app'));
const events = {errors:[], focus:[], lifecycle:[]};
let sheet;
let restore = () => {};
const active = () => {
  let node = document.activeElement;
  while (node?.shadowRoot?.activeElement) node = node.shadowRoot.activeElement;
  return node;
};
const trigger = () => sheet?.shadowRoot?.querySelector('.trigger');
const frame = () => sheet?.shadowRoot?.querySelector('.portal-plane')?.shadowRoot?.querySelector('.sheet-frame');
const content = () => sheet?.shadowRoot?.querySelector('.portal-plane')?.shadowRoot?.querySelector('.content');
const snapshot = () => ({id:active()?.id, trigger:active() === trigger(), sibling:active()?.id === 'sibling-action'});
const bodyStyles = () => ({
  overflow:document.body.style.overflow,
  paddingRight:document.body.style.paddingRight,
  scrollbarWidth:document.documentElement.style.getPropertyValue('--scrollbar-width'),
  locked:document.body.hasAttribute('data-scroll-lock'),
});
function clickDialog(label) {
  [...document.querySelectorAll('.lab-dialog-trigger')].find(node => node.textContent === label).click();
}
function failed(error) {
  events.errors.push({...snapshot(), primary:error === window.sheetFocus.primary});
  restore();
  events.lifecycle.push({at:'before-callback', body:bodyStyles()});
  if (config.remove) sheet.remove();
  if (config.reconnect) document.getElementById('core-mount').append(sheet);
  events.lifecycle.push({at:'after-owner-change', body:bodyStyles()});
  if (config.neighbor) clickDialog('Sibling trigger');
}
function App() {
  const primary = <div id="core-mount"/>;
  return <>
    {config.parent ? <Dialog heading="Parent dialog" content={<><button id="parent-action">Parent action</button>{primary}</>}>Parent trigger</Dialog> : primary}
    <Dialog heading="Sibling dialog" content={<button id="sibling-action">Sibling action</button>}>Sibling trigger</Dialog>
  </>;
}
window.sheetFocus = {
  events, config, snapshot, trigger, frame, content, bodyStyles, clickDialog,
  baseline:bodyStyles(),
  async installCore() {
    sheet = document.createElement('lab-sheet');
    sheet.heading = 'Core Sheet';
    sheet.innerHTML = '<span>Core trigger</span><input slot="content" id="primary-input" aria-label="Primary input">';
    sheet.addEventListener('motion-error',event => failed(event.detail.error));
    document.getElementById('core-mount').append(sheet);
    await sheet.updateComplete;
  },
  setOpen(value = true) {sheet.open = value;},
  setPosition() {sheet.position = 'full';},
  fail() {
    const style = frame().style;
    const baseline = style.getPropertyValue('--_sheet-top');
    const setter = CSSStyleDeclaration.prototype.setProperty;
    this.primary = new Error('Core Sheet: отказ scalar writer перед callback удаления owner');
    restore = () => {CSSStyleDeclaration.prototype.setProperty = setter;};
    CSSStyleDeclaration.prototype.setProperty = function(property,value,priority) {
      if (this === style && property === '--_sheet-top' && value !== baseline) throw window.sheetFocus.primary;
      return setter.call(this,property,value,priority);
    };
  },
  destroy() {
    restore();
    events.cleanup = [{at:'before-unmount',body:bodyStyles()}];
    root.unmount(); sheet?.remove();
    events.cleanup.push({at:'after-unmount',body:bodyStyles()});
  },
};
document.addEventListener('focusin',() => events.focus.push(snapshot()),true);
flushSync(() => root.render(<App/>));
`;
  const bundle = await build({
    stdin: { contents: source, resolveDir: consumer, loader: 'tsx' },
    outfile: `${evidence}-core.js`,
    bundle: true,
    platform: 'browser',
    format: 'iife',
    write: false,
    metafile: true,
  });
  const inputs = Object.keys(bundle.metafile.inputs).map((name) => name.replaceAll('\\', '/'));
  assert(!inputs.some((name) => /\/packages\/(react|core)\/src\//.test(name)));
  for (const file of bundle.outputFiles) await writeFile(file.path, file.contents);
  await writeFile(`${evidence}-core-metafile.json`, JSON.stringify(bundle.metafile, null, 2));
  return {
    js: bundle.outputFiles.find((file) => file.path.endsWith('.js')).text,
    css: bundle.outputFiles.find((file) => file.path.endsWith('.css'))?.text ?? '',
  };
}

test.beforeAll(async ({ browserName }, info) => {
  const context = info.config.metadata.packedReactSheetFocus;
  assert(context, 'Этот spec запускается владельцем installed packed-modal consumer.');
  const { consumer, format } = context;
  evidence = join(context.evidence, `react-sheet-focus-${format}-${browserName}`);
  const sheet =
    format === 'esm'
      ? "import {Sheet} from '@labpics/ui-react/sheet';"
      : "const {Sheet} = require('@labpics/ui-react/sheet');";
  const dialog =
    format === 'cjs'
      ? "const {Dialog} = require('@labpics/ui-react/dialog');"
      : "import {Dialog} from '@labpics/ui-react/dialog';";
  const source = `
import '@labui/colors/contract.css';
import '@labpics/ui-tokens/tokens.css';
import '@labpics/ui-tokens/motion.css';
import '@labpics/ui-core/theme.css';
import '@labpics/ui-core/shadow.css';
import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
${sheet}
${dialog}
const root = createRoot(document.getElementById('app'));
const events = {closes:[], errors:[], focus:[]};
const trigger = () => [...document.querySelectorAll('.lab-dialog-trigger')].find(node => node.textContent === 'Primary trigger');
const snapshot = () => ({
  trigger:document.activeElement === trigger(),
  background:document.activeElement?.id === 'background',
  sibling:document.activeElement?.id === 'sibling-action',
});
function clickDialog(label) {
  [...document.querySelectorAll('.lab-dialog-trigger')].find(node => node.textContent === label).click();
}
function App() {
  const [open,setOpen] = useState(false);
  const [position,setPosition] = useState('half');
  const [alive,setAlive] = useState(true);
  const config = window.sheetFocus.config;
  window.sheetFocus.setOpen = () => flushSync(() => setOpen(true));
  window.sheetFocus.setPosition = () => flushSync(() => setPosition('full'));
  const primary = alive && <Sheet
    open={config.controlled === false ? undefined : open}
    position={position}
    heading="Primary Sheet"
    content={<input id="primary-input" aria-label="Primary input"/>}
    onOpenChange={value => {
      if (!value) {
        events.closes.push(snapshot());
        if (config.sibling) return;
        if (config.unmount) {setAlive(false); clickDialog('Sibling trigger');}
      }
      setOpen(value);
    }}
    onMotionError={error => {
      events.errors.push({...snapshot(), primary:error === window.sheetFocus.primary});
      window.sheetFocus.restore?.();
    }}
  >Primary trigger</Sheet>;
  return <>
    {config.parent ? <Dialog heading="Parent dialog" content={<><button id="parent-action">Parent action</button>{primary}</>}>Parent trigger</Dialog> : primary}
    <Dialog heading="Sibling dialog" content={<button id="sibling-action">Sibling action</button>}>Sibling trigger</Dialog>
  </>;
}
window.sheetFocus = {
  events, config:window.sheetFocusConfig, snapshot, trigger, clickDialog,
  fail(target) {
    const style = document.querySelector('.lab-sheet-frame').style;
    const baseline = style.getPropertyValue('--_sheet-top');
    const setter = CSSStyleDeclaration.prototype.setProperty;
    this.primary = new Error('Sheet: отказ scalar writer до завершения focus lifetime');
    this.restore = () => {CSSStyleDeclaration.prototype.setProperty = setter;};
    CSSStyleDeclaration.prototype.setProperty = function(property,value,priority) {
      if (this === style && property === '--_sheet-top' && value !== baseline) {
        if (target === 'disabled') trigger().disabled = true;
        if (target === 'fieldset') document.getElementById('area').disabled = true;
        throw window.sheetFocus.primary;
      }
      return setter.call(this,property,value,priority);
    };
  },
  destroy() {this.restore?.(); root.unmount();},
};
document.addEventListener('focusin',() => events.focus.push(snapshot()),true);
flushSync(() => root.render(<App/>));
`;
  const bundle = await build({
    stdin: { contents: source, resolveDir: consumer, loader: 'tsx' },
    outfile: `${evidence}.js`,
    bundle: true,
    platform: 'browser',
    format: 'iife',
    write: false,
    metafile: true,
  });
  const inputs = Object.values(bundle.metafile.outputs).flatMap((output) =>
    Object.entries(output.inputs)
      .filter(([, item]) => item.bytesInOutput > 0)
      .map(([name]) => name.replaceAll('\\', '/')),
  );
  assert(!inputs.some((name) => /\/packages\/(react|core)\/src\//.test(name)));
  assert(
    !inputs.some((name) => /\/node_modules\/(lit|lit-html|lit-element|@lit-labs)\//.test(name)),
  );
  fixture = {
    js: bundle.outputFiles.find((file) => file.path.endsWith('.js')).text,
    css: bundle.outputFiles.find((file) => file.path.endsWith('.css'))?.text ?? '',
  };
  for (const file of bundle.outputFiles) await writeFile(file.path, file.contents);
  await writeFile(`${evidence}-metafile.json`, JSON.stringify(bundle.metafile, null, 2));
  coreFixture = await bundleCoreScrollFixture(consumer, format);
});

async function setup(page, config = {}) {
  const epoch = new Date('2026-11-05T00:00:00Z');
  await page.clock.install({ time: epoch });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/_fixtures/packed-react-sheet-focus.html');
  await page.addStyleTag({ content: fixture.css });
  await page.evaluate((config) => {
    window.sheetFocusConfig = config;
    document.getElementById('background').focus();
  }, config);
  await page.addScriptTag({ content: fixture.js });
  await expect
    .poll(() =>
      page.evaluate(() =>
        document.querySelector('.lab-sheet-frame')?.style.getPropertyValue('--_sheet-top'),
      ),
    )
    .toBe('812px');
  if (config.parent) {
    await page.evaluate(() => window.sheetFocus.clickDialog('Parent trigger'));
    await expect(page.locator('#parent-action')).toBeFocused();
  }
  await page.clock.pauseAt(epoch.getTime() + 60_000);
}

async function fail(page, late = false, target = 'keep') {
  await page.evaluate((target) => window.sheetFocus.fail(target), target);
  await page.evaluate((late) => {
    if (late) window.sheetFocus.setPosition();
    else window.sheetFocus.setOpen();
  }, late);
  await page.clock.runFor(128);
  expect(await page.evaluate(() => window.sheetFocus.events.errors.length)).toBe(1);
  expect(await page.evaluate(() => window.sheetFocus.events.errors[0].primary)).toBe(true);
  await expect(page.locator('.lab-sheet-content')).toBeHidden();
}

async function setupCore(page, config = {}) {
  const epoch = new Date('2026-11-05T00:00:00Z');
  await page.clock.install({ time: epoch });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/_fixtures/packed-react-sheet-focus.html');
  await page.addStyleTag({ content: coreFixture.css });
  await page.evaluate((config) => {
    window.sheetFocusConfig = config;
    document.body.style.overflow = 'auto';
    document.body.style.paddingRight = '7px';
    document.documentElement.style.setProperty('--scrollbar-width', '19px');
    document.getElementById('background').focus();
  }, config);
  await page.addScriptTag({ content: coreFixture.js });
  await page.waitForFunction(() => document.getElementById('core-mount'));
  await page.evaluate(() => window.sheetFocus.installCore());
  await expect
    .poll(() =>
      page.evaluate(() => window.sheetFocus.frame()?.style.getPropertyValue('--_sheet-top')),
    )
    .toBe('812px');
  if (config.parent) {
    await page.evaluate(() => window.sheetFocus.clickDialog('Parent trigger'));
    await expect(page.locator('#parent-action')).toBeFocused();
  }
  await page.clock.pauseAt(epoch.getTime() + 60_000);
}

async function failCore(page, late) {
  if (late) {
    await page.evaluate(() => window.sheetFocus.setOpen());
    await page.clock.runFor(64);
    await page.locator('#primary-input').focus();
  }
  await page.evaluate(() => window.sheetFocus.fail());
  await page.evaluate((late) => {
    if (late) window.sheetFocus.setPosition();
    else window.sheetFocus.setOpen();
  }, late);
  await page.clock.runFor(128);
  const errors = await page.evaluate(() => window.sheetFocus.events.errors);
  expect(errors).toHaveLength(1);
  expect(errors[0].primary).toBe(true);
  // До RAF finalFocus завершается синхронно; активный trap завершается через Zag cleanup.
  if (!late) expect(errors[0].trigger).toBe(true);
}

test.beforeEach(({ page }) => {
  const errors = [];
  pageErrors.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
});

test.afterEach(async ({ page }, info) => {
  await page.evaluate(() => window.sheetFocus?.destroy());
  await page.clock.runFor(128);
  const overflow = await page.evaluate(() => getComputedStyle(document.body).overflow);
  const styles = await page.evaluate(() => {
    if (!window.sheetFocus?.baseline) return;
    const actual = window.sheetFocus.bodyStyles();
    window.sheetFocus.events.cleanup.push({ at: 'after-clock', body: actual });
    return { actual, expected: window.sheetFocus.baseline };
  });
  const proof = await page.evaluate(() => window.sheetFocus?.events);
  await writeFile(`${evidence}-${info.testId}.json`, JSON.stringify(proof ?? null, null, 2));
  expect(overflow).not.toBe('hidden');
  if (styles) expect(styles.actual).toEqual(styles.expected);
  expect(pageErrors.get(page)).toEqual([]);
});

test.describe('React Sheet final focus', () => {
  for (const controlled of [false, true]) {
    test(`${controlled ? 'controlled' : 'trusted click'}: ранний отказ завершает фокус до обоих callbacks`, async ({
      page,
    }) => {
      await setup(page, { controlled });
      await page.evaluate(() =>
        document.documentElement.style.setProperty('--lab-motion-entrance-duration', '-1ms'),
      );
      if (controlled) await page.evaluate(() => window.sheetFocus.setOpen());
      else await page.getByRole('button', { name: 'Primary trigger', exact: true }).click();
      await page.clock.runFor(128);
      const events = await page.evaluate(() => window.sheetFocus.events);
      expect(events.errors).toHaveLength(1);
      expect(events.errors[0].trigger).toBe(true);
      expect(events.closes[0].trigger).toBe(true);
      await expect(
        page.getByRole('button', { name: 'Primary trigger', exact: true }),
      ).toBeFocused();
      await expect(page.locator('.lab-sheet-content')).toBeHidden();
    });
  }

  // Fieldset :disabled отсутствует в HappyDOM21; этот DOM fallback проверяется браузером.
  for (const target of ['disabled', 'fieldset']) {
    test(`${target}: поздний отказ пропускает недоступный DOM fallback`, async ({ page }) => {
      await setup(page);
      await page.evaluate(() => window.sheetFocus.setOpen());
      await page.clock.runFor(64);
      await page.locator('#primary-input').focus();
      await fail(page, true, target);
      await expect(page.locator('#background')).toBeFocused();
    });
  }

  test('surviving parent сохраняет модальность и принимает child trigger', async ({ page }) => {
    await setup(page, { parent: true });
    await fail(page);
    await expect(page.getByRole('button', { name: 'Primary trigger', exact: true })).toBeFocused();
    await expect(page.getByRole('dialog', { name: 'Parent dialog', exact: true })).toBeVisible();
    expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).toBe('hidden');
  });

  test('callback удаляет Sheet после восстановления фокуса и открывает новый modal', async ({
    page,
  }) => {
    await setup(page, { unmount: true });
    await fail(page);
    const events = await page.evaluate(() => window.sheetFocus.events);
    expect(events.closes[0].trigger).toBe(true);
    expect(events.errors[0].trigger).toBe(true);
    await expect(page.locator('#sibling-action')).toBeFocused();
    const firstSibling = events.focus.findIndex((focus) => focus.sibling);
    expect(firstSibling).toBeGreaterThanOrEqual(0);
    expect(events.focus.slice(firstSibling + 1).some((focus) => focus.trigger)).toBe(false);
  });

  test('controlled primary сохраняет фокус уже активного самостоятельного modal', async ({
    page,
  }) => {
    await setup(page, { sibling: true });
    await page.evaluate(() => window.sheetFocus.setOpen());
    await page.clock.runFor(64);
    await page.evaluate(() => window.sheetFocus.clickDialog('Sibling trigger'));
    await page.clock.runFor(64);
    await expect(page.locator('#sibling-action')).toBeFocused();
    await expect(page.locator('.lab-sheet-content')).toBeVisible();
    await fail(page, true);
    await expect(page.locator('#sibling-action')).toBeFocused();
  });

  test.describe('Core callback scroll lifetime', () => {
    for (const remove of [false, true]) {
      for (const late of [false, true]) {
        test(`${late ? 'active trap' : 'queued open'}: callback ${remove ? 'удаляет' : 'сохраняет'} Core owner и открывает React neighbor`, async ({
          page,
        }) => {
          await setupCore(page, { remove, neighbor: true });
          await failCore(page, late);
          await expect(page.locator('#sibling-action')).toBeFocused();
          expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).toBe(
            'hidden',
          );
          const events = await page.evaluate(() => window.sheetFocus.events);
          const firstSibling = events.focus.findIndex((focus) => focus.sibling);
          expect(firstSibling).toBeGreaterThanOrEqual(0);
          expect(events.focus.slice(firstSibling + 1).some((focus) => focus.trigger)).toBe(false);
        });
      }
    }

    test('новое подключение Core owner не принимает queued open прежней машины', async ({
      page,
    }) => {
      await setupCore(page, { remove: true, reconnect: true, neighbor: true });
      await failCore(page, false);
      await expect(page.locator('#sibling-action')).toBeFocused();
      expect(await page.evaluate(() => window.sheetFocus.content().hidden)).toBe(true);
      await page.keyboard.press('Escape');
      await page.clock.runFor(128);
      expect(await page.evaluate(() => window.sheetFocus.bodyStyles())).toEqual(
        await page.evaluate(() => window.sheetFocus.baseline),
      );
    });

    test('удалённый child не освобождает scroll lock surviving React parent', async ({ page }) => {
      await setupCore(page, { remove: true, parent: true });
      await failCore(page, false);
      await expect(page.getByRole('dialog', { name: 'Parent dialog', exact: true })).toBeVisible();
      await page.locator('#parent-action').focus();
      await expect(page.locator('#parent-action')).toBeFocused();
      expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).toBe('hidden');
      await page.keyboard.press('Escape');
      await page.clock.runFor(128);
      expect(await page.evaluate(() => window.sheetFocus.bodyStyles())).toEqual(
        await page.evaluate(() => window.sheetFocus.baseline),
      );
    });

    test('обычное закрытие Core Sheet сохраняет lock открытого React neighbor', async ({
      page,
    }) => {
      await setupCore(page);
      await page.evaluate(() => window.sheetFocus.setOpen());
      await page.clock.runFor(64);
      expect(await page.evaluate(() => window.sheetFocus.content().hidden)).toBe(false);
      await page.evaluate(() => window.sheetFocus.clickDialog('Sibling trigger'));
      await page.clock.runFor(64);
      await page.evaluate(() => window.sheetFocus.setOpen(false));
      await page.clock.runFor(128);
      await expect(page.locator('#sibling-action')).toBeFocused();
      expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).toBe('hidden');
      await page.keyboard.press('Escape');
      await page.clock.runFor(128);
      expect(await page.evaluate(() => window.sheetFocus.bodyStyles())).toEqual(
        await page.evaluate(() => window.sheetFocus.baseline),
      );
    });
  });
});
