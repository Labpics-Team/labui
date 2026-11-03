import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { rawContentPath } from './icons-content-scale-consumer.mjs';
import { ICONS_HARNESS_FILES } from './icons-harness.mjs';
import { rawMicrophoneParts } from './icons-microphone-consumer.mjs';
import { assertIconsImport, consumerFixture, consumerPublicEntries } from './icons-packed.mjs';
import {
  WIDTH_MOTION_ENTRIES,
  WIDTH_MOTION_POSES,
  WIDTH_MOTION_VISUAL_FILES,
  assertWidthMotionVisualEvidence,
  createBodyWidthController,
  mountWidthMotionConsumer,
  mountWidthWorkload,
  validateWidthMotionReference,
  widthMotionBrowserProof,
  widthMotionFixture,
  widthMotionMeasurementFixtures,
  widthMotionReference,
  widthMotionTypeFixture,
} from './icons-width-motion-consumer.mjs';
import { readAuthorMaster } from './prepare-icons-inputs.mjs';

function fixture() {
  let d = 'width:1';
  let valid = true;
  let rejectWrite = false;
  let writes = 0;
  const factory = { instances: [] };
  const prepared = {
    sample: (width) =>
      !Number.isFinite(width) || typeof width !== 'number'
        ? { ok: false, reason: { code: 'INVALID_REQUEST' } }
        : width < 0.8 || width > 1
          ? { ok: false, reason: { code: 'VARIATION_OUTSIDE_DOMAIN' } }
          : { ok: true, bodyWidth: width, d: `width:${width}` },
  };
  const binding = {
    read: () => d,
    write: (next) => {
      if (rejectWrite) throw new Error('WRITE_REJECTED');
      d = next;
      writes++;
    },
    valid: (expected) => valid && d === expected,
  };
  const media = {
    matches: false,
    listeners: new Set(),
    addEventListener(_event, listener) {
      this.listeners.add(listener);
    },
    removeEventListener(_event, listener) {
      this.listeners.delete(listener);
    },
    change(matches) {
      this.matches = matches;
      for (const listener of this.listeners) listener({ matches });
    },
  };
  const value = (initial) => {
    let listener;
    let captured;
    let control;
    let current = initial;
    let disposed = false;
    const instance = {
      initial,
      get: () => current,
      emit: (next) => {
        current = next;
        try {
          listener?.(next);
        } catch (error) {
          control?.fail(error);
          throw error;
        }
      },
      stale: (next) => captured?.(next),
      subscribe(next) {
        listener = next;
        captured = next;
        return () => {
          listener = undefined;
        };
      },
      animate(target, options) {
        assert.equal(options.ease, 'linear');
        assert.ok(Number.isFinite(options.duration));
        let resolve;
        let reject;
        const start = current;
        control = {
          state: 'running',
          finished: new Promise((done, fail) => {
            resolve = done;
            reject = fail;
          }),
          fail(error) {
            this.state = 'failed';
            reject(error);
          },
          pause() {
            this.state = 'paused';
          },
          play() {
            this.state = 'running';
          },
          seek(milliseconds) {
            instance.emit(start + ((target - start) * milliseconds) / options.duration);
          },
          stop() {
            if (['running', 'paused'].includes(this.state)) {
              this.state = 'stopped';
              resolve({ status: 'stopped' });
            }
          },
          finish() {
            if (['running', 'paused'].includes(this.state)) {
              instance.emit(target);
              this.state = 'finished';
              resolve({ status: 'finished' });
            }
          },
        };
        void control.finished.catch(() => {});
        if (options.duration === 0) control.finish();
        return control;
      },
      dispose() {
        disposed = true;
        listener = undefined;
        control?.stop();
      },
      get disposed() {
        return disposed;
      },
      get control() {
        return control;
      },
    };
    factory.instances.push(instance);
    return instance;
  };
  const controller = createBodyWidthController(prepared, binding, value, media);
  return {
    controller,
    prepared,
    value,
    factory,
    media,
    binding,
    get d() {
      return d;
    },
    get writes() {
      return writes;
    },
    set valid(next) {
      valid = next;
    },
    set rejectWrite(next) {
      rejectWrite = next;
    },
  };
}

