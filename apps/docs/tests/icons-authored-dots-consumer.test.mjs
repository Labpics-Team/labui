import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { runInNewContext } from 'node:vm';
import * as dotsConsumer from './icons-authored-dots-consumer.mjs';
import {
  AUTHORED_DOT_ENTRIES,
  assertContourPose,
  assertDotVariation,
  authoredDotsFixture,
  authoredDotsTypeFixture,
  rawDotOperands,
  scalarSequenceSteps,
  validateAuthoredDotsReference,
} from './icons-authored-dots-consumer.mjs';

test('raw contour grammar preserves legal SVG separators and refuses misplaced cubic operands', () => {
  const cubic = 'C1 1 1 1 1 1';
  const canonical = `M1 1${cubic.repeat(4)}Z`;
  assert.deepEqual(rawDotOperands(canonical), Array(26).fill(1));
  const separated = ` \tM+1e0,1.\r\n${'C+1e0,1.,1e+0,1,1,1'.repeat(4)}Z\n`;
  assert.deepEqual(rawDotOperands(separated), rawDotOperands(canonical));
  for (const malformed of [
    `M1 1C1 1 1 1 1C1 1 1 1 1 1 1${cubic.repeat(2)}Z`,
    canonical.replace('C1 1', 'C1,,1'),
    `${canonical},`,
    `${canonical}\u00a0`,
  ])
    assert.throws(() => rawDotOperands(malformed));
});
import { assertIconsImport, consumerFixture, consumerPublicEntries } from './icons-packed.mjs';
import { authoredDotsReference } from './prepare-icons-inputs.mjs';

const snapshot = JSON.parse(
  await readFile(new URL('./fixtures/icons-authored-dots-masters.json', import.meta.url)),
);
const pin = { sourceCommit: snapshot.sourceCommit, figma: snapshot.annotations.source };

async function fixture(t, change = () => {}) {
  const parent = await realpath(tmpdir());
  const root = await mkdtemp(join(parent, 'labui-authored-dots-'));
  t.after(async () => {
    const resolved = await realpath(root);
    assert.equal(dirname(resolved), parent);
    assert.ok(basename(resolved).startsWith('labui-authored-dots-'));
    await rm(resolved, { recursive: true, force: true });
  });
  const data = structuredClone(snapshot);
  change(data);
  const files = {
    'semantics/figma-baseline.json': JSON.stringify(data.manifest),
    'semantics/author-anatomy.json': JSON.stringify(data.annotations),
    'semantics/author-state-groups.json': data.semantics,
    'semantics/grid.json': data.grid,
    ...data.masters,
  };
  for (const [file, bytes] of Object.entries(files)) {
    await mkdir(dirname(join(root, file)), { recursive: true });
    await writeFile(join(root, file), bytes);
  }
  return root;
}

test('schema5 extends actual public entries and keeps every schema4 primitive', () => {
  assert.deepEqual(consumerPublicEntries(5), [
    ...consumerPublicEntries(4),
    ...AUTHORED_DOT_ENTRIES,
  ]);
  for (const entry of AUTHORED_DOT_ENTRIES) assertIconsImport(entry);
  assert.throws(() => assertIconsImport('@labpics/icons/ir'));
  assert.throws(() => assertIconsImport('@labpics/icons/private/contour-runtime'));
  assert.ok(consumerFixture(5).includes(authoredDotsFixture()));
  assert.ok(!consumerFixture(4).includes('contourConsumers'));
  const parsed = spawnSync(process.execPath, ['--check', '--input-type=module'], {
    input: consumerFixture(5),
    encoding: 'utf8',
    timeout: 10_000,
  });
  assert.equal(parsed.status, 0, parsed.stderr);
});

test('external type consumer uses both variants and meaningful rejected public requests', () => {
  const source = authoredDotsTypeFixture();
  for (const entry of AUTHORED_DOT_ENTRIES) assert.ok(source.includes(entry));
  assert.equal(source.match(/@ts-expect-error/g).length, 3);
  assert.ok(!source.includes('/dist/'));
  assert.ok(!source.includes('/ir/contour-runtime'));
});

