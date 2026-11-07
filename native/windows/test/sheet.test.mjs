import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { crc32, deflateSync } from 'node:zlib';
import './sheet-topology-stage.test.mjs';
import { evidenceLog } from '../../../scripts/ci/evidence-log.mjs';
import {
  CASES,
  decodeSheetEvidence,
  encodeSheetEvidence,
  sheetFailureLog,
  validateObservation,
} from './sheet.mjs';

const SOURCE = 'a'.repeat(40);
const CLI = fileURLToPath(new URL('./sheet.mjs', import.meta.url));
const json = (value) => Buffer.from(JSON.stringify(value));
const processIdentity = { pid: 42, startedAtUnixMs: 100, observedUntilUnixMs: 200 };
const EXPECTED_CASES = [
  { name: 'Light-Blur', theme: 'Light', material: 'Blur' },
  { name: 'Light-Solid', theme: 'Light', material: 'Solid' },
  { name: 'Dark-Blur', theme: 'Dark', material: 'Blur' },
  { name: 'Dark-Solid', theme: 'Dark', material: 'Solid' },
];

function observation(theme = 'Light', material = 'Blur') {
  return {
    pid: 42,
    windowHandle: '1234',
    observedAtUnixMs: 150,
    theme,
    rasterizationScale: 1,
    viewport: { x: 0, y: 0, width: 375, height: 812 },
    body: { x: 0, y: 390, width: 375, height: 422 },
    handle: { x: 170, y: 404, width: 36, height: 4 },
    layoutReady: true,
    imageLoaded: true,
    rendererReady: true,
    requestedMaterial: material,
    effectiveMaterial: material,
    materialReason: null,
    error: null,
  };
}