test('successful-write frontier survives failed writes and never picks up unpublished scalar state', async () => {
  const f = fixture();
  f.controller.request(0.8, 800);
  f.controller.seek(280);
  assert.ok(Math.abs(f.controller.read().lastWrittenWidth - 0.93) < 1e-12);
  const before = f.controller.read();
  f.rejectWrite = true;
  assert.throws(() => f.controller.seek(400), /WRITE_REJECTED/);
  assert.equal(f.controller.read().lastWrittenWidth, before.lastWrittenWidth);
  assert.equal(f.controller.read().d, before.d);
  f.rejectWrite = false;
  const next = f.controller.request(1, 500);
  assert.deepEqual(next.before, next.after);
  assert.equal(f.factory.instances[1].initial, before.lastWrittenWidth);
  f.controller.finish();
  await f.controller.settle();
  assert.equal(f.d, 'width:1');
  await f.controller.cleanup();
});

test('invalid target refusals preserve playback while a lost binding revokes its writer', async () => {
  const f = fixture();
  f.controller.request(0.8, 800);
  f.controller.pause();
  f.controller.seek(280);
  const before = f.controller.read();
  const old = f.factory.instances[0];
  for (const target of [0.79, 1.01, Number.NaN, null]) {
    assert.equal(f.controller.request(target, 300).ok, false);
    assert.deepEqual(f.controller.read(), before);
    assert.equal(old.control.state, 'paused');
    assert.equal(old.disposed, false);
  }
  f.valid = false;
  assert.equal(f.controller.request(0.9, 300).reason.code, 'RENDER_CORRESPONDENCE_MISMATCH');
  assert.equal(old.control.state, 'stopped');
  assert.equal(old.disposed, true);
  assert.equal(f.controller.read().lastError, 'RENDER_CORRESPONDENCE_MISMATCH');
  assert.equal(f.factory.instances.length, 1);
  f.valid = true;
  old.stale(0.8);
  assert.equal(f.controller.read().d, before.d);
  await assert.rejects(f.controller.settle(), /RENDER_CORRESPONDENCE_MISMATCH/);
  const successor = f.controller.request(0.92, 500);
  assert.equal(successor.from, before.lastWrittenWidth);
  f.controller.finish();
  await f.controller.settle();
  const cleanup = await f.controller.cleanup();
  assert.deepEqual(cleanup.failures, ['RENDER_CORRESPONDENCE_MISMATCH']);
});

test('single writer rejects stale callbacks across reverse, newer target and rapid latest-wins', async () => {
  const f = fixture();
  f.controller.request(0.8, 800);
  const old = f.factory.instances[0];
  f.controller.seek(280);
  const reverse = f.controller.request(1, 800);
  assert.deepEqual(reverse.before, reverse.after);
  const before = f.controller.read();
  old.stale(0.81);
  assert.equal(f.controller.read().d, before.d);
  assert.equal(f.controller.read().writes, before.writes);
  f.controller.seek(200);
  const newer = f.controller.request(0.92, 300);
  assert.deepEqual(newer.before, newer.after);
  for (const target of [1, 0.8, 0.95, 0.84, 0.92]) f.controller.request(target, 300);
  for (const instance of f.factory.instances.slice(0, -1)) instance.stale(0.8);
  assert.equal(f.factory.instances.filter((instance) => !instance.disposed).length, 1);
  f.controller.finish();
  await f.controller.settle();
  assert.equal(f.d, 'width:0.92');
  assert.ok(f.controller.read().stale > 0);
  assert.equal(f.factory.instances.filter((instance) => !instance.disposed).length, 0);
  const disposal = await f.controller.cleanup();
  assert.ok(disposal.statuses.length <= 2);
  assert.equal(f.media.listeners.size, 0);
  const writes = f.writes;
  for (const instance of f.factory.instances) instance.stale(1);
  assert.equal(f.writes, writes);
  assert.throws(() => f.controller.request(1), /WIDTH_MOTION_DISPOSED/);
});

