import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { build } from 'vite';

// Одноразовый consumer намеренно находится вне workspace: bare import LabColors
// разрешается только к реально установленному архиву, без alias на producer.
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../..');
const FIXTURE = resolve(HERE, '../src/_fixtures');
const SUBJECT = JSON.parse(await readFile(join(HERE, 'colors-assignment-subject.json'), 'utf8'));
const args = process.argv.slice(2);
const options = new Map();
for (let index = 0; index < args.length; index += 2) {
  assert.ok(
    [
      '--tarball',
      '--ui-core-tarball',
      '--ui-shadow-tarball',
      '--out',
      '--browser-channel',
    ].includes(args[index]),
    args[index],
  );
  assert.ok(args[index + 1] && !options.has(args[index]), `missing or duplicate ${args[index]}`);
  options.set(args[index], args[index + 1]);
}
assert.ok(
  ['--tarball', '--ui-core-tarball', '--ui-shadow-tarball', '--out'].every((name) =>
    options.has(name),
  ),
  'Usage: node apps/docs/tests/colors-assignment-packed.mjs --tarball <archive> --ui-core-tarball <archive> --ui-shadow-tarball <archive> --out <evidence-directory>',
);
const TARBALL = resolve(options.get('--tarball'));
const OUT = resolve(options.get('--out'));
const outside = (path) => path === '..' || path.startsWith(`..${sep}`) || isAbsolute(path);
assert.ok(outside(relative(ROOT, OUT)), 'Evidence directory must be outside the checkout');
await mkdir(OUT, { recursive: true });
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const source = (args) =>
  execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', timeout: 20_000 }).trim();
const sourceHead = source(['rev-parse', 'HEAD']);
const sourceDiff = execFileSync('git', ['diff', 'HEAD', '--binary'], {
  cwd: ROOT,
  timeout: 20_000,
});
const archiveBytes = await readFile(TARBALL);
assert.equal(hash(archiveBytes), SUBJECT.archiveSha256, 'unexpected LabColors tarball');
assert.equal(archiveBytes.length, SUBJECT.archiveBytes);
const uiArchives = [];
for (const [name, option] of [
  ['@labpics/ui-core', '--ui-core-tarball'],
  ['@labpics/ui-shadow', '--ui-shadow-tarball'],
]) {
  const path = resolve(options.get(option));
  const bytes = await readFile(path);
  uiArchives.push({
    name,
    path,
    archive: basename(path),
    archiveSha256: hash(bytes),
    archiveBytes: bytes.length,
  });
}
const consumer = await mkdtemp(join(tmpdir(), 'labui-colors-consumer-'));
const records = [];
let browser;
let server;
let baseURL;
let proofTimer;
let phase = 'install';
const errors = [];
const started = new Date().toISOString();
const checked = (name, evidence) => {
  records.push({ name, evidence });
  process.stdout.write(`${name}\n`);
};

function npm(args) {
  const inherited = process.env.npm_execpath;
  const sibling = join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
  const cli = inherited?.endsWith('npm-cli.js') ? inherited : existsSync(sibling) ? sibling : null;
  const command = cli ? process.execPath : 'npm';
  const parameters = cli ? [cli, ...args] : args;
  return execFileSync(command, parameters, {
    cwd: consumer,
    encoding: 'utf8',
    timeout: 120_000,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

async function serve(root) {
  const mime = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.mjs': 'text/javascript',
    '.css': 'text/css',
    '.wasm': 'application/wasm',
    '.woff2': 'font/woff2',
  };
  const instance = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const path = resolve(root, `.${pathname === '/' ? '/colors-assignment.html' : pathname}`);
      const local = relative(root, path);
      if (outside(local)) throw new Error('outside static root');
      const bytes = await readFile(path);
      response.writeHead(200, {
        'content-type': mime[extname(path)] ?? 'application/octet-stream',
      });
      response.end(bytes);
    } catch {
      response.writeHead(404);
      response.end('Not found');
    }
  });
  await new Promise((resolve, reject) => {
    instance.once('error', reject);
    instance.listen(0, '127.0.0.1', resolve);
  });
  return instance;
}

