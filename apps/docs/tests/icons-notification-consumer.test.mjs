import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import test from 'node:test';
import { notificationReference, readAuthorMaster } from './prepare-icons-inputs.mjs';
import { consumerFixture, consumerPublicEntries, assertIconsImport, assertNotificationPose } from './icons-packed.mjs';
import {
  NOTIFICATION_ENTRIES, notificationPosition, rawNotificationClapperWidth,
  translationSequenceSteps, validateNotificationReference, assertNotificationEffect,
  notificationFixture,
} from './icons-notification-consumer.mjs';

const snapshot = JSON.parse(await readFile(new URL('./fixtures/icons-notification-masters.json', import.meta.url)));
const pin = { sourceCommit: snapshot.sourceCommit, figma: snapshot.annotations.source };
async function fixture(t, change = () => {}) {
  const parent = await realpath(tmpdir());
  const root = await mkdtemp(join(parent, 'labui-notification-'));
  t.after(async () => {
    const target = await realpath(root);
    assert.equal(dirname(target), parent);
    assert.ok(basename(target).startsWith('labui-notification-'));
    await rm(target, { recursive: true, force: true });
  });
  const data = structuredClone(snapshot);
  change(data);
  for (const [file, value] of Object.entries({
    'semantics/figma-baseline.json': JSON.stringify(data.manifest),
    'semantics/author-anatomy.json': JSON.stringify(data.annotations), ...data.masters,
  })) {
    await mkdir(dirname(join(root, file)), { recursive: true });
    await writeFile(join(root, file), value);
  }
  return root;
}

test('notification source reference admits four exact authored variants and two off controls', async t => {
  const root = await fixture(t);
  const reference = await notificationReference(root, pin);
  validateNotificationReference(reference, pin.figma);
  for (const icon of ['notifications', 'notifications-unread', 'notifications-off'])
    for (const [variant, item] of Object.entries(reference.icons[icon])) {
      const record = snapshot.manifest.icons[icon][variant];
      assert.equal(createHash('sha256').update(snapshot.masters[record.master]).digest('hex'), record.sha256);
      assert.equal(item.author.masterSha256, record.sha256);
      if (icon !== 'notifications-off') {
        assert.ok(item.amplitude > 0);
        assert.equal(item.parts.filter(part => part.id === 'notification-clapper').length, 1);
        assert.equal(item.unchangedPartIds.length, item.parts.length - 1);
      }
    }
});

for (const [name, mutation] of [
  ['raw master', data => { const path = data.manifest.icons.notifications.outline.master; data.masters[path] += ' '; }],
  ['source version', data => { data.annotations.source.version = '1'; }],
  ['muted semantics', data => { data.annotations.icons.notifications.filled.gesture.purpose = 'muted'; }],
  ['clapper identity', data => { data.annotations.icons.notifications.outline.parts[1].id = 'invented'; }],
  ['fixed role', data => { data.annotations.icons['notifications-unread'].filled.parts[1].role = 'content'; }],
  ['path order', data => { data.annotations.icons.notifications.outline.parts.reverse(); }],
  ['off annotation', data => { data.annotations.icons['notifications-off'] = data.annotations.icons.notifications; }],
]) test(`notification raw reference refuses changed ${name}`, async t => {
  await assert.rejects(notificationReference(await fixture(t, mutation), pin));
});

test('raw cubic width oracle finds interior extrema instead of the control-point box', () => {
  const curve = 'M0 0C4 0 4 1 0 1C0 1 0 2 0 2C0 2 0 3 0 3C0 3 0 4 0 4C0 4 0 5 0 5C0 5 0 0 0 0H0Z';
  assert.equal(rawNotificationClapperWidth(curve), 3);
  assert.throws(() => rawNotificationClapperWidth('M0 0L1 0L1 1Z'));
});

test('equal visible coordinates retain distinct reverse phase routes', () => {
  assert.equal(notificationPosition(2, 0.1), notificationPosition(2, 0.25));
  assert.notEqual(notificationPosition(2, 0.2), notificationPosition(2, 0.6));
});