test('reduced admission and live preference finish the target synchronously and remove listener', async () => {
  const f = fixture();
  f.media.matches = true;
  const reduced = f.controller.request(0.8, 800);
  assert.equal(reduced.after.width, 0.8);
  assert.equal(f.d, 'width:0.8');
  await f.controller.settle();
  f.media.matches = false;
  f.controller.request(1, 800);
  f.controller.pause();
  f.controller.seek(280);
  f.media.change(true);
  assert.equal(f.d, 'width:1');
  await f.controller.settle();
  assert.equal(f.factory.instances.at(-1).control.state, 'finished');
  const disposal = await f.controller.cleanup();
  assert.equal(f.media.listeners.size, 0);
  const writes = f.writes;
  f.media.change(false);
  f.media.change(true);
  assert.equal(f.writes, writes);
  assert.equal(disposal.disposed, true);
});

test('pause seek stop and teardown conserve visible geometry without claiming stopped as finished', async () => {
  const f = fixture();
  f.controller.request(0.8, 800);
  f.controller.pause();
  f.controller.seek(280);
  const before = f.controller.read();
  f.controller.stop();
  assert.equal(f.controller.read().d, before.d);
  f.factory.instances[0].stale(0.81);
  assert.equal(f.controller.read().d, before.d, 'late callback после stop не имеет writer');
  await assert.rejects(f.controller.settle(), /WIDTH_MOTION_STOPPED/);
  const previous = f.factory.instances[0];
  f.controller.request(1, 800);
  const disposal = await f.controller.cleanup();
  assert.ok(disposal.statuses.includes('stopped'));
  const writes = f.writes;
  previous.stale(0.84);
  assert.equal(f.writes, writes);
});

test('terminal playback cannot publish an endpoint through finish or a later reduced preference', async () => {
  const f = fixture();
  f.controller.request(0.8, 800);
  f.controller.pause();
  f.controller.seek(280);
  f.controller.stop();
  await assert.rejects(f.controller.settle(), /WIDTH_MOTION_STOPPED/);
  const stopped = f.controller.read();
  for (const action of [
    () => f.media.change(true),
    () => f.controller.finish(),
    () => f.media.change(false),
    () => f.media.change(true),
    () => f.controller.stop(),
  ]) {
    action();
    assert.deepEqual(f.controller.read(), stopped);
  }
  assert.equal(f.factory.instances[0].control.state, 'stopped');
  const newer = f.controller.request(1, 800);
  assert.equal(newer.before.width, stopped.lastWrittenWidth);
  await f.controller.settle();
  assert.equal(f.d, 'width:1');
  const finished = f.controller.read();
  f.media.change(true);
  f.controller.finish();
  assert.deepEqual(f.controller.read(), finished);
  await f.controller.cleanup();
});

test('finish closes the old writer so a queued intermediate callback cannot replace the endpoint', async () => {
  const f = fixture();
  f.controller.request(0.8, 800);
  const old = f.factory.instances[0];
  f.controller.seek(280);
  f.controller.finish();
  await f.controller.settle();
  old.stale(0.91);
  assert.equal(f.d, 'width:0.8');
  assert.equal(f.controller.read().lastWrittenWidth, 0.8);
  await f.controller.cleanup();
});

test('rejected playback stays observable while cleanup owns every completion rejection', async () => {
  const f = fixture();
  const unhandled = [];
  const onUnhandled = (error) => unhandled.push(error);
  process.on('unhandledRejection', onUnhandled);
  try {
    f.controller.request(0.8, 800);
    f.controller.seek(280);
    const before = f.controller.read();
    f.rejectWrite = true;
    assert.throws(() => f.controller.seek(400), /WRITE_REJECTED/);
    await assert.rejects(f.controller.settle(), /WRITE_REJECTED/);
    const failed = f.controller.read();
    assert.equal(failed.lastCompletion, 'failed');
    assert.equal(failed.lastError, 'WRITE_REJECTED');
    assert.equal(failed.lastWrittenWidth, before.lastWrittenWidth);
    assert.equal(failed.d, before.d);
    f.media.change(true);
    assert.deepEqual(f.controller.read(), failed);
    const disposal = await f.controller.cleanup();
    assert.deepEqual(disposal.statuses, ['failed']);
    assert.deepEqual(disposal.failures, ['WRITE_REJECTED']);
    assert.equal(disposal.disposed, true);
    assert.equal(f.media.listeners.size, 0);
    assert.equal(f.factory.instances[0].disposed, true);
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(unhandled, []);
  } finally {
    process.removeListener('unhandledRejection', onUnhandled);
    await f.controller.cleanup();
  }
});

