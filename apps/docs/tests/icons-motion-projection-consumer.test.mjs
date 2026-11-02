import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { ICONS_HARNESS_FILES } from './icons-harness.mjs';
import {
  MOTION_PROJECTION_ENTRIES,
  MOTION_PROJECTION_ICONS,
  MOTION_PROJECTION_VISUAL_FILES,
  TIMER_POSES,
  assertMotionProjectionEffect,
  assertTimerPoseEvidence,
  motionProjectionFixture,
  motionProjectionReference,
  motionProjectionTypeFixture,
  timerPoseVisualFile,
  validateMotionProjectionReference,
} from './icons-motion-projection-consumer.mjs';
import { assertIconsImport, consumerFixture, consumerPublicEntries } from './icons-packed.mjs';
import { readAuthorMaster } from './prepare-icons-inputs.mjs';

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
const pin = { figma: { fileKey: 'FixtureFigma', version: '42' } };

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'lab-ui-thin-motion-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const manifest = { schemaVersion: 1, source: pin.figma, icons: {} };
  const semantic = { schemaVersion: 1, source: pin.figma, icons: {} };
  for (const icon of MOTION_PROJECTION_ICONS) {
    manifest.icons[icon] = {};
    semantic.icons[icon] = {};
    for (const variant of icon === 'timer' ? ['outline'] : ['outline', 'filled']) {
      const content = variant === 'outline' ? 'M8 8L12 12L8 12Z' : 'M9 9L12 12L9 12Z';
      const paths = icon === 'timer' ? ['M2 2L22 2L22 22L2 22Z', content] : [content];
      const svg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="author">${paths.map((d) => `<path d="${d}" fill="#101012"/>`).join('')}</g></svg>`;
      const master = `masters/figma/42/${variant === 'outline' ? 'Outline' : 'Filled'}/${icon}.svg`;
      await mkdir(dirname(join(root, master)), { recursive: true });
      await writeFile(join(root, master), svg);
      const fingerprint = hash(
        stableJSON(paths.map((d, index) => ({ index, d, fillRule: 'nonzero' }))),
      );
      manifest.icons[icon][variant] = {
        master,
        bytes: Buffer.byteLength(svg),
        sha256: hash(svg),
        nodeId: '1:2',
        nodeSha256: 'a'.repeat(64),
        normalizedSource: { sha256: 'b'.repeat(64), pathFingerprintSha256: fingerprint },
      };
      semantic.icons[icon][variant] = {
        ...(icon === 'timer' ? { scope: 'motion' } : {}),
        masterSha256: hash(svg),
        pathFingerprintSha256: fingerprint,
        parts:
          icon === 'timer'
            ? [
                { pathIndex: 0, id: 'timer-dial', role: 'container' },
                {
                  pathIndex: 1,
                  id: 'timer-hand',
                  role: 'control',
                  anchor: [0.5, 0.5],
                  anchorMeaning: 'canvas-center',
                },
              ]
            : [
                {
                  pathIndex: 0,
                  id: 'cycle-body',
                  role: 'control',
                  anchor: [0.5, 0.5],
                  anchorMeaning: 'canvas-center',
                },
              ],
        gesture: {
          law: 'cycle.clockwise',
          ...(icon === 'timer' ? { purpose: 'elapsed-time' } : {}),
          partId: icon === 'timer' ? 'timer-hand' : 'cycle-body',
        },
      };
    }
  }
  await mkdir(join(root, 'semantics'));
  await writeFile(join(root, 'semantics/figma-baseline.json'), JSON.stringify(manifest));
  await writeFile(join(root, 'semantics/author-anatomy.json'), JSON.stringify(semantic));
  return {
    root,
    manifest,
    semantic,
    reference: await motionProjectionReference(root, pin, readAuthorMaster),
  };
}

test('raw reference binds five independent masters, timer scope, authored layers and receipts', async (t) => {
  const { reference } = await fixture(t);
  assert.equal(validateMotionProjectionReference(reference, pin.figma), reference);
  assert.equal(reference.icons.timer.outline.paths.length, 2);
  assert.equal(reference.icons.timer.filled, undefined);
  assert.notDeepEqual(reference.icons.reload.outline.paths, reference.icons.reload.filled.paths);
});

test('raw master edits and dishonest declarations refuse before installed producer import', async (t) => {
  const { root, manifest, reference } = await fixture(t);
  const changed = structuredClone(reference);
  changed.icons.timer.outline.declaration.parts[0].role = 'control';
  assert.throws(() => validateMotionProjectionReference(changed, pin.figma));
  const wrongAnchor = structuredClone(reference);
  wrongAnchor.icons.timer.outline.declaration.parts[1].anchor = [0.4, 0.5];
  assert.throws(() => validateMotionProjectionReference(wrongAnchor, pin.figma));
  const foreign = structuredClone(reference);
  foreign.icons.refresh.filled.author.fileKey = 'Foreign';
  assert.throws(() => validateMotionProjectionReference(foreign, pin.figma));
  const file = join(root, manifest.icons.timer.outline.master);
  await writeFile(file, (await readFile(file, 'utf8')).replace('M8 8', 'M7 8'));
  await assert.rejects(
    () => motionProjectionReference(root, pin, readAuthorMaster),
    /raw master digest/,
  );
});

function effect(raw, from, to, duration, reducedMotion = false) {
  return {
    version: 1,
    icon: 'timer',
    variant: 'outline',
    gesture: 'timer.advance',
    from,
    to,
    targets: [
      {
        partId: raw.gesture.partIds[0],
        rotation: { from: from * 360, to: to * 360, unit: 'degrees' },
        style: { transformBox: 'view-box', transformOrigin: '50% 50%' },
        keyframes: [
          { offset: 0, transform: `rotate(${from * 360}deg)` },
          { offset: 1, transform: `rotate(${to * 360}deg)` },
        ],
      },
    ],
    unchangedPartIds: ['timer-dial'],
    viewport: { overflow: 'visible' },
    options: {
      duration: reducedMotion || from === to ? 0 : duration,
      easing: 'linear',
      fill: 'both',
    },
  };
}
test('packet oracle catches moving dial, altered pivot, false reduction and changed finite interval', async (t) => {
  const { reference } = await fixture(t);
  const raw = reference.icons.timer.outline;
  for (const request of [
    { from: 0.125, to: 0.5, duration: 400 },
    { from: 0.5, to: 0.125, duration: 300 },
    { from: 0.125, to: 0.5, duration: 400, reducedMotion: true },
    { from: 0.875, to: 0.875, duration: 400 },
  ]) {
    const healthy = effect(raw, request.from, request.to, request.duration, request.reducedMotion);
    assertMotionProjectionEffect(healthy, raw, 'timer', 'outline', request);
    for (const alter of [
      (value) => {
        value.targets[0].partId = 'timer-dial';
      },
      (value) => {
        value.targets[0].style.transformOrigin = '49% 50%';
      },
      (value) => {
        value.options.duration++;
      },
      (value) => {
        value.targets[0].rotation.to++;
      },
    ]) {
      const broken = structuredClone(healthy);
      alter(broken);
      assert.throws(() => assertMotionProjectionEffect(broken, raw, 'timer', 'outline', request));
    }
  }
});

function poses(reference, phase) {
  const raw = reference.icons.timer.outline;
  const angle = phase * 2 * Math.PI;
  return [16, 24, 48].map((size) => ({
    icon: 'timer',
    variant: 'outline',
    size,
    capability: {
      icon: 'timer',
      variant: 'outline',
      gestures: [{ id: raw.gesture.id, kind: raw.gesture.kind, meaning: raw.gesture.meaning }],
      formats: ['svg', 'web-effect'],
      author: raw.author,
      anatomy: raw.anatomy,
    },
    viewBox: raw.viewBox,
    paths: raw.paths.map((path, index) => ({
      ...path,
      id: raw.declaration.parts[index].id,
      role: raw.declaration.parts[index].role,
    })),
    matrices: [
      [1, 0, 0, 1, 0, 0],
      [Math.cos(angle), Math.sin(angle), -Math.sin(angle), Math.cos(angle), 0, 0],
    ],
    identity: true,
    styles: [
      { transformBox: '', transformOrigin: '' },
      { transformBox: 'view-box', transformOrigin: '50% 50%' },
    ],
    width: size,
    height: size,
    target: { width: 48, height: 48, name: 'Таймер', type: 'button' },
    hidden: 'true',
    focusable: 'false',
    slot: 'icon',
    statuses: ['finished'],
  }));
}
test('capture receipt binds bytes and actual pose, never awards an optical verdict', async (t) => {
  const { reference } = await fixture(t);
  const visuals = MOTION_PROJECTION_VISUAL_FILES.map((path) => ({
    path,
    bytes: Buffer.from(path),
  }));
  const records = ['no-preference', 'reduce'].flatMap((mode) =>
    TIMER_POSES.map((phase) => {
      const file = timerPoseVisualFile(mode, phase);
      const image = visuals.find((item) => item.path === file);
      return {
        name: `${mode}:timer-pose-${phase}:capture`,
        result: 'PASS',
        file,
        phase,
        icon: 'timer',
        variant: 'outline',
        sizes: [16, 24, 48],
        samples: 3,
        pngSha256: hash(image.bytes),
        poses: poses(reference, phase),
      };
    }),
  );
  assertTimerPoseEvidence(visuals, records, reference);
  for (const alter of [
    (value) => {
      value[0].phase = 0.5;
    },
    (value) => {
      value[0].poses[0].matrices[1] = [0, 1, -1, 0, 0, 0];
    },
    (value) => {
      value[0].pngSha256 = 'c'.repeat(64);
    },
    (value) => {
      value[0].poses[0].matrices[0] = [0, 1, -1, 0, 0, 0];
    },
  ]) {
    const changed = structuredClone(records);
    alter(changed);
    assert.throws(() => assertTimerPoseEvidence(visuals, changed, reference));
  }
  assert.throws(() => assertTimerPoseEvidence(visuals.slice(1), records, reference));
  assert.throws(() => assertTimerPoseEvidence(visuals, [...records, records[0]], reference));
});

test('schema11 adds only opt-in roots and keeps prior consumers free of them', () => {
  assert.deepEqual(consumerPublicEntries(11), [
    ...consumerPublicEntries(10),
    ...MOTION_PROJECTION_ENTRIES,
  ]);
  assert.ok(!consumerFixture(10).includes('@labpics/icons/gestures/'));
  for (const entry of MOTION_PROJECTION_ENTRIES) {
    assertIconsImport(entry);
    assert.ok(consumerFixture(11).includes(entry));
  }
  assert.throws(() => assertIconsImport('@labpics/icons/gestures/mic'));
  assert.ok(ICONS_HARNESS_FILES.includes('apps/docs/tests/icons-motion-projection-consumer.mjs'));
  assert.equal((motionProjectionTypeFixture().match(/@ts-expect-error/g) ?? []).length, 3);
  const source = consumerFixture(11).replace(/^import .*?;\s*$/gm, '');
  assert.doesNotThrow(() => new Function(source));
  assert.ok(motionProjectionFixture().includes('motionProjectionConsumer.cleanup()'));
});