// В 420bfe0 download helper попал внутрь TypeScript literal: TS7006/TS2304/TS2591,
// а внешний модуль не имел вызываемого downloadedSvg. Эти два наблюдения связаны.
test('type fixture remains consumer code and compiles strict NodeNext without Node orchestration', async (t) => {
  const source = authoredDotsTypeFixture();
  const root = await fixture(t);
  const modules = {
    'node_modules/@labpics/icons/package.json': JSON.stringify({
      name: '@labpics/icons',
      type: 'module',
      exports: {
        './variations/ellipsis-horizontal': { types: './symbol.d.ts' },
        './variations/ellipsis-vertical': { types: './symbol.d.ts' },
        './states/ellipsis-orientation-outline': { types: './state.d.ts' },
        './states/ellipsis-orientation-filled': { types: './state.d.ts' },
        './motion': { types: './motion.d.ts' },
      },
    }),
    'node_modules/@labpics/icons/symbol.d.ts':
      "export declare function glyph(input?: {variant?: 'outline' | 'filled'; variation?: {dotScale?: number; spacingScale?: number}}): unknown;",
    'node_modules/@labpics/icons/state.d.ts':
      "export declare function compileStateEffect(state: 'horizontal' | 'vertical', request: {duration: number; from?: number; reducedMotion?: boolean}): {ok: false} | {ok: true; effect: {from: number; to: number; options: {duration: number}}};",
    'node_modules/@labpics/icons/motion.d.ts':
      'export declare function prepareContourStateEffect(effect: unknown): {ok: false} | {ok: true; sample(progress: number): unknown};',
    'node_modules/@labpics/motion/package.json': JSON.stringify({
      name: '@labpics/motion',
      type: 'module',
      exports: { '.': { types: './index.d.ts' } },
    }),
    'node_modules/@labpics/motion/index.d.ts':
      "export declare function value(initial: number): {subscribe(callback: (progress: number) => unknown): () => void; animate(to: number, options: {duration: number; ease: 'linear'}): unknown; dispose(): void};",
    'package.json': JSON.stringify({ private: true, type: 'module' }),
    'consumer.ts': source,
    'tsconfig.json': JSON.stringify({
      compilerOptions: {
        strict: true,
        noEmit: true,
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        target: 'ES2022',
        types: [],
        lib: ['ES2022', 'DOM'],
      },
      files: ['consumer.ts'],
    }),
  };
  for (const [file, contents] of Object.entries(modules)) {
    await mkdir(dirname(join(root, file)), { recursive: true });
    await writeFile(join(root, file), contents);
  }
  // Минимальные declarations изолируют границу шаблона. Настоящий tarball проверяет heavy harness.
  const require = createRequire(import.meta.url);
  const metadata = require.resolve('typescript/package.json');
  const compiler = join(dirname(metadata), require(metadata).bin.tsc);
  const result = spawnSync(process.execPath, [compiler, '--project', join(root, 'tsconfig.json')], {
    cwd: root,
    encoding: 'utf8',
    timeout: 10_000,
  });
  assert.equal(result.status, 0, `${result.stdout ?? ''}${result.stderr ?? ''}`);
  assert.ok(!source.includes('downloadedSvg'));
  assert.ok(!source.includes('Buffer'));
  assert.ok(!source.includes('waitForEvent'));
});

test('download helper exists at module scope and consumes a real stream protocol', async () => {
  assert.equal(typeof dotsConsumer.downloadedSvg, 'function');
  let clicked = false;
  const bytes = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>');
  const download = {
    createReadStream: async () =>
      (async function* () {
        yield bytes;
      })(),
    failure: async () => null,
  };
  const page = {
    waitForEvent: async (name) => {
      assert.equal(name, 'download');
      return download;
    },
  };
  const button = {
    click: async () => {
      clicked = true;
    },
  };
  assert.equal(await dotsConsumer.downloadedSvg(page, button), bytes.toString());
  assert.equal(clicked, true);
});

