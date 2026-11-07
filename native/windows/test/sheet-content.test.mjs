import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { access, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, isAbsolute, join, relative, sep } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { crc32, deflateSync } from 'node:zlib';
import { evidenceLog } from '../../../scripts/ci/evidence-log.mjs';
import { policyWitness } from './sheet-policy.fixtures.mjs';
import { POLICY_CASES } from './sheet-policy.mjs';
import {
  CONTENT_CASES,
  decodeSheetContentEvidence,
  decodeSheetEvidence,
  encodeSheetContentEvidence,
  sheetContentCaseLog,
  sheetFailureLog,
  validateObservation,
} from './sheet.mjs';

const SOURCE = 'a'.repeat(40);
const CLI = fileURLToPath(new URL('./sheet.mjs', import.meta.url));
const OWNER = { pid: 42, startedAtUnixMs: 100, observedUntilUnixMs: 200, windowHandle: '1234' };
const EXPECTED = [
  {
    name: 'Content-Long-Stretch',
    theme: 'Light',
    material: 'Solid',
    scenario: 'long',
    alignment: 'Stretch',
  },
  {
    name: 'Content-Long-Top',
    theme: 'Light',
    material: 'Solid',
    scenario: 'long',
    alignment: 'Top',
  },
  {
    name: 'Content-List',
    theme: 'Light',
    material: 'Solid',
    scenario: 'list',
    alignment: 'Stretch',
  },
];
const json = (value) => Buffer.from(JSON.stringify(value));
const copy = (value) => structuredClone(value);

function sample(entry, after, observedAtUnixMs) {
  const isList = entry.scenario === 'list';
  return {
    scenario: entry.scenario,
    contentType: isList ? 'ListView' : 'StackPanel',
    alignment: entry.alignment,
    heightIsAuto: true,
    itemCount: isList ? 1000 : 30,
    rowHeight: isList ? null : 100,
    lastMeasure: { width: 343, height: 358 },
    unboundedWidth: false,
    unboundedHeight: false,
    contentLoaded: true,
    actualHeight: isList ? 358 : 3000,
    desiredHeight: 358,
    outer: {
      extentHeight: isList ? 358 : 3000,
      viewportHeight: 358,
      viewportWidth: 343,
      scrollableHeight: isList ? 0 : 2642,
      verticalOffset: !isList && after ? 2642 : 0,
      sizesContentToTemplatedParent: true,
    },
    inner: isList
      ? {
          extentHeight: 40000,
          viewportHeight: 358,
          viewportWidth: 343,
          scrollableHeight: 39642,
          verticalOffset: after ? 39642 : 0,
          sizesContentToTemplatedParent: false,
        }
      : null,
    realizedItems: isList ? (after ? 40 : 30) : null,
    lastRow: isList
      ? after
        ? { realized: true, bounds: { x: 0, y: 318, width: 343, height: 40 } }
        : { realized: false, bounds: null }
      : {
          realized: true,
          bounds: { x: 0, y: after ? 258 : 2900, width: 343, height: 100 },
        },
    observedAtUnixMs,
  };
}

function observation(entry = EXPECTED[0]) {
  const target = entry.scenario === 'list' ? 39642 : 2642;
  return {
    pid: 42,
    windowHandle: '1234',
    observedAtUnixMs: 180,
    theme: 'Light',
    rasterizationScale: 1,
    viewport: { x: 0, y: 0, width: 375, height: 812 },
    body: { x: 0, y: 390, width: 375, height: 422 },
    handle: { x: 170, y: 404, width: 36, height: 4 },
    layoutReady: true,
    imageLoaded: true,
    rendererReady: true,
    requestedMaterial: 'Solid',
    requestedState: 'Half',
    geometryScale: 1,
    contentViewport: { x: 16, y: 438, width: 343, height: 358 },
    effectiveMaterial: 'Solid',
    materialReason: 'Requested',
    error: null,
    contentWitness: {
      ...sample(entry, true, 175),
      qualification: {
        schema: 'sheet-content-v2',
        status: 'complete',
        phase: 'replacement-scroll',
        failure: null,
        reset: {
          targetOffset: 0,
          accepted: true,
          settled: true,
          finalEvents: 1,
          beforeOffset: target,
          afterOffset: 0,
        },
        replacement: {
          presentersDiffer: true,
          sameContent: true,
          previousPresenterLoaded: false,
          previousSizesContentToTemplatedParent: true,
          currentSizesContentToTemplatedParent: true,
        },
        cycles: ['initial', 'replaced'].map((template, index) => ({
          template,
          before: sample(entry, false, 120 + index * 30),
          changeView: {
            targetOffset: target,
            accepted: true,
            settled: true,
            finalEvents: 1,
            beforeOffset: 0,
            afterOffset: target,
          },
          after: sample(entry, true, 140 + index * 30),
        })),
      },
    },
  };
}

