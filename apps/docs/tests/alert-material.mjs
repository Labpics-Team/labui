import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium, firefox, webkit } from '@playwright/test';
import { build } from 'vite';
import { displayPixels } from '../../../docs/evidence/materials-20261117/display-pixels.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const output = process.env.MATERIAL_OUTPUT
  ? pathToFileURL(`${resolve(process.env.MATERIAL_OUTPUT)}/`)
  : new URL('../../../docs/evidence/alert-20261119/', import.meta.url);
const display = process.env.MATERIAL_CAPTURE === 'display';
if (display && !process.env.CI) throw new Error('Display capture runs only in isolated CI');
const capture = display ? 'display' : 'snapshot';
const rgbTolerance = 2;
// Endpoint interpolation uses binary floating-point on byte RGB. Preserve the
// 2 RGB contract at its boundary (e.g. 2.000000000000014) within one scale ULP.
const rgbComparisonTolerance = rgbTolerance + Number.EPSILON * 255;
const minimumResponse = rgbTolerance * 2;

// Build the actual fixture and all its imports once. No dev server or second
// Alert renderer participates; Vite supplies the complete asset graph.
const built = await build({
  configFile: false,
  root: resolve(root, 'apps/docs/src'),
  logLevel: 'error',
  // Isolated worktrees may share dependency junctions. Resolve their own built
  // files explicitly when requested, rather than accidentally testing a peer.
  ...(process.env.MATERIAL_LOCAL_BUILD === '1'
    ? {
        resolve: {
          alias: [
            {
              find: '@labpics/ui-core/alert',
              replacement: resolve(root, 'packages/core/dist/components/alert/index.js'),
            },
            {
              find: '@labpics/ui-core/icon/runtime',
              replacement: resolve(root, 'packages/core/dist/components/icon/runtime.js'),
            },
            {
              find: '@labpics/ui-materials/material.css',
              replacement: resolve(root, 'packages/materials/dist/material.css'),
            },
            {
              find: '@labpics/ui-materials/css',
              replacement: resolve(root, 'packages/materials/dist/css.js'),
            },
            {
              find: '@labpics/ui-materials',
              replacement: resolve(root, 'packages/materials/dist/index.js'),
            },
          ],
        },
      }
    : {}),
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
      const refresh = await page.locator('lab-alert').evaluate(async (host) => {
        const scope = document.createElement('section');
        scope.dataset.theme = 'light';
        scope.dataset.material = 'acrylic';
        scope.innerHTML =
          '<div class="lab-material lab-material--base" style="width:40px;height:40px"></div>';
        host.shadowRoot.querySelector('[data-lab-alert]').append(scope);
        const surface = scope.firstElementChild;
        const raf = window.requestAnimationFrame;
        const style = window.getComputedStyle;
        const frame = () => new Promise((resolve) => raf(resolve));
        await frame();
        await frame();
        await frame();
        let frames = 0;
        let reads = 0;
        window.requestAnimationFrame = (...args) => {
          frames++;
          return raf(...args);
        };
        window.getComputedStyle = (...args) => {
          if (args[0] === surface) reads++;
          return style(...args);
        };
        try {
          scope.dataset.theme = 'dark';
          await frame();
          await frame();
          await frame();
          return {
            frames,
            reads,
            theme: surface.dataset.labMaterialTheme,
            renderer: surface.dataset.labMaterialPaintRenderer,
          };
        } finally {
          window.requestAnimationFrame = raf;
          window.getComputedStyle = style;
          scope.remove();
        }
      });
      assert.equal(refresh.theme, 'dark');
      assert.equal(refresh.frames, 1, 'a source theme change schedules one material refresh');
      assert.equal(
        refresh.reads,
        2,
        'contour and paint read style once each; affine needs no capture placement',
      );
      await settle(page);
      for (const theme of ['light', 'dark'])
        for (const material of ['acrylic', 'glass']) {
          await page.evaluate(
            ({ theme, material }) => {
              document.documentElement.dataset.theme = theme;
              document.documentElement.dataset.material = material;
            },
            { theme, material },
          );
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
            const decoration = surfaces.slice(1).map((el, i) => {
              const r = el.getBoundingClientRect();
              const left = Math.ceil(r.left);
              const right = Math.floor(r.right) - 1;
              const top = Math.ceil(r.top);
              const bottom = Math.floor(r.bottom) - 1;
              const row = (x, y) => [-1, 0, 1].map((dx) => ({ x: x + dx, y }));
              return [
                {
                  name: `stack-${i + 1}-center`,
                  points: cluster(x, Math.floor(r.top + r.height / 2)),
                },
                { name: `stack-${i + 1}-bottom`, points: row(x, bottom) },
                {
                  name: `stack-${i + 1}-left`,
                  points: [0, 1, 2].map((dy) => ({ x: left, y: top + dy })),
                },
                {
                  name: `stack-${i + 1}-right`,
                  points: [0, 1, 2].map((dy) => ({ x: right, y: top + dy })),
                },
                {
                  name: `stack-${i + 1}-corners`,
                  points: Array.from({ length: 8 }, (_, dy) =>
                    Array.from({ length: 8 }, (_, dx) => [
                      { x: left + dx, y: bottom - dy },
                      { x: right - dx, y: bottom - dy },
                    ]),
                  ).flat(2),
                },
                { name: `stack-${i + 1}-top`, points: row(x, top) },
              ];
            });
            return { groups, decoration, center: x, near, far };
          });
          assert.equal(
            geometry.groups.length,
            5,
            'front, both stack strips, and two backdrop controls',
          );
          const captureTriplet = async () => {
            const frames = [];
            for (const radius of [geometry.far, geometry.near, geometry.far]) {
              await page.evaluate(({ center, radius }) => window.moveBackdrop(center, radius), {
                center: geometry.center,
                radius,
              });
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
              const alpha = Number(
                getComputedStyle(layer).getPropertyValue('--_alert-layer-opacity'),
              );
              if (!(alpha > 0 && alpha < 1))
                throw new Error('negative control needs authored partial alpha');
              layer.style.opacity = String(alpha);
              if (Number(getComputedStyle(layer).opacity) !== alpha)
                throw new Error('negative control did not create wrapper opacity');
              material.style.setProperty('--_material-layer-opacity', '1');
            }
          });
          const control = await captureTriplet();
          const controlResponse = control[0]
            .slice(1, 3)
            .map((frame, i) => distance(frame.rgb, control[1][i + 1].rgb));
          await page.locator('lab-alert').evaluate((host) => {
            for (const layer of host.shadowRoot.querySelectorAll('[part="stack"]')) {
              layer.style.removeProperty('opacity');
              layer
                .querySelector('.lab-material')
                .style.removeProperty('--_material-layer-opacity');
            }
          });
          await settle(page);
          const restored = await sample(page, geometry.groups);
          const compositeError = [];
          const decorativeComposite = [];
          const strokeVisibility = [];
          // Hold the other layers fixed: they are part of this layer's actual
          // backdrop. Changing all group alphas together is not a linear test.
          for (let index = 0; index < 2; index++) {
            const alpha = await page
              .locator('lab-alert')
              .evaluate(
                (host, index) =>
                  Number(
                    getComputedStyle(
                      host.shadowRoot.querySelectorAll('[part="stack"]')[index],
                    ).getPropertyValue('--_alert-layer-opacity'),
                  ),
                index,
              );
            const endpoints = [];
            const originalDecoration = await sample(page, geometry.decoration[index]);
            const decorativeEndpoints = [];
            for (const weight of ['0', '1']) {
              await page.locator('lab-alert').evaluate(
                (host, { index, weight }) => {
                  host.shadowRoot
                    .querySelectorAll('[part="stack"]')
                    [index].querySelector('.lab-material')
                    .style.setProperty('--_material-layer-opacity', weight);
                },
                { index, weight },
              );
              await settle(page);
              endpoints.push((await sample(page, geometry.groups))[index + 1].rgb);
              decorativeEndpoints.push(await sample(page, geometry.decoration[index]));
            }
            compositeError.push(
              Math.max(
                ...[0, 1, 2].map((c) =>
                  Math.abs(
                    original[0][index + 1].rgb[c] -
                      (endpoints[0][c] * (1 - alpha) + endpoints[1][c] * alpha),
                  ),
                ),
              ),
            );
            decorativeComposite.push(
              originalDecoration.map((group, at) => ({
                name: group.name,
                error: Math.max(
                  ...group.raw.flatMap((pixel, p) =>
                    pixel
                      .slice(0, 3)
                      .map((value, c) =>
                        Math.abs(
                          value -
                            decorativeEndpoints[0][at].raw[p][c] * (1 - alpha) -
                            decorativeEndpoints[1][at].raw[p][c] * alpha,
                        ),
                      ),
                  ),
                ),
                rgb: group.rgb,
                endpoints: decorativeEndpoints.map((e) => e[at].rgb),
              })),
            );
            await page
              .locator('lab-alert')
              .evaluate(
                (host, index) =>
                  host.shadowRoot
                    .querySelectorAll('[part="stack"]')
                    [index].querySelector('.lab-material')
                    .style.removeProperty('--_material-layer-opacity'),
                index,
              );
            await settle(page);
            const beforeStroke = await sample(page, geometry.decoration[index]);
            await page.locator('lab-alert').evaluate((host, index) => {
              const surface = host.shadowRoot
                .querySelectorAll('[part="stack"]')
                [index].querySelector('.lab-material');
              surface.dataset.noStroke = '';
              const sheet = document.createElement('style');
              sheet.id = 'stroke-control';
              sheet.textContent =
                '[data-no-stroke]::after { border-color:transparent !important; box-shadow:none !important; }';
              host.shadowRoot.append(sheet);
            }, index);
            await settle(page);
            const noStroke = await sample(page, geometry.decoration[index]);
            strokeVisibility.push(
              beforeStroke.map((group, at) => ({
                name: group.name,
                change: Math.max(
                  ...group.raw.flatMap((p, i) =>
                    p.slice(0, 3).map((v, c) => Math.abs(v - noStroke[at].raw[i][c])),
                  ),
                ),
              })),
            );
            await page.locator('lab-alert').evaluate((host, index) => {
              host.shadowRoot
                .querySelectorAll('[part="stack"]')
                [index].querySelector('.lab-material')
                .removeAttribute('data-no-stroke');
              host.shadowRoot.querySelector('#stroke-control').remove();
            }, index);
            await settle(page);
          }
          const restoreError = original[0]
            .slice(0, 3)
            .map((frame, i) => distance(frame.rgb, restored[i].rgb));
          const measurable =
            engine === 'chromium' ||
            (display && (process.platform === 'darwin' || engine === 'firefox'));
          const row = {
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
            decorativeComposite,
            strokeVisibility,
            refresh,
            original,
            control,
            restored,
          };
          if (process.env.MATERIAL_IMAGES === '1' && engine === 'chromium') {
            await mkdir(output, { recursive: true });
            await page.screenshot({
              path: fileURLToPath(new URL(`alert-${theme}-${material}.png`, output)),
            });
          }
          rows.push(row);
          try {
            if (measurable) {
              for (const error of compositeError)
                assert.ok(
                  error <= rgbComparisonTolerance,
                  `authored group alpha is preserved within ${rgbTolerance} RGB, observed ${error}`,
                );
              for (const [i, value] of response.entries())
                assert.ok(
                  value > minimumResponse,
                  `${engine}/${theme}/${material}/${geometry.groups[i].name}: actual backdrop response ${value} exceeds ${minimumResponse} RGB`,
                );
              for (const value of returned)
                assert.ok(
                  value <= rgbComparisonTolerance,
                  'returning the backdrop restores every Alert layer',
                );
              for (const value of restoreError)
                assert.ok(
                  value <= rgbComparisonTolerance,
                  'removing the regression restores the production pixels',
                );
              for (const [i, value] of controlResponse.entries()) {
                assert.ok(
                  value <= rgbComparisonTolerance,
                  'wrapper opacity cannot observe the changed surrounding backdrop',
                );
                assert.ok(
                  response[i + 1] > value + minimumResponse,
                  'the optical invariant rejects wrapper opacity',
                );
              }
            }
            // Endpoint compositing remains observable even when the snapshot
            // omits live backdrop capture. Do not waive edge alpha on those engines.
            for (const layer of decorativeComposite)
              for (const point of layer)
                assert.ok(
                  point.error <= rgbComparisonTolerance,
                  `${point.name}: complete decoration group alpha error ${point.error} <= ${rgbTolerance}`,
                );
            for (const layer of strokeVisibility) {
              for (const point of layer) {
                if (point.name.endsWith('-top') || point.name.endsWith('-center'))
                  assert.equal(
                    point.change,
                    0,
                    `${point.name}: no authored top border or center stroke`,
                  );
                else
                  assert.ok(
                    point.change > 0,
                    `${point.name}: stroke is present and the pixel probe observes it`,
                  );
              }
            }
            row.qualified = measurable;
          } finally {
            const { original, control, restored, ...summary } = row;
            const medians = (frames) =>
              frames.map((frame) => frame.map(({ name, rgb }) => ({ name, rgb })));
            console.info(
              `ALERT_MATERIAL_ROW=${JSON.stringify({ ...summary, original: medians(original), control: medians(control), restored: restored.map(({ name, rgb }) => ({ name, rgb })) })}`,
            );
          }
        }
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
    }
  }
  assert.ok(
    rows.some((row) => row.measurable),
    'at least one optical capture is measurable',
  );
} finally {
  await new Promise((resolve) => server.close(resolve));
  await mkdir(output, { recursive: true });
  await writeFile(
    new URL(`material-${capture}-${process.platform}.json`, output),
    `${JSON.stringify({ source: process.env.GITHUB_SHA ?? null, bundleSha256, capture, platform: process.platform, rgbTolerance, minimumResponse, rows }, null, 2)}\n`,
  );
}