test('native download helper paces the eleventh request without losing UTF8 file observations', async (t) => {
  let clock = 0;
  const waits = [];
  t.mock.method(performance, 'now', () => clock);
  t.mock.method(globalThis, 'setTimeout', (callback, milliseconds) => {
    waits.push(milliseconds);
    clock += milliseconds;
    queueMicrotask(callback);
  });
  const requests = [];
  let start = 0;
  let burst = 0;
  let complete;
  const text = '<svg xmlns="http://www.w3.org/2000/svg"><title>Знак №1 😀 &amp; 50%</title></svg>';
  const file = {
    createReadStream: async () =>
      (async function* () {
        yield Buffer.from(text);
      })(),
    failure: async () => null,
  };
  const page = {
    waitForEvent: (name) => {
      assert.equal(name, 'download');
      return new Promise((resolve, reject) => {
        complete = { resolve, reject };
      });
    },
  };
  const button = {
    click: async () => {
      // Модель ровно Chromium140 LocalFrame::ShouldThrottleDownload, не native oracle.
      if (requests.length === 0) clock += 120;
      requests.push(clock);
      if (burst === 0) start = clock;
      else if (burst >= 10) {
        if (clock - start <= 1000) {
          complete.reject(new Error('DOWNLOAD_BURST_THROTTLED'));
          return;
        }
        burst = 0;
        start = clock;
      }
      burst++;
      complete.resolve(file);
    },
  };
  for (let index = 0; index < 21; index++)
    assert.equal(await dotsConsumer.downloadedSvg(page, button), text);
  assert.equal(requests.length, 21);
  assert.deepEqual(requests.slice(0, 10), Array(10).fill(120));
  assert.ok(requests[10] - requests[0] > 1000 && requests[20] - requests[10] > 1000);
  assert.equal(waits.length, 2);
});

test('native download helper keeps pages independent and adds no wait after a naturally slow burst', async (t) => {
  let clock = 0;
  const waits = [];
  t.mock.method(performance, 'now', () => clock);
  t.mock.method(globalThis, 'setTimeout', (callback, milliseconds) => {
    waits.push(milliseconds);
    clock += milliseconds;
    queueMicrotask(callback);
  });
  const text = '<svg/>';
  const file = {
    createReadStream: async () =>
      (async function* () {
        yield Buffer.from(text);
      })(),
    failure: async () => null,
  };
  const page = { waitForEvent: async () => file };
  const other = { waitForEvent: async () => file };
  const button = { click: async () => {} };
  for (let index = 0; index < 10; index++) await dotsConsumer.downloadedSvg(page, button);
  assert.equal(await dotsConsumer.downloadedSvg(other, button), text);
  clock = 2000;
  assert.equal(await dotsConsumer.downloadedSvg(page, button), text);
  assert.deepEqual(waits, []);
});

test('native download helper serializes simultaneous successful requests with exact file ownership', async () => {
  const events = [];
  let complete;
  let ordinal = 0;
  const page = {
    waitForEvent: () => {
      events.push('listen');
      return new Promise((resolve) => {
        complete = resolve;
      });
    },
  };
  const button = {
    click: async () => {
      const current = ++ordinal;
      events.push(`click:${current}`);
      complete({
        createReadStream: async () =>
          (async function* () {
            events.push(`stream:${current}`);
            yield Buffer.from(`<svg data-n="${current}"/>`);
          })(),
        failure: async () => null,
      });
    },
  };
  assert.deepEqual(
    await Promise.all([
      dotsConsumer.downloadedSvg(page, button),
      dotsConsumer.downloadedSvg(page, button),
    ]),
    ['<svg data-n="1"/>', '<svg data-n="2"/>'],
  );
  assert.deepEqual(events, ['listen', 'click:1', 'stream:1', 'listen', 'click:2', 'stream:2']);
});

test('native download helper fences the page queue after a stream failure', async () => {
  const events = [];
  const failure = new Error('native stream failed');
  let complete;
  let ordinal = 0;
  const page = {
    waitForEvent: (name) => {
      assert.equal(name, 'download');
      events.push('listen');
      return new Promise((resolve) => {
        complete = resolve;
      });
    },
  };
  const button = {
    click: async () => {
      const occurrence = ++ordinal;
      events.push(`click:${occurrence}`);
      complete({
        createReadStream: async () => {
          events.push(`stream:${occurrence}`);
          if (occurrence === 1) throw failure;
          return (async function* () {
            yield Buffer.from('<svg/>');
          })();
        },
        failure: async () => null,
      });
    },
  };
  const first = dotsConsumer.downloadedSvg(page, button);
  const second = dotsConsumer.downloadedSvg(page, button);
  await assert.rejects(first, (error) => error === failure);
  await assert.rejects(second, (error) => error === failure);
  assert.deepEqual(events, ['listen', 'click:1', 'stream:1']);
});