test('generic translation stages read the explicit visible start once and retain subsequent targets', () => {
  const element = {};
  const target = { partId: 'clapper', property: 'x', unit: 'viewBox', from: 0, to: 0 };
  const effect = { version: 3, targets: [target], unchangedPartIds: ['bell'], options: { duration: 600, easing: 'linear' },
    stages: [1, -1, 0].map((to, index) => ({ ...target, to, at: index * 200, duration: 200 })) };
  const steps = translationSequenceSteps(effect, new Map([['clapper', element]]), new Map([['clapper:x', 0.37]]));
  assert.deepEqual(steps, [
    [element, { x: [0.37, 1] }, { at: 0, duration: 200, ease: 'linear' }],
    [element, { x: -1 }, { at: 200, duration: 200, ease: 'linear' }],
    [element, { x: 0 }, { at: 400, duration: 200, ease: 'linear' }],
  ]);
  for (const mutate of [
    value => { value.targets[0].unit = 'px'; },
    value => { value.unchangedPartIds.push('clapper'); },
    value => { value.stages[0].partId = 'missing'; },
    value => { value.stages[0].duration = -1; },
    value => { value.targets.push({ ...value.targets[0] }); },
    value => { value.targets.push({ ...value.targets[0], property: 'y' }); },
    value => { value.stages[1].at = 100; },
  ]) {
    const bad = structuredClone(effect); mutate(bad);
    assert.throws(() => translationSequenceSteps(bad, new Map([['clapper', element]]), new Map([['clapper:x', 0.37]])));
  }
  assert.throws(() => translationSequenceSteps(effect, new Map([['clapper', element]]), new Map()));
});

test('notification effect oracle refuses a missing interior stop despite identical terminal position', () => {
  const expected = { amplitude: 1, unchangedPartIds: ['bell'] };
  const effect = { version: 3, icon: 'notifications', variant: 'outline', gesture: 'notifications.ring', from: 0, to: 1,
    options: { duration: 1000, easing: 'linear', fill: 'both' }, viewport: { overflow: 'visible' }, unchangedPartIds: ['bell'],
    targets: [{ partId: 'notification-clapper', property: 'x', unit: 'viewBox', from: 0, to: 0 }],
    stages: [1, -1, 0.5, -0.5, 0].map((to, index) => ({ partId: 'notification-clapper', property: 'x', unit: 'viewBox', to, at: index * 200, duration: 200 })) };
  assertNotificationEffect(effect, expected, 'notifications', 'outline', 0, 1, 1000);
  effect.stages.splice(2, 1);
  assert.throws(() => assertNotificationEffect(effect, expected, 'notifications', 'outline', 0, 1, 1000));
});

test('schema4 requires every actual notification public entry while keeping prior scenarios', () => {
  const entries = consumerPublicEntries(4);
  for (const entry of consumerPublicEntries(3)) assert.ok(entries.includes(entry));
  for (const entry of NOTIFICATION_ENTRIES) {
    assert.ok(entries.includes(entry));
    assert.doesNotThrow(() => assertIconsImport(entry));
  }
});

test('schema4 fixture mounts notifications through shared public translation execution', () => {
  const fixture = consumerFixture(4);
  for (const entry of NOTIFICATION_ENTRIES) assert.ok(fixture.includes(entry));
  assert.match(fixture, /function mountNotificationConsumer/);
  assert.match(fixture, /translationSequenceSteps/);
  assert.match(fixture, /notificationConsumers/);
  assert.match(fixture, /mountStateConsumer/);
});

test('emitted schema4 consumer is valid module syntax without installing or running it', async t => {
  const root = await fixture(t);
  const file = join(root, 'consumer.mjs');
  await writeFile(file, consumerFixture(4));
  execFileSync(process.execPath, ['--check', file], { encoding: 'utf8', timeout: 5000 });
});

