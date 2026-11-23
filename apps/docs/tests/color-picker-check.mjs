import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 1100 } });
  page.on('pageerror', (error) => console.info('PAGEERROR', error.message));
  await page.goto('http://127.0.0.1:4473/color-picker.html');
  await page.locator('[data-lab-color-picker]').first().waitFor();
  await page.evaluate(() => document.fonts.ready);
  mkdirSync('../../docs/evidence/color-picker-20261123', { recursive: true });
  await page
    .locator('#lit')
    .screenshot({ path: '../../docs/evidence/color-picker-20261123/lit-spectrum-hex.png' });
  console.info(
    'Geometry',
    await page.locator('#lit').evaluate((host) =>
      Array.from(host.shadowRoot.querySelector('[data-lab-color-picker]').children).map((e) => ({
        name: e.tagName,
        cls: e.className,
        rect: e.getBoundingClientRect().toJSON(),
      })),
    ),
  );
  console.info(
    'Forms',
    await page
      .locator('form')
      .evaluateAll((forms) => forms.map((form) => Array.from(new FormData(form).entries()))),
  );
  await page.locator('#lit').evaluate((host) => {
    host.value = { space: 'lch', coords: [72.09, 84.86, 65.34], alpha: 1 };
    host.model = 'lch';
    host.variant = 'sliders';
  });
  await page.locator('#lit canvas').first().waitFor();
  await page.waitForFunction(() =>
    [...document.querySelector('#lit').shadowRoot.querySelectorAll('canvas')].every(
      (c) => c.dataset.paintCount,
    ),
  );
  await page
    .locator('#lit')
    .screenshot({ path: '../../docs/evidence/color-picker-20261123/lit-sliders-lch.png' });
  console.info(
    'Graphs',
    await page.locator('#lit canvas').evaluateAll((canvases) =>
      canvases.map((c) => ({
        plane: c.dataset.graph,
        render: c.dataset.renderer,
        ms: c.dataset.paintMs,
        width: c.width,
        height: c.height,
      })),
    ),
  );

  await page.locator('#lit').evaluate((host) => {
    host.variant = 'spectrum';
  });
  await page.waitForFunction(() =>
    [...document.querySelector('#lit').shadowRoot.querySelectorAll('canvas')].every(
      (c) => c.dataset.paintCount,
    ),
  );
  await page
    .locator('#lit')
    .screenshot({ path: '../../docs/evidence/color-picker-20261123/lit-spectrum-lch.png' });
  await page.locator('#lit').evaluate((host) => {
    host.value = { space: 'srgb', coords: [1, 149 / 255, 0], alpha: 1 };
    host.model = 'hex';
    host.variant = 'sliders';
  });
  await page
    .locator('#lit')
    .screenshot({ path: '../../docs/evidence/color-picker-20261123/lit-sliders-hex.png' });
  for (const model of ['hex', 'lch']) {
    await page.locator('#lit').evaluate((host, model) => {
      host.model = model;
      host.variant = 'grid';
    }, model);
    await page
      .locator('#lit')
      .screenshot({ path: `../../docs/evidence/color-picker-20261123/lit-grid-${model}.png` });
  }
  await page.locator('#lit').evaluate((host) => {
    host.value = { space: 'lch', coords: [72.09, 84.86, 65.34], alpha: 1 };
    host.model = 'lch';
    host.variant = 'spectrum';
  });
  for (const theme of ['light', 'dark']) {
    await page.setViewportSize({ width: 320, height: 1100 });
    await page.evaluate((theme) => {
      document.documentElement.dataset.theme = theme;
    }, theme);
    await page
      .locator('#lit')
      .screenshot({ path: `../../docs/evidence/color-picker-20261123/lit-narrow-${theme}.png` });
    const bounds = await page.locator('#lit').evaluate((host) => {
      const root = host.shadowRoot.querySelector('[data-lab-color-picker]');
      return { width: root.clientWidth, scroll: root.scrollWidth };
    });
    if (bounds.scroll > bounds.width) throw new Error('ColorPicker overflows the narrow container');
  }
  const cpu = await browser.newPage({ viewport: { width: 1500, height: 1100 } });
  await cpu.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
      return kind === 'webgl2' ? null : original.call(this, kind, ...args);
    };
  });
  await cpu.goto('http://127.0.0.1:4473/color-picker.html');
  await cpu.locator('#lit').getByRole('combobox').waitFor();
  await cpu.locator('#lit').evaluate((host) => {
    host.value = { space: 'lch', coords: [72.09, 84.86, 65.34], alpha: 1 };
    host.model = 'lch';
    host.variant = 'spectrum';
  });
  await cpu.waitForFunction(
    () =>
      [...document.querySelector('#lit').shadowRoot.querySelectorAll('canvas')].length === 2 &&
      [...document.querySelector('#lit').shadowRoot.querySelectorAll('canvas')].every(
        (c) => c.dataset.renderer === 'cpu',
      ),
  );
  const metrics = await cpu.locator('#lit canvas').evaluateAll((cs) =>
    cs.map((c) => ({
      plane: c.dataset.graph,
      width: c.width,
      height: c.height,
      cssWidth: c.clientWidth,
      cssHeight: c.clientHeight,
      ms: Number(c.dataset.paintMs),
    })),
  );
  await cpu
    .locator('#lit')
    .screenshot({ path: '../../docs/evidence/color-picker-20261123/lit-cpu-spectrum-lch.png' });
  writeFileSync(
    '../../docs/evidence/color-picker-20261123/cpu.generated.json',
    `${JSON.stringify(metrics, null, 2)}\n`,
  );
  console.info('CPU', metrics);
} finally {
  await browser.close();
}
