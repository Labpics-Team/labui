import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  CLOCK_MOTION_ENTRIES, CLOCK_MOTION_VISUAL_FILES, assertClockEntry,
  assertClockQuarterControls, clockMotionFixture, clockMotionTypeFixture,
  createClockHandsController, rawClockControls, validateClockMotionReference,
} from './icons-clock-motion-consumer.mjs';
import { ICONS_HARNESS_FILES } from './icons-harness.mjs';
import { assertIconsImport, consumerFixture, consumerPublicEntries } from './icons-packed.mjs';

const raw = JSON.parse(await readFile(new URL('./fixtures/icons-clock-masters.json', import.meta.url)));

function motionFixture() {
  let valid = true;
  const targets = ['rest', 'rest', 'rest'];
  const instances = [];
  const listeners = new Set();
  const media = { matches: false,
    addEventListener: (_type, callback) => listeners.add(callback),
    removeEventListener: (_type, callback) => listeners.delete(callback),
    change(matches) { this.matches = matches; for (const callback of listeners) callback({ matches }); },
  };
  const prepared = { sample: (hours) => typeof hours === 'number' && Number.isFinite(hours)
    ? { ok: true, elapsedHours: hours, d: hours % 12 === 0 ? 'rest' : `hours:${hours}` }
    : { ok: false, reason: { code: 'INVALID_REQUEST' } } };
  const value = (initial) => {
    let callback;
    let captured;
    let playback;
    const scalar = { initial, disposed: false,
      subscribe(listener) { callback = listener; captured = listener; return () => { callback = undefined; }; },
      stale(next) { captured?.(next); },
      animate(target, options) {
        assert.equal(options.ease, 'linear');
        let done;
        let fail;
        const finished = new Promise((resolve, reject) => { done = resolve; fail = reject; });
        playback = { state: 'running', finished,
          pause() { this.state = 'paused'; }, play() { this.state = 'running'; },
          seek(ms) {
            try { callback?.(initial + (target - initial) * ms / options.duration); }
            catch (error) { this.state = 'failed'; fail(error); throw error; }
          },
          stop() { if (['running', 'paused'].includes(this.state)) { this.state = 'stopped'; done({ status: 'stopped' }); } },
          finish() { if (['running', 'paused'].includes(this.state)) { callback?.(target); this.state = 'finished'; done({ status: 'finished' }); } },
        };
        void finished.catch(() => {});
        if (options.duration === 0) playback.finish();
        return playback;
      },
      dispose() { this.disposed = true; callback = undefined; playback?.stop(); },
    };
    instances.push(scalar);
    return scalar;
  };
  const controller = createClockHandsController(prepared, {
    read: () => targets[0],
    write: (next) => { for (let index = 0; index < targets.length; index++) targets[index] = next; },
    valid: (expected) => valid && targets.every((d) => d === expected),
  }, value, media);
  return { controller, media, instances, listeners, targets, get d() { return targets[0]; }, set valid(next) { valid = next; } };
}

test('clock parameter conserves authored zero, unwrapped twelve hours and negative reverse through one writer', async () => {
  const f = motionFixture();
  assert.equal(f.controller.read().lastWrittenHours, 0);
  f.controller.request(1, 800); f.controller.pause(); f.controller.seek(300);
  assert.equal(f.controller.read().lastWrittenHours, 0.375);
  const before = f.controller.read();
  const old = f.instances[0];
  const reverse = f.controller.request(-1, 800);
  assert.deepEqual(reverse.before, reverse.after);
  assert.equal(reverse.from, before.lastWrittenHours);
  assert.equal(f.instances[1].initial, before.lastWrittenHours);
  old.stale(0.875);
  assert.equal(f.controller.read().d, before.d);
  f.controller.finish(); await f.controller.settle();
  assert.equal(f.d, 'hours:-1');
  const receipt = f.controller.request(12, 0); await f.controller.settle();
  assert.equal(receipt.after.hours, 12); assert.equal(f.controller.read().lastWrittenHours, 12);
  assert.equal(f.d, 'rest', 'геометрический период не сворачивает состояние приложения');
  const disposal = await f.controller.cleanup();
  assert.equal(disposal.lastWrittenHours, 12); assert.equal(f.listeners.size, 0);
  for (const scalar of f.instances) scalar.stale(3);
  assert.equal(f.d, 'rest');
  assert.throws(() => f.controller.request(0), /CLOCK_MOTION_DISPOSED/);
});