async function readScope(page, id) {
  return page.evaluate((scope) => {
    const root = document.querySelector(`[data-witness-scope="${scope}"]`);
    const tuple = root?.querySelector('[data-current-tuple]');
    const button = tuple?.querySelector('lab-button')?.shadowRoot?.querySelector('button');
    const primary = tuple?.querySelector('[data-primary]');
    const visible =
      tuple !== null &&
      tuple !== undefined &&
      getComputedStyle(tuple).display !== 'none' &&
      getComputedStyle(tuple).visibility !== 'hidden';
    return {
      model: window.__labColorsWitness.read(scope),
      present: root !== null,
      visible,
      cssText: tuple?.style.cssText ?? null,
      buttonBackground: button ? getComputedStyle(button).backgroundColor : null,
      buttonLabel: button ? getComputedStyle(button).color : null,
      primary: primary ? getComputedStyle(primary).color : null,
      external: root?.style.getPropertyValue('--lab-fill-danger') ?? null,
    };
  }, id);
}

async function runScope(page, id, action) {
  const mutation = await page.evaluate(
    async ({ scope, operation }) => {
      const tuple = document.querySelector(`[data-witness-scope="${scope}"] [data-current-tuple]`);
      const changes = [];
      const observer = new MutationObserver((entries) =>
        changes.push(...entries.map((entry) => entry.oldValue)),
      );
      if (tuple)
        observer.observe(tuple, {
          attributes: true,
          attributeFilter: ['style'],
          attributeOldValue: true,
        });
      try {
        await window.__labColorsWitness.run(scope, operation);
        await Promise.resolve();
      } finally {
        observer.disconnect();
      }
      return changes;
    },
    { scope: id, operation: action },
  );
  return { ...(await readScope(page, id)), styleMutations: mutation };
}

function noncurrent(value, state) {
  assert.equal(value.model.state, state);
  assert.equal(value.model.outputCount, 0);
  assert.equal(value.visible, false, `${state} exposed inherited or historical colors`);
  assert.equal(value.model.invalidOutputReadsRejected, true);
  assert.equal(value.model.resources.live, 1);
  assert.equal(value.model.resources.snapshotsCreated, value.model.resources.snapshotsFreed);
}

function color(value) {
  const match = /^rgb\((\d+), (\d+), (\d+)\)$/.exec(value ?? '');
  assert.ok(match, `expected actual opaque RGB computed style, got ${value}`);
  return match.slice(1).map(Number);
}