test('native download helper cannot transfer a late click event after its wait failed', async () => {
  const failure = new Error('native event wait failed');
  const file = {
    createReadStream: async () =>
      (async function* () {
        yield Buffer.from('<svg/>');
      })(),
    failure: async () => null,
  };
  let waits = 0;
  let clicks = 0;
  let finishClick;
  let lateDownload;
  const page = {
    waitForEvent: () => {
      if (++waits === 1) return Promise.reject(failure);
      return new Promise((resolve) => {
        lateDownload = resolve;
      });
    },
  };
  const button = {
    click: () => {
      if (++clicks > 1) return Promise.resolve();
      return new Promise((resolve) => {
        finishClick = () => {
          lateDownload?.(file);
          resolve();
        };
      });
    },
  };
  const first = dotsConsumer.downloadedSvg(page, button);
  const second = dotsConsumer.downloadedSvg(page, button);
  await assert.rejects(first, (error) => error === failure);
  await Promise.resolve();
  await Promise.resolve();
  finishClick();
  await assert.rejects(second, (error) => error === failure);
  assert.equal(waits, 1);
  assert.equal(clicks, 1);
});

test('native download helper rejects activation recovery on the same page and accepts a fresh page', async (t) => {
  let clock = 0;
  t.mock.method(performance, 'now', () => clock);
  const failure = new Error('native click failed before dispatch');
  const file = {
    createReadStream: async () =>
      (async function* () {
        yield Buffer.from('<svg/>');
      })(),
    failure: async () => null,
  };
  const page = { waitForEvent: async () => file };
  let clicks = 0;
  const button = {
    click: async () => {
      if (++clicks === 1) throw failure;
    },
  };
  await assert.rejects(dotsConsumer.downloadedSvg(page, button), (error) => error === failure);
  clock = 20_000;
  for (let index = 0; index < 12; index++)
    await assert.rejects(dotsConsumer.downloadedSvg(page, button), (error) => error === failure);
  assert.equal(clicks, 1);
  assert.equal(
    await dotsConsumer.downloadedSvg({ waitForEvent: async () => file }, button),
    '<svg/>',
  );
  assert.equal(clicks, 2);
});

test('four independent masters carry exact Figma, semantic and grid receipts', async (t) => {
  const root = await fixture(t);
  const reference = await authoredDotsReference(root, pin);
  validateAuthoredDotsReference(reference, pin.figma);
  assert.equal(
    reference.semanticSha256,
    createHash('sha256').update(snapshot.semantics).digest('hex'),
  );
  assert.equal(reference.gridSha256, createHash('sha256').update(snapshot.grid).digest('hex'));
  for (const variants of Object.values(reference.icons))
    for (const item of Object.values(variants)) {
      assert.equal(
        item.author.masterSha256,
        createHash('sha256').update(snapshot.masters[item.sourceFile]).digest('hex'),
      );
      assert.equal(item.paths.length, 3);
    }
});

test('source oracle rejects changed raw bytes before any installed producer import', async (t) => {
  const root = await fixture(t, (data) => {
    const file = Object.keys(data.masters)[0];
    data.masters[file] = `${data.masters[file].replace('11.5', '11.4')} `;
  });
  await assert.rejects(authoredDotsReference(root, pin));
});

test('source oracle rejects a fabricated morph between different authored variants', async (t) => {
  const root = await fixture(t, (data) => {
    const semantic = JSON.parse(data.semantics);
    semantic.groups['ellipsis-orientation-outline'].states.vertical.variant = 'filled';
    data.semantics = JSON.stringify(semantic);
  });
  await assert.rejects(authoredDotsReference(root, pin));
});

test('vertical menu does not acquire a loading gesture from identical dot count', async (t) => {
  const root = await fixture(t, (data) => {
    data.annotations.icons['ellipsis-vertical'].outline.gesture = structuredClone(
      data.annotations.icons['ellipsis-horizontal'].outline.gesture,
    );
  });
  await assert.rejects(authoredDotsReference(root, pin));
});