test('clock invalid parameters preserve valid playback while correspondence loss revokes it', async () => {
  const f = motionFixture();
  f.controller.request(1, 800); f.controller.pause(); f.controller.seek(300);
  const before = f.controller.read();
  for (const value of [Number.NaN, Number.POSITIVE_INFINITY, '1', null, {}]) {
    assert.equal(f.controller.request(value).reason.code, 'INVALID_REQUEST');
    assert.deepEqual(f.controller.read(), before);
  }
  f.valid = false;
  assert.equal(f.controller.request(-1).reason.code, 'RENDER_CORRESPONDENCE_MISMATCH');
  assert.equal(f.instances[0].disposed, true);
  await assert.rejects(f.controller.settle(), /RENDER_CORRESPONDENCE_MISMATCH/);
  f.valid = true; f.media.change(true); f.controller.request(1, 0); await f.controller.settle();
  assert.equal(f.d, 'hours:1');
  const writes = f.controller.read().writes;
  f.instances[0].stale(0.5);
  assert.equal(f.controller.read().writes, writes);
  await f.controller.cleanup();
});

test('foreign target mutation after admission refuses a frame without publishing the visible frontier', async () => {
  for (const index of [1, 2]) {
    const f = motionFixture();
    f.controller.request(1, 800); f.controller.pause();
    const before = f.controller.read();
    f.targets[index] = 'foreign';
    const snapshot = [...f.targets];
    assert.throws(() => f.controller.seek(300), /RENDER_CORRESPONDENCE_MISMATCH/);
    assert.equal(f.controller.read().lastWrittenHours, before.lastWrittenHours);
    assert.equal(f.controller.read().d, before.d);
    assert.equal(f.controller.read().writes, before.writes);
    assert.deepEqual(f.targets, snapshot, 'до отказа ни один связанный target не изменяется');
    await assert.rejects(f.controller.settle(), /RENDER_CORRESPONDENCE_MISMATCH/);
    assert.equal(f.controller.read().lastError, 'RENDER_CORRESPONDENCE_MISMATCH');
    f.targets[index] = 'rest';
    f.instances[0].stale(0.75);
    assert.deepEqual(f.targets, ['rest', 'rest', 'rest'], 'старый callback утратил writer даже после восстановления target');
    const retarget = f.controller.request(-1, 800);
    assert.equal(retarget.from, 0);
    f.controller.finish(); await f.controller.settle();
    assert.deepEqual(f.targets, ['hours:-1', 'hours:-1', 'hours:-1']);
    const receipt = await f.controller.cleanup();
    assert.deepEqual(receipt.failures, ['RENDER_CORRESPONDENCE_MISMATCH']);
  }
});