function contrast(foreground, background) {
  const luminance = (rgb) => {
    const linear = rgb.map((value) => {
      const channel = value / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  };
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

function current(value, primary) {
  assert.equal(value.model.state, 'ready');
  assert.equal(value.model.outputCount, 3);
  assert.equal(value.visible, true);
  assert.deepEqual(color(value.buttonLabel), [255, 255, 255]);
  assert.deepEqual(color(value.primary), primary);
  assert.equal(value.model.resources.live, 1);
  assert.equal(value.model.resources.snapshotsCreated, value.model.resources.snapshotsFreed);
  const outputs = new Map(value.model.outputs.map((output) => [output.slot, output]));
  for (const [slot, actual] of [
    [91, value.buttonBackground],
    [92, value.buttonLabel],
    [93, value.primary],
  ]) {
    assert.deepEqual(
      outputs.get(slot)?.rgb,
      color(actual),
      `slot ${slot} was not applied to the consumer`,
    );
    assert.equal(outputs.get(slot)?.opacity, 1);
  }
}

async function proof(page) {
  phase = 'browser navigation';
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  phase = 'fixture ready';
  await page.waitForFunction(() => window.__labColorsWitness !== undefined);
  const initialization = await page.evaluate(async () => {
    try {
      await window.__labColorsWitness.ready;
      await document.fonts.ready;
      return { ready: true };
    } catch (error) {
      return { ready: false, error: { message: error.message, ...error } };
    }
  });
  assert.equal(initialization.ready, true, JSON.stringify(initialization.error));
  phase = 'browser scenarios';
  const outside = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--lab-fill-accent'),
  );
  const expected = {
    light: { accent: [0, 122, 255], primary: [16, 16, 18] },
    dark: { accent: [74, 143, 255], primary: [246, 248, 250] },
  };
  for (const id of ['light', 'dark']) {
    const waiting = await readScope(page, id);
    noncurrent(waiting, 'waiting');
    checked(`${id}:waiting`, waiting);
    await page.evaluate((scope) => {
      document
        .querySelector(`[data-witness-scope="${scope}"]`)
        .style.setProperty('--lab-fill-danger', 'rgb(7 8 9)');
    }, id);
    const accepted = await runScope(page, id, 'baseline');
    current(accepted, expected[id].primary);
    assert.deepEqual(color(accepted.buttonBackground), expected[id].accent);
    assert.deepEqual(color(accepted.buttonLabel), [255, 255, 255]);
    assert.deepEqual(color(accepted.primary), expected[id].primary);
    assert.equal(
      accepted.styleMutations.length,
      1,
      'the tuple must publish in one owned style mutation',
    );
    assert.equal(accepted.external, 'rgb(7 8 9)');
    checked(`${id}:authored`, accepted);
  }
  await page.screenshot({ path: join(OUT, 'authored.png'), fullPage: true });
  for (const id of ['light', 'dark']) {
    const other = id === 'light' ? 'dark' : 'light';
    const untouched = await readScope(page, other);
    for (const [action, state] of [
      ['unknown', 'stale'],
      ['strict', 'unsatisfied'],
      ['incomplete', 'incomplete'],
    ]) {
      const outcome = await runScope(page, id, action);
      noncurrent(outcome, state);
      assert.equal(outcome.styleMutations.length, 1, `${state} must hide the tuple atomically`);
      assert.equal(outcome.external, 'rgb(7 8 9)');
      checked(`${id}:${state}`, outcome);
      const restored = await runScope(page, id, 'recover');
      current(restored, expected[id].primary);
      assert.deepEqual(color(restored.buttonBackground), expected[id].accent);
      assert.deepEqual(await readScope(page, other), untouched, 'one scope changed another scope');
    }
    const assigned = await runScope(page, id, 'diagnostic');
    current(assigned, expected[id].primary);
    assert.notDeepEqual(color(assigned.buttonBackground), expected[id].accent);
    assert.deepEqual(color(assigned.buttonLabel), [255, 255, 255]);
    assert.deepEqual(color(assigned.primary), expected[id].primary);
    const actualContrast = contrast(color(assigned.buttonLabel), color(assigned.buttonBackground));
    assert.ok(actualContrast >= 4.5, `actual button contrast ${actualContrast} is below 4.5`);
    assert.equal(assigned.styleMutations.length, 1);
    assert.deepEqual(await readScope(page, other), untouched);
    checked(`${id}:experimental-assignment`, { ...assigned, actualContrast });
    await runScope(page, id, 'recover');
  }
  await runScope(page, 'light', 'diagnostic');
  await runScope(page, 'dark', 'diagnostic');
  await page.screenshot({ path: join(OUT, 'assigned-diagnostic.png'), fullPage: true });
  for (const id of ['light', 'dark']) {
    await runScope(page, id, 'recover');
    const button = page
      .locator(`[data-witness-scope="${id}"] [data-current-tuple] lab-button`)
      .getByRole('button');
    await page.evaluate((scope) => {
      const element = document.querySelector(`[data-witness-scope="${scope}"] lab-button`);
      window.__witnessEvents ??= {};
      window.__witnessEvents[scope] = [];
      element.addEventListener('click', (event) =>
        window.__witnessEvents[scope].push({ trusted: event.isTrusted, composed: event.composed }),
      );
    }, id);
    await button.click();
    await button.focus();
    await button.press('Enter');
    await button.press('Space');
    const events = await page.evaluate((scope) => window.__witnessEvents[scope], id);
    assert.equal(events.length, 3);
    assert.ok(events.every((event) => event.trusted && event.composed));
    checked(`${id}:real-button-pointer-keyboard`, events);
    await runScope(page, id, 'disconnect');
    const disconnected = await readScope(page, id);
    assert.equal(disconnected.present, false);
    assert.equal(disconnected.model.resources.live, 0);
    checked(`${id}:disconnect`, disconnected);
    await runScope(page, id, 'reconnect');
    noncurrent(await readScope(page, id), 'waiting');
    const recovered = await runScope(page, id, 'baseline');
    assert.equal(recovered.model.state, 'ready');
    await runScope(page, id, 'disconnect');
    assert.equal((await readScope(page, id)).model.resources.live, 0);
  }
  assert.equal(
    await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--lab-fill-accent'),
    ),
    outside,
  );
}

try {
  await writeFile(
    join(consumer, 'package.json'),
    `${JSON.stringify({ private: true, type: 'module' })}\n`,
  );
  await writeFile(
    join(OUT, 'npm-install.log'),
    npm([
      'install',
      '--ignore-scripts',
      '--no-package-lock',
      '--no-audit',
      '--no-fund',
      TARBALL,
      ...uiArchives.map((archive) => archive.path),
    ]),
  );
  await writeFile(join(OUT, 'dependency-tree.json'), npm(['ls', '--all', '--json']));
  for (const archive of uiArchives) {
    const installedManifest = JSON.parse(
      await readFile(join(consumer, 'node_modules', archive.name, 'package.json'), 'utf8'),
    );
    assert.equal(installedManifest.name, archive.name);
    assert.equal(installedManifest.version, '0.0.0');
    assert.ok(
      Object.values(installedManifest.dependencies ?? {}).every(
        (version) => !version.startsWith('workspace:'),
      ),
    );
  }
  process.stdout.write('Three package archives installed\n');
  const installed = join(consumer, 'node_modules/@labpics/colors');
  const metadata = JSON.parse(await readFile(join(installed, 'build-metadata.json'), 'utf8'));
  const manifest = JSON.parse(await readFile(join(installed, 'package.json'), 'utf8'));
  assert.equal(manifest.name, SUBJECT.packageName);
  assert.equal(manifest.version, SUBJECT.packageVersion);
  assert.equal(metadata.sourceSha, SUBJECT.sourceCommit);
  const wasm = await readFile(join(installed, 'pkg/labcolors_bg.wasm'));
  assert.equal(hash(wasm), SUBJECT.wasmSha256);
  assert.equal(wasm.length, SUBJECT.wasmBytes);
  const assembly = {};
  const verifierFiles = ['colors-assignment-packed.mjs', 'colors-assignment-subject.json'];
  for (const name of verifierFiles) {
    const path = join(HERE, name);
    assembly[relative(ROOT, path).replaceAll('\\', '/')] = hash(await readFile(path));
  }
  const files = [
    ['colors-assignment.html', join(FIXTURE, 'colors-assignment.html')],
    ['colors-assignment.mjs', join(FIXTURE, 'colors-assignment.mjs')],
    ['colors-assignment.css', join(FIXTURE, 'colors-assignment.css')],
    ['contract.css', join(ROOT, 'packages/colors/contract.css')],
    ['tokens.css', join(ROOT, 'packages/tokens/src/generated/tokens.css')],
    ['theme.css', join(ROOT, 'packages/core/src/theme.css')],
    ['Geist-Variable.woff2', join(ROOT, 'packages/fonts/fonts/Geist-Variable.woff2')],
  ];
  for (const [name, path] of files) {
    const bytes = await readFile(path);
    assembly[relative(ROOT, path).replaceAll('\\', '/')] = hash(bytes);
    await copyFile(path, join(consumer, name));
  }
  phase = 'consumer build';
  const bundledPackages = new Set();
  await build({
    configFile: false,
    root: consumer,
    logLevel: 'warn',
    plugins: [
      {
        name: 'record-consumer-packages',
        generateBundle(_options, bundle) {
          for (const item of Object.values(bundle)) {
            if (item.type !== 'chunk') continue;
            for (const id of Object.keys(item.modules)) {
              if (id.includes('/node_modules/@labpics/'))
                bundledPackages.add(id.replaceAll('\\', '/'));
            }
          }
        },
      },
    ],
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      rollupOptions: { input: join(consumer, 'colors-assignment.html') },
    },
  });
  assert.ok(
    [...bundledPackages].some((id) =>
      id.endsWith('/node_modules/@labpics/ui-core/dist/components/button/index.js'),
    ),
  );
  assert.ok(
    [...bundledPackages].some((id) => id.endsWith('/node_modules/@labpics/colors/index.js')),
  );
  for (const id of bundledPackages)
    assert.equal(outside(relative(consumer, id.split('?')[0])), false);
  process.stdout.write('Consumer built from installed package entrypoints\n');
  assert.equal(source(['rev-parse', 'HEAD']), sourceHead, 'LabUI source changed during proof');
  assert.equal(
    hash(execFileSync('git', ['diff', 'HEAD', '--binary'], { cwd: ROOT, timeout: 20_000 })),
    hash(sourceDiff),
    'LabUI patch changed during proof',
  );
  server = await serve(join(consumer, 'dist'));
  baseURL = `http://127.0.0.1:${server.address().port}/colors-assignment.html`;
  browser = await chromium.launch({
    channel: options.get('--browser-channel') ?? 'chrome',
    headless: true,
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  page.on('pageerror', (error) => errors.push(error.message));
  await Promise.race([
    proof(page),
    new Promise((_, reject) => {
      proofTimer = setTimeout(
        () => reject(new Error(`Browser proof timed out during ${phase}`)),
        120_000,
      );
    }),
  ]);
  clearTimeout(proofTimer);
  assert.deepEqual(errors, [], 'browser threw an unhandled error');
  for (const [path, digest] of Object.entries(assembly)) {
    assert.equal(hash(await readFile(join(ROOT, path))), digest, `LabUI source changed: ${path}`);
  }
  await writeFile(
    join(OUT, 'receipt.json'),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        outcome: 'passed',
        started,
        completed: new Date().toISOString(),
        subject: SUBJECT,
        labui: {
          commit: sourceHead,
          dirty: source(['status', '--porcelain']) !== '',
          diffSha256: hash(sourceDiff),
          assembly,
          packages: uiArchives.map(({ path, ...archive }) => archive),
          bundledModules: [...bundledPackages]
            .map((path) => relative(consumer, path).replaceAll('\\', '/'))
            .sort(),
        },
        runtime: { node: process.version, browser: browser.version() },
        records,
        qualification:
          'Locally packed LabUI and exact LabColors tarball installed in a clean consumer; no publication or visual-policy admission',
      },
      null,
      2,
    )}\n`,
  );
  process.stdout.write(
    `LabUI installed Colors browser proof passed: ${records.length} observations\n`,
  );
} catch (error) {
  await writeFile(
    join(OUT, 'failure.json'),
    `${JSON.stringify(
      {
        outcome: 'failed',
        started,
        completed: new Date().toISOString(),
        labuiCommit: sourceHead,
        phase,
        browserErrors: errors,
        error: String(error?.stack ?? error),
        records,
      },
      null,
      2,
    )}\n`,
  );
  throw error;
} finally {
  clearTimeout(proofTimer);
  await browser?.close();
  if (server) await new Promise((resolve) => server.close(resolve));
  assert.equal(dirname(resolve(consumer)), resolve(tmpdir()));
  assert.ok(basename(consumer).startsWith('labui-colors-consumer-'));
  await rm(consumer, { recursive: true, force: true });
}