test('cleanup preserves a retired failure while a newer request keeps its own completion state', async () => {
  const f = fixture();
  f.controller.request(0.8, 800);
  f.rejectWrite = true;
  assert.throws(() => f.controller.seek(280), /WRITE_REJECTED/);
  await assert.rejects(f.controller.settle(), /WRITE_REJECTED/);
  f.rejectWrite = false;
  const newer = f.controller.request(0.92, 800);
  assert.equal(newer.from, 1);
  assert.equal(f.controller.read().lastCompletion, null);
  assert.equal(f.controller.read().lastError, null);
  const disposal = await f.controller.cleanup();
  assert.deepEqual(disposal.statuses, ['failed', 'stopped']);
  assert.deepEqual(disposal.failures, ['WRITE_REJECTED']);
  assert.equal(f.media.listeners.size, 0);
});

test('mounted width cleanup removes its nodes even after a rejected Motion completion', async () => {
  const f = fixture();
  const target = {
    isConnected: true,
    getAttribute: () => f.binding.read(),
    setAttribute: (_name, d) => f.binding.write(d),
  };
  const svg = { querySelectorAll: () => [target] };
  const host = {
    innerHTML: '',
    querySelector: () => svg,
    replaceChildren() {
      target.isConnected = false;
    },
  };
  const previousMedia = Object.getOwnPropertyDescriptor(globalThis, 'matchMedia');
  Object.defineProperty(globalThis, 'matchMedia', { configurable: true, value: () => f.media });
  try {
    const workload = mountWidthWorkload(
      host,
      () => ({
        ok: true,
        prepared: {
          ...f.prepared,
          svg: '<svg><path /></svg>',
          renderTarget: { selector: 'path', attribute: 'd' },
        },
      }),
      f.value,
    );
    workload.controller.request(0.8, 800);
    f.rejectWrite = true;
    assert.throws(() => workload.controller.seek(280), /WRITE_REJECTED/);
    await assert.rejects(workload.controller.settle(), /WRITE_REJECTED/);
    const disposal = await workload.cleanup();
    assert.deepEqual(disposal.failures, ['WRITE_REJECTED']);
    assert.equal(target.isConnected, false);
    await f.controller.cleanup();
    assert.equal(f.media.listeners.size, 0);
  } finally {
    if (previousMedia) Object.defineProperty(globalThis, 'matchMedia', previousMedia);
    else Reflect.deleteProperty(globalThis, 'matchMedia');
  }
});