test('finish, reduced preference and valid retarget admission revoke a mismatched writer and own its failure', async () => {
  for (const action of ['finish', 'preference', 'request']) for (const index of [1, 2]) {
    const f = motionFixture();
    f.controller.request(1, 800); f.controller.pause();
    const before = f.controller.read();
    f.targets[index] = 'foreign';
    const snapshot = [...f.targets];
    if (action === 'finish') assert.throws(() => f.controller.finish(), /RENDER_CORRESPONDENCE_MISMATCH/);
    else if (action === 'preference') assert.doesNotThrow(() => f.media.change(true));
    else assert.equal(f.controller.request(-1, 800).reason.code, 'RENDER_CORRESPONDENCE_MISMATCH');
    assert.equal(f.controller.read().lastError, 'RENDER_CORRESPONDENCE_MISMATCH');
    assert.equal(f.controller.read().lastCompletion, 'failed');
    assert.equal(f.controller.read().lastWrittenHours, before.lastWrittenHours);
    assert.equal(f.controller.read().writes, before.writes);
    assert.deepEqual(f.targets, snapshot);
    f.targets[index] = 'rest';
    f.instances[0].stale(0.5);
    assert.deepEqual(f.targets, ['rest', 'rest', 'rest']);
    await assert.rejects(f.controller.settle(), /RENDER_CORRESPONDENCE_MISMATCH/);
    const retarget = f.controller.request(-1, 0);
    assert.equal(retarget.from, 0); await f.controller.settle();
    assert.deepEqual(f.targets, ['hours:-1', 'hours:-1', 'hours:-1']);
    const cleanup = await f.controller.cleanup();
    assert.deepEqual(cleanup.failures, ['RENDER_CORRESPONDENCE_MISMATCH']);
    assert.equal(f.listeners.size, 0);
  }
});

test('already waiting settle retains correspondence cause through an immediate successful successor', async () => {
  for (const action of ['seek', 'finish', 'preference', 'request']) for (const index of [1, 2]) {
    const f = motionFixture();
    f.controller.request(1, 800); f.controller.pause();
    const pending = f.controller.settle().then(() => 'finished', (error) => error.message);
    f.targets[index] = 'foreign';
    if (action === 'seek') assert.throws(() => f.controller.seek(300), /RENDER_CORRESPONDENCE_MISMATCH/);
    else if (action === 'finish') assert.throws(() => f.controller.finish(), /RENDER_CORRESPONDENCE_MISMATCH/);
    else if (action === 'preference') f.media.change(true);
    else assert.equal(f.controller.request(-1, 800).reason.code, 'RENDER_CORRESPONDENCE_MISMATCH');
    f.targets[index] = 'rest';
    f.controller.request(-1, 0);
    assert.equal(await pending, 'RENDER_CORRESPONDENCE_MISMATCH');
    await f.controller.settle();
    assert.equal(f.controller.read().lastError, null);
    assert.deepEqual(f.targets, ['hours:-1', 'hours:-1', 'hours:-1']);
    const cleanup = await f.controller.cleanup();
    assert.deepEqual(cleanup.failures, ['RENDER_CORRESPONDENCE_MISMATCH']);
  }
});

test('reduced clock request commits signed endpoint synchronously and stopped motion never revives', async () => {
  const f = motionFixture();
  f.media.matches = true;
  const receipt = f.controller.request(-3, 800);
  assert.equal(receipt.after.hours, -3); await f.controller.settle();
  f.media.matches = false;
  f.controller.request(3, 800); f.controller.pause(); f.controller.seek(200); f.controller.stop();
  const stopped = f.controller.read();
  f.media.change(true); f.controller.finish(); f.instances.at(-1).stale(3);
  assert.equal(f.controller.read().d, stopped.d);
  await assert.rejects(f.controller.settle(), /CLOCK_MOTION_STOPPED/);
  await f.controller.cleanup();
});

test('independent raw oracle retains all four masters and derives off-canvas History bearing', () => {
  validateClockMotionReference(raw, raw);
  assert.deepEqual(rawClockControls(raw.icons.time.outline).bearing, [12, 12.0068]);
  assert.deepEqual(rawClockControls(raw.icons.history.outline).bearing, [11.9639, 13.1485]);
  assert.deepEqual(rawClockControls(raw.icons.history.filled).bearing, [12.0068, 12.96]);
  assert.notDeepEqual(raw.icons.time.outline.paths, raw.icons.time.filled.paths);
  assert.notDeepEqual(raw.icons.history.outline.paths, raw.icons.history.filled.paths);
  const changed = structuredClone(raw);
  changed.icons.history.filled.paths[0].d += 'M0 0L1 0Z';
  assert.throws(() => validateClockMotionReference(changed, raw));
});

