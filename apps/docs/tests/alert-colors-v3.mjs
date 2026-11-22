import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { build } from 'vite';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const output = resolve(
  root,
  process.env.COLORS_PROBE_OUTPUT ?? 'packages/colors/artifacts/alert-v3',
);
// A local directory is an explicit development override, never a published coordinate.
const colorsDirectory =
  process.env.COLORS_PROBE_COLORS && resolve(process.env.COLORS_PROBE_COLORS).replaceAll('\\', '/');
const built = await build({
  configFile: false,
  root: resolve(root, 'apps/docs/src'),
  logLevel: 'error',
  ...(colorsDirectory
    ? {
        resolve: {
          alias: [
            { find: /^@labpics\/colors$/, replacement: `${colorsDirectory}/index.js` },
            { find: /^@labpics\/colors\/(.*)$/, replacement: `${colorsDirectory}/$1` },
          ],
        },
      }
    : {}),
  build: {
    target: 'esnext',
    write: false,
    rollupOptions: { input: resolve(root, 'apps/docs/src/_fixtures/alert-colors-v3.html') },
  },
});
const assets = new Map(
  built.output.map((file) => [
    `/${file.fileName}`,
    file.type === 'chunk' ? file.code : file.source,
  ]),
);
const html = [...assets.keys()].find((path) => path.endsWith('.html'));
const wasm = [...assets].find(([path]) => path.endsWith('.wasm'));
assert.ok(wasm, 'consumer bundle contains the real Rust WASM');
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
        : path.endsWith('.wasm')
          ? 'application/wasm'
          : path.endsWith('.woff2')
            ? 'font/woff2'
            : 'text/html',
  );
  response.end(file);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({
  headless: true,
  ...(process.env.COLORS_PROBE_BROWSER ? { executablePath: process.env.COLORS_PROBE_BROWSER } : {}),
});
const reports = [];
try {
  await mkdir(output, { recursive: true });
  const page = await browser.newPage({
    viewport: { width: 1462, height: 290 },
    deviceScaleFactor: 1,
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForFunction(() => Boolean(window.alertColorsProbe));
  await page.evaluate(() => document.fonts.ready);
  for (const [theme, cases] of [
    [
      'light',
      [
        ['nominal', [255, 255, 255]],
        ['black', [0, 0, 0]],
        ['blue', [40, 60, 100]],
        ['recovered', [255, 255, 255]],
      ],
    ],
    [
      'dark',
      [
        ['nominal', [28, 28, 30]],
        ['white', [255, 255, 255]],
        ['blue', [40, 60, 100]],
        ['recovered', [28, 28, 30]],
      ],
    ],
  ])
    for (const [name, background] of cases) {
      const result = await page.evaluate(
        ({ theme, background }) => window.alertColorsProbe.update(theme, background),
        { theme, background },
      );
      // Read the real component's computed styles. A rejected solve must retain its prior painted surface.
      const rendered = await page.evaluate(() =>
        Object.fromEntries(
          ['source', 'visible'].map((mode) => {
            const alert = document.getElementById(mode);
            const style = (part) =>
              getComputedStyle(alert.shadowRoot.querySelector(`[part="${part}"]`));
            return [
              mode,
              {
                heading: style('heading').color,
                description: style('description').color,
                border: style('surface').boxShadow,
                background: getComputedStyle(alert)
                  .getPropertyValue('--lab-bg-grouped-secondary')
                  .trim(),
              },
            ];
          }),
        ),
      );
      for (const mode of ['source', 'visible'])
        if (result[mode].accepted) {
          assert.equal(
            rendered[mode].background,
            `rgb(${result[mode].accepted.background.join(' ')})`,
          );
          const close = page.locator(`#${mode}`).locator('button');
          await close.focus();
          rendered[mode].focus = await close.evaluate((element) => {
            const style = getComputedStyle(element);
            return { color: style.outlineColor, width: style.outlineWidth };
          });
          assert.notEqual(rendered[mode].focus.width, '0px');
          await close.evaluate((element) => element.blur());
        }
      reports.push({ theme, name, result, rendered });
      await page.screenshot({ path: resolve(output, `${theme}-${name}.png`) });
    }
  assert.deepEqual(errors, []);
  for (const theme of ['light', 'dark']) {
    const nominal = reports.find((report) => report.theme === theme && report.name === 'nominal');
    const recovered = reports.find(
      (report) => report.theme === theme && report.name === 'recovered',
    );
    for (const mode of ['source', 'visible'])
      assert.deepEqual(recovered.result[mode].colors, nominal.result[mode].colors);
  }
  await page.evaluate(() => window.alertColorsProbe.dispose());
  await writeFile(
    resolve(output, 'report.json'),
    `${JSON.stringify(
      {
        purpose:
          'Diagnostic comparison; successful execution is not acceptance of either color policy.',
        colorsArtifact: process.env.COLORS_PROBE_PROVENANCE ?? 'unqualified-local-artifact',
        wasmSha256: createHash('sha256').update(wasm[1]).digest('hex'),
        browser: browser.version(),
        reports,
      },
      null,
      2,
    )}\n`,
  );
  console.info(`Alert V3 diagnostic consumer: ${reports.length} rendered cases, ${output}`);
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
