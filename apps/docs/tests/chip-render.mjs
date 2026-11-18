import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const sourceDirectory = resolve(process.argv[2]);
const output = resolve(process.argv[3]);
await mkdir(output, { recursive: true });
const names = (await readdir(sourceDirectory)).filter((name) => name.endsWith('.svg'));
const samples = await Promise.all(
  names.map(async (name) => ({
    name: name.slice(5, -4),
    svg: `data:image/svg+xml;base64,${Buffer.from(await readFile(resolve(sourceDirectory, name))).toString('base64')}`,
  })),
);
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1020, height: 900 },
    deviceScaleFactor: 2,
  });
  await page.goto(process.env.CHIP_BASE_URL ?? 'http://127.0.0.1:4338/_fixtures/chip.html');
  await page.locator('#react-matrix button').last().waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(async (samples) => {
    const original = document.querySelector('main');
    const comparison = document.createElement('main');
    comparison.id = 'comparison';
    comparison.style.cssText =
      'padding:24px;background:white;color:#101012;width:900px;box-sizing:border-box;font-family:Geist,sans-serif';
    const heading = document.createElement('h1');
    heading.textContent = 'Original SVG / LabUI Chip';
    heading.style.fontSize = '20px';
    comparison.append(heading);
    for (const sample of samples) {
      const [shape, size, state, selected] = sample.name.split('-');
      const row = document.createElement('div');
      row.style.cssText =
        'display:grid;grid-template-columns:370px 190px 190px;gap:16px;align-items:center;min-height:70px';
      const label = document.createElement('span');
      label.textContent = sample.name;
      label.style.fontSize = '13px';
      const image = document.createElement('img');
      image.src = sample.svg;
      image.style.cssText = 'max-width:none;display:block';
      const sourceCell = document.createElement('div');
      sourceCell.append(image);
      const chip = document.createElement('lab-chip');
      Object.assign(chip, {
        sharp: shape === 'sharp',
        size: size === 'small' ? 's' : 'm',
        selected: selected === 'selected',
        active: state === 'active',
        loading: state === 'loading',
      });
      chip.textContent = state === 'loading' ? 'Chip 1' : 'Chip label';
      const cell = document.createElement('div');
      cell.append(chip);
      row.append(label, sourceCell, cell);
      comparison.append(row);
      await image.decode();
    }
    original?.replaceWith(comparison);
    await Promise.all(
      [...comparison.querySelectorAll('lab-chip')].map((chip) => chip.updateComplete),
    );
    for (const [index, chip] of [...comparison.querySelectorAll('lab-chip')].entries()) {
      const state = samples[index].name.split('-')[2];
      const attribute = { pressed: 'data-pressed', focus: 'data-focused' }[state];
      if (attribute) chip.shadowRoot.querySelector('button').setAttribute(attribute, '');
    }
  }, samples);
  await page
    .locator('#comparison')
    .screenshot({ path: resolve(output, 'original-svg-and-web.png') });
  const dimensions = await page.locator('#comparison lab-chip').evaluateAll((chips) =>
    chips.map((chip) => ({
      label: chip.textContent,
      width: chip.shadowRoot.querySelector('button').getBoundingClientRect().width,
      height: chip.shadowRoot.querySelector('button').getBoundingClientRect().height,
    })),
  );
  await writeFile(
    resolve(output, 'original-svg-and-web.json'),
    `${JSON.stringify({ source: 'Original SVG_STRING Figma exports, locally rasterized by Chromium; not Figma PNG', scale: '1 CSS px per author px, DPR 2', samples: samples.map((sample, index) => ({ name: sample.name, ...dimensions[index] })) }, null, 2)}\n`,
  );
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto(process.env.CHIP_BASE_URL ?? 'http://127.0.0.1:4338/_fixtures/chip.html');
  await page.locator('#react-matrix button').last().waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.locator('#lit-matrix').evaluate((matrix) => {
    matrix.style.width = 'max-content';
    for (const [index, state] of [
      'Default',
      'Hover',
      'Pressed',
      'Focus',
      'Active',
      'Disabled',
      'Loading',
    ].entries()) {
      const label = document.createElement('span');
      label.textContent = state;
      label.style.cssText = `grid-column:${index + 1};grid-row:1;font-size:13px;opacity:.7`;
      matrix.append(label);
    }
    for (const [index, cell] of [...matrix.querySelectorAll(':scope > div')].entries()) {
      cell.style.gridRow = String(Math.floor(index / 7) + 2);
      cell.style.gridColumn = String((index % 7) + 1);
    }
  });
  await page.locator('#lit-matrix').screenshot({ path: resolve(output, 'web-all-56-light.png') });
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'dark';
  });
  await page.locator('#lit-matrix').screenshot({ path: resolve(output, 'web-all-56-dark.png') });
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'light';
    document.documentElement.style.fontSize = '32px';
  });
  await page.locator('#narrow').screenshot({ path: resolve(output, 'web-rtl-200.png') });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '16px';
    const main = document.createElement('main');
    main.style.cssText = 'background:Canvas;color:CanvasText;padding:20px;width:max-content';
    for (const renderer of ['lit', 'react']) {
      const heading = document.createElement('h2');
      heading.textContent = `${renderer}: unselected / selected`;
      const matrix = document.querySelector(`#forced-${renderer}`);
      if (!matrix) throw new Error('Missing forced-color examples');
      matrix.style.width = 'max-content';
      for (const [index, state] of [
        'Default',
        'Hover',
        'Pressed',
        'Focus',
        'Active',
        'Disabled',
        'Loading',
      ].entries()) {
        const label = document.createElement('span');
        label.textContent = state;
        label.style.cssText = `grid-column:${index + 1};grid-row:1;font-size:13px`;
        matrix.append(label);
      }
      for (const [index, cell] of [...matrix.querySelectorAll(':scope > div')].entries()) {
        cell.style.gridRow = String(Math.floor(index / 7) + 2);
        cell.style.gridColumn = String((index % 7) + 1);
      }
      main.append(heading, matrix);
    }
    document.body.replaceChildren(main);
  });
  for (const colorScheme of ['light', 'dark']) {
    await page.emulateMedia({ forcedColors: 'active', colorScheme });
    await page.locator('main').screenshot({ path: resolve(output, `forced-${colorScheme}.png`) });
  }
} finally {
  await browser.close();
}