function pose(reference, variant, state) {
  const item = reference.icons[`ellipsis-${state}`][variant];
  return {
    variant,
    viewBox: item.viewBox,
    identity: true,
    middleIdentity: true,
    middleMutations: 0,
    paths: item.parts.map(({ id, d, fillRule }) => ({ partId: id, d, fillRule })),
  };
}

test('contour endpoint oracle preserves raw strings and catches node replacement or middle writes', async (t) => {
  const reference = await authoredDotsReference(await fixture(t), pin);
  for (const variant of ['outline', 'filled'])
    for (const [state, progress] of [
      ['horizontal', 0],
      ['vertical', 1],
    ]) {
      const original = pose(reference, variant, state);
      assertContourPose(original, reference, variant, progress);
      assert.throws(() =>
        assertContourPose({ ...original, identity: false }, reference, variant, progress),
      );
      assert.throws(() =>
        assertContourPose({ ...original, middleMutations: 1 }, reference, variant, progress),
      );
      const changed = structuredClone(original);
      changed.paths[0].d += ' ';
      assert.throws(() => assertContourPose(changed, reference, variant, progress));
    }
});

const pathFromNumbers = (values) =>
  `M${values.slice(0, 2).join(' ')}${[0, 1, 2, 3].map((quarter) => `C${values.slice(2 + quarter * 6, 8 + quarter * 6).join(' ')}`).join('')}Z`;
const close = (actual, expected, message) =>
  assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= 4 * Number.EPSILON, message);