function png() {
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

function fixture() {
  const identity = {
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
  for (const { name, theme, material } of EXPECTED_CASES) {
    const window = { pid: 42, windowHandle: '1234', startedAtUnixMs: 110 };
    identity.cases[name] = {
      ...processIdentity,
      windowHandle: '1234',
      exited: true,
      windowBefore: window,
      windowAfter: window,
    };
    files.set(`${name}.json`, json(observation(theme, material)));
    files.set(`${name}.png`, png());
  }
  files.set('identity.json', json(identity));
  return files;
}

const rawPackets = (files) =>
  [...files]
    .map(([file, bytes]) =>
      evidenceLog(bytes, 'LABUI_SHEET_EVIDENCE', { sourceSha: SOURCE, file }, 'sha256'),
    )
    .join('');

test('Half observation admits the reference and rejects wrong process, stale readiness and changed geometry', () => {
  const expected = { ...CASES[0], ...processIdentity };
  validateObservation(observation(), expected);
  for (const change of [
    { pid: 43 },
    { observedAtUnixMs: 99 },
    { observedAtUnixMs: 201 },
    { windowHandle: '0' },
    { windowHandle: 1234 },
    { theme: 'Dark' },
    { effectiveMaterial: 'Solid' },
    { error: 'device lost' },
    { layoutReady: false },
    { imageLoaded: false },
    { rendererReady: false },
    { rasterizationScale: 1.5 },
    { body: { x: 0, y: 406, width: 375, height: 406 } },
    { handle: { x: 170, y: 404, width: 36, height: 0 } },
  ])
    assert.throws(() => validateObservation({ ...observation(), ...change }, expected));
});

test('all four materials retain exact bytes and source through the common log codec', () => {
  assert.deepEqual(CASES, EXPECTED_CASES);
  const files = fixture();
  const decoded = decodeSheetEvidence(encodeSheetEvidence(files, SOURCE), SOURCE);
  assert.deepEqual(decoded, files);
  assert.throws(() => decodeSheetEvidence(rawPackets(files), 'c'.repeat(40)));
});

test('material capability facts preserve false and null while effective Blur remains mandatory', () => {
  const facts = { advancedEffectsEnabled: true, areEffectsSupported: true, areEffectsFast: false };
  const expected = { ...CASES[0], ...processIdentity };
  const value = { ...observation(), materialCapabilities: facts };
  assert.equal(validateObservation(value, expected), value);
  assert.throws(
    () => validateObservation({ ...value, effectiveMaterial: 'Solid' }, expected),
    (error) => error.sheetPhase === 'capability',
  );
  const files = fixture();
  for (const entry of CASES) {
    const value = JSON.parse(files.get(`${entry.name}.json`));
    value.materialCapabilities = {
      advancedEffectsEnabled: entry.material === 'Blur',
      areEffectsSupported: true,
      areEffectsFast: entry.theme === 'Dark' ? null : false,
    };
    files.set(`${entry.name}.json`, json(value));
  }
  assert.deepEqual(decodeSheetEvidence(encodeSheetEvidence(files, SOURCE), SOURCE), files);
  assert.throws(
    () => validateObservation({ ...observation(), materialCapabilities: null }, expected),
    (error) => error.sheetPhase === 'capability',
  );
});

test('material capability admission binds ready Frame facts across validate and both real codecs', () => {
  // Инертные JSON/PNG DTO: нет env fixtures, Native API или запуска capture.
  const accepted = {
    readyWithoutFacts: 0,
    blurWithTransparencyDisabled: 0,
    blurWithUnsupportedFalse: 0,
    blurWithUnsupportedNull: 0,
  };
  let positiveCases = 0;
  const filesFor = (entry, value) => {
    const files = fixture();
    files.set(`${entry.name}.json`, json(value));
    return files;
  };
  const reject = (entry, value, condition) => {
    const files = filesFor(entry, value);
    for (const boundary of [
      () => validateObservation(value, { ...entry, ...processIdentity }),
      () => encodeSheetEvidence(files, SOURCE),
      () => decodeSheetEvidence(rawPackets(files), SOURCE),
    ]) {
      try {
        boundary();
        accepted[condition]++;
      } catch (error) {
        assert.equal(error.sheetPhase, 'capability');
      }
    }
  };
  const admit = (entry, value) => {
    assert.equal(validateObservation(value, { ...entry, ...processIdentity }), value);
    const files = filesFor(entry, value);
    assert.deepEqual(decodeSheetEvidence(encodeSheetEvidence(files, SOURCE), SOURCE), files);
    positiveCases++;
  };
  for (const entry of CASES) {
    reject(
      entry,
      { ...observation(entry.theme, entry.material), materialCapabilities: null },
      'readyWithoutFacts',
    );
    if (entry.material === 'Solid') {
      admit(entry, {
        ...observation(entry.theme, entry.material),
        materialCapabilities: {
          advancedEffectsEnabled: false,
          areEffectsSupported: null,
          areEffectsFast: null,
        },
      });
      continue;
    }
    for (const advancedEffectsEnabled of [true, false, null])
      for (const areEffectsSupported of [true, false, null])
        for (const areEffectsFast of [true, false, null]) {
          const value = {
            ...observation(entry.theme, entry.material),
            materialCapabilities: { advancedEffectsEnabled, areEffectsSupported, areEffectsFast },
          };
          if (advancedEffectsEnabled === false)
            reject(entry, value, 'blurWithTransparencyDisabled');
          else if (areEffectsSupported !== true)
            reject(
              entry,
              value,
              areEffectsSupported === false
                ? 'blurWithUnsupportedFalse'
                : 'blurWithUnsupportedNull',
            );
          else admit(entry, value);
        }
  }
  assert.equal(positiveCases, 14, 'supported Fast=false/null and explicit Solid remain admitted');
  const legacy = fixture();
  assert.equal(legacy.size, 9);
  assert.deepEqual(decodeSheetEvidence(encodeSheetEvidence(legacy, SOURCE), SOURCE), legacy);
  assert.deepEqual(
    accepted,
    {
      readyWithoutFacts: 0,
      blurWithTransparencyDisabled: 0,
      blurWithUnsupportedFalse: 0,
      blurWithUnsupportedNull: 0,
    },
    'inconsistent ready facts were admitted by real validate/encode/decode',
  );
});

test('material capability publication rejects open fields and never evaluates getters', () => {
  const facts = { advancedEffectsEnabled: true, areEffectsSupported: true, areEffectsFast: false };
  const expected = { ...CASES[0], ...processIdentity };
  const marker = 'MATERIAL_PRIVATE_SENTINEL';
  let getters = 0;
  const accessors = ['advancedEffectsEnabled', 'areEffectsSupported', 'areEffectsFast'].map(
    (field) =>
      Object.defineProperty({ ...facts }, field, {
        enumerable: true,
        get() {
          getters++;
          return marker;
        },
      }),
  );
  const accessor = accessors[2];
  const symbolic = { ...facts, [Symbol('privateDetail')]: marker };
  for (const malformed of [
    marker,
    [],
    {},
    { ...facts, privateDetail: marker },
    { ...facts, areEffectsFast: marker },
    { ...facts, areEffectsSupported: 1 },
    { ...facts, advancedEffectsEnabled: undefined },
    symbolic,
    Object.create(facts),
    ...accessors,
  ]) {
    const value = { ...observation(), materialCapabilities: malformed };
    assert.throws(() => validateObservation(value, expected));
    if (!accessors.includes(malformed) && malformed !== symbolic) {
      const files = fixture();
      files.set('Light-Blur.json', json(value));
      assert.throws(() => encodeSheetEvidence(files, SOURCE));
      assert.throws(() => decodeSheetEvidence(rawPackets(files), SOURCE));
    }
  }
  const log = (value) =>
    sheetFailureLog({
      sourceSha: SOURCE,
      name: 'Light-Blur',
      phase: 'capability',
      pid: 42,
      observation: value,
      error: null,
      cleanupError: null,
      stderrBytes: 0,
    });
  const readback = (value) =>
    JSON.parse(log(value).slice('LABUI_SHEET_FAILURE_JSON '.length)).observation;
  assert.deepEqual(
    readback({ ...observation(), materialCapabilities: facts }).materialCapabilities,
    facts,
  );
  assert.equal(Object.hasOwn(readback(observation()), 'materialCapabilities'), false);
  assert.equal(
    readback({ ...observation(), materialCapabilities: marker }).materialCapabilities,
    null,
  );
  assert.deepEqual(
    readback({ ...observation(), materialCapabilities: accessor }).materialCapabilities,
    { ...facts, areEffectsFast: null },
  );
  const topAccessor = Object.defineProperty(observation(), 'materialCapabilities', {
    enumerable: true,
    get() {
      getters++;
      return marker;
    },
  });
  assert.throws(() => validateObservation(topAccessor, expected));
  assert.equal(readback(topAccessor).materialCapabilities, null);
  assert.doesNotMatch(
    log({ ...observation(), materialCapabilities: { ...facts, privateDetail: marker } }),
    /MATERIAL_PRIVATE_SENTINEL|privateDetail/,
  );
  assert.equal(getters, 0);
});

test('failed capture preserves bounded source and capability diagnostics without becoming evidence', () => {
  const observed = {
    ...observation(),
    effectiveMaterial: 'Solid',
    materialReason: 'EffectsNotFast',
    privateEnvironment: { token: 'not-for-job-log' },
  };
  let primary;
  try {
    validateObservation(observed, { ...EXPECTED_CASES[0], ...processIdentity });
  } catch (error) {
    primary = error;
  }
  assert.ok(primary);
  const line = sheetFailureLog({
    sourceSha: SOURCE,
    name: 'Light-Blur',
    phase: 'observation',
    pid: 42,
    observation: observed,
    error: primary,
    cleanupError: new Error('sheet: cleanup deadline'),
    stderrBytes: 17,
    stderr: 'not-for-job-log',
  });
  const value = JSON.parse(line.slice('LABUI_SHEET_FAILURE_JSON '.length));
  assert.equal(value.source, SOURCE);
  assert.equal(value.name, 'Light-Blur');
  assert.equal(value.phase, 'capability');
  assert.equal(value.pid, 42);
  assert.equal(value.observation.effectiveMaterial, 'Solid');
  assert.equal(value.observation.materialReason, 'EffectsNotFast');
  assert.deepEqual(value.error, { type: 'AssertionError', code: 'ERR_ASSERTION' });
  assert.deepEqual(value.cleanupError, { type: 'Error', code: null });
  assert.equal(value.stderrBytes, 17);
  assert.doesNotMatch(line, /not-for-job-log|privateEnvironment|"stderr"/);
  assert.throws(() => decodeSheetEvidence(line, SOURCE));
  const partial = new Map([['Light-Blur.json', json(observed)]]);
  assert.throws(() => decodeSheetEvidence(line + rawPackets(partial), SOURCE));
  const malformed = sheetFailureLog({
    sourceSha: SOURCE,
    name: 'Light-Blur',
    phase: 'readiness',
    pid: 42,
    observation: null,
    error: new SyntaxError('not-for-job-log'),
    stderrBytes: 0,
  });
  const absent = JSON.parse(malformed.slice('LABUI_SHEET_FAILURE_JSON '.length));
  assert.equal(absent.phase, 'readiness');
  assert.equal(absent.observation, null);
  assert.doesNotMatch(malformed, /not-for-job-log/);
  const oversized = sheetFailureLog({
    sourceSha: SOURCE,
    name: 'Light-Blur',
    phase: 'render',
    pid: 42,
    observation: { ...observed, error: 'x'.repeat(64000) },
    error: new Error(`sheet: ${'x'.repeat(64000)}`),
    stderrBytes: 0,
  });
  assert.ok(Buffer.byteLength(oversized) < 8192);
  for (const [phase, change] of [
    ['render', { error: 'device lost' }],
    ['render', { rendererReady: false }],
    ['readiness', { imageLoaded: false }],
    ['readiness', { layoutReady: false }],
    ['geometry', { rasterizationScale: 1.5 }],
    ['geometry', { body: { x: 0, y: 406, width: 375, height: 406 } }],
  ]) {
    assert.throws(
      () =>
        validateObservation(
          { ...observation(), ...change },
          { ...EXPECTED_CASES[0], ...processIdentity },
        ),
      (error) => error.sheetPhase === phase,
    );
  }
});

test('startup diagnostics distinguish image failure and typed application errors without free-form text', () => {
  const marker = 'PRIVATE_VALUE_NOT_FOR_LOG';
  const readback = (error) => {
    const line = sheetFailureLog({
      sourceSha: SOURCE,
      name: 'Light-Blur',
      phase: 'render',
      pid: 42,
      observation: { ...observation(), error },
      error: new Error(marker),
      stderrBytes: 0,
    });
    assert.doesNotMatch(line, new RegExp(marker));
    assert.throws(() => decodeSheetEvidence(line, SOURCE));
    return JSON.parse(line.slice('LABUI_SHEET_FAILURE_JSON '.length)).observation.error;
  };
  for (const error of [
    { origin: 'image', type: null, hresult: null },
    { origin: 'unhandled', type: 'COMException', hresult: -2147024809 },
    { origin: 'unhandled', type: 'InvalidOperationException', hresult: -2147483648 },
    { origin: 'unhandled', type: 'Exception', hresult: 2147483647 },
  ]) {
    assert.deepEqual(readback({ ...error, message: marker, stack: marker }), error);
    assert.throws(
      () =>
        validateObservation(
          { ...observation(), error },
          { ...EXPECTED_CASES[0], ...processIdentity },
        ),
      (failure) => failure.sheetPhase === 'render',
    );
  }
  assert.deepEqual(readback({ origin: marker, type: marker, hresult: marker }), {
    origin: null,
    type: null,
    hresult: null,
  });
  for (const hresult of [-2147483649, 2147483648, 1.25, Number.NaN, Number.POSITIVE_INFINITY])
    assert.deepEqual(readback({ origin: 'unhandled', type: 'COMException', hresult }), {
      origin: 'unhandled',
      type: 'COMException',
      hresult: null,
    });
  assert.equal(readback(marker), 'reported');
  assert.equal(readback([marker]), 'invalid');
});

test('diagnostics retain only known renderer failure sites and keep rejecting failures', () => {
  const marker = 'PRIVATE_RENDERER_SITE_NOT_FOR_LOG';
  for (const site of [
    'Compositor.CreateEffectFactory',
    'CanvasComposition.CreateDrawingSession',
    'SheetLayers.BuildFrame',
    'CompositionGraphicsDevice.CreateVirtualDrawingSurface',
    'SheetLayers.DrawAtlasCell',
    marker,
  ]) {
    const error = { origin: 'unhandled', type: 'ArgumentException', hresult: -2147024809, site };
    const line = sheetFailureLog({
      sourceSha: SOURCE,
      name: 'Light-Blur',
      phase: 'render',
      pid: 42,
      observation: { ...observation(), error },
      error: new Error(marker),
      stderrBytes: 0,
    });
    assert.doesNotMatch(line, new RegExp(marker));
    const readback = JSON.parse(line.slice('LABUI_SHEET_FAILURE_JSON '.length)).observation.error;
    assert.deepEqual(readback, { ...error, site: site === marker ? null : site });
    assert.throws(() => decodeSheetEvidence(line, SOURCE));
    assert.throws(
      () =>
        validateObservation(
          { ...observation(), error },
          { ...EXPECTED_CASES[0], ...processIdentity },
        ),
      (failure) => failure.sheetPhase === 'render',
    );
  }
});

test('source topology diagnostics preserve bounded cases without publishing private data', () => {
  const marker = 'PRIVATE_TOPOLOGY_NOT_FOR_LOG';
  const sample = {
    index: 0,
    inputs: 2,
    combine: 'Arithmetic',
    source: 'shared',
    named: false,
    blur: true,
    mask: true,
    hresult: 0,
    cleanupHresult: null,
  };
  const readback = (topology) => {
    const error = {
      origin: 'unhandled',
      type: 'ArgumentException',
      hresult: -2147024809,
      site: 'Compositor.CreateEffectFactory',
      topology,
    };
    const line = sheetFailureLog({
      sourceSha: SOURCE,
      name: 'Light-Blur',
      phase: 'render',
      pid: 42,
      observation: { ...observation(), error },
      error: new Error(marker),
      stderrBytes: 0,
    });
    assert.doesNotMatch(line, new RegExp(marker));
    assert.throws(() => decodeSheetEvidence(line, SOURCE));
    assert.throws(
      () =>
        validateObservation(
          { ...observation(), error },
          { ...EXPECTED_CASES[0], ...processIdentity },
        ),
      (failure) => failure.sheetPhase === 'render',
    );
    return JSON.parse(line.slice('LABUI_SHEET_FAILURE_JSON '.length)).observation.error.topology;
  };
  assert.deepEqual(readback([{ ...sample, message: marker, path: marker }]), [sample]);
  assert.deepEqual(readback([{ ...sample, hresult: -2147024809, cleanupHresult: -2147483648 }]), [
    { ...sample, hresult: -2147024809, cleanupHresult: -2147483648 },
  ]);
  assert.deepEqual(
    readback([
      {
        ...sample,
        combine: marker,
        source: marker,
        named: marker,
        index: 20,
        inputs: 100,
        hresult: 2147483648,
      },
    ]),
    [
      {
        ...sample,
        combine: null,
        source: null,
        named: null,
        index: null,
        inputs: null,
        hresult: null,
      },
    ],
  );
  for (const invalid of [null, marker, {}, Array.from({ length: 21 }, () => sample)])
    assert.equal(readback(invalid), null);
});

test('diagnostics classify free-form exceptions and malformed geometry without publishing their text', async (t) => {
  const marker = 'PRIVATE_VALUE_NOT_FOR_LOG';
  for (const [name, change, phase] of [
    ['application exception', { error: marker }, 'render'],
    ['malformed geometry', { body: { x: marker, y: 390, width: 375, height: 422 } }, 'geometry'],
  ])
    await t.test(name, () => {
      const observed = { ...observation(), ...change };
      let failure;
      try {
        validateObservation(observed, { ...EXPECTED_CASES[0], ...processIdentity });
      } catch (error) {
        failure = error;
      }
      assert.ok(failure);
      const line = sheetFailureLog({
        sourceSha: SOURCE,
        name: 'Light-Blur',
        phase: 'observation',
        pid: 42,
        observation: observed,
        error: failure,
        stderrBytes: 0,
      });
      assert.doesNotMatch(line, new RegExp(marker));
      const parsed = JSON.parse(line.slice('LABUI_SHEET_FAILURE_JSON '.length));
      assert.equal(parsed.phase, phase);
      assert.equal(parsed.observation.imageLoaded, true);
      assert.equal(parsed.observation.requestedMaterial, 'Blur');
    });
  await t.test('prefix, error code and phase cannot authorize arbitrary text', () => {
    const failure = Object.assign(new Error(`sheet: ${marker}`), {
      code: marker,
      sheetPhase: marker,
    });
    const line = sheetFailureLog({
      sourceSha: SOURCE,
      name: 'Light-Blur',
      phase: 'render',
      pid: 42,
      observation: null,
      error: failure,
      cleanupError: failure,
      stderrBytes: 0,
    });
    assert.doesNotMatch(line, new RegExp(marker));
  });
});

test('CLI rejection does not republish an application exception in terminal stderr', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'labui-sheet-private-'));
  try {
    const files = fixture();
    const marker = 'PRIVATE_VALUE_NOT_FOR_LOG';
    files.set('Light-Blur.json', json({ ...observation(), error: marker }));
    const log = join(directory, 'job.log');
    await writeFile(log, rawPackets(files));
    const result = spawnSync(
      process.execPath,
      [CLI, 'decode', log, SOURCE, join(directory, 'decoded')],
      { encoding: 'utf8', windowsHide: true, timeout: 10000 },
    );
    assert.notEqual(result.status, 0);
    assert.doesNotMatch(result.stdout + result.stderr, new RegExp(marker));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('incomplete, duplicate, foreign, corrupted or unqualified evidence cannot be published', () => {
  const complete = fixture();
  for (const file of complete.keys()) {
    const partial = new Map(complete);
    partial.delete(file);
    assert.throws(() => encodeSheetEvidence(partial, SOURCE));
    assert.throws(() => decodeSheetEvidence(rawPackets(partial), SOURCE));
  }
  const foreign = new Map(complete);
  foreign.set('../escape.json', json({}));
  assert.throws(() => decodeSheetEvidence(rawPackets(foreign), SOURCE));
  const repeated =
    rawPackets(complete) +
    rawPackets(new Map([['Light-Blur.json', complete.get('Light-Blur.json')]]));
  assert.throws(() => decodeSheetEvidence(repeated, SOURCE));
  const corrupt = new Map(complete);
  corrupt.set('Light-Blur.png', png().subarray(0, -1));
  assert.throws(() => decodeSheetEvidence(rawPackets(corrupt), SOURCE));
  const wrongPid = new Map(complete);
  wrongPid.set('Light-Blur.json', json({ ...observation(), pid: 43 }));
  assert.throws(() => decodeSheetEvidence(rawPackets(wrongPid), SOURCE));
  for (const changedOwner of [
    { startedAtUnixMs: null },
    { observedUntilUnixMs: '200' },
    { windowHandle: undefined },
    { windowAfter: { pid: 42, windowHandle: '5678', startedAtUnixMs: 110 } },
    { windowAfter: { pid: 42, windowHandle: '1234', startedAtUnixMs: 111 } },
  ]) {
    const files = new Map(complete);
    const identity = JSON.parse(files.get('identity.json'));
    Object.assign(identity.cases['Light-Blur'], changedOwner);
    files.set('identity.json', json(identity));
    assert.throws(() => decodeSheetEvidence(rawPackets(files), SOURCE));
  }
});

test('real CLI decodes once and refuses local native capture before creating output', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'labui-sheet-codec-'));
  try {
    const log = join(directory, 'job.log');
    await writeFile(log, rawPackets(fixture()));
    const decoded = join(directory, 'decoded');
    const run = (args, env = process.env) =>
      spawnSync(process.execPath, [CLI, ...args], {
        encoding: 'utf8',
        env,
        windowsHide: true,
        timeout: 10000,
      });
    const first = run(['decode', log, SOURCE, decoded]);
    assert.equal(first.status, 0, first.stderr);
    assert.deepEqual(await readFile(join(decoded, 'Light-Blur.png')), png());
    assert.notEqual(run(['decode', log, SOURCE, decoded]).status, 0);
    const local = join(directory, 'local');
    const denied = run(['capture', directory, local, log, SOURCE], {
      ...process.env,
      GITHUB_ACTIONS: 'false',
      RUNNER_ENVIRONMENT: '',
    });
    assert.notEqual(denied.status, 0);
    assert.match(denied.stderr, /"code":"SHEET_HOST_REQUIRED"/);
    await assert.rejects(readFile(join(local, 'identity.json')), { code: 'ENOENT' });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
