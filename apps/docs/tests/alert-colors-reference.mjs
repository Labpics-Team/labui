import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { build } from 'vite';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const output = resolve(
  root,
  process.env.COLORS_PROBE_OUTPUT ?? 'packages/colors/artifacts/alert-reference',
);
assert.ok(process.env.COLORS_PROBE_COLORS, 'explicit immutable development package required');
const colorsDirectory = resolve(process.env.COLORS_PROBE_COLORS).replaceAll('\\', '/');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
async function runtimeFiles(directory, prefix = '') {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = `${prefix}${entry.name}`;
    if (entry.isDirectory() && !['node_modules', 'test'].includes(entry.name))
      files.push(...(await runtimeFiles(resolve(directory, entry.name), `${path}/`)));
    else if (entry.isFile() && /\.(js|d\.ts|wasm)$/.test(entry.name)) files.push(path);
  }
  return files.sort();
}
const inputFiles = await runtimeFiles(colorsDirectory);
const inputHashes = async () =>
  Object.fromEntries(
    await Promise.all(
      inputFiles.map(async (path) => [path, hash(await readFile(resolve(colorsDirectory, path)))]),
    ),
  );
const beforeHashes = await inputHashes();
const built = await build({
  configFile: false,
  root: resolve(root, 'apps/docs/src'),
  logLevel: 'error',
  resolve: {
    alias: [
      { find: /^@labpics\/colors$/, replacement: `${colorsDirectory}/index.js` },
      { find: /^@labpics\/colors\/(.*)$/, replacement: `${colorsDirectory}/$1` },
    ],
  },
  build: {
    target: 'esnext',
    write: false,
    rollupOptions: { input: resolve(root, 'apps/docs/src/_fixtures/alert-colors-reference.html') },
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
assert.ok(wasm, 'real Rust WASM bundled');
assert.equal(hash(wasm[1]), beforeHashes['pkg/labcolors_bg.wasm']);
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
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const browser = await chromium.launch({
  headless: true,
  ...(process.env.COLORS_PROBE_BROWSER ? { executablePath: process.env.COLORS_PROBE_BROWSER } : {}),
});
const modes = ['source', 'visible', 'reference'];
const roles = ['heading', 'description', 'dangerIcon', 'close', 'border', 'focus'];
const reports = [];
const failures = [];
const lastAccepted = new Map();
const check = (description, run) => {
  try {
    run();
  } catch (error) {
    failures.push({ description, message: error.message });
  }
};
try {
  await mkdir(output, { recursive: true });
  const page = await browser.newPage({
    viewport: { width: 988, height: 436 },
    deviceScaleFactor: 1,
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForFunction(() => Boolean(window.alertColorsProbe));
  await page.evaluate(() => document.fonts.ready);
  const cases = [
    ['light', 'nominal', [255, 255, 255]],
    ['light', 'black', [0, 0, 0]],
    ['light', 'blue', [40, 60, 100]],
    ['light', 'gray', [128, 128, 128]],
    ['light', 'recovered', [255, 255, 255]],
    ['dark', 'nominal', [28, 28, 30]],
    ['dark', 'white', [255, 255, 255]],
    ['dark', 'blue', [40, 60, 100]],
    ['dark', 'gray', [128, 128, 128]],
    ['dark', 'recovered', [28, 28, 30]],
    ['light', 'theme-return', [255, 255, 255]],
  ];
  for (const [theme, name, background] of cases) {
    const result = await page.evaluate(
      ({ theme, background }) => window.alertColorsProbe.update(theme, background),
      { theme, background },
    );
    const rendered = await page.evaluate(() =>
      Object.fromEntries(
        ['authored', 'source', 'visible', 'reference'].map((mode) => {
          const alert = document.getElementById(mode);
          const base = alert.getBoundingClientRect();
          const parts = Object.fromEntries(
            ['surface', 'heading', 'description', 'icon', 'close'].map((part) => {
              const node = alert.shadowRoot.querySelector(`[part="${part}"]`);
              const style = getComputedStyle(node);
              const rect = node.getBoundingClientRect();
              return [
                part,
                {
                  color: style.color,
                  background: style.backgroundColor,
                  border: style.boxShadow,
                  geometry: [rect.x - base.x, rect.y - base.y, rect.width, rect.height],
                  typography: [
                    style.fontFamily,
                    style.fontSize,
                    style.lineHeight,
                    style.fontWeight,
                    style.letterSpacing,
                  ],
                },
              ];
            }),
          );
          const normalized = Object.fromEntries(
            ['heading', 'description', 'dangerIcon', 'close', 'border', 'focus'].map((part) => {
              const swatch = document.createElement('span');
              swatch.style.color = getComputedStyle(alert).getPropertyValue(`--probe-${part}`);
              document.body.append(swatch);
              const value = getComputedStyle(swatch).color;
              swatch.remove();
              return [part, value];
            }),
          );
          const rawPaint = Object.fromEntries(
            ['heading', 'description', 'dangerIcon', 'close', 'border', 'focus'].map((part) => [
              part,
              getComputedStyle(alert).getPropertyValue(`--probe-${part}`).trim(),
            ]),
          );
          return [
            mode,
            {
              parts,
              normalized,
              rawPaint,
              size: [base.width, base.height],
              background: getComputedStyle(alert)
                .getPropertyValue('--lab-bg-grouped-secondary')
                .trim(),
            },
          ];
        }),
      ),
    );
    for (const mode of modes) {
      const value = result[mode];
      const key = `${theme}/${mode}`;
      check(`${theme}/${name}/${mode}: atomic acceptance or retention`, () => {
        if (value.state === 'ready') {
          assert.deepEqual(value.colors, value.accepted.colors);
          assert.deepEqual(value.accepted.background, background);
        } else {
          assert.deepEqual(value.accepted, lastAccepted.get(key) ?? null);
        }
      });
      if (value.state === 'ready') lastAccepted.set(key, value.accepted);
      check(`${theme}/${name}/${mode}: geometry`, () => {
        assert.deepEqual(rendered[mode].size, rendered.authored.size);
        for (const part of ['surface', 'heading', 'description', 'icon', 'close']) {
          assert.deepEqual(
            rendered[mode].parts[part].geometry,
            rendered.authored.parts[part].geometry,
          );
          assert.deepEqual(
            rendered[mode].parts[part].typography,
            rendered.authored.parts[part].typography,
          );
        }
      });
      if (!value.accepted) continue;
      check(`${theme}/${name}/${mode}: accepted surface and raw paint`, () => {
        assert.equal(rendered[mode].background, `rgb(${value.accepted.background.join(' ')})`);
        for (const [part, role] of [
          ['heading', 'heading'],
          ['description', 'description'],
          ['icon', 'dangerIcon'],
          ['close', 'close'],
        ])
          assert.equal(rendered[mode].parts[part].color, rendered[mode].normalized[role]);
        for (const role of roles) {
          assert.equal(value.accepted.colors[role][3], value.authored[role][3]);
          const [r, g, b, a] = value.accepted.colors[role];
          assert.equal(rendered[mode].rawPaint[role], `rgb(${r} ${g} ${b} / ${a})`);
        }
        assert.ok(rendered[mode].parts.surface.border.includes(rendered[mode].normalized.border));
      });
      const close = page.locator(`#${mode}`).locator('button');
      await close.focus();
      rendered[mode].focus = await close.evaluate((element) => {
        const style = getComputedStyle(element);
        return { color: style.outlineColor, width: style.outlineWidth };
      });
      check(`${theme}/${name}/${mode}: keyboard focus`, () => {
        assert.notEqual(rendered[mode].focus.width, '0px');
        assert.equal(rendered[mode].focus.color, rendered[mode].normalized.focus);
      });
      await close.evaluate((element) => element.blur());
    }
    const reference = result.reference;
    if (reference.state === 'ready')
      check(`${theme}/${name}: reference evidence`, () => {
        assert.equal(reference.reportSelectionsMatch, true);
        assert.equal(reference.referenceSelections.length, roles.length);
        assert.equal(reference.tonalHierarchy.length, 1);
        assert.equal(reference.tonalHierarchy[0].satisfied, true);
        for (const selection of reference.referenceSelections) {
          assert.equal(selection.preference, 'reference-strength');
          assert.deepEqual(selection.cases[0].referenceBackdrop, reference.referenceBackground);
          assert.deepEqual(selection.cases[0].actualBackdrop, background);
        }
      });
    reports.push({ theme, name, result, rendered });
    await page.screenshot({ path: resolve(output, `${theme}-${name}.png`) });
  }
  const sourceIdentity = await page.evaluate(() => window.alertColorsProbe.sourceIdentityControl());
  check('orange raw+alpha source identity and drift-free recovery', () => {
    for (const state of sourceIdentity) {
      assert.equal(state.state, 'ready');
      assert.equal(state.values.orange.opacity, 0.5);
      const [r, g, b] = state.values.orange.rgb;
      assert.ok(r > g && g > b);
    }
    assert.deepEqual(sourceIdentity[0].values.orange.rgb, [255, 128, 0]);
    assert.deepEqual(sourceIdentity[0].reference[0].cases[0].referenceVisible, [128, 128, 128]);
    assert.deepEqual(sourceIdentity[2].values, sourceIdentity[0].values);
  });
  for (const theme of ['light', 'dark']) {
    const nominal = reports.find((report) => report.theme === theme && report.name === 'nominal');
    const recovered = reports.find(
      (report) => report.theme === theme && report.name === 'recovered',
    );
    for (const mode of modes)
      check(`${theme}/${mode}: nominal and recovery usable`, () => {
        for (const report of [nominal, recovered]) {
          const value = report.result[mode];
          assert.equal(value.state, 'ready');
          assert.ok(value.accepted);
          for (const role of roles) {
            assert.equal(value.colors[role]?.length, 4);
            assert.ok(value.colors[role].every((channel) => Number.isFinite(channel)));
          }
        }
        assert.deepEqual(recovered.result[mode].colors, nominal.result[mode].colors);
        if (mode !== 'visible')
          assert.deepEqual(nominal.result[mode].colors, nominal.result[mode].authored);
      });
  }
  check('theme switch returns the entire original composition', () => {
    for (const mode of modes)
      assert.deepEqual(reports.at(-1).result[mode].colors, reports[0].result[mode].colors);
  });
  check('no browser errors', () => assert.deepEqual(errors, []));
  assert.deepEqual(await inputHashes(), beforeHashes);
  await page.evaluate(() => window.alertColorsProbe.dispose());
  await writeFile(
    resolve(output, 'report.json'),
    `${JSON.stringify(
      {
        purpose:
          'Local reference-appearance qualification on real Alert; no production migration or spatial-material acceptance.',
        colorsArtifact: process.env.COLORS_PROBE_PROVENANCE ?? 'unqualified-local-artifact',
        labuiSourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], {
          cwd: root,
          encoding: 'utf8',
        }).trim(),
        bundleHashes: Object.fromEntries([...assets].map(([path, bytes]) => [path, hash(bytes)])),
        inputHashes: beforeHashes,
        wasmSha256: hash(wasm[1]),
        browser: browser.version(),
        reports,
        sourceIdentity,
        failures,
      },
      null,
      2,
    )}\n`,
  );
  assert.deepEqual(failures, []);
  console.info(
    `Alert reference appearance: ${reports.length} actual renders, raw+alpha and theme recovery; ${output}`,
  );
} finally {
  await browser.close();
  await new Promise((done) => server.close(done));
}