async function installedMotion() {
  const require = createRequire(import.meta.url);
  let root = dirname(require.resolve('@labpics/motion'));
  for (;;) {
    try {
      const metadata = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
      if (metadata.name === '@labpics/motion') {
        assert.equal(metadata.version, '0.5.0');
        return import(pathToFileURL(join(root, metadata.exports['.'].import.default)).href);
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    assert.notEqual(dirname(root), root, 'не найден package owner установленного Motion');
    root = dirname(root);
  }
}

// Реальный Motion и исходный consumer; DOM seam записывает атрибуты без браузера.
// Числа sampler получены независимо из raw masters. Packed compiler проверяет remote journey.
function contourHarness(reference, variant, value) {
  const source = reference.icons['ellipsis-horizontal'][variant];
  const writes = [];
  const observers = new Set();
  const elements = [];
  const calls = { compile: 0, prepare: 0, sample: 0, value: 0 };
  class Element {
    constructor(tag) {
      elements.push(this);
      this.tagName = tag;
      this.dataset = {};
      this.attributes = new Map();
      this.children = [];
      this.listeners = new Map();
      this.isConnected = true;
      if (tag === 'lab-button') {
        this.updateComplete = Promise.resolve();
        const native = new Element('button');
        native.setAttribute('aria-label', 'Сменить ориентацию многоточия');
        this.shadowRoot = { querySelector: () => native };
      }
    }
    setAttribute(name, value) {
      this.attributes.set(name, value);
      if (name === 'd')
        writes.push({ time: performance.now(), partId: this.dataset.part, d: value });
      for (const observer of observers)
        if (observer.node === this) observer.records.push({ attributeName: name });
    }
    getAttribute(name) {
      return this.attributes.get(name) ?? null;
    }
    removeAttribute(name) {
      this.attributes.delete(name);
    }
    set innerHTML(_) {
      const svg = new Element('svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.children = source.parts.map((part) => {
        const node = new Element('path');
        node.dataset.part = part.id;
        node.setAttribute('d', part.d);
        node.setAttribute('fill-rule', part.fillRule);
        return node;
      });
      this.children = [svg];
    }
    querySelector(selector) {
      return selector === 'svg' ? this.children[0] : null;
    }
    querySelectorAll() {
      return this.children;
    }
    append(...children) {
      this.children.push(...children);
    }
    addEventListener(name, callback) {
      const listeners = this.listeners.get(name) ?? [];
      listeners.push(callback);
      this.listeners.set(name, listeners);
    }
    dispatch(name) {
      for (const listener of this.listeners.get(name) ?? []) listener({});
    }
    getBoundingClientRect() {
      return { width: 48, height: 48 };
    }
    cloneNode() {
      return this;
    }
    get outerHTML() {
      return '<svg/>';
    }
    remove() {
      this.isConnected = false;
    }
  }
  class Observer {
    records = [];
    observe(node) {
      this.node = node;
      observers.add(this);
    }
    takeRecords() {
      return this.records.splice(0);
    }
    disconnect() {
      observers.delete(this);
    }
  }
  const sample = (progress) => ({
    ok: true,
    parts: [0, 2].map((index) => {
      const a = reference.icons['ellipsis-horizontal'][variant].paths[index].d;
      const b = reference.icons['ellipsis-vertical'][variant].paths[index].d;
      return {
        partId: source.parts[index].id,
        d:
          progress === 0
            ? a
            : progress === 1
              ? b
              : pathFromNumbers(
                  rawDotOperands(a).map(
                    (number, operand) =>
                      number * (1 - progress) + rawDotOperands(b)[operand] * progress,
                  ),
                ),
      };
    }),
  });
  const plays = [];
  let rejectedPose = false;
  let reduced = false;
  const fixtureSource = authoredDotsFixture();
  const start = fixtureSource.indexOf('function mountContourConsumer(');
  const end = fixtureSource.indexOf('\nfunction scalarSequenceSteps(', start);
  assert.ok(start >= 0 && end > start);
  const mount = runInNewContext(`(${fixtureSource.slice(start, end)})`, {
    document: { createElement: (tag) => new Element(tag) },
    MutationObserver: Observer,
    matchMedia: () => ({ matches: reduced }),
    contourValue: (initial) => {
      calls.value++;
      const scalar = value(initial);
      const animate = scalar.animate;
      scalar.animate = (...args) => {
        const play = animate(...args);
        plays.push(play);
        return play;
      };
      return scalar;
    },
    prepareContourStateEffect: () => {
      calls.prepare++;
      return {
        ok: true,
        sample: (progress) => {
          calls.sample++;
          return rejectedPose
            ? { ok: false, reason: { code: 'POSE_UNREPRESENTABLE' } }
            : sample(progress);
        },
      };
    },
  });
  const consumer = mount(
    {
      stateCapabilities: () => ({}),
      renderStateSvg: () => ({ ok: true, svg: '<svg/>' }),
      compileStateEffect: (state, request) => {
        calls.compile++;
        return state === 'unknown'
          ? { ok: false, reason: { code: 'STATE_UNSUPPORTED' } }
          : {
              ok: true,
              effect: {
                from: request.from,
                to: state === 'vertical' ? 1 : 0,
                options: {
                  duration: request.reducedMotion ? 0 : request.duration,
                  easing: 'linear',
                },
              },
            };
      },
    },
    variant,
    new Element('section'),
  );
  const read = () => JSON.parse(JSON.stringify(consumer.read()));
  return {
    consumer,
    read,
    plays,
    writes,
    calls,
    controls: () => {
      const button = elements.find((element) => element.tagName === 'lab-button');
      button.dispatch('click');
      button.shadowRoot.querySelector('button').dispatch('click');
      elements.find((element) => element.tagName === 'select').dispatch('change');
    },
    rejectPose: () => {
      rejectedPose = true;
    },
    reduce: () => {
      reduced = true;
    },
  };
}

test('real Motion successor starts the last materialized authored pose in both directions', async (t) => {
  const { value } = await installedMotion();
  const reference = await authoredDotsReference(await fixture(t), pin);
  const original = Object.getOwnPropertyDescriptor(performance, 'now');
  let now = 100;
  Object.defineProperty(performance, 'now', { configurable: true, value: () => now });
  try {
    for (const variant of ['outline', 'filled']) {
      const harness = contourHarness(reference, variant, value);
      const { consumer, read, plays } = harness;
      try {
        consumer.change('vertical', 1200);
        plays.at(-1).seek(240);
        assert.equal(read().renderedProgress, 0.2);
        now += 5;
        const interrupted = consumer.change('horizontal', 600);
        assert.deepEqual(interrupted.after, interrupted.before, 'reverse admission');
        assert.equal(interrupted.from, 0.2);
        assert.equal(interrupted.effect.from, read().progress);
        assert.equal(interrupted.previousPlayback, 'stopped');
        const reversed = consumer.pauseAt(200);
        const expectedReverse = 0.2 * (1 - 200 / 600);
        close(reversed.renderedProgress, expectedReverse, 'actual reverse trajectory');
        assertContourPose(read(), reference, variant, expectedReverse);
        plays.at(-1).play();
        now += 5;
        const newest = consumer.change('vertical', 300);
        assert.deepEqual(newest.after, newest.before, 'newer target admission');
        assert.equal(newest.effect.from, read().progress);
        const staleCount = read().notifications;
        plays[0].finish();
        plays[1].finish();
        assert.equal(read().notifications, staleCount, 'retired channels must not write');
        const forward = consumer.pauseAt(150);
        const expectedForward = expectedReverse + (1 - expectedReverse) * 0.5;
        close(forward.renderedProgress, expectedForward, 'actual forward trajectory');
        assertContourPose(read(), reference, variant, expectedForward);
        plays.at(-1).finish();
        await consumer.settle();
        assertContourPose(read(), reference, variant, 1);
      } finally {
        consumer.cleanup();
      }
    }
  } finally {
    if (original) Object.defineProperty(performance, 'now', original);
    else Reflect.deleteProperty(performance, 'now');
  }
});

test('refused prepared pose preserves the current public playback and reduced motion finishes once', async (t) => {
  const { value } = await installedMotion();
  const reference = await authoredDotsReference(await fixture(t), pin);
  const harness = contourHarness(reference, 'outline', value);
  const { consumer, read, plays } = harness;
  try {
    consumer.change('vertical', 1200);
    plays.at(-1).seek(240);
    const before = read();
    harness.rejectPose();
    assert.throws(() => consumer.change('horizontal', 600), /POSE_UNREPRESENTABLE/);
    assert.deepEqual(read().paths, before.paths);
    assert.equal(plays.at(-1).state, 'running');
    assert.equal(read().targetState, 'vertical');
  } finally {
    consumer.cleanup();
  }
  const reduced = contourHarness(reference, 'filled', value);
  try {
    reduced.reduce();
    const before = reduced.read().notifications;
    reduced.consumer.change('vertical', 600);
    await reduced.consumer.settle();
    assertContourPose(reduced.read(), reference, 'filled', 1);
    assert.ok(reduced.read().notifications - before <= 1);
    reduced.consumer.cleanup();
    const notifications = reduced.read().notifications;
    reduced.plays.at(-1).finish();
    assert.equal(reduced.read().notifications, notifications);
  } finally {
    reduced.consumer.cleanup();
  }
});

test('disposed contour consumer refuses before compile and cannot recreate a Motion channel', async (t) => {
  const { value } = await installedMotion();
  const reference = await authoredDotsReference(await fixture(t), pin);
  for (const variant of ['outline', 'filled']) {
    for (const active of [false, true]) {
      const harness = contourHarness(reference, variant, value);
      const { consumer, read, plays, calls } = harness;
      try {
        if (active) {
          await consumer.ready;
          consumer.change('vertical', 1200);
          plays.at(-1).seek(240);
        }
        consumer.cleanup();
        if (!active) await consumer.ready;
        const before = JSON.parse(JSON.stringify(consumer.disposal()));
        const beforeCalls = { ...calls };
        const beforePaths = read().paths;
        const nativeClicks = read().nativeClicks;
        assert.equal(before.connected, false);
        assert.throws(() => consumer.change('horizontal', 600), /освобожд/);
        assert.throws(() => consumer.pauseAt(300), /освобожд/);
        assert.throws(() => consumer.refuse(), /освобожд/);
        await assert.rejects(consumer.settle(), /освобожд/);
        assert.deepEqual(
          calls,
          beforeCalls,
          'post-disposal admission reached a producer or allocated Motion',
        );
        harness.controls();
        consumer.cleanup();
        plays.at(-1)?.finish();
        await Promise.resolve();
        assert.deepEqual(calls, beforeCalls);
        assert.deepEqual(read().paths, beforePaths);
        assert.equal(read().nativeClicks, nativeClicks);
        assert.deepEqual(
          JSON.parse(JSON.stringify(consumer.disposal())),
          before,
          'cleanup or a pending completion changed the terminal lifecycle',
        );
      } finally {
        consumer.cleanup();
      }
    }
  }
});

test('raw correspondence oracle catches an incorrect interior pose despite correct endpoints', async (t) => {
  const reference = await authoredDotsReference(await fixture(t), pin);
  for (const variant of ['outline', 'filled']) {
    const expected = pose(reference, variant, 'horizontal');
    expected.paths = expected.paths.map((path, index) => {
      if (index === 1) return path;
      const a = rawDotOperands(reference.icons['ellipsis-horizontal'][variant].paths[index].d);
      const b = rawDotOperands(reference.icons['ellipsis-vertical'][variant].paths[index].d);
      return { ...path, d: pathFromNumbers(a.map((value, operand) => (value + b[operand]) / 2)) };
    });
    assertContourPose(expected, reference, variant, 0.5);
    const wrong = structuredClone(expected);
    const values = rawDotOperands(wrong.paths[0].d);
    values[2] += 0.05;
    wrong.paths[0].d = pathFromNumbers(values);
    assert.throws(() => assertContourPose(wrong, reference, variant, 0.5));
    assert.throws(() =>
      assertContourPose(pose(reference, variant, 'horizontal'), reference, variant, 0.5),
    );
  }
});

test('variation default oracle catches silent fallback and nonidentity defaults', async (t) => {
  const reference = await authoredDotsReference(await fixture(t), pin);
  for (const icon of ['ellipsis-horizontal', 'ellipsis-vertical'])
    for (const variant of ['outline', 'filled']) {
      const source = reference.icons[icon][variant];
      const observation = {
        icon,
        variant,
        viewBox: source.viewBox,
        author: source.author,
        defaultIdentity: true,
        provenance: { kind: 'source' },
        paths: source.parts.map(({ id, d, fillRule }) => ({ partId: id, d, fillRule })),
      };
      assertDotVariation(observation, reference, icon, variant, {});
      assert.throws(() =>
        assertDotVariation(
          { ...observation, defaultIdentity: false },
          reference,
          icon,
          variant,
          {},
        ),
      );
      assert.throws(() =>
        assertDotVariation(observation, reference, icon, variant, {
          dotScale: 1.1,
          spacingScale: 0.9,
        }),
      );
    }
});

test('transport fixture uses public Motion value ownership and exact sampler refusal', () => {
  const source = authoredDotsFixture();
  assert.match(source, /value as contourValue.*@labpics\/motion/);
  assert.match(source, /JSON\.parse\(JSON\.stringify\(result\.effect\)\)/);
  assert.match(source, /prepareContourStateEffect\(nextEffect\)/);
  assert.match(source, /progress\.get\(\)/);
  assert.match(source, /progress\.animate\(effect\.to/);
  assert.ok(/unsubscribe\(\);\s*progress\.dispose\(\)/.test(source));
  assert.ok(!source.includes('requestAnimationFrame'));
  assert.ok(!source.includes('setInterval'));
});

test('scalar stages read visible starts once and preserve subsequent public targets in all sample instances', () => {
  const first = {};
  const second = {};
  const effect = {
    version: 2,
    options: { easing: 'linear' },
    stages: [
      { partId: 'dot-leading', property: 'opacity', to: 0.35, at: 0, duration: 30 },
      { partId: 'dot-leading', property: 'opacity', to: 1, at: 30, duration: 30 },
    ],
  };
  const byPart = new Map([['dot-leading', [first, second]]]);
  const visible = new Map([
    [first, 0.5],
    [second, 0.6],
  ]);
  const steps = scalarSequenceSteps(effect, byPart, visible);
  assert.deepEqual(
    steps.map((step) => step[1].opacity),
    [[0.5, 0.35], [0.6, 0.35], 1, 1],
  );
  assert.deepEqual(
    steps.map((step) => step[2].ease),
    ['linear', 'linear', 'linear', 'linear'],
  );
  assert.throws(() => scalarSequenceSteps(effect, new Map(), visible));
});
