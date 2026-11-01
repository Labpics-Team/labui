import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync, gzipSync } from 'node:zlib';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../..');
const HASH = /^[a-f0-9]{64}$/;
const outside = (path) => path === '..' || path.startsWith(`..${sep}`) || isAbsolute(path);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const stableJSON = (value) =>
  JSON.stringify(value, (_, item) =>
    item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(
          Object.keys(item)
            .sort()
            .map((key) => [key, item[key]]),
        )
      : item,
  );

// Импорт harness не устанавливает пакеты и не запускает browser/build.
export function assertSelfHostedRunner(env = process.env) {
  assert.ok(
    env.GITHUB_ACTIONS === 'true' &&
      env.CI === 'true' &&
      /^\d+$/.test(env.GITHUB_RUN_ID ?? '') &&
      env.RUNNER_ENVIRONMENT === 'self-hosted',
    'icons-packed: install/build/browser разрешены только self-hosted GitHub Actions runner',
  );
}

export function validateSubject(subject) {
  assert.equal(subject?.schemaVersion, 1);
  assert.deepEqual(Object.keys(subject.packages ?? {}).sort(), ['icons', 'uiCore', 'uiShadow']);
  for (const [key, name] of [
    ['icons', '@labpics/icons'],
    ['uiCore', '@labpics/ui-core'],
    ['uiShadow', '@labpics/ui-shadow'],
  ]) {
    const item = subject.packages?.[key];
    assert.equal(item?.name, name);
    assert.ok(typeof item.version === 'string' && item.version.length > 0);
    assert.match(item.archiveSha256, HASH);
    assert.ok(Number.isSafeInteger(item.archiveBytes) && item.archiveBytes > 0);
    assert.match(item.sourceCommit, /^[a-f0-9]{40}$/);
  }
  const reference = subject.authorReference;
  assert.ok(typeof reference?.fileName === 'string' && /Lab UI.*v2\.1/.test(reference.fileName));
  assert.match(reference.fileKey, /^[A-Za-z0-9]+$/);
  assert.match(reference.version, /^\d+$/);
  assert.deepEqual(Object.keys(reference.icons ?? {}), ['reload']);
  assert.deepEqual(Object.keys(reference.icons.reload).sort(), ['filled', 'outline']);
  for (const variant of ['outline', 'filled']) {
    const item = reference.icons.reload[variant];
    assert.equal(
      item.sourceFile,
      `masters/figma/${reference.version}/${variant === 'outline' ? 'Outline' : 'Filled'}/reload.svg`,
    );
    assert.equal(item.author?.kind, 'figma');
    assert.equal(item.author.fileKey, reference.fileKey);
    assert.equal(item.author.version, reference.version);
    assert.match(item.author.nodeId, /^\d+:\d+$/);
    for (const key of ['nodeSha256', 'masterSha256', 'normalizedSha256', 'pathFingerprintSha256'])
      assert.match(item.author[key], HASH);
    assert.equal(item.anatomy?.version, 1);
    assert.match(item.anatomy.annotationSha256, HASH);
    assert.equal(item.anatomy.masterSha256, item.author.masterSha256);
    assert.equal(item.anatomy.pathFingerprintSha256, item.author.pathFingerprintSha256);
    assert.ok(
      Array.isArray(item.viewBox) &&
        item.viewBox.length === 4 &&
        item.viewBox.every(Number.isFinite),
    );
    assert.ok(item.viewBox[2] > 0 && item.viewBox[3] > 0);
    assert.ok(Array.isArray(item.paths) && item.paths.length > 0);
    for (const path of item.paths) {
      assert.ok(typeof path.d === 'string' && path.d.length > 0);
      assert.ok(['evenodd', 'nonzero'].includes(path.fillRule));
    }
    const entries = item.paths.map((path, index) => ({
      index,
      d: path.d,
      fillRule: path.fillRule,
    }));
    assert.equal(
      hash(stableJSON(entries)),
      item.author.pathFingerprintSha256,
      'независимый reference fingerprint',
    );
    assert.ok(Array.isArray(item.parts) && item.parts.length === item.paths.length);
    assert.equal(new Set(item.parts.map((part) => part.id)).size, item.parts.length);
    for (const [index, part] of item.parts.entries()) {
      assert.match(part.id, /^[a-z][a-z0-9-]*$/);
      assert.ok(typeof part.role === 'string' && part.role.length > 0);
      assert.ok(Number.isSafeInteger(part.zIndex));
      assert.equal(part.d, item.paths[index].d);
      assert.equal(part.fillRule, item.paths[index].fillRule);
    }
    assert.equal(item.gesture?.id, 'reload.cycle');
    assert.equal(item.gesture.progress, 'normalized-0-to-1');
    assert.deepEqual(
      item.gesture.partIds,
      item.parts.map((part) => part.id),
    );
    assert.ok(
      Array.isArray(item.gesture.tracks) && item.gesture.tracks.length === item.parts.length,
    );
    for (const [index, track] of item.gesture.tracks.entries()) {
      assert.equal(track.partId, item.parts[index].id);
      assert.equal(track.kind, 'rotate');
      assert.equal(track.unit, 'degrees');
      assert.equal(track.interpolation, 'linear');
      assert.ok(
        Number.isFinite(track.from) && Number.isFinite(track.to) && track.from !== track.to,
      );
      assert.ok(
        Array.isArray(track.anchor) &&
          track.anchor.length === 2 &&
          track.anchor.every((value) => Number.isFinite(value) && value >= 0 && value <= 1),
      );
    }
  }
  return subject;
}