function deferredWidthMount() {
  const elements = [];
  const updates = [];
  class Element {
    constructor(tag) {
      this.tag = tag;
      this.children = [];
      this.attributes = new Map();
      this.listeners = new Map();
      this.dataset = {};
      this.style = {};
      elements.push(this);
      if (tag === 'lab-button') {
        const native = new Element('button');
        this.shadowRoot = { querySelector: () => native };
        this.updateComplete = new Promise((resolve) => updates.push(resolve));
      }
    }
    get isConnected() {
      return this.tag === 'body' || Boolean(this.parent?.isConnected);
    }
    setAttribute(name, value) {
      this.attributes.set(name, value);
    }
    getAttribute(name) {
      return this.attributes.get(name) ?? null;
    }
    append(...children) {
      for (const child of children) {
        child.parent = this;
        this.children.push(child);
      }
    }
    remove() {
      this.parent.children = this.parent.children.filter((child) => child !== this);
      this.parent = null;
    }
    set innerHTML(_svg) {
      const svg = new Element('svg');
      const path = new Element('path');
      path.setAttribute('d', 'width:1');
      svg.append(path);
      this.append(svg);
    }
    querySelectorAll(selector) {
      const descendants = this.children.flatMap((child) => [child, ...child.querySelectorAll('*')]);
      return selector === '*' ? descendants : descendants.filter((child) => child.tag === selector);
    }
    querySelector(selector) {
      return this.querySelectorAll(selector)[0];
    }
    addEventListener(event, handler) {
      const handlers = this.listeners.get(event) ?? new Set();
      handlers.add(handler);
      this.listeners.set(event, handlers);
    }
    removeEventListener(event, handler) {
      this.listeners.get(event)?.delete(handler);
    }
    dispatchEvent(event) {
      for (const handler of this.listeners.get(event.type) ?? []) handler(event);
    }
  }
  const body = new Element('body');
  const mediaListeners = new Set();
  const media = {
    matches: false,
    addEventListener: (_event, handler) => mediaListeners.add(handler),
    removeEventListener: (_event, handler) => mediaListeners.delete(handler),
  };
  const saved = ['document', 'matchMedia', 'MouseEvent'].map((name) => [
    name,
    Object.getOwnPropertyDescriptor(globalThis, name),
  ]);
  const globals = {
    document: { body, createElement: (tag) => new Element(tag) },
    matchMedia: () => media,
    MouseEvent: class {
      constructor(type) {
        this.type = type;
      }
    },
  };
  for (const [name, value] of Object.entries(globals))
    Object.defineProperty(globalThis, name, { configurable: true, value });
  const apis = ['mic', 'mic-circle'].map((icon) => ({
    prepareBodyWidth: () => ({
      ok: true,
      prepared: {
        icon,
        svg: '<svg><path /></svg>',
        renderTarget: { selector: 'path' },
        sample: () => ({ ok: true, d: 'width:1' }),
      },
    }),
    motionCapabilities: () => ({ ok: true, capabilities: {} }),
  }));
  const consumer = mountWidthMotionConsumer(apis, [], [], () => {
    throw new Error('Readiness проверка не запускает анимацию');
  });
  return {
    consumer,
    mediaListeners,
    updates,
    nativeButtons: elements
      .filter((element) => element.tag === 'lab-button')
      .map((element) => element.shadowRoot.querySelector('button')),
    listenerCount: () =>
      elements.reduce(
        (count, element) =>
          count + [...element.listeners.values()].reduce((sum, handlers) => sum + handlers.size, 0),
        0,
      ),
    restore: () => {
      for (const [name, descriptor] of saved)
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else Reflect.deleteProperty(globalThis, name);
    },
  };
}

test('mounted readiness owns native listeners until cleanup and cannot revive them afterward', async () => {
  for (const order of ['ready-first', 'cleanup-first', 'partially-ready', 'cleanup-pending']) {
    const mounted = deferredWidthMount();
    try {
      assert.equal(mounted.nativeButtons.length, 12);
      if (order === 'ready-first') {
        for (const update of mounted.updates) update();
        await mounted.consumer.ready;
        assert.ok(
          mounted.nativeButtons.every((button) => button.listeners.get('click').size === 1),
        );
      } else if (order === 'partially-ready') {
        for (const update of mounted.updates.slice(0, 6)) update();
        await Promise.resolve();
        assert.equal(
          mounted.nativeButtons.filter((button) => button.listeners.get('click')?.size === 1)
            .length,
          6,
        );
      }
      const cleanup = mounted.consumer.cleanup();
      if (order === 'cleanup-pending') for (const update of mounted.updates) update();
      const disposal = await cleanup;
      assert.equal(disposal.connected, false);
      assert.equal(disposal.listenersRemoved, true);
      assert.equal(mounted.listenerCount(), 0);
      for (const update of mounted.updates) update();
      await mounted.consumer.ready;
      assert.equal(mounted.listenerCount(), 0, order);
      assert.equal(mounted.mediaListeners.size, 0);
    } finally {
      mounted.restore();
    }
  }
});