function controlD(reference, hours, pivot, rates = [1, 1 / 12]) {
  const source = rawClockControls(reference);
  const bearing = pivot ?? source.bearing;
  return ['minute', 'hour'].map((limb, index) => {
    const p = source[limb];
    const x = p[0] - bearing[0];
    const y = p[1] - bearing[1];
    const angle = hours * rates[index] * Math.PI * 2;
    const rotated = [bearing[0] + x * Math.cos(angle) - y * Math.sin(angle), bearing[1] + x * Math.sin(angle) + y * Math.cos(angle)];
    return `M${rotated.join(' ')}L${rotated.join(' ')}Z`;
  }).join('');
}

test('orthogonal raw-tip oracle kills canvas pivot, shared rate and reversed rate without compiler expected shapes', () => {
  for (const reference of [raw.icons.time.outline, raw.icons.history.outline, raw.icons.history.filled])
    for (const hours of [-0.25, 0.25, -3, 3]) assertClockQuarterControls(controlD(reference, hours), reference, hours);
  const reference = raw.icons.history.outline;
  assert.throws(() => assertClockQuarterControls(controlD(reference, 0.25, [12, 12]), reference, 0.25), /authored pivot/);
  assert.throws(() => assertClockQuarterControls(controlD(reference, 0.25, undefined, [1 / 12, 1 / 12]), reference, 0.25), /minute rate/);
  assert.throws(() => assertClockQuarterControls(controlD(reference, 3, undefined, [1, 1]), reference, 3), /hour rate/);
  assert.throws(() => assertClockQuarterControls(controlD(reference, -0.25, undefined, [-1, -1 / 12]), reference, -0.25), /minute rate/);
});

test('schema15 packed closure keeps earlier consumers, public imports and the shared scalar executor', () => {
  const old = consumerPublicEntries(14);
  const entries = consumerPublicEntries(15);
  assert.deepEqual(entries.filter((entry) => !old.includes(entry)), CLOCK_MOTION_ENTRIES);
  for (const entry of CLOCK_MOTION_ENTRIES) assertIconsImport(entry);
  assert.ok(ICONS_HARNESS_FILES.includes('apps/docs/tests/icons-clock-motion-consumer.mjs'));
  assert.ok(!consumerFixture(14).includes('clockMotionConsumer'));
  const fixture = consumerFixture(15);
  assert.equal((fixture.match(/function createPreparedScalarController\(/g) ?? []).length, 1);
  assert.ok(fixture.includes(clockMotionFixture()));
  assert.match(fixture, /import \{value as clockValue\} from '@labpics\/motion'/);
  assert.match(fixture, /import \{filled as clockTimeFilled\} from '@labpics\/icons\/symbols\/time'/);
  assert.ok(!clockMotionFixture().includes('@labpics/icons/symbols/history'));
  assert.ok(!clockMotionFixture().includes('.glyph('));
  assert.match(fixture, /clockMotionConsumer\.cleanup\(\)/);
  assert.ok(CLOCK_MOTION_VISUAL_FILES.includes('result/no-preference-clock-interrupted.png'));
  assert.equal(CLOCK_MOTION_VISUAL_FILES.length, 9);
  assert.match(clockMotionTypeFixture(), /RejectsClockObject=ClockExpectTrue/);
});

test('unsupported Filled Time requires literal source geometry and no fabricated gesture capability', () => {
  const reference = raw.icons.time.filled;
  const sample = { size: 16, width: 16, height: 16, viewBox: reference.viewBox, identity: true,
    paths: reference.paths, hidden: 'true', focusable: 'false', slot: 'icon', name: 'Время', target: { width: 44, height: 44 } };
  const entry = { icon: 'time', variant: 'filled', supported: false, refusal: 'COMPOSITION_UNSUPPORTED',
    capability: null, renderTarget: null, lastWrittenHours: 0, samples: [16, 24, 48].map((size) => ({ ...sample, size, width: size, height: size })) };
  assertClockEntry(entry, raw);
  const changed = structuredClone(entry); changed.samples[0].paths[0].fillRule = 'nonzero';
  assert.throws(() => assertClockEntry(changed, raw));
});