const HTML = `<!doctype html><html lang="ru" data-theme="light"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Lab Icons в Lab UI</title>
<style>
:root { --lab-label-primary:#16181c; --lab-fill-neutral:#eef0f3; --lab-label-on-neutral:#16181c;
  --lab-border-focus:#007aff; --lab-focus-ring-width:2px; --lab-focus-ring-offset:3px; }
body { margin:0; padding:48px; background:#fff; color:var(--lab-label-primary); }
h1 { margin:0 0 32px; font-size:24px; font-weight:600; }
form { display:flex; gap:48px; } figure { margin:0; display:grid; gap:16px; justify-items:center; }
figcaption { font-size:14px; } svg[slot=icon] { width:24px; height:24px; display:block; }
</style><body><h1>Обновить</h1><form id="actions"></form>
<script type="module" src="/consumer.mjs"></script></body></html>`;

const FIXTURE = `import '@labpics/ui-core/button';
import '@labpics/ui-core/theme.css';
import { glyph, glyphCapabilities } from '@labpics/icons/symbols/reload';
import { renderGlyphSvg } from '@labpics/icons/ir/render';
import { compileSymbolEffect } from '@labpics/icons/motion';
import { animate } from '@labpics/motion';

const instances = new Map();
let submissions = 0;
document.querySelector('form').addEventListener('submit', event => { event.preventDefault(); submissions++; });
for (const variant of ['outline', 'filled']) {
  const model = glyph({ variant });
  const capabilities = glyphCapabilities(variant);
  const figure = document.createElement('figure');
  const button = document.createElement('lab-button');
  button.setAttribute('size', 'l');
  button.setAttribute('icon', '');
  button.setAttribute('type', 'neutral');
  button.setAttribute('aria-label', 'Обновить');
  button.dataset.variant = variant;
  button.innerHTML = renderGlyphSvg(model, { instanceId: 'labui-' + variant });
  const svg = button.querySelector('svg');
  svg.setAttribute('slot', 'icon');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const caption = document.createElement('figcaption');
  caption.textContent = variant === 'outline' ? 'Outline' : 'Filled';
  figure.append(button, caption);
  document.querySelector('form').append(figure);
  instances.set(variant, { model, capabilities, button, svg, controls: [], events: [], generation: 0, settled: true });
  button.addEventListener('click', event => {
    const initialize = instances.get(variant).settled;
    const transition = start(variant, { from: 0, to: 1, initialize });
    instances.get(variant).events.push({ trusted: event.isTrusted, composed: event.composed,
      initialize, before: transition.before, after: transition.after, effect: transition.effect });
  });
}

function compile(item, request) {
  const result = compileSymbolEffect(item.model, item.capabilities, 'reload.cycle', request);
  if (!result.ok) throw new Error(result.reason.code);
  if (result.effect.version !== 1) throw new Error('reload требует rotation effect v1');
  return result.effect;
}
function matrices(item) {
  return [...item.svg.querySelectorAll('[data-part]')].map(element => {
    const value = new DOMMatrix(getComputedStyle(element).transform);
    return ['a', 'b', 'c', 'd', 'e', 'f'].map(key => value[key]);
  });
}
function start(variant, { from = 0, to = 1, duration = 600, initialize = false } = {}) {
  const item = instances.get(variant);
  const effect = compile(item, { from, to, duration,
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches });
  const before = matrices(item);
  const previous = item.controls;
  const controls = [];
  const generation = ++item.generation;
  try {
    Object.assign(item.svg.style, effect.viewport);
    for (const target of effect.targets) {
      const element = [...item.svg.querySelectorAll('[data-part]')].find(node => node.dataset.part === target.partId);
      if (!element) throw new Error('Потеряна часть ' + target.partId);
      Object.assign(element.style, target.style);
      controls.push(animate(element, { rotate: initialize ? [target.rotation.from, target.rotation.to] : target.rotation.to },
        { duration: effect.options.duration, ease: effect.options.easing,
          reducedMotion: effect.options.duration === 0 ? 'always' : 'user' }));
    }
  } catch (error) { controls.forEach(control => control.stop()); throw error; }
  item.controls = controls;
  previous.forEach(control => control.stop());
  item.settled = false;
  item.completion = Promise.all(controls.map(control => control.finished));
  item.completion.then(results => {
    if (generation === item.generation && results.every(result => result.status === 'finished')) item.settled = true;
  });
  return { before, after: matrices(item), effect, generation };
}
function read(variant) {
  const item = instances.get(variant);
  const native = item.button.shadowRoot?.querySelector('button');
  const rectangle = native?.getBoundingClientRect();
  return { icon: item.model.icon, variant: item.model.variant, provenance: item.model.provenance,
    composition: item.model.composition.kind,
    parts: item.model.parts.map(({ id, role, zIndex, fillRule, d }) => ({ id, role, zIndex, fillRule, d })),
    viewBox: item.svg.getAttribute('viewBox').trim().split(/\\s+/).map(Number),
    paths: [...item.svg.querySelectorAll('path')].map(element => ({ d: element.getAttribute('d'),
      fillRule: element.getAttribute('fill-rule') ?? 'nonzero', id: element.dataset.part, role: element.dataset.role })),
    matrices: matrices(item), svg: item.svg.outerHTML, events: item.events, submissions,
    target: { width: rectangle?.width, height: rectangle?.height, name: native?.getAttribute('aria-label'),
      type: native?.type, iconHidden: item.svg.getAttribute('aria-hidden'), slotHidden: native?.querySelector('slot[name=icon]')?.getAttribute('aria-hidden') },
    capabilities: item.capabilities, connected: item.button.isConnected };
}
async function settle(variant) {
  const item = instances.get(variant);
  let timer;
  let results;
  try {
    results = await Promise.race([item.completion,
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Motion completion timeout')), 20000); })]);
    if (!results || !results.every(result => result.status === 'finished')) throw new Error('Motion не завершил текущий жест');
  } finally { clearTimeout(timer); }
  await new Promise(requestAnimationFrame);
  await new Promise(requestAnimationFrame);
  return { ...read(variant), completionStatuses: results.map(result => result.status) };
}
function cleanup() {
  for (const item of instances.values()) { item.controls.forEach(control => control.stop()); item.controls = []; }
  document.querySelector('form').replaceChildren();
  return { connected: [...instances.values()].filter(item => item.button.isConnected).length,
    runningNativeAnimations: document.getAnimations().filter(animation => animation.playState === 'running').length };
}
window.__iconsPacked = { ready: Promise.all([...instances.values()].map(item => item.button.updateComplete)),
  read, start, settle, cleanup,
  refuse: variant => {
    const item = instances.get(variant);
    let axis;
    try { glyph({ variant, axes: { weight: 1.1 } }); axis = 'accepted'; } catch (error) { axis = error.code; }
    return { axis, motion: compileSymbolEffect(item.model, item.capabilities, 'reload.morph', { duration: 600 }) };
  } };
`;