test('width capture owns its section when another consumer shares the layout class', async () => {
  const mounted = deferredWidthMount();
  try {
    const widthSection = document.body.querySelector('section');
    const sibling = document.createElement('section');
    sibling.className = 'clock-motion width-motion';
    sibling.setAttribute('aria-labelledby', 'clock-motion-heading');
    document.body.append(sibling);
    let selector;
    const captured = new Error('LOCATOR_CAPTURED');
    await assert.rejects(
      widthMotionBrowserProof(
        {
          locator(query) {
            selector = query;
            throw captured;
          },
        },
        undefined,
        'reduce',
        [],
        '',
      ),
      (error) => error === captured,
    );
    const match = selector.match(/^section(?:\.([\w-]+))?(?:\[aria-labelledby="([^"]+)"\])?$/);
    assert.ok(match, 'section selector is supported by the boundary witness');
    const selected = document.body
      .querySelectorAll('section')
      .filter(
        (section) =>
          (!match[1] || section.className.split(/\s+/).includes(match[1])) &&
          (!match[2] || section.getAttribute('aria-labelledby') === match[2]),
      );
    assert.equal(selected.length, 1, 'capture selects exactly its owned section');
    assert.equal(selected[0], widthSection);
  } finally {
    await mounted.consumer.cleanup();
    mounted.restore();
  }
});

test('schema12 reuses the bound raw oracle, retains old consumers and publishes no fake effect adapter', async () => {
  const raw = { icons: { mic: { outline: { paths: [{ d: 'raw' }] } } }, source: 'immutable' };
  const reference = widthMotionReference(raw);
  validateWidthMotionReference(reference, raw);
  assert.throws(() => validateWidthMotionReference(reference, { ...raw, source: 'edited' }));
  assert.deepEqual(consumerPublicEntries(12), [
    ...consumerPublicEntries(11),
    ...WIDTH_MOTION_ENTRIES,
  ]);
  for (const entry of WIDTH_MOTION_ENTRIES) {
    assertIconsImport(entry);
    assert.ok(consumerFixture(12).includes(entry));
  }
  assert.ok(!consumerFixture(11).includes('createBodyWidthController'));
  assert.ok(ICONS_HARNESS_FILES.includes('apps/docs/tests/icons-width-motion-consumer.mjs'));
  assert.doesNotThrow(() => new Function(consumerFixture(12).replace(/^import .*?;\s*$/gm, '')));
  assert.equal((widthMotionTypeFixture().match(/@ts-expect-error/g) ?? []).length, 3);
  assert.ok(!widthMotionFixture().includes('compileMotionEffect'));
  const code = await readFile(
    new URL('./icons-width-motion-consumer.mjs', import.meta.url),
    'utf8',
  );
  assert.ok(!code.includes('requestAnimationFrame(() =>'));
});

test('byte experiments include public Motion and identical controller lifecycle for each useful baseline', () => {
  const scenarios = widthMotionMeasurementFixtures();
  assert.equal(scenarios.length, 4);
  for (const scenario of scenarios) {
    assert.ok(scenario.source.includes("from '@labpics/motion'"));
    assert.ok(scenario.source.includes('createBodyWidthController'));
    assert.ok(scenario.source.includes('mountWidthWorkload'));
    assert.doesNotThrow(
      () =>
        new Function(scenario.source.replace(/^import .*?;\s*$/gm, '').replace(/^export /gm, '')),
    );
    if (scenario.key.endsWith('prepared')) {
      assert.ok(scenario.source.includes('api.prepareBodyWidth'));
      assert.ok(!scenario.source.includes('api.glyph('));
    } else {
      assert.match(
        scenario.source,
        /api\.glyph\(\{\s*variant,\s*variation:\s*\{\s*bodyWidth:\s*width\s*\}\s*\}\)/,
      );
    }
  }
});

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const snapshot = JSON.parse(
  await readFile(new URL('./fixtures/icons-microphone-masters.json', import.meta.url)),
);
function rawReference() {
  return {
    icons: Object.fromEntries(
      ['mic', 'mic-circle'].map((icon) => [
        icon,
        Object.fromEntries(
          ['outline', 'filled'].map((variant) => {
            const record = snapshot.manifest.icons[icon][variant];
            const paths = readAuthorMaster(Buffer.from(snapshot.masters[record.master]));
            return [
              variant,
              {
                ...paths,
                declaration: snapshot.semantic.icons[icon][variant],
                author: {
                  kind: 'figma',
                  fileKey: snapshot.manifest.source.fileKey,
                  version: snapshot.manifest.source.version,
                  nodeId: record.nodeId,
                  nodeSha256: record.nodeSha256,
                  masterSha256: record.sha256,
                  normalizedSha256: record.normalizedSource.sha256,
                  pathFingerprintSha256: record.normalizedSource.pathFingerprintSha256,
                },
              },
            ];
          }),
        ),
      ]),
    ),
  };
}
function independentlyNarrowed(raw, width) {
  if (width === 1) return structuredClone(raw.paths);
  const parts = rawMicrophoneParts(raw);
  const body = parts.find((part) => part.id === 'microphone-body');
  const contours = body.d.split(/(?=M)/).filter(Boolean).map(rawContentPath);
  const bounds = (contour) => {
    const xs = contour.flatMap((segment) => segment.points.map((point) => point[0]));
    return [Math.min(...xs), Math.max(...xs)];
  };
  const [outerLow, outerHigh] = bounds(contours[0]);
  body.d = contours
    .map((contour) => {
      const [low, high] = bounds(contour);
      const center = (low + high) / 2;
      const span = high - low - (outerHigh - outerLow) * (1 - width);
      return contour
        .map(
          ({ command, points }) =>
            command +
            points
              .flatMap(([x, y]) => [center + ((x - center) * span) / (high - low), y])
              .join(' '),
        )
        .join('');
    })
    .join('');
  return raw.declaration.composition
    ? [{ d: parts.map((part) => part.d).join(''), fillRule: 'evenodd' }]
    : parts.map(({ d, fillRule }) => ({ d, fillRule }));
}
function captureEntry(raw, icon, variant, width) {
  const source = raw.icons[icon][variant];
  const geometrySha256 = 'a'.repeat(64);
  const domain = { minimum: 0.8, maximum: 1 };
  return {
    icon,
    variant,
    lastWrittenWidth: width,
    capability: {
      law: 'capsule.width',
      formats: ['svg', 'prepared-width'],
      author: source.author,
      geometrySha256,
      domain,
      anatomy: {
        masterSha256: source.author.masterSha256,
        pathFingerprintSha256: source.author.pathFingerprintSha256,
      },
    },
    staticCapability: { geometrySha256, domain },
    renderTarget: {
      attribute: 'd',
      partId: 'microphone-body',
      selector: source.declaration.composition
        ? `[data-parts="${source.declaration.parts.map((part) => part.id).join(' ')}"]`
        : '[data-part="microphone-body"]',
      unchangedPartIds: source.declaration.parts
        .filter((part) => part.id !== 'microphone-body')
        .map((part) => part.id),
    },
    samples: [16, 24, 48].map((size) => ({
      size,
      width: size,
      height: size,
      viewBox: source.viewBox,
      identity: true,
      peersUnchanged: true,
      target: { width: 48, height: 48 },
      name: 'Микрофон',
      hidden: 'true',
      focusable: 'false',
      paths: independentlyNarrowed(source, width),
    })),
  };
}
test('capture binds actual raw geometry, all variants and sizes to exact width and bytes', () => {
  const raw = rawReference();
  const visuals = WIDTH_MOTION_VISUAL_FILES.map((path) => ({ path, bytes: Buffer.from(path) }));
  const records = ['no-preference', 'reduce'].flatMap((mode) =>
    WIDTH_MOTION_POSES.map((width) => {
      const file = `result/${mode}-width-motion-${width}.png`;
      return {
        name: `${mode}:width-motion-${width}:capture`,
        result: 'PASS',
        file,
        width,
        pngSha256: hash(Buffer.from(file)),
        entries: ['mic', 'mic-circle'].flatMap((icon) =>
          ['outline', 'filled'].map((variant) => captureEntry(raw, icon, variant, width)),
        ),
      };
    }),
  );
  assertWidthMotionVisualEvidence(visuals, records, raw);
  for (const sabotage of [
    (changed) => {
      changed[1].entries[0].samples[0].paths = raw.icons.mic.outline.paths;
    },
    (changed) => {
      changed[1].entries[3].samples[0].paths[0].fillRule = 'nonzero';
    },
    (changed) => {
      changed[0].entries[0].samples.pop();
    },
    (changed) => {
      changed[0].entries[1] = changed[0].entries[0];
    },
    (changed) => {
      changed[0].pngSha256 = 'b'.repeat(64);
    },
    (changed) => {
      changed[0].entries[0].samples[0].viewBox = [0, 0, 48, 48];
    },
  ]) {
    const changed = structuredClone(records);
    sabotage(changed);
    assert.throws(() => assertWidthMotionVisualEvidence(visuals, changed, raw));
  }
  assert.throws(() => assertWidthMotionVisualEvidence(visuals.slice(1), records, raw));
});