function notificationRefuseWitness(renderGlyph = model => model.svg, emitted = notificationFixture()) {
  const start = emitted.indexOf('function mountNotificationConsumer(');
  const end = emitted.indexOf('\nconst notificationSection');
  assert.ok(start >= 0 && end > start);
  // Узкий host исполняет mounting/refuse; layout, ввод и motion принадлежат browser proof.
  const element = () => {
    const node = { style: {}, setAttribute() {}, addEventListener() {}, append() {},
      updateComplete: Promise.resolve(), querySelectorAll: () => [],
      shadowRoot: { querySelector: () => ({ addEventListener() {} }) } };
    node.querySelector = () => ({ ...element(), parentElement: node });
    return node;
  };
  const document = { createElement: element, createTextNode: text => ({ text }) };
  const ids = new Set();
  const offIds = [];
  const render = (model, options) => {
    const svg = renderGlyph(model, options);
    assert.match(options?.instanceId ?? '', /^[A-Za-z][A-Za-z0-9_-]{0,63}$/, 'public renderer requires instanceId');
    assert.equal(ids.has(options.instanceId), false, 'instanceId collides with another consumer');
    ids.add(options.instanceId);
    if (model.icon === 'notifications-off') offIds.push(options.instanceId);
    return svg;
  };
  const models = (icon, variant) => ({ icon, variant, svg: snapshot.masters[snapshot.manifest.icons[icon][variant].master] });
  const capabilities = (icon, variant) => ({ motion: { gestures: [{ id: `${icon}.ring`, partIds: ['notification-clapper'] }] } });
  const off = { glyph: ({ variant }) => models('notifications-off', variant), glyphCapabilities: variant => capabilities('notifications-off', variant) };
  const compile = model => ({ ok: false, reason: { code: model.icon === 'notifications-off' ? 'SEMANTIC_MOTION_UNAVAILABLE' : 'GESTURE_UNSUPPORTED' } });
  class Parser {
    parseFromString(svg) {
      const paths = readAuthorMaster(Buffer.from(svg)).paths;
      return { querySelectorAll: () => paths.map(path => ({ getAttribute: name => name === 'd' ? path.d : path.fillRule })) };
    }
  }
  const mount = new Function('document', 'renderGlyphSvg', 'compileSymbolEffect', 'notificationOff', 'DOMParser',
    `${emitted.slice(start, end)}\nreturn mountNotificationConsumer;`)(document, render, compile, off, Parser);
  for (const icon of ['notifications', 'notifications-unread'])
    for (const variant of ['outline', 'filled']) {
      const api = { glyph: ({ axes } = {}) => {
        if (axes) throw Object.assign(new Error('Unsupported axis'), { code: 'AUTHOR_PARITY_REQUIRED' });
        return models(icon, variant);
      }, glyphCapabilities: () => capabilities(icon, variant) };
      const refusal = mount(api, icon, variant, icon, element()).refuse();
      assert.equal(refusal.axis, 'AUTHOR_PARITY_REQUIRED');
      assert.equal(refusal.morph.reason.code, 'GESTURE_UNSUPPORTED');
      assert.equal(refusal.off.reason.code, 'SEMANTIC_MOTION_UNAVAILABLE');
      assert.deepEqual(refusal.offPaths, readAuthorMaster(Buffer.from(models('notifications-off', variant).svg)).paths);
    }
  assert.equal(offIds.length, 4);
  assert.equal(new Set(offIds).size, 4);
  return { consumers: 4, offIds };
}

test('actual notification refuse callback supplies unique renderer instances for all four consumers', () => {
  notificationRefuseWitness();
});

test('notification browser oracle rejects changed contours, fixed transforms, identity and incorrect phase', async t => {
  const expected = (await notificationReference(await fixture(t), pin)).icons['notifications-unread'].outline;
  const track = { partId: 'notification-clapper', kind: 'translate', axis: 'x', unit: 'viewBox', interpolation: 'linear',
    stops: [0, 1, -1, 0.5, -0.5, 0].map((value, index) => ({ at: index / 5, value: expected.amplitude * value })) };
  const gestures = [{ id: 'notifications-unread.ring', kind: 'cycle',
    meaning: 'Входящее уведомление: один затухающий горизонтальный цикл язычка; корпус и badge остаются неподвижными.',
    partIds: ['notification-clapper'], progress: 'normalized-0-to-1', restProgress: 0, tracks: [track] }];
  const stable = value => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
  const anatomy = { version: 1, annotationSha256: createHash('sha256').update(stable({ schemaVersion: 1,
    source: pin.figma, icon: 'notifications-unread', variant: 'outline', declaration: expected.declaration, gestures })).digest('hex'),
    masterSha256: expected.author.masterSha256, pathFingerprintSha256: expected.author.pathFingerprintSha256 };
  const observation = { icon: 'notifications-unread', variant: 'outline', composition: 'layers', identity: true,
    provenance: { kind: 'source', file: expected.sourceFile, author: expected.author, anatomy },
    capabilities: { author: expected.author, anatomy, supportedAxes: [], motion: { gestures } },
    parts: expected.parts, paths: expected.parts.map(({ d, fillRule, id, role }) => ({ d, fillRule, id, role })), viewBox: expected.viewBox,
    fixed: expected.unchangedPartIds.map(id => ({ id, count: 1, opacity: 1, identity: true, ancestorsUnchanged: true, matrix: [1, 0, 0, 1, 0, 0] })),
    pose: expected.parts.map(part => ({ partId: part.id, matrix: [1, 0, 0, 1, part.id === 'notification-clapper' ? expected.amplitude : 0, 0] })) };
  assertNotificationPose(observation, expected, 'notifications-unread', 'outline', 0.2);
  for (const mutate of [
    value => { value.paths[0].d += ' '; },
    value => { value.fixed[0].matrix[4] = 0.01; },
    value => { value.fixed[0].count = 2; },
    value => { value.fixed[0].opacity = 0.5; },
    value => { value.fixed[0].ancestorsUnchanged = false; },
    value => { value.fixed[0].identity = false; },
    value => { value.identity = false; },
    value => { value.pose.find(item => item.partId === 'notification-clapper').matrix[4] *= -1; },
    value => { value.capabilities.motion.gestures[0].tracks[0].stops.splice(2, 1); },
  ]) {
    const changed = structuredClone(observation); mutate(changed);
    assert.throws(() => assertNotificationPose(changed, expected, 'notifications-unread', 'outline', 0.2));
  }
});