function npm(consumer, args) {
  const inherited = process.env.npm_execpath;
  const sibling = join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
  const cli = inherited?.endsWith('npm-cli.js') ? inherited : existsSync(sibling) ? sibling : null;
  return execFileSync(cli ? process.execPath : 'npm', cli ? [cli, ...args] : args, {
    cwd: consumer,
    encoding: 'utf8',
    timeout: 120_000,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

async function serve(root) {
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const path = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
      assert.equal(outside(relative(root, path)), false);
      const bytes = await readFile(path);
      response.writeHead(200, {
        'content-type':
          { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[extname(path)] ??
          'application/octet-stream',
      });
      response.end(bytes);
    } catch {
      response.writeHead(404);
      response.end('Not found');
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return server;
}

function samePose(left, right, tolerance = 0.002) {
  assert.equal(left.length, right.length);
  for (const [index, matrix] of left.entries())
    assert.ok(
      matrix.every((value, channel) => Math.abs(value - right[index][channel]) <= tolerance),
      `видимый transform скачет: ${JSON.stringify({ left, right })}`,
    );
}

function sameMotion(effect, gesture, from, to, duration, reduced, variant) {
  assert.equal(effect.version, 1);
  assert.equal(effect.icon, 'reload');
  assert.equal(effect.variant, variant);
  assert.equal(effect.gesture, gesture.id);
  assert.equal(effect.from, from);
  assert.equal(effect.to, to);
  assert.deepEqual(effect.options, {
    duration: reduced ? 0 : duration,
    easing: 'linear',
    fill: 'both',
  });
  assert.deepEqual(effect.viewport, { overflow: 'visible' });
  assert.deepEqual(effect.unchangedPartIds, []);
  assert.deepEqual(
    effect.targets,
    gesture.tracks.map((track) => {
      const start = track.from + (track.to - track.from) * from;
      const end = track.from + (track.to - track.from) * to;
      return {
        partId: track.partId,
        rotation: { from: start, to: end, unit: 'degrees' },
        style: {
          transformBox: 'view-box',
          transformOrigin: `${track.anchor[0] * 100}% ${track.anchor[1] * 100}%`,
        },
        keyframes: [
          { offset: 0, transform: `rotate(${start}deg)` },
          { offset: 1, transform: `rotate(${end}deg)` },
        ],
      };
    }),
  );
}

async function browserProof(browser, url, reference, out, records, browserErrors) {
  for (const reducedMotion of ['no-preference', 'reduce']) {
    const context = await browser.newContext({
      viewport: { width: 640, height: 360 },
      reducedMotion,
    });
    const page = await context.newPage();
    page.setDefaultTimeout(20_000);
    page.on('pageerror', (error) => browserErrors.push(error.message));
    try {
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => window.__iconsPacked !== undefined);
      await page.evaluate(() => window.__iconsPacked.ready);
      for (const variant of ['outline', 'filled']) {
        const expected = reference.icons.reload[variant];
        const read = () => page.evaluate((id) => window.__iconsPacked.read(id), variant);
        const initial = await read();
        assert.equal(initial.provenance.kind, 'source');
        assert.equal(initial.provenance.file, expected.sourceFile);
        assert.equal(initial.composition, 'layers');
        assert.deepEqual(initial.provenance.author, expected.author);
        assert.deepEqual(initial.provenance.anatomy, expected.anatomy);
        assert.deepEqual(initial.parts, expected.parts);
        assert.deepEqual(initial.viewBox, expected.viewBox);
        assert.deepEqual(
          initial.paths.map(({ d, fillRule }) => ({ d, fillRule })),
          expected.paths,
        );
        assert.deepEqual(
          initial.paths.map(({ id, role }) => ({ id, role })),
          expected.parts.map(({ id, role }) => ({ id, role })),
        );
        assert.deepEqual(initial.capabilities.author, expected.author);
        assert.deepEqual(initial.capabilities.anatomy, expected.anatomy);
        assert.deepEqual(initial.capabilities.motion.gestures, [expected.gesture]);
        assert.deepEqual(initial.capabilities.supportedAxes, []);
        assert.deepEqual(initial.target, {
          width: 48,
          height: 48,
          name: 'Обновить',
          type: 'button',
          iconHidden: 'true',
          slotHidden: 'true',
        });
        const button = page
          .locator(`lab-button[data-variant="${variant}"]`)
          .getByRole('button', { name: 'Обновить', exact: true });
        assert.equal(await button.count(), 1, 'native accessible button не найден');
        const other = variant === 'outline' ? 'filled' : 'outline';
        const untouched = await page.evaluate((id) => window.__iconsPacked.read(id), other);
        await button.click();
        await button.focus();
        await button.press('Enter');
        await button.press('Space');
        const activated = await read();
        assert.equal(activated.events.length, 3);
        assert.ok(activated.events.every((event) => event.trusted && event.composed));
        for (const event of activated.events)
          sameMotion(
            event.effect,
            expected.gesture,
            0,
            1,
            600,
            reducedMotion === 'reduce',
            variant,
          );
        if (reducedMotion === 'no-preference')
          for (const event of activated.events)
            if (!event.initialize) samePose(event.before, event.after);
        assert.equal(activated.submissions, 0);
        if (reducedMotion === 'no-preference') {
          // Прерывание проводится только после наблюдаемого движения, до половины оборота.
          await page.evaluate((id) => window.__iconsPacked.settle(id), variant);
          await page.evaluate(
            (id) => window.__iconsPacked.start(id, { initialize: true }),
            variant,
          );
          await page.waitForFunction((id) => {
            const pose = window.__iconsPacked.read(id).matrices[0];
            const phase = Math.atan2(pose[1], pose[0]) / (2 * Math.PI);
            return phase > 0.05 && phase < 0.35;
          }, variant);
          const interrupted = await page.evaluate((id) => {
            const pose = window.__iconsPacked.read(id).matrices[0];
            const from = Math.atan2(pose[1], pose[0]) / (2 * Math.PI);
            return window.__iconsPacked.start(id, { from, to: 0, duration: 240 });
          }, variant);
          assert.ok(interrupted.effect.from > 0.05 && interrupted.effect.from < 0.35);
          sameMotion(
            interrupted.effect,
            expected.gesture,
            interrupted.effect.from,
            0,
            240,
            false,
            variant,
          );
          samePose(interrupted.before, interrupted.after);
          const terminal = await page.evaluate((id) => window.__iconsPacked.settle(id), variant);
          samePose(terminal.matrices, initial.matrices);
          records.push({
            name: `${variant}:interrupt-reverse`,
            effect: interrupted.effect,
            before: interrupted.before,
            after: interrupted.after,
            terminal: terminal.matrices,
          });
        } else {
          const terminal = await page.evaluate((id) => window.__iconsPacked.settle(id), variant);
          samePose(terminal.matrices, initial.matrices);
          const result = await page.evaluate(
            (id) => window.__iconsPacked.start(id, { duration: 600 }),
            variant,
          );
          assert.equal(result.effect.options.duration, 0);
          sameMotion(result.effect, expected.gesture, 0, 1, 600, true, variant);
          records.push({ name: `${variant}:reduced-motion`, effect: result.effect });
        }
        const current = await read();
        assert.deepEqual(current.paths, initial.paths, 'motion изменил authored contours');
        const afterOther = await page.evaluate((id) => window.__iconsPacked.read(id), other);
        assert.equal(afterOther.svg, untouched.svg, 'экземпляр изменил соседний символ');
        assert.deepEqual(afterOther.events, untouched.events);
        const refusal = await page.evaluate((id) => window.__iconsPacked.refuse(id), variant);
        assert.equal(refusal.axis, 'AUTHOR_PARITY_REQUIRED');
        assert.deepEqual(
          { ok: refusal.motion.ok, code: refusal.motion.reason?.code },
          { ok: false, code: 'GESTURE_UNSUPPORTED' },
        );
        records.push({
          name: `${variant}:${reducedMotion}:real-button`,
          target: initial.target,
          events: activated.events,
          provenance: initial.provenance,
          refusal,
        });
      }
      await page.screenshot({ path: join(out, `${reducedMotion}.png`), fullPage: true });
      assert.deepEqual(await page.evaluate(() => window.__iconsPacked.cleanup()), {
        connected: 0,
        runningNativeAnimations: 0,
      });
    } catch (error) {
      await page
        .screenshot({ path: join(out, `${reducedMotion}-failure.png`), fullPage: true })
        .catch(() => {});
      throw error;
    } finally {
      await context.close();
    }
  }
}

export async function main(args = process.argv.slice(2)) {
  assertSelfHostedRunner();
  const options = new Map();
  for (let index = 0; index < args.length; index += 2) {
    assert.ok(
      [
        '--icons-tarball',
        '--ui-core-tarball',
        '--ui-shadow-tarball',
        '--subject',
        '--out',
        '--browser-channel',
      ].includes(args[index]),
      args[index],
    );
    assert.ok(args[index + 1] && !options.has(args[index]), `missing or duplicate ${args[index]}`);
    options.set(args[index], args[index + 1]);
  }
  assert.ok(
    ['--icons-tarball', '--ui-core-tarball', '--ui-shadow-tarball', '--subject', '--out'].every(
      (key) => options.has(key),
    ),
    'Нужны три tarball, --subject и новый --out',
  );
  const out = resolve(options.get('--out'));
  assert.ok(outside(relative(ROOT, out)), 'Отчёт должен находиться вне checkout');
  assert.ok(
    outside(relative(await realpath(ROOT), await realpath(dirname(out)))),
    'Родитель отчёта через symlink находится внутри checkout',
  );
  await mkdir(out, { recursive: false });
  const started = new Date().toISOString();
  const records = [];
  const browserErrors = [];
  const receipt = { schemaVersion: 1, started, outcome: 'running', records };
  let consumer;
  let browser;
  let server;
  let proofTimer;
  let failure;
  const cleanupErrors = [];
  let phase = 'subject';
  try {
    const subjectBytes = await readFile(resolve(options.get('--subject')));
    const subject = validateSubject(JSON.parse(subjectBytes));
    receipt.subject = subject;
    receipt.subjectSha256 = hash(subjectBytes);
    const source = (args) =>
      execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', timeout: 20_000 }).trim();
    const harnessBytes = await readFile(fileURLToPath(import.meta.url));
    receipt.harness = {
      commit: source(['rev-parse', 'HEAD']),
      sourceSha256: hash(harnessBytes),
      dirty: source(['status', '--porcelain']) !== '',
      diffSha256: hash(execFileSync('git', ['diff', 'HEAD', '--binary'], { cwd: ROOT })),
    };
    receipt.runner = {
      node: process.version,
      platform: process.platform,
      architecture: process.arch,
      runId: process.env.GITHUB_RUN_ID,
      runAttempt: process.env.GITHUB_RUN_ATTEMPT,
      environment: process.env.RUNNER_ENVIRONMENT,
      name: process.env.RUNNER_NAME,
      os: process.env.RUNNER_OS,
    };
    const archives = [];
    for (const [key, option] of [
      ['icons', '--icons-tarball'],
      ['uiCore', '--ui-core-tarball'],
      ['uiShadow', '--ui-shadow-tarball'],
    ]) {
      const path = resolve(options.get(option));
      const bytes = await readFile(path);
      assert.equal(hash(bytes), subject.packages[key].archiveSha256, key);
      assert.equal(bytes.length, subject.packages[key].archiveBytes, key);
      archives.push({ key, path });
    }
    consumer = await mkdtemp(join(tmpdir(), 'labui-icons-consumer-'));
    assert.ok(outside(relative(ROOT, await realpath(consumer))));
    await writeFile(
      join(consumer, 'package.json'),
      `${JSON.stringify({ private: true, type: 'module' })}\n`,
    );
    phase = 'install';
    await writeFile(
      join(out, 'npm-install.log'),
      npm(consumer, [
        'install',
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
        ...archives.map((item) => item.path),
        '@labpics/motion@0.5.0',
      ]),
    );
    await writeFile(join(out, 'dependency-tree.json'), npm(consumer, ['ls', '--all', '--json']));
    await writeFile(
      join(out, 'package-lock.json'),
      await readFile(join(consumer, 'package-lock.json')),
    );
    receipt.installed = [];
    for (const expected of [
      ...Object.values(subject.packages),
      { name: '@labpics/motion', version: '0.5.0' },
    ]) {
      const path = join(consumer, 'node_modules', expected.name, 'package.json');
      assert.ok(
        !outside(relative(consumer, await realpath(path))),
        'package resolution вышла из clean consumer',
      );
      const bytes = await readFile(path);
      const manifest = JSON.parse(bytes);
      assert.equal(manifest.name, expected.name);
      assert.equal(manifest.version, expected.version);
      assert.ok(
        Object.values(manifest.dependencies ?? {}).every(
          (value) => !value.startsWith('workspace:'),
        ),
      );
      receipt.installed.push({
        name: manifest.name,
        version: manifest.version,
        manifestSha256: hash(bytes),
      });
    }
    await writeFile(join(consumer, 'index.html'), HTML);
    await writeFile(join(consumer, 'consumer.mjs'), FIXTURE);
    phase = 'build';
    // Зависимости tooling загружаются только после запрета локального heavy run.
    const { build } = await import('vite');
    const { chromium } = await import('@playwright/test');
    const modules = new Set();
    const bundles = [];
    await build({
      configFile: false,
      root: consumer,
      logLevel: 'warn',
      plugins: [
        {
          name: 'icons-packed-identity',
          generateBundle(_options, output) {
            for (const item of Object.values(output)) {
              const bytes = Buffer.from(item.type === 'chunk' ? item.code : item.source);
              bundles.push({
                file: item.fileName,
                sha256: hash(bytes),
                raw: bytes.length,
                gzip: gzipSync(bytes).length,
                brotli: brotliCompressSync(bytes).length,
              });
              if (item.type === 'chunk')
                for (const id of Object.keys(item.modules)) modules.add(id);
            }
          },
        },
      ],
      build: { outDir: join(out, 'bundle'), emptyOutDir: false },
    });
    const moduleGraph = [...modules]
      .filter((id) => !id.startsWith('\0'))
      .map((id) => {
        const path = id.split('?')[0];
        assert.ok(!outside(relative(consumer, path)), `consumer импортирует producer: ${path}`);
        return relative(consumer, path).replaceAll('\\', '/');
      })
      .sort();
    assert.ok(
      moduleGraph.some((id) =>
        id.endsWith('node_modules/@labpics/ui-core/dist/components/button/index.js'),
      ),
    );
    assert.ok(
      moduleGraph.some((id) => id.endsWith('node_modules/@labpics/icons/dist/symbols/reload.js')),
    );
    assert.ok(moduleGraph.some((id) => id.includes('node_modules/@labpics/motion/')));
    assert.ok(
      !moduleGraph.some((id) =>
        /@labpics\/icons\/(?:dist\/ir\/(?:index|compiler)\.js|.*(?:catalog|semantics|authoring))/.test(
          id,
        ),
      ),
      'reload импортирует весь IR/authoring catalog',
    );
    assert.ok(
      !moduleGraph.some((id) => /@labpics\/icons\/dist\/symbols\/(?!reload\.js$)/.test(id)),
      'загружен чужой symbol',
    );
    receipt.consumer = {
      fixtureSha256: hash(FIXTURE),
      htmlSha256: hash(HTML),
      moduleGraph,
      bundles,
      scenario:
        'два LabUI icon-only button, reload Outline/Filled, публичный Lab Motion; размер полного consumer без baseline speedup claim',
    };
    await writeFile(join(out, 'module-graph.json'), `${JSON.stringify(moduleGraph, null, 2)}\n`);
    await writeFile(join(out, 'bundle-sizes.json'), `${JSON.stringify(bundles, null, 2)}\n`);
    phase = 'browser';
    server = await serve(join(out, 'bundle'));
    browser = await chromium.launch({
      headless: true,
      ...(options.has('--browser-channel') ? { channel: options.get('--browser-channel') } : {}),
    });
    receipt.runner.browser = browser.version();
    await Promise.race([
      browserProof(
        browser,
        `http://127.0.0.1:${server.address().port}`,
        subject.authorReference,
        out,
        records,
        browserErrors,
      ),
      new Promise((_, reject) => {
        proofTimer = setTimeout(
          () => reject(new Error('icons-packed browser proof timeout')),
          120_000,
        );
      }),
    ]);
    clearTimeout(proofTimer);
    assert.deepEqual(browserErrors, []);
    assert.equal(source(['rev-parse', 'HEAD']), receipt.harness.commit);
    assert.equal(
      hash(await readFile(fileURLToPath(import.meta.url))),
      receipt.harness.sourceSha256,
    );
    receipt.outcome = 'passed';
    receipt.qualification =
      'Три заданных архива и публичный Motion установлены в отдельный consumer. Producer sourceCommit — входное утверждение; публикация и полная оптическая приёмка этим запуском не доказаны.';
  } catch (error) {
    receipt.outcome = 'failed';
    receipt.failure = { phase, browserErrors, message: String(error?.stack ?? error) };
    failure = error;
  } finally {
    clearTimeout(proofTimer);
    try {
      await browser?.close();
    } catch (error) {
      cleanupErrors.push(String(error));
    }
    try {
      if (server)
        await new Promise((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        );
    } catch (error) {
      cleanupErrors.push(String(error));
    }
    try {
      if (consumer) {
        const resolved = await realpath(consumer);
        assert.equal(dirname(resolved), await realpath(tmpdir()));
        assert.ok(basename(resolved).startsWith('labui-icons-consumer-'));
        await rm(resolved, { recursive: true, force: true });
      }
    } catch (error) {
      cleanupErrors.push(String(error));
    }
    if (cleanupErrors.length) {
      receipt.outcome = 'failed';
      receipt.cleanupErrors = cleanupErrors;
    }
    receipt.completed = new Date().toISOString();
    await writeFile(join(out, 'receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`);
    if (receipt.outcome === 'failed')
      await writeFile(join(out, 'failure.json'), `${JSON.stringify(receipt, null, 2)}\n`);
    if (receipt.outcome === 'passed')
      process.stdout.write(`icons-packed: passed, ${records.length} observations\n`);
  }
  if (failure) throw failure;
  if (cleanupErrors.length) throw new Error(`icons-packed cleanup: ${cleanupErrors.join('; ')}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
