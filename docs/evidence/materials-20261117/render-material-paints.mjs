import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import {
  blendChannel,
  materialPaintOver,
  parseRgb,
} from '../../../packages/materials/dist/index.js';
import { displayPixels } from './display-pixels.mjs';
import { verifyScrollPaint } from './verify-scroll-paint.mjs';

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
const scrollRows = [];
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
        for (const tier of ['subtle', 'soft', 'muted', 'base', 'elevated']) {
          for (const recipe of ['author', 'coloured', 'grain', 'author-grain']) {
            if (tier !== 'soft' && (recipe === 'coloured' || recipe === 'grain')) continue;
            await page.goto(`http://127.0.0.1:${port}`);
            const paints = await page.evaluate(
              async ({ theme, tier, recipe, swatches }) => {
                document.documentElement.setAttribute('data-theme', theme);
                const style = document.createElement('style');
                style.textContent =
                  'body{margin:0}.zone{position:absolute;top:0;width:100px;height:100px}.surface{position:absolute;inset:0;border-radius:0;transform:translateZ(0);--_rim:none;--_backdrop-blur:1px}.marker{position:fixed;left:16px;top:16px;width:8px;height:8px;background:rgb(7 251 137);z-index:2147483647;pointer-events:none}';
                document.head.append(style);
                for (const [index, rgb] of swatches.entries()) {
                  const zone = document.createElement('div');
                  zone.className = 'zone';
                  zone.style.left = `${index * 100}px`;
                  zone.style.background = `rgb(${rgb.join(' ')})`;
                  const surface = document.createElement('div');
                  surface.className = `lab-material lab-material--${tier} surface`;
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
                  } else if (recipe !== 'author-grain')
                    surface.style.setProperty('--_acrylic-noise', 'none');
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
                const cs = getComputedStyle(document.querySelector('.surface'));
                return [cs.getPropertyValue('--_tint'), cs.getPropertyValue('--_blend')];
              },
              { theme, tier, recipe, swatches },
            );
            let motion;
            if (recipe === 'author-grain' && tier === 'soft') {
              motion = await page.evaluate(async () => {
                const surfaces = Array.from(document.querySelectorAll('.surface'));
                const resources = Array.from(
                  document.querySelectorAll('.lab-material__paint,.lab-material-paint-defs filter'),
                );
                let mutations = 0;
                const observer = new MutationObserver((records) => {
                  mutations += records.length;
                });
                for (const resource of resources)
                  observer.observe(resource, { attributes: true, childList: true, subtree: true });
                const frames = [];
                let previous = performance.now();
                for (let i = 0; i < 30; i++) {
                  for (const surface of surfaces)
                    surface.style.transform = `translateY(${i % 2}px) scale(${i % 2 ? 0.98 : 1})`;
                  await new Promise(requestAnimationFrame);
                  const now = performance.now();
                  frames.push(now - previous);
                  previous = now;
                }
                for (const surface of surfaces) surface.style.transform = 'translateZ(0)';
                await new Promise(requestAnimationFrame);
                observer.disconnect();
                frames.sort((a, b) => a - b);
                return {
                  mutations,
                  retained: resources.every((node) => node.isConnected),
                  frameP95: frames[Math.floor(frames.length * 0.95)],
                  surfaces: surfaces.length,
                };
              });
              assert.equal(
                motion.mutations,
                0,
                'translation and scale retain immutable paint resources',
              );
              assert.equal(motion.retained, true);
            }
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
              const input =
                recipe.startsWith('grain') && name !== 'firefox'
                  ? rgb.map(
                      (channel, i) => channel + (((255 - channel) * [80, 160, 240][i]) / 255) * 0.6,
                    )
                  : rgb;
              const output = materialPaintOver(spec, {
                r: input[0],
                g: input[1],
                b: input[2],
                a: 1,
              });
              return [output.r, output.g, output.b];
            });
            const maxError = Math.max(
              ...pixels.flatMap((rgb, i) =>
                rgb.slice(0, 3).map((c, k) => Math.abs(c - expected[i][k])),
              ),
            );
            const state = await page.evaluate(() => ({
              grain: document.querySelector('.surface').getAttribute('data-lab-material-grain'),
              grainError: Number(
                document.querySelector('.surface').getAttribute('data-lab-material-grain-error') ??
                  0,
              ),
              renderer:
                document
                  .querySelector('.surface')
                  .getAttribute('data-lab-material-paint-renderer') ?? 'backdrop-svg',
              filters: document.querySelectorAll('.lab-material-paint-defs filter').length,
              layers: document.querySelectorAll('.lab-material__paint').length,
            }));
            const measurable =
              name === 'chromium' ||
              (display && (name === 'firefox' || process.platform === 'darwin'));
            if (measurable && recipe !== 'coloured')
              assert(maxError <= 2, `${name}/${theme}/${recipe}: ${maxError} RGB`);
            if (measurable && recipe === 'coloured') {
              // Native dodge amplifies intermediate byte rounding near its
              // breakpoint. Bound the intermediate normal channel by one byte,
              // then the output blend/quantisation by two; retain the raw error.
              for (const [i, pixel] of pixels.entries())
                for (let ch = 0; ch < 3; ch++) {
                  const key = ['r', 'g', 'b'][ch];
                  const normal =
                    swatches[i][ch] * (1 - spec.normal.a) + spec.normal[key] * spec.normal.a;
                  const ends = [-1, 1].map((delta) => {
                    const b = Math.min(1, Math.max(0, (normal + delta) / 255));
                    return (
                      255 *
                      (b +
                        spec.blend.a * (blendChannel(b, spec.blend[key] / 255, spec.blendMode) - b))
                    );
                  });
                  assert(
                    pixel[ch] >= ends[0] - 2 && pixel[ch] <= ends[1] + 2,
                    `${name}/${theme}/${recipe}/${i}/${ch} exceeds native quantisation bound`,
                  );
                }
            }
            if (name === 'firefox' && recipe === 'grain') assert.equal(state.grain, 'unsupported');
            if (name === 'firefox' && recipe === 'author-grain') {
              assert.equal(state.grain, 'uniform-bounded');
              assert(state.grainError < 1);
            }
            await page.evaluate(() => window.disposeMaterials());
            assert.equal(
              await page
                .locator('.lab-material__paint,.lab-material-paint-defs,[data-lab-material-grain]')
                .count(),
              0,
              'final disposal releases all capture and filter resources',
            );
            const row = {
              browser: name,
              version: browser.version(),
              theme,
              tier,
              recipe,
              expected,
              pixels,
              maxError,
              ...state,
              measurable,
              ...(motion ? { motion } : {}),
            };
            rows.push(row);
            console.info(`MATERIAL_PAINT_ROW=${JSON.stringify(row)}`);
          }
        }
      }
      scrollRows.push(
        ...(await verifyScrollPaint(page, `http://127.0.0.1:${port}`, name, display)),
      );
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
  scrollRows,
};
await writeFile(
  new URL(`material-paints-${report.capture}-${process.platform}.json`, import.meta.url),
  `${JSON.stringify(report, null, 2)}\n`,
);