function policyObservation(entry = POLICY_CASES[0]) {
  const value = observation();
  value.contentWitness = policyWitness(entry);
  value.requestedState = entry.state;
  const final = value.contentWitness.steps.at(-1);
  const height = final.bodyHeight;
  value.body = { x: 0, y: 812 - height, width: 375, height };
  value.handle = { x: 170, y: 812 - height + 14, width: 36, height: 4 };
  value.contentViewport = { x: 16, y: 812 - height + 48, width: 343, height: height - 64 };
  return value;
}

function image() {
  const chunk = (name, payload) => {
    const bytes = Buffer.alloc(12 + payload.length);
    bytes.writeUInt32BE(payload.length);
    bytes.write(name, 4, 'ascii');
    payload.copy(bytes, 8);
    bytes.writeUInt32BE(crc32(bytes.subarray(4, -4)), bytes.length - 4);
    return bytes;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(375);
  header.writeUInt32BE(812, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.alloc((375 * 4 + 1) * 812))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
const IMAGE = image();

function fixture() {
  const identity = {
    schema: 'sheet-content-v2',
    source: SOURCE,
    cases: {},
    cliVersion: '0.7.1',
    visualReview: 'pending',
    motion: 'not-qualified',
    performance: 'not-qualified',
  };
  for (const field of [
    'appSha256',
    'consumerSha256',
    'uiSha256',
    'motionSha256',
    'cliZipSha256',
    'cliSha256',
  ])
    identity[field] = 'b'.repeat(64);
  const files = new Map();
  for (const entry of CONTENT_CASES) {
    const window = { pid: 42, windowHandle: '1234', startedAtUnixMs: 110 };
    identity.cases[entry.name] = {
      ...OWNER,
      exited: true,
      windowBefore: window,
      windowAfter: window,
      termination: { code: null, signal: 'SIGTERM' },
    };
    files.set(
      `${entry.name}.json`,
      json(POLICY_CASES.includes(entry) ? policyObservation(entry) : observation(entry)),
    );
    files.set(`${entry.name}.png`, IMAGE);
  }
  files.set('identity.json', json(identity));
  return files;
}
const packets = (files) =>
  [...files]
    .map(([file, bytes]) =>
      evidenceLog(bytes, 'LABUI_SHEET_CONTENT_EVIDENCE', { sourceSha: SOURCE, file }, 'sha256'),
    )
    .join('');
const check = (value, entry = EXPECTED[0]) => validateObservation(value, { ...entry, ...OWNER });
const rejectMutation = (mutate, entry = EXPECTED[0]) => {
  const value = observation(entry);
  mutate(value, value.contentWitness, value.contentWitness.qualification);
  assert.throws(() => check(value, entry));
};

test('hosted Content matrix admits finite Stretch, Top and an un-sized native ListView', () => {
  assert.deepEqual(CONTENT_CASES, [...EXPECTED, ...POLICY_CASES]);
  for (const entry of EXPECTED) check(observation(entry), entry);
});

test('hosted policy observations bind selector and recovered Flex to measured outer geometry', () => {
  for (const entry of POLICY_CASES) {
    check(policyObservation(entry), entry);
    for (const mutate of [
      (value) => {
        value.requestedState = entry.state === 'Flex' ? 'Half' : 'Flex';
      },
      (value) => {
        value.geometryScale = 2;
      },
      (value) => {
        value.body.height += 1;
      },
      (value) => {
        value.handle.y += 1;
      },
      (value) => {
        value.contentViewport.height += 1;
      },
      (value) => {
        value.contentWitness.steps.at(-1).viewport.actualWidth -= 1;
      },
      (value) => {
        value.privateRoot = 'private';
      },
    ]) {
      const value = policyObservation(entry);
      mutate(value);
      assert.throws(() => check(value, entry));
    }
  }
});

test('Flex outer geometry admits natural heights and viewport clamp while rejecting stale fixed Half', () => {
  const entry = POLICY_CASES[1];
  for (const desiredHeight of [24, 160, 900]) {
    const value = policyObservation(entry);
    const final = value.contentWitness.steps.at(-1);
    const contentHeight = Math.min(748, desiredHeight);
    final.bodyHeight = contentHeight + 64;
    final.root.desired.height = desiredHeight;
    final.root.actual.height = contentHeight;
    final.root.layoutSlot.height = contentHeight;
    Object.assign(final.viewport, {
      actualHeight: contentHeight,
      viewportHeight: contentHeight,
      extentHeight: contentHeight,
    });
    value.body = { x: 0, y: 812 - final.bodyHeight, width: 375, height: final.bodyHeight };
    value.handle = { x: 170, y: value.body.y + 14, width: 36, height: 4 };
    value.contentViewport = { x: 16, y: value.body.y + 48, width: 343, height: contentHeight };
    check(value, entry);
    const stale = copy(value);
    stale.body = { x: 0, y: 390, width: 375, height: 422 };
    assert.throws(() => check(stale, entry));
  }
});

test('policy Content series keeps typed evidence and fails closed on missing recovery or retirement', () => {
  const files = fixture();
  assert.equal(files.size, 11);
  const decoded = decodeSheetContentEvidence(encodeSheetContentEvidence(files, SOURCE), SOURCE);
  for (const entry of POLICY_CASES) {
    assert.deepEqual(decoded.get(`${entry.name}.json`), files.get(`${entry.name}.json`));
    for (const mutate of [
      (value) => {
        value.contentWitness.steps.pop();
      },
      (value) => {
        value.contentWitness.status = 'failed';
      },
      (value) => {
        value.contentWitness.scenario = 'unknown';
      },
      (value) => {
        value.contentWitness.steps.at(-1).viewport.sizesContentToTemplatedParent = false;
      },
    ]) {
      const bad = new Map(files);
      const value = JSON.parse(bad.get(`${entry.name}.json`).toString());
      mutate(value);
      bad.set(`${entry.name}.json`, json(value));
      assert.throws(() => encodeSheetContentEvidence(bad, SOURCE));
      assert.throws(() => decodeSheetContentEvidence(packets(bad), SOURCE));
    }
  }
});

test('policy diagnostics preserve closed failed witness data for each capture case', () => {
  for (const entry of POLICY_CASES) {
    const value = policyObservation(entry);
    value.contentWitness.status = 'failed';
    value.contentWitness.failure = {
      phase: value.contentWitness.phase,
      code: 'layout-timeout',
      type: 'TimeoutException',
      hresult: -2147024809,
      message: 'private exception text',
    };
    const failure = sheetFailureLog({
      sourceSha: SOURCE,
      name: entry.name,
      phase: 'content-layout',
      pid: 42,
      observation: value,
      error: new Error('private exception text'),
    });
    assert.ok(!failure.includes('private exception text'));
    const readback = JSON.parse(failure.slice(failure.indexOf('{')));
    assert.equal(readback.observation.contentWitness.failure.hresult, -2147024809);
    assert.equal(readback.observation.contentWitness.schema, 'sheet-policy-v1');
    assert.equal(readback.observation.contentWitness.steps.length, entry.state === 'Half' ? 5 : 2);
    const completed = sheetContentCaseLog({
      sourceSha: SOURCE,
      name: entry.name,
      ...OWNER,
      exited: true,
      observation: policyObservation(entry),
    });
    assert.equal(
      JSON.parse(completed.slice(completed.indexOf('{'))).contentWitness.status,
      'complete',
    );
  }
});

test('complete status cannot hide missing phases or a failed native template replacement', () => {
  for (const mutate of [
    (v, w) => {
      w.qualification = null;
    },
    (v, w, q) => {
      q.status = 'pending';
    },
    (v, w, q) => {
      q.cycles = [];
    },
    (v, w, q) => {
      q.cycles.pop();
    },
    (v, w, q) => {
      q.cycles[1].template = 'initial';
    },
    (v, w, q) => {
      q.replacement = null;
    },
    (v, w, q) => {
      q.replacement.presentersDiffer = false;
    },
    (v, w, q) => {
      q.replacement.sameContent = false;
    },
    (v, w, q) => {
      q.replacement.previousPresenterLoaded = true;
    },
    (v, w, q) => {
      q.replacement.currentSizesContentToTemplatedParent = false;
    },
    (v, w, q) => {
      q.cycles[1].before.outer.sizesContentToTemplatedParent = false;
    },
    (v, w, q) => {
      q.reset.afterOffset = 2642;
    },
    (v, w, q) => {
      q.reset.accepted = false;
    },
  ])
    rejectMutation(mutate);
});

test('real readback must keep the finite offer, change the view and reach the final ordinary row', () => {
  for (const mutate of [
    (v) => {
      v.contentViewport.height = 812;
    },
    (v) => {
      v.requestedState = 'Full';
    },
    (v) => {
      v.geometryScale = 2;
    },
    (v, w) => {
      w.lastMeasure.height = null;
      w.unboundedHeight = true;
    },
    (v, w, q) => {
      q.cycles[0].before.lastMeasure.height = 3000;
    },
    (v, w, q) => {
      q.cycles[1].after.lastMeasure.height = 812;
    },
    (v, w, q) => {
      q.cycles[0].changeView.accepted = false;
    },
    (v, w, q) => {
      q.cycles[0].changeView.settled = false;
    },
    (v, w, q) => {
      q.cycles[0].changeView.afterOffset = 0;
    },
    (v, w, q) => {
      q.cycles[0].after.lastRow.bounds.y = 2900;
    },
    (v, w) => {
      w.outer.verticalOffset = 0;
      w.lastRow.bounds.y = 2900;
    },
    (v, w) => {
      w.itemCount = 29;
    },
    (v, w) => {
      w.rowHeight = 90;
    },
  ])
    rejectMutation(mutate);
});

test('pinned public-source Top counterexample remains unqualified while its Stretch control is admitted', () => {
  const value = observation(EXPECTED[1]);
  const collapse = (sample) => {
    sample.outer.extentHeight = 358;
    sample.outer.scrollableHeight = 0;
    sample.outer.verticalOffset = 0;
    sample.lastRow.bounds.y = 2900;
  };
  collapse(value.contentWitness);
  for (const cycle of value.contentWitness.qualification.cycles) {
    collapse(cycle.before);
    collapse(cycle.after);
    cycle.changeView = {
      targetOffset: 0,
      accepted: false,
      settled: false,
      finalEvents: 0,
      beforeOffset: 0,
      afterOffset: 0,
    };
  }
  assert.throws(
    () => check(value, EXPECTED[1]),
    (error) => error.sheetPhase === 'content-layout',
  );
  check(observation(EXPECTED[0]));
});

test('ListView must own scrolling and retain partial realization through both templates', () => {
  for (const mutate of [
    (v, w) => {
      w.heightIsAuto = false;
    },
    (v, w) => {
      w.inner = null;
    },
    (v, w) => {
      w.realizedItems = 1000;
    },
    (v, w) => {
      w.realizedItems = 0;
    },
    (v, w, q) => {
      q.cycles[1].after.realizedItems = 1000;
    },
    (v, w, q) => {
      q.cycles[0].before.inner.sizesContentToTemplatedParent = true;
    },
    (v, w, q) => {
      q.cycles[0].after.inner.verticalOffset = 0;
    },
    (v, w) => {
      w.outer.extentHeight = 40000;
      w.outer.scrollableHeight = 39642;
      w.outer.verticalOffset = 39642;
    },
  ])
    rejectMutation(mutate, EXPECTED[2]);
});

test('ListView admits an unrealized final container before scrolling and a visible partial realization after', () => {
  const value = observation(EXPECTED[2]);
  for (const cycle of value.contentWitness.qualification.cycles) {
    assert.deepEqual(cycle.before.lastRow, { realized: false, bounds: null });
    cycle.after.realizedItems = 16;
    cycle.after.lastRow.bounds.y += 0.005;
  }
  value.contentWitness.realizedItems = 16;
  check(value, EXPECTED[2]);
});

test('ListView rejects a missing or invisible final container at a correct offset in every reached sample', () => {
  const targets = [
    (value) => value.contentWitness.qualification.cycles[0].after,
    (value) => value.contentWitness.qualification.cycles[1].after,
    (value) => value.contentWitness,
  ];
  for (const target of targets)
    for (const lastRow of [
      { realized: false, bounds: null },
      { realized: true, bounds: { x: 0, y: 358, width: 343, height: 40 } },
      { realized: true, bounds: { x: 0, y: -40, width: 343, height: 40 } },
      { realized: true, bounds: { x: 0, y: 319, width: 343, height: 40 } },
    ]) {
      const value = observation(EXPECTED[2]);
      target(value).lastRow = copy(lastRow);
      assert.throws(() => check(value, EXPECTED[2]), {
        code: 'ERR_ASSERTION',
        sheetPhase: 'content-scroll',
      });
    }
});

test('reached Content rejects a horizontally clipped or invisible final row in every template and final sample', () => {
  const targets = [
    (value) => value.contentWitness.qualification.cycles[0].after,
    (value) => value.contentWitness.qualification.cycles[1].after,
    (value) => value.contentWitness,
  ];
  for (const entry of EXPECTED)
    for (const target of targets)
      for (const x of [-400, 343, -1, 1]) {
        const value = observation(entry);
        target(value).lastRow.bounds.x = x;
        assert.throws(() => check(value, entry), {
          code: 'ERR_ASSERTION',
          sheetPhase: 'content-scroll',
        });
      }
});

test('Content viewport widths are measured, mandatory and versioned rather than inferred from the finite offer', () => {
  const targets = [
    (value) => value.contentWitness.qualification.cycles[0].after,
    (value) => value.contentWitness.qualification.cycles[1].after,
    (value) => value.contentWitness,
  ];
  const allowed = observation(EXPECTED[2]);
  for (const target of targets) {
    target(allowed).inner.viewportWidth = 200;
    target(allowed).lastRow.bounds.width = 200;
    target(allowed).lastRow.bounds.x = -0.005;
  }
  check(allowed, EXPECTED[2]);
  for (const target of targets) {
    const outside = copy(allowed);
    target(outside).lastRow.bounds = { x: 210, y: 318, width: 20, height: 40 };
    assert.throws(() => check(outside, EXPECTED[2]), {
      code: 'ERR_ASSERTION',
      sheetPhase: 'content-scroll',
    });
    for (const invalid of [null, 0, -1, Number.POSITIVE_INFINITY]) {
      const value = observation(EXPECTED[2]);
      target(value).inner.viewportWidth = invalid;
      assert.throws(() => check(value, EXPECTED[2]));
    }
    const missing = observation(EXPECTED[2]);
    target(missing).inner = Object.fromEntries(
      Object.entries(target(missing).inner).filter(([field]) => field !== 'viewportWidth'),
    );
    assert.throws(() => check(missing, EXPECTED[2]));
  }
  const legacy = observation(EXPECTED[2]);
  legacy.contentWitness.qualification.schema = 'sheet-content-v1';
  assert.throws(() => check(legacy, EXPECTED[2]));
  const files = fixture();
  const identity = JSON.parse(files.get('identity.json'));
  identity.schema = 'sheet-content-v1';
  files.set('identity.json', json(identity));
  assert.throws(() => encodeSheetContentEvidence(files, SOURCE));
});

test('phase samples cannot predate the process, reverse time or follow the final observation', () => {
  for (const mutate of [
    (v, w, q) => {
      q.cycles[0].before.observedAtUnixMs = 99;
    },
    (v, w, q) => {
      q.cycles[0].after.observedAtUnixMs = 119;
    },
    (v, w, q) => {
      q.cycles[1].before.observedAtUnixMs = 139;
    },
    (v, w) => {
      w.observedAtUnixMs = 201;
    },
    (v, w) => {
      w.observedAtUnixMs = 169;
    },
  ])
    rejectMutation(mutate);
});

test('Content evidence roundtrips exact files and source independently of the material series', () => {
  const files = fixture();
  assert.equal(files.size, 11);
  const log = encodeSheetContentEvidence(files, SOURCE);
  assert.deepEqual(decodeSheetContentEvidence(log, SOURCE), files);
  assert.throws(() => decodeSheetContentEvidence(log, 'c'.repeat(40)));
  assert.throws(() => decodeSheetEvidence(log, SOURCE));
});

test('Content and policy series retain closed material capability facts at both wire boundaries', () => {
  const facts = { advancedEffectsEnabled: false, areEffectsSupported: true, areEffectsFast: false };
  const healthy = fixture();
  for (const entry of CONTENT_CASES) {
    const value = JSON.parse(healthy.get(`${entry.name}.json`));
    value.materialCapabilities = { ...facts };
    check(value, entry);
    healthy.set(`${entry.name}.json`, json(value));
  }
  assert.deepEqual(
    decodeSheetContentEvidence(encodeSheetContentEvidence(healthy, SOURCE), SOURCE),
    healthy,
  );
  for (const entry of CONTENT_CASES) {
    for (const malformed of [
      'MATERIAL_PRIVATE_SENTINEL',
      { ...facts, privateDetail: 'MATERIAL_PRIVATE_SENTINEL' },
      { ...facts, areEffectsFast: 'MATERIAL_PRIVATE_SENTINEL' },
    ]) {
      const value = JSON.parse(healthy.get(`${entry.name}.json`));
      value.materialCapabilities = malformed;
      assert.throws(() => check(value, entry));
      const files = new Map(healthy);
      files.set(`${entry.name}.json`, json(value));
      assert.throws(() => encodeSheetContentEvidence(files, SOURCE));
      assert.throws(() => decodeSheetContentEvidence(packets(files), SOURCE));
    }
  }
});

test('Content window geometry rejects foreign data at observation and both publication boundaries', () => {
  const sample = (visible) => ({
    status: 'complete',
    client: { width: 375, height: 812 },
    frame: { x: -300, y: 80, width: 391, height: 851 },
    workArea: { x: -1920, y: 0, width: 1920, height: 1040 },
    outerBounds: { x: -1920, y: 0, width: 1920, height: 1080 },
    presenter: 'Overlapped',
    visible,
    extendsContentIntoTitleBar: false,
  });
  const geometry = {
    afterResize: sample(false),
    afterActivation: sample(true),
    observed: sample(true),
  };
  const healthy = fixture();
  for (const entry of CONTENT_CASES) {
    const value = JSON.parse(healthy.get(`${entry.name}.json`));
    value.windowGeometry = copy(geometry);
    check(value, entry);
    healthy.set(`${entry.name}.json`, json(value));
  }
  assert.deepEqual(
    decodeSheetContentEvidence(encodeSheetContentEvidence(healthy, SOURCE), SOURCE),
    healthy,
  );
  for (const entry of CONTENT_CASES) {
    for (const malformed of [
      'WINDOW_PRIVATE_SENTINEL',
      { unrelated: 'WINDOW_PRIVATE_SENTINEL' },
      {
        afterResize: null,
        afterActivation: null,
        observed: {
          status: 'failed',
          type: 'COMException',
          hresult: -1,
          message: 'WINDOW_PRIVATE_SENTINEL',
        },
      },
    ]) {
      const value = JSON.parse(healthy.get(`${entry.name}.json`));
      value.windowGeometry = copy(malformed);
      assert.throws(() => check(value, entry));
      const files = new Map(healthy);
      files.set(`${entry.name}.json`, json(value));
      assert.throws(() => encodeSheetContentEvidence(files, SOURCE));
      assert.throws(() => decodeSheetContentEvidence(packets(files), SOURCE));
    }
  }
});

test('incomplete, duplicate, foreign or corrupted Content packets cannot become evidence', () => {
  const files = fixture();
  const missing = new Map(files);
  missing.delete('Content-List.json');
  assert.throws(() => encodeSheetContentEvidence(missing, SOURCE));
  assert.throws(() => decodeSheetContentEvidence(packets(missing), SOURCE));
  assert.throws(() => decodeSheetContentEvidence(packets(files) + packets(files), SOURCE));
  const foreign = new Map(files);
  foreign.set('../foreign.json', json({}));
  assert.throws(() => decodeSheetContentEvidence(packets(foreign), SOURCE));
  const corrupted = new Map(files);
  corrupted.set('Content-Long-Top.png', IMAGE.subarray(0, -1));
  assert.throws(() => encodeSheetContentEvidence(corrupted, SOURCE));
  const oversized = new Map(files);
  oversized.set('Content-List.json', Buffer.alloc(64 * 1024 + 1));
  assert.throws(() => decodeSheetContentEvidence(packets(oversized), SOURCE));
});

test('identity, lifecycle and unknown JSON fields remain strict at the Content publication boundary', () => {
  for (const mutate of [
    (identity) => {
      identity.source = 'c'.repeat(40);
    },
    (identity) => {
      identity.schema = 'other';
    },
    (identity) => {
      identity.message = 'private-sentinel';
    },
    (identity) => {
      identity.cases['Content-List'].exited = false;
    },
    (identity) => {
      identity.cases['Content-List'].windowAfter.pid = 43;
    },
    (identity) => {
      identity.cases['Content-List'].termination.signal = 'private-sentinel';
    },
  ]) {
    const files = fixture();
    const identity = JSON.parse(files.get('identity.json'));
    mutate(identity);
    files.set('identity.json', json(identity));
    assert.throws(() => encodeSheetContentEvidence(files, SOURCE));
  }
  for (const mutate of [
    (v) => {
      v.message = 'private-sentinel';
    },
    (v, w) => {
      w.text = 'private-sentinel';
    },
    (v, w, q) => {
      q.cycles[0].before.outer.message = 'private-sentinel';
    },
    (v, w, q) => {
      q.cycles[1].after.lastRow.bounds.message = 'private-sentinel';
    },
    (v, w, q) => {
      q.status = 'complete';
      q.failure = { type: 'COMException', message: 'private-sentinel' };
    },
  ])
    rejectMutation(mutate);
});

test('bounded failure and case readbacks preserve native facts without publishing exception text', () => {
  const value = observation(EXPECTED[1]);
  const sentinel = 'private-sentinel';
  value.contentWitness.text = sentinel;
  value.contentWitness.qualification.failure = {
    phase: sentinel,
    code: sentinel,
    type: sentinel,
    hresult: -2147467259,
    message: sentinel,
  };
  const unknown = {
    template: sentinel,
    before: { scenario: sentinel, actualHeight: 1e20, text: sentinel },
    changeView: { accepted: sentinel },
    after: null,
  };
  value.contentWitness.qualification.cycles = Array(100).fill(unknown);
  value.contentViewport.x = sentinel;
  const log = sheetFailureLog({
    sourceSha: SOURCE,
    name: EXPECTED[1].name,
    phase: 'content-scroll',
    pid: 42,
    observation: value,
    error: Object.assign(new Error(sentinel), { code: sentinel }),
    cleanupError: new Error(sentinel),
    stderrBytes: 500,
  });
  assert.equal(log.includes(sentinel), false);
  assert.ok(Buffer.byteLength(log) < 64 * 1024);
  const failure = JSON.parse(log.trim().slice('LABUI_SHEET_FAILURE_JSON '.length));
  assert.equal(failure.phase, 'content-scroll');
  assert.equal(failure.observation.contentWitness.lastMeasure.height, 358);
  assert.equal(failure.observation.contentWitness.qualification.failure.hresult, -2147467259);
  assert.equal(failure.observation.contentWitness.qualification.cycles.length, 2);
  assert.equal(
    failure.observation.contentWitness.qualification.cycles[0].before.actualHeight,
    null,
  );
  const caseLog = sheetContentCaseLog({
    sourceSha: SOURCE,
    name: EXPECTED[1].name,
    ...OWNER,
    exited: true,
    observation: value,
  });
  assert.equal(caseLog.includes(sentinel), false);
  assert.throws(() => decodeSheetContentEvidence(caseLog, SOURCE));
});

test('real CLI decodes Content once and rejects local capture before creating any output', async () => {
  const temporaryRoot = await realpath(tmpdir());
  const directory = await mkdtemp(join(temporaryRoot, 'labui-sheet-content-'));
  const run = (args, env = process.env) =>
    spawnSync(process.execPath, [CLI, ...args], {
      encoding: 'utf8',
      env,
      windowsHide: true,
      timeout: 10000,
    });
  try {
    const log = join(directory, 'job.log');
    await writeFile(log, packets(fixture()));
    const decoded = join(directory, 'decoded');
    const result = run(['decode-content', log, SOURCE, decoded]);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(await readFile(join(decoded, 'Content-List.png')), IMAGE);
    assert.notEqual(run(['decode-content', log, SOURCE, decoded]).status, 0);
    const output = join(directory, 'local');
    const denied = run(
      ['capture-content', directory, output, join(directory, 'missing-receipt.json'), SOURCE],
      {
        ...process.env,
        GITHUB_ACTIONS: 'false',
        RUNNER_ENVIRONMENT: '',
      },
    );
    assert.notEqual(denied.status, 0);
    assert.match(denied.stderr, /"code":"SHEET_HOST_REQUIRED"/);
    await assert.rejects(access(output), { code: 'ENOENT' });
  } finally {
    const resolved = await realpath(directory);
    const target = relative(temporaryRoot, resolved);
    assert.ok(
      target &&
        !isAbsolute(target) &&
        target !== '..' &&
        !target.startsWith(`..${sep}`) &&
        !target.includes(sep) &&
        basename(resolved).startsWith('labui-sheet-content-'),
    );
    await rm(resolved, { recursive: true, force: true });
  }
});
