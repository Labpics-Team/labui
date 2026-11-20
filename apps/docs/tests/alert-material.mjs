import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium, firefox, webkit } from '@playwright/test';
import { build } from 'vite';
import { displayPixels } from '../../../docs/evidence/materials-20261117/display-pixels.mjs';
import { materialPaintOver, parseRgb } from '../../../packages/materials/dist/index.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const output = process.env.MATERIAL_OUTPUT
  ? pathToFileURL(`${resolve(process.env.MATERIAL_OUTPUT)}/`)
  : new URL('../../../docs/evidence/alert-20261119/', import.meta.url);
const display = process.env.MATERIAL_CAPTURE === 'display';
if (display && !process.env.CI) throw new Error('Display capture runs only in isolated CI');
const capture = display ? 'display' : 'snapshot';
const rgbTolerance = 2;
const minimumResponse = rgbTolerance * 2;

// Build the actual fixture and all its imports once. No dev server or second
// Alert renderer participates; Vite supplies the complete asset graph.
const built = await build({
  configFile: false,
  root: resolve(root, 'apps/docs/src'),
  logLevel: 'error',
  build: {
    write: false,
    rollupOptions: { input: resolve(root, 'apps/docs/src/_fixtures/alert-material.html') },
  },
});
const assets = new Map(
  built.output.map((file) => [
    `/${file.fileName}`,
    file.type === 'chunk' ? file.code : file.source,
  ]),
);
const html = [...assets.keys()].find((path) => path.endsWith('.html'));
assert.ok(html, 'production fixture HTML exists');
const bundle = createHash('sha256');
for (const [name, bytes] of [...assets].sort(([a], [b]) => a.localeCompare(b))) {
  bundle.update(name);
  bundle.update(bytes);
}
const bundleSha256 = bundle.digest('hex');
const server = createServer((request, response) => {
  const path = new URL(request.url, 'http://localhost').pathname;
  const file = assets.get(path === '/' ? html : path);
  if (file === undefined) return response.writeHead(404).end();
  response.setHeader(
    'content-type',
    path.endsWith('.js')
      ? 'text/javascript'
      : path.endsWith('.css')
        ? 'text/css'
        : path.endsWith('.woff2')
          ? 'font/woff2'
          : 'text/html',
  );
  response.end(file);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

function distance(a, b) {
  return Math.max(...a.slice(0, 3).map((value, channel) => Math.abs(value - b[channel])));
}
async function sample(page, groups) {
  const points = groups.flatMap((group) => group.points);
  const pixels = display
    ? await displayPixels(page, points)
    : await page.evaluate(
        async ({ data, points }) => {
          const image = new Image();
          image.src = `data:image/png;base64,${data}`;
          await image.decode();
          const canvas = document.createElement('canvas');
          canvas.width = image.width;
          canvas.height = image.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(image, 0, 0);
          return points.map(({ x, y }) => [...ctx.getImageData(x, y, 1, 1).data]);
        },
        { data: (await page.screenshot()).toString('base64'), points },
      );
  let index = 0;
  return groups.map((group) => {
    const raw = pixels.slice(index, index + group.points.length);
    index += group.points.length;
    return {
      name: group.name,
      raw,
      rgb: [0, 1, 2].map(
        (channel) =>
          raw.map((pixel) => pixel[channel]).sort((a, b) => a - b)[Math.floor(raw.length / 2)],
      ),
    };
  });
}
async function settle(page) {
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  if (display) await page.waitForTimeout(250);
}
const rows = [];
try {
  for (const engine of (process.env.MATERIAL_BROWSERS ?? 'chromium,firefox,webkit').split(',')) {
    const launcher = { chromium, firefox, webkit }[engine];
    assert.ok(launcher, `known browser ${engine}`);
    const browser = await launcher.launch({
      headless: !display,
      ...(engine === 'chromium' ? { channel: 'chromium' } : {}),
    });
    try {
      const page = await browser.newPage({ viewport: { width: 640, height: 260 } });
      const errors = [];
      page.on('pageerror', (error) => errors.push(String(error)));
      if (engine === 'chromium') {
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('Emulation.setEmulatedMedia', {
          features: [
            { name: 'prefers-reduced-transparency', value: 'no-preference' },
            { name: 'prefers-contrast', value: 'no-preference' },
          ],
        });
      }
      if (display) await page.bringToFront();
      await page.goto(`http://127.0.0.1:${server.address().port}/`);
      await page.waitForFunction(() => customElements.get('lab-alert'));
      await page.evaluate(async () => {
        await document.querySelector('lab-alert').updateComplete;
        await document.fonts.ready;
      });
      // Diagnostic branch: move authored group opacity to the actual capture.
      // Keep the production recipes and geometry to isolate the tree boundary.
      await page.locator('lab-alert').evaluate((host) => {
        const style = document.createElement('style');
        style.textContent = `
          .lab-alert-layer { --_probe-alpha: var(--_alert-layer-opacity); }
          .lab-alert-layer[data-opacity-control] { --_probe-alpha: 1; }
          .lab-alert-layer > .lab-material { opacity: 1 !important; }
          .lab-alert-layer > .lab-material > .lab-material__paint { opacity: 1; }
          .lab-alert-layer > .lab-material::before,
          .lab-alert-layer > .lab-material::after { opacity: var(--_probe-alpha); }
          :host([data-opacity-probe^="nested"]) .lab-alert-layer .lab-material__capture,
          :host([data-opacity-probe^="capture-alpha"]) .lab-alert-layer .lab-material__capture { opacity: var(--_probe-alpha); }
          :host([data-opacity-probe="nested-opaque"]) .lab-alert-layer .lab-material__capture { opacity: 1; }
          :host([data-opacity-probe^="nested"]) .lab-material__capture > div { position: absolute; inset: 0; border-radius: inherit; }
          :host([data-opacity-probe="nested-bare"]) .lab-alert-layer .lab-material__capture > div,
          :host([data-opacity-probe="nested-no-blend"]) .lab-alert-layer .lab-material__blend,
          :host([data-opacity-probe="nested-no-blend"]) .lab-alert-layer .lab-material__grain { display: none; }
          :host([data-opacity-probe="capture-alpha-no-clip"]) .lab-alert-layer { overflow: visible; }
          :host([data-opacity-probe="host-bare"]) .lab-alert-layer > .lab-material { opacity: var(--_probe-alpha) !important; background: transparent; backdrop-filter: blur(var(--_blur)); -webkit-backdrop-filter: blur(var(--_blur)); }
          :host([data-opacity-probe="host-bare"]) .lab-alert-layer .lab-material__paint { display: none; }
          :host([data-opacity-probe^="group-"]) .lab-alert-layer .lab-material__paint { opacity: var(--_probe-alpha); }
          :host([data-opacity-probe="group-identity"]) .lab-alert-layer .lab-material__paint { backdrop-filter: opacity(1); -webkit-backdrop-filter: opacity(1); }
          :host([data-opacity-probe="group-zero-blur"]) .lab-alert-layer .lab-material__paint { backdrop-filter: blur(0px); -webkit-backdrop-filter: blur(0px); }
          :host([data-opacity-probe="group-tiny-blur"]) .lab-alert-layer .lab-material__paint { backdrop-filter: blur(0.001px); -webkit-backdrop-filter: blur(0.001px); }
          :host([data-opacity-probe="group-host-identity"]) .lab-alert-layer > .lab-material { backdrop-filter: opacity(1); -webkit-backdrop-filter: opacity(1); }
          :host([data-opacity-probe^="affine-"]) .lab-alert-layer .lab-material__capture { filter: var(--_probe-transfer); opacity: var(--_probe-alpha); }
          :host([data-opacity-probe^="affine-"]) .lab-alert-layer .lab-material__normal,
          :host([data-opacity-probe^="affine-"]) .lab-alert-layer .lab-material__blend,
          :host([data-opacity-probe="affine-bare"]) .lab-alert-layer .lab-material__grain { display: none; }
          :host([data-opacity-probe^="affine-"]) .lab-alert-layer .lab-material__grain { opacity: var(--_probe-alpha); }
        `;
        host.shadowRoot.append(style);
      });
      for (const probe of ['affine-after', 'affine-bare']) {
      for (const theme of ['light', 'dark'])
        for (const material of ['acrylic', 'glass']) {
          await page.evaluate(
            ({ theme, material }) => {
              document.documentElement.dataset.theme = theme;
              document.documentElement.dataset.material = material;
            },
            { theme, material },
          );
          await page.waitForFunction(() => {
            const materials = document.querySelector('lab-alert').shadowRoot.querySelectorAll('.lab-alert-layer > .lab-material');
            return materials.length === 2 && [...materials].every(el => el.querySelector('.lab-material__paint > .lab-material__capture'));
          });
          await page.locator('lab-alert').evaluate((host, probe) => {
            host.dataset.opacityProbe = probe;
            for (const material of host.shadowRoot.querySelectorAll('.lab-alert-layer > .lab-material')) {
              const paint = material.querySelector('.lab-material__paint');
              const capture = paint.querySelector('.lab-material__capture');
              if (probe.startsWith('nested')) {
                for (const layer of [...paint.children]) if (layer !== capture) capture.append(layer);
              } else {
                paint.append(...capture.children);
              }
            }
          }, probe);
          const rawPaints = await page.locator('lab-alert').evaluate(host => [...host.shadowRoot.querySelectorAll('.lab-alert-layer > .lab-material')].map(el => {
            const style = getComputedStyle(el);
            return { normal: style.getPropertyValue('--_tint'), blend: style.getPropertyValue('--_blend') };
          }));
          const transfers = rawPaints.map(paint => {
            const spec = { normal: parseRgb(paint.normal), blend: parseRgb(paint.blend), blendMode: theme === 'light' ? 'color-dodge' : 'overlay' };
            const out = value => materialPaintOver(spec, { r: value, g: value, b: value, a: 1 });
            const black = out(0);
            const white = out(255);
            const slope = (white.r - black.r) / 255;
            const intercept = black.r / 255;
            for (let i = 0; i <= 255; i++) {
              const actual = out(i);
              for (const c of ['r', 'g', 'b']) assert.ok(Math.abs(actual[c] - (slope * i + intercept * 255)) < 1e-8, 'diagnostic recipe is neutral and affine');
            }
            const gain = slope + 2 * intercept;
            return `contrast(${slope / gain}) brightness(${gain})`;
          });
          await page.locator('lab-alert').evaluate((host, transfers) => {
            [...host.shadowRoot.querySelectorAll('.lab-alert-layer > .lab-material')].forEach((el, i) => el.style.setProperty('--_probe-transfer', transfers[i]));
          }, transfers);
          await settle(page);
          const geometry = await page.locator('lab-alert').evaluate((host) => {
            const surfaces = [
              host.shadowRoot.querySelector('[part="surface"]'),
              ...host.shadowRoot.querySelectorAll('[part="stack"]'),
            ];
            const x = Math.floor(
              host.getBoundingClientRect().left + host.getBoundingClientRect().width / 2,
            );
            const cluster = (x, y) =>
              [-1, 0, 1].flatMap((dy) => [-1, 0, 1].map((dx) => ({ x: x + dx, y: y + dy })));
            const groups = surfaces.map((el, i) => {
              const rect = el.getBoundingClientRect();
              return {
                name: i ? `stack-${i}` : 'surface',
                points: cluster(x, Math.floor(rect.top + rect.height / 2)),
              };
            });
            // A narrow black band keeps every sample black while exposing both
            // sides of the blur kernel to white. A single edge gives weak
            // signal in the translucent stack on some compositor backends.
            const near = 2;
            const far = 120;
            groups.push(
              { name: 'raw-fixed', points: cluster(x, 220) },
              { name: 'raw-moving', points: cluster(x + Math.floor((near + far) / 2), 220) },
            );
            const planes = surfaces.map((surface) => [...surface.querySelectorAll('.lab-material, .lab-material__paint, .lab-material__capture')].map((el) => {
              const cs = getComputedStyle(el); const rect = el.getBoundingClientRect();
              return { className: el.className, opacity: cs.opacity, filter: cs.filter, backdrop: cs.backdropFilter, blur: cs.getPropertyValue('--_blur'), bounds: {x:rect.x,y:rect.y,width:rect.width,height:rect.height} };
            }));
            return { groups, center: x, near, far, planes };
          });
          assert.equal(
            geometry.groups.length,
            5,
            'front, both stack strips, and two backdrop controls',
          );
          const captureTriplet = async () => {
            const frames = [];
            for (const radius of [geometry.far, geometry.near, geometry.far]) {
              await page.evaluate(
                ({ center, radius }) => window.moveBackdrop(center, radius),
                { center: geometry.center, radius },
              );
              await settle(page);
              frames.push(await sample(page, geometry.groups));
            }
            return frames;
          };
          const original = await captureTriplet();
          const response = original[0]
            .slice(0, 3)
            .map((frame, i) => distance(frame.rgb, original[1][i].rgb));
          const returned = original[0]
            .slice(0, 3)
            .map((frame, i) => distance(frame.rgb, original[2][i].rgb));
          for (const frame of original)
            assert.deepEqual(frame[3].rgb, [0, 0, 0], 'local raw backdrop stays black');
          assert.deepEqual(original[0][4].rgb, [0, 0, 0]);
          assert.deepEqual(original[1][4].rgb, [255, 255, 255], 'boundary actually moved');

          // Reinstate the known backdrop-root regression as a negative control.
          // Fixed raw color prevents ordinary transparency satisfying this test.
          await page.locator('lab-alert').evaluate((host) => {
            for (const layer of host.shadowRoot.querySelectorAll('[part="stack"]')) {
              const material = layer.querySelector('.lab-material');
              layer.style.opacity = getComputedStyle(layer).getPropertyValue('--_alert-layer-opacity');
              layer.setAttribute('data-opacity-control', '');
              material.style.opacity = '1';
            }
          });
          const control = await captureTriplet();
          const controlResponse = control[0]
            .slice(1, 3)
            .map((frame, i) => distance(frame.rgb, control[1][i + 1].rgb));
          await page.locator('lab-alert').evaluate((host) => {
            for (const layer of host.shadowRoot.querySelectorAll('[part="stack"]')) {
              layer.style.removeProperty('opacity');
              layer.removeAttribute('data-opacity-control');
              layer.querySelector('.lab-material').style.removeProperty('opacity');
            }
          });
          await settle(page);
          const restored = await sample(page, geometry.groups);
          const groupAlpha = await page.locator('lab-alert').evaluate((host) => {
            return [...host.shadowRoot.querySelectorAll('[part="stack"]')].map(layer => {
              return Number(getComputedStyle(layer).getPropertyValue('--_alert-layer-opacity'));
            });
          });
          const compositeFrames = [];
          const compositeError = [];
          // Other layers stay at their authored alpha: their paint is part of
          // this capture's backdrop, so changing all alphas is not a linear test.
          for (const [index, weight] of groupAlpha.entries()) {
            const endpoints = [];
            for (const alpha of ['0', '1']) {
              await page.locator('lab-alert').evaluate((host, {index, alpha}) => {
                host.shadowRoot.querySelectorAll('[part="stack"]')[index].style.setProperty('--_probe-alpha', alpha);
              }, {index, alpha});
              await settle(page);
              endpoints.push((await sample(page, geometry.groups))[index+1].rgb);
            }
            compositeFrames.push(endpoints);
            compositeError.push(Math.max(...[0,1,2].map(c => Math.abs(original[0][index+1].rgb[c] - (endpoints[0][c] * (1-weight) + endpoints[1][c] * weight)))));
            await page.locator('lab-alert').evaluate((host, index) => host.shadowRoot.querySelectorAll('[part="stack"]')[index].style.removeProperty('--_probe-alpha'), index);
            await settle(page);
          }
          const restoreError = original[0]
            .slice(0, 3)
            .map((frame, i) => distance(frame.rgb, restored[i].rgb));
          const measurable =
            engine === 'chromium' ||
            (display && (process.platform === 'darwin' || engine === 'firefox'));
          const row = {
            probe,
            engine,
            version: browser.version(),
            theme,
            material,
            capture,
            platform: process.platform,
            measurable,
            qualified: false,
            geometry,
            response,
            returned,
            controlResponse,
            restoreError,
            compositeError,
            compositeFrames,
            original,
            control,
            restored,
          };
          rows.push(row);
          try {
            if (false && measurable) {
              for (const [i, value] of response.entries())
                assert.ok(
                  value > minimumResponse,
                  `${engine}/${theme}/${material}/${geometry.groups[i].name}: actual backdrop response ${value} exceeds ${minimumResponse} RGB`,
                );
              for (const value of returned)
                assert.ok(
                  value <= rgbTolerance,
                  'returning the backdrop restores every Alert layer',
                );
              for (const value of restoreError)
                assert.ok(
                  value <= rgbTolerance,
                  'removing the regression restores the production pixels',
                );
              for (const [i, value] of controlResponse.entries()) {
                assert.ok(
                  value <= rgbTolerance,
                  'wrapper opacity cannot observe the changed surrounding backdrop',
                );
                assert.ok(
                  response[i + 1] > value + minimumResponse,
                  'the optical invariant rejects wrapper opacity',
                );
              }
            }
            row.qualified = false; // Diagnostic matrix: raw observations only.
          } finally {
            const { original, control, restored, ...summary } = row;
            const medians = (frames) =>
              frames.map((frame) => frame.map(({ name, rgb }) => ({ name, rgb })));
            console.info(
              `ALERT_MATERIAL_ROW=${JSON.stringify({ ...summary, original: medians(original), control: medians(control), restored: restored.map(({ name, rgb }) => ({ name, rgb })) })}`,
            );
          }
        }
      }
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
    }
  }
  assert.ok(rows.length > 0, 'diagnostic observations exist');
} finally {
  await new Promise((resolve) => server.close(resolve));
  await mkdir(output, { recursive: true });
  await writeFile(
    new URL(`material-${capture}-${process.platform}.json`, output),
    `${JSON.stringify({ source: process.env.GITHUB_SHA ?? null, bundleSha256, capture, platform: process.platform, rgbTolerance, minimumResponse, rows }, null, 2)}\n`,
  );
}
