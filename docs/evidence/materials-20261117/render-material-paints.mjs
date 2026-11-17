import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { materialPaintOver, parseRgb } from '../../../packages/materials/dist/index.js';
import { displayPixels } from './display-pixels.mjs';

const engines = createRequire(new URL('../../../apps/docs/package.json', import.meta.url))(
  '@playwright/test',
);
const display = process.env.MATERIAL_CAPTURE === 'display';
if (display && !process.env.CI) throw new Error('Display capture runs only in isolated CI');
const files = new Map(
  await Promise.all(
    [
      ['/runtime.js', '../../../packages/materials/dist/index.js', 'text/javascript'],
      ['/material.css', '../../../packages/materials/dist/material.css', 'text/css'],
      ['/colors.css', '../../../packages/colors/contract.css', 'text/css'],
    ].map(async ([path, file, type]) => [
      path,
      { body: await readFile(new URL(file, import.meta.url)), type },
    ]),
  ),
);
const html =
  '<!doctype html><html data-material="acrylic" data-theme="light"><head><link rel="stylesheet" href="/colors.css"><link rel="stylesheet" href="/material.css"></head><body></body></html>';
const server = createServer((request, response) => {
  const file = files.get(request.url);
  response.setHeader('Content-Type', file?.type ?? 'text/html');
  response.end(file?.body ?? html);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const swatches = [
  [0, 0, 0],
  [255, 255, 255],
  [15, 75, 200],
  [200, 60, 15],
  [120, 128, 140],
  [240, 230, 220],
];
const xs = swatches.map((_, index) => index * 100 + 50);
const rows = [];
try {
  for (const name of (process.env.MATERIAL_BROWSERS ?? 'chromium,firefox,webkit').split(',')) {
    const browser = await engines[name].launch({
      headless: !display,
      ...(name === 'chromium' ? { channel: 'chromium' } : {}),
    });
    try {
      const page = await browser.newPage({ viewport: { width: 800, height: 300 } });
      // Hosted macOS can inherit reduced-transparency. This diagnostic measures
      // optical rendering; media degradation is covered by lifecycle tests.
      if (name === 'chromium') {
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('Emulation.setEmulatedMedia', {
          features: [
            { name: 'prefers-reduced-transparency', value: 'no-preference' },
            { name: 'prefers-contrast', value: 'no-preference' },
          ],
        });
      }
      if (display) await page.bringToFront();
      for (const theme of ['light', 'dark']) {
        for (const recipe of [
          'author',
          'coloured',
          'grain',
          'author-no-alpha',
          'coloured-no-alpha',
          'author-linear',
          'author-table2',
          'author-direct',
          'grain-no-alpha',
          'author-256',
          'coloured-256',
          'author-native-host',
          'coloured-native-host',
          'grain-native-host',
          'author-native-flat',
          'coloured-native-flat',
          'grain-native-flat',
          'grain-capture-parent',
          'grain-arithmetic',
          'grain-native-flat-transform',
        ]) {
          await page.goto(`http://127.0.0.1:${port}`);
          const paints = await page.evaluate(
            async ({ theme, recipe, swatches }) => {
              document.documentElement.setAttribute('data-theme', theme);
              const style = document.createElement('style');
              style.textContent =
                'body{margin:0}.zone{position:absolute;top:0;width:100px;height:100px}.surface{position:absolute;inset:0;border-radius:0;--_rim:none;--_backdrop-blur:1px}.marker{position:fixed;left:16px;top:16px;width:8px;height:8px;background:rgb(7 251 137);z-index:2147483647;pointer-events:none}';
              document.head.append(style);
              for (const [index, rgb] of swatches.entries()) {
                const zone = document.createElement('div');
                zone.className = 'zone';
                zone.style.left = `${index * 100}px`;
                zone.style.background = `rgb(${rgb.join(' ')})`;
                const surface = document.createElement('div');
                surface.className = 'lab-material lab-material--soft surface';
                if (recipe.startsWith('coloured')) {
                  surface.style.setProperty('--_tint', 'rgb(20 40 60 / .3)');
                  surface.style.setProperty('--_blend', 'rgb(235 70 155 / .65)');
                } else if (recipe.startsWith('grain')) {
                  surface.style.setProperty('--_tint', 'rgb(0 0 0 / 0)');
                  surface.style.setProperty('--_blend', 'rgb(0 0 0 / 0)');
                  // Amplified coloured Screen grain exposes missing, misplaced or
                  // normally-composited grain; production uses the same layer.
                  const svg =
                    '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><path fill="rgb(80,160,240)" fill-opacity=".6" d="M0 0h2v2H0z"/></svg>';
                  surface.style.setProperty(
                    '--_acrylic-noise',
                    `url("data:image/svg+xml;base64,${btoa(svg)}")`,
                  );
                  surface.style.setProperty('--_acrylic-noise-size', '2px');
                } else surface.style.setProperty('--_acrylic-noise', 'none');
                if (recipe.startsWith('coloured'))
                  surface.style.setProperty('--_acrylic-noise', 'none');
                zone.append(surface);
                document.body.append(zone);
              }
              const marker = document.createElement('div');
              marker.className = 'marker';
              document.body.append(marker);
              const runtime = await import('/runtime.js');
              window.disposeMaterials = runtime.mountMaterialRuntime();
              if (recipe.endsWith('arithmetic')) {
                for (const blend of document.querySelectorAll('.lab-material-paint-defs feBlend')) {
                  const composite = document.createElementNS(
                    'http://www.w3.org/2000/svg',
                    'feComposite',
                  );
                  for (const name of ['in', 'in2', 'result'])
                    composite.setAttribute(name, blend.getAttribute(name));
                  for (const [name, value] of Object.entries({
                    operator: 'arithmetic',
                    k1: '-1',
                    k2: '1',
                    k3: '1',
                    k4: '0',
                  }))
                    composite.setAttribute(name, value);
                  blend.replaceWith(composite);
                }
              }
              if (recipe.endsWith('256')) {
                for (const node of document.querySelectorAll(
                  '.lab-material-paint-defs feFuncR,.lab-material-paint-defs feFuncG,.lab-material-paint-defs feFuncB',
                )) {
                  const values = node.getAttribute('tableValues').split(' ').map(Number);
                  node.setAttribute(
                    'tableValues',
                    Array.from({ length: 256 }, (_, i) => {
                      const t = (i * (values.length - 1)) / 255;
                      const lo = Math.floor(t);
                      return values[lo] + ((values[lo + 1] ?? values[lo]) - values[lo]) * (t - lo);
                    }).join(' '),
                  );
                }
              }
              if (recipe.includes('native')) {
                for (const surface of document.querySelectorAll('.surface')) {
                  let wrapper = surface.querySelector('.lab-material__paint');
                  if (!wrapper) {
                    wrapper = document.createElement('div');
                    wrapper.className = 'lab-material__paint';
                    surface.prepend(wrapper);
                  }
                  wrapper.innerHTML = ['capture', 'grain', 'normal', 'blend']
                    .map((name) => `<div class="lab-material__${name}"></div>`)
                    .join('');
                  wrapper.style.display = 'contents';
                  surface.style.setProperty('--_surface-paint', 'transparent');
                  surface.style.setProperty('--_material-paint-filter', 'opacity(1)');
                  surface.setAttribute('data-lab-material-paint-renderer', 'capture-blend');
                  if (recipe.endsWith('host')) {
                    surface.style.backdropFilter = 'blur(1px)';
                    surface.style.webkitBackdropFilter = 'blur(1px)';
                    wrapper.querySelector('.lab-material__capture').remove();
                  } else surface.style.isolation = 'auto';
                  if (recipe.endsWith('transform')) surface.style.transform = 'translateZ(0)';
                }
              }
              if (recipe.endsWith('capture-parent')) {
                for (const surface of document.querySelectorAll('.surface')) {
                  const wrapper = surface.querySelector('.lab-material__paint');
                  if (!wrapper) continue;
                  wrapper.style.filter = getComputedStyle(surface).getPropertyValue(
                    '--_material-paint-filter',
                  );
                  wrapper.querySelector('.lab-material__capture').style.filter = 'none';
                }
              }
              if (recipe.endsWith('no-alpha'))
                for (const node of document.querySelectorAll('.lab-material-paint-defs feFuncA'))
                  node.remove();
              if (recipe === 'author-linear' || recipe === 'author-table2') {
                for (const node of document.querySelectorAll(
                  '.lab-material-paint-defs feFuncR,.lab-material-paint-defs feFuncG,.lab-material-paint-defs feFuncB',
                )) {
                  const values = node.getAttribute('tableValues').split(' ').map(Number);
                  const first = values[0];
                  const last = values.at(-1);
                  if (recipe === 'author-linear') {
                    node.setAttribute('type', 'linear');
                    node.setAttribute('slope', String(last - first));
                    node.setAttribute('intercept', String(first));
                  } else node.setAttribute('tableValues', `${first} ${last}`);
                }
              }
              if (recipe === 'author-direct') {
                for (const surface of document.querySelectorAll('.surface')) {
                  const wrapper = surface.querySelector('.lab-material__paint');
                  if (!wrapper) continue;
                  const capture = wrapper.querySelector('.lab-material__capture');
                  capture.classList.add('lab-material__paint');
                  capture.style.filter = getComputedStyle(surface).getPropertyValue(
                    '--_material-paint-filter',
                  );
                  surface.prepend(capture);
                  wrapper.remove();
                }
              }
              const cs = getComputedStyle(document.querySelector('.surface'));
              return [cs.getPropertyValue('--_tint'), cs.getPropertyValue('--_blend')];
            },
            { theme, recipe, swatches },
          );
          await page.waitForTimeout(display ? 300 : 80);
          let pixels;
          if (display) pixels = await displayPixels(page, xs);
          else {
            const png = await page.screenshot();
            pixels = await page.evaluate(
              async ({ data, xs }) => {
                const image = new Image();
                image.src = `data:image/png;base64,${data}`;
                await image.decode();
                const canvas = document.createElement('canvas');
                canvas.width = image.width;
                canvas.height = image.height;
                const context = canvas.getContext('2d');
                context.drawImage(image, 0, 0);
                return xs.map((x) => Array.from(context.getImageData(x, 50, 1, 1).data));
              },
              { data: png.toString('base64'), xs },
            );
          }
          const spec = {
            normal: parseRgb(paints[0]),
            blend: parseRgb(paints[1]),
            blendMode: theme === 'light' ? 'color-dodge' : 'overlay',
          };
          const expected = swatches.map((rgb) => {
            const input = recipe.startsWith('grain')
              ? rgb.map(
                  (channel, i) => channel + (((255 - channel) * [80, 160, 240][i]) / 255) * 0.6,
                )
              : rgb;
            const output = materialPaintOver(spec, { r: input[0], g: input[1], b: input[2], a: 1 });
            return [output.r, output.g, output.b];
          });
          const maxError = Math.max(
            ...pixels.flatMap((rgb, i) =>
              rgb.slice(0, 3).map((c, k) => Math.abs(c - expected[i][k])),
            ),
          );
          const state = await page.evaluate(() => ({
            renderer:
              document.querySelector('.surface').getAttribute('data-lab-material-paint-renderer') ??
              'backdrop-svg',
            filters: document.querySelectorAll('.lab-material-paint-defs filter').length,
            layers: document.querySelectorAll('.lab-material__paint').length,
          }));
          await page.evaluate(() => window.disposeMaterials());
          if (recipe.includes('native'))
            await page.locator('.lab-material__paint').evaluateAll((nodes) => {
              for (const node of nodes) node.remove();
            });
          assert.equal(
            await page.locator('.lab-material__paint,.lab-material-paint-defs').count(),
            recipe === 'author-direct' && state.layers ? 6 : 0,
            'final disposal releases all capture and filter resources',
          );
          const row = {
            browser: name,
            version: browser.version(),
            theme,
            recipe,
            expected,
            pixels,
            maxError,
            ...state,
          };
          rows.push(row);
          console.info(`MATERIAL_PAINT_ROW=${JSON.stringify(row)}`);
        }
      }
    } finally {
      await browser.close();
    }
  }
} finally {
  await new Promise((resolve) => server.close(resolve));
}
const report = {
  date: new Date().toISOString(),
  platform: process.platform,
  capture: display ? 'display' : 'snapshot',
  rows,
};
await writeFile(
  new URL(`material-paints-${report.capture}-${process.platform}.json`, import.meta.url),
  `${JSON.stringify(report, null, 2)}\n`,
);
console.info(`MATERIAL_PAINT_REPORT=${JSON.stringify(report)}`);
