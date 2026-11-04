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
  assertMotionProjectionEffect,
  assertTimerRefusalEvidence,
  assertTimerRefusals,
  motionProjectionFixture,
  motionProjectionReference,
  motionProjectionTypeFixture,
  timerRefusalVisualFile,
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
    for (const variant of ['outline', 'filled']) {
      const content = variant === 'outline' ? 'M8 8L12 12L8 12Z' : 'M9 9L12 12L9 12Z';
      const paths =
        icon === 'timer' && variant === 'outline' ? ['M2 2L22 2L22 22L2 22Z', content] : [content];
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
      if (icon === 'timer' && variant === 'filled') continue;
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
        gesture:
          icon === 'timer'
            ? null
            : {
                law: 'cycle.clockwise',
                partId: 'cycle-body',
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

test('raw reference binds six independent masters, withdrawn timer scope and authored receipts', async (t) => {
  const { reference } = await fixture(t);
  assert.equal(validateMotionProjectionReference(reference, pin.figma), reference);
  assert.equal(reference.icons.timer.outline.paths.length, 2);
  assert.equal(reference.icons.timer.outline.gesture, null);
  assert.equal(reference.icons.timer.outline.declaration.gesture, null);
  assert.equal(reference.icons.timer.filled.declaration, null);
  assert.notDeepEqual(reference.icons.timer.outline.paths, reference.icons.timer.filled.paths);
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
  const falseGesture = structuredClone(reference);
  falseGesture.icons.timer.outline.declaration.gesture = {
    law: 'cycle.clockwise',
    purpose: 'elapsed-time',
    partId: 'timer-hand',
  };
  assert.throws(() => validateMotionProjectionReference(falseGesture, pin.figma));
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
    icon: 'reload',
    variant: 'outline',
    gesture: 'reload.cycle',
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
    unchangedPartIds: [],
    viewport: { overflow: 'visible' },
    options: {
      duration: reducedMotion || from === to ? 0 : duration,
      easing: 'linear',
      fill: 'both',
    },
  };
}
test('accepted rotation oracle catches wrong target, altered pivot, false reduction and changed interval', async (t) => {
  const { reference } = await fixture(t);
  const raw = reference.icons.reload.outline;
  for (const request of [
    { from: 0.125, to: 0.5, duration: 400 },
    { from: 0.5, to: 0.125, duration: 300 },
    { from: 0.125, to: 0.5, duration: 400, reducedMotion: true },
    { from: 0.875, to: 0.875, duration: 400 },
  ]) {
    const healthy = effect(raw, request.from, request.to, request.duration, request.reducedMotion);
    assertMotionProjectionEffect(healthy, raw, 'reload', 'outline', request);
    for (const alter of [
      (value) => {
        value.targets[0].partId = 'other-body';
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
      assert.throws(() => assertMotionProjectionEffect(broken, raw, 'reload', 'outline', request));
    }
  }
});

function poses(reference) {
  return ['outline', 'filled'].flatMap((variant) =>
    [16, 24, 48].map((size) => {
      const raw = reference.icons.timer[variant];
      return {
        icon: 'timer',
        variant,
        size,
        capability: {
          icon: 'timer',
          variant,
          motion: { state: 'source-only', gestures: [] },
          author: raw.author,
        },
        viewBox: raw.viewBox,
        paths: raw.paths.map((path, index) => ({
          ...path,
          id: `source-${String(index).padStart(12, '0')}`,
          role: 'unclassified',
        })),
        matrices: raw.paths.map(() => [1, 0, 0, 1, 0, 0]),
        identity: true,
        styles: raw.paths.map(() => ({ transformBox: '', transformOrigin: '' })),
        width: size,
        height: size,
        target: { width: 48, height: 48, name: 'Таймер', type: 'button' },
        hidden: 'true',
        focusable: 'false',
        slot: 'icon',
        generation: 0,
        animations: 0,
      };
    }),
  );
}
const refusedTimer = () =>
  Object.fromEntries(
    ['outline', 'filled'].map((variant) => [
      variant,
      { ok: false, reason: { code: 'SEMANTIC_MOTION_UNAVAILABLE' } },
    ]),
  );

test('capture receipt binds static authors and actual refusal without a motion or optical verdict', async (t) => {
  const { reference } = await fixture(t);
  const visuals = MOTION_PROJECTION_VISUAL_FILES.map((path) => ({
    path,
    bytes: Buffer.from(path),
  }));
  const records = ['no-preference', 'reduce'].map((mode) => {
    const file = timerRefusalVisualFile(mode);
    const image = visuals.find((item) => item.path === file);
    return {
      name: `${mode}:timer-static-refusal:capture`,
      result: 'PASS',
      file,
      icon: 'timer',
      variants: ['outline', 'filled'],
      sizes: [16, 24, 48],
      samples: 6,
      pngSha256: hash(image.bytes),
      poses: poses(reference),
      refusals: refusedTimer(),
    };
  });
  assertTimerRefusalEvidence(visuals, records, reference);
  for (const alter of [
    (value) => {
      value[0].poses[0].capability.motion.gestures = [{ id: 'timer.advance' }];
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
    (value) => {
      value[0].refusals.filled = { ok: true, effect: {} };
    },
    (value) => {
      value[0].refusals.outline.reason.code = 'GESTURE_UNSUPPORTED';
    },
    (value) => {
      value[0].poses[0].generation = 1;
    },
    (value) => {
      value[0].poses[0].animations = 1;
    },
    (value) => {
      value[0].poses[0].paths[0].d += 'M0 0Z';
    },
    (value) => {
      value[0].poses[0].target.name = '';
    },
  ]) {
    const changed = structuredClone(records);
    alter(changed);
    assert.throws(() => assertTimerRefusalEvidence(visuals, changed, reference));
  }
  assert.throws(() => assertTimerRefusalEvidence(visuals.slice(1), records, reference));
  assert.throws(() => assertTimerRefusalEvidence(visuals, [...records, records[0]], reference));
  assertTimerRefusals(refusedTimer());
  assert.throws(() => assertTimerRefusals({ outline: refusedTimer().outline }));
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
  assert.ok(!consumerPublicEntries(11).includes('@labpics/icons/gestures/mic'));
  assert.ok(!consumerFixture(11).includes('@labpics/icons/gestures/mic'));
  assert.ok(!consumerPublicEntries(11).includes('@labpics/icons/gestures/timer'));
  assert.ok(!consumerFixture(11).includes('@labpics/icons/gestures/timer'));
  assert.throws(() => assertIconsImport('@labpics/icons/gestures/timer'));
  assert.throws(() => assertIconsImport('@labpics/icons/ir/capsule-motion-runtime'));
  assert.ok(ICONS_HARNESS_FILES.includes('apps/docs/tests/icons-motion-projection-consumer.mjs'));
  assert.equal((motionProjectionTypeFixture().match(/@ts-expect-error/g) ?? []).length, 3);
  const source = consumerFixture(11).replace(/^import .*?;\s*$/gm, '');
  assert.doesNotThrow(() => new Function(source));
  assert.ok(motionProjectionFixture().includes('motionProjectionConsumer.cleanup()'));
});
