import assert from 'node:assert/strict';
import test from 'node:test';
import { crc32, deflateSync } from 'node:zlib';
import {
  CASES,
  decodeSheetEvidence,
  encodeSheetEvidence,
  sheetFailureLog,
  validateObservation,
} from './sheet.mjs';

const sourceSha = 'a'.repeat(40);
const expected = {
  pid: 83,
  startedAtUnixMs: 100,
  observedUntilUnixMs: 300,
  theme: 'Light',
  material: 'Solid',
};
const observation = () => ({
  pid: 83,
  windowHandle: '170',
  observedAtUnixMs: 200,
  theme: 'Light',
  rasterizationScale: 1,
  requestedMaterial: 'Solid',
  effectiveMaterial: 'Solid',
  materialReason: 'Requested',
  error: null,
  rendererReady: true,
  layoutReady: true,
  imageLoaded: true,
  viewport: { x: 0, y: 0, width: 375, height: 812 },
  body: { x: 0, y: 390, width: 375, height: 422 },
  handle: { x: 170, y: 404, width: 36, height: 4 },
});
const geometry = (height) => ({
  status: 'complete',
  client: { width: 375, height },
  frame: { x: -300, y: 80, width: 391, height: height + 39 },
  workArea: { x: -1920, y: 0, width: 1920, height: 1040 },
  outerBounds: { x: -1920, y: 0, width: 1920, height: 1080 },
  presenter: 'Overlapped',
  visible: true,
  extendsContentIntoTitleBar: false,
});
const readback = (value, error = { name: 'AssertionError', code: 'ERR_ASSERTION' }) =>
  JSON.parse(
    sheetFailureLog({
      sourceSha,
      name: 'Light-Solid',
      phase: 'geometry',
      pid: 83,
      observation: value,
      error,
      cleanupError: null,
      stderrBytes: 0,
    })
      .trim()
      .slice('LABUI_SHEET_FAILURE_JSON '.length),
  );

test('размер после ResizeClient, активации и settled snapshot сохраняется раздельно', () => {
  const value = observation();
  value.windowGeometry = {
    afterResize: { ...geometry(812), visible: false },
    afterActivation: geometry(749),
    observed: geometry(749),
  };
  const result = readback(value);
  assert.deepEqual(result.observation.windowGeometry, value.windowGeometry);
  assert.equal(result.phase, 'geometry');
  assert.equal(result.error.type, 'AssertionError');
  assert.equal(result.error.code, 'ERR_ASSERTION');
  assert.equal(result.observation.viewport.height, 812);
});

test('дополнительный readback не меняет проверку фактической геометрии', () => {
  const value = observation();
  value.windowGeometry = {
    afterResize: geometry(812),
    afterActivation: geometry(812),
    observed: geometry(812),
  };
  assert.equal(validateObservation(value, expected), value);
  value.viewport.height = 749;
  assert.throws(
    () => validateObservation(value, expected),
    (error) => error.sheetPhase === 'geometry',
  );
  value.viewport.height = 812;
  value.rendererReady = false;
  assert.throws(
    () => validateObservation(value, expected),
    (error) => error.sheetPhase === 'render',
  );
});

test('ошибка дополнительного наблюдения сохраняет первичный отказ и ограниченные поля', () => {
  const value = observation();
  value.windowGeometry = {
    afterResize: null,
    afterActivation: {
      status: 'failed',
      type: 'COMException',
      hresult: -2147024809,
      message: 'private detail',
    },
    observed: {
      ...geometry(749),
      client: { width: 'private detail', height: Number.POSITIVE_INFINITY },
      secret: 'private detail',
    },
    unrelated: 'private detail',
  };
  const result = readback(value, { name: 'TypeError', code: 'ERR_INVALID_ARG_TYPE' });
  assert.equal(result.error.type, 'TypeError');
  assert.equal(result.error.code, 'ERR_INVALID_ARG_TYPE');
  assert.deepEqual(result.observation.windowGeometry.afterActivation, {
    status: 'failed',
    type: 'COMException',
    hresult: -2147024809,
  });
  assert.deepEqual(result.observation.windowGeometry.observed.client, {
    width: null,
    height: null,
  });
  assert.ok(!JSON.stringify(result).includes('private detail'));
});

test('предыдущий observation сохраняет прежний формат без выдуманного readback', () => {
  const value = observation();
  assert.equal(validateObservation(value, expected), value);
  assert.equal(Object.hasOwn(readback(value).observation, 'windowGeometry'), false);
});

test('все материалы отвергают постороннюю форму windowGeometry при публикации', () => {
  for (const entry of CASES) {
    const value = {
      ...observation(),
      theme: entry.theme,
      requestedMaterial: entry.material,
      effectiveMaterial: entry.material,
      windowGeometry: {
        afterResize: geometry(812),
        afterActivation: geometry(812),
        observed: geometry(812),
      },
    };
    const owner = { ...expected, ...entry };
    assert.equal(validateObservation(value, owner), value);
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
    ])
      assert.throws(() => validateObservation({ ...value, windowGeometry: malformed }, owner));
  }
});

test('материалы проверяют всю форму observation и вложенных bounds', () => {
  for (const entry of CASES) {
    const value = {
      ...observation(),
      theme: entry.theme,
      requestedMaterial: entry.material,
      effectiveMaterial: entry.material,
      requestedState: 'Half',
      geometryScale: 1,
      contentViewport: { x: 16, y: 438, width: 343, height: 358 },
      contentWitness: null,
    };
    const owner = { ...expected, ...entry };
    assert.equal(validateObservation(value, owner), value);
    for (const field of ['viewport', 'body', 'handle', 'contentViewport'])
      assert.throws(() =>
        validateObservation(
          { ...value, [field]: { ...value[field], message: 'WINDOW_PRIVATE_SENTINEL' } },
          owner,
        ),
      );
    for (const change of [
      { message: 'WINDOW_PRIVATE_SENTINEL' },
      { materialReason: 'WINDOW_PRIVATE_SENTINEL' },
      { contentWitness: { message: 'WINDOW_PRIVATE_SENTINEL' } },
      { requestedState: 'WINDOW_PRIVATE_SENTINEL' },
      { geometryScale: 'WINDOW_PRIVATE_SENTINEL' },
    ])
      assert.throws(() => validateObservation({ ...value, ...change }, owner));
  }
});

function materialFiles() {
  const identity = {
    source: sourceSha,
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
  const chunk = (name, payload) => {
    const bytes = Buffer.alloc(payload.length + 12);
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
  const image = Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.alloc((375 * 4 + 1) * 812))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  const files = new Map();
  for (const entry of CASES) {
    const window = { pid: expected.pid, windowHandle: '170', startedAtUnixMs: 110 };
    identity.cases[entry.name] = {
      pid: expected.pid,
      windowHandle: window.windowHandle,
      startedAtUnixMs: expected.startedAtUnixMs,
      observedUntilUnixMs: expected.observedUntilUnixMs,
      windowBefore: { ...window },
      windowAfter: { ...window },
      exited: true,
    };
    files.set(
      `${entry.name}.json`,
      Buffer.from(
        JSON.stringify({
          ...observation(),
          theme: entry.theme,
          requestedMaterial: entry.material,
          effectiveMaterial: entry.material,
        }),
      ),
    );
    files.set(`${entry.name}.png`, image);
  }
  files.set('identity.json', Buffer.from(JSON.stringify(identity)));
  return files;
}

test('публикация материалов проверяет identity, owner и native window records', () => {
  const healthy = materialFiles();
  assert.deepEqual(
    decodeSheetEvidence(encodeSheetEvidence(healthy, sourceSha), sourceSha),
    healthy,
  );
  for (const mutate of [
    (identity) => {
      identity.message = 'WINDOW_PRIVATE_SENTINEL';
    },
    (identity) => {
      identity.cliVersion = 'WINDOW_PRIVATE_SENTINEL';
    },
    (identity) => {
      identity.cases['Light-Solid'].message = 'WINDOW_PRIVATE_SENTINEL';
    },
    (identity) => {
      const owner = identity.cases['Light-Solid'];
      owner.windowBefore.message = 'WINDOW_PRIVATE_SENTINEL';
      owner.windowAfter.message = 'WINDOW_PRIVATE_SENTINEL';
    },
    (identity) => {
      identity.cases['Light-Solid'].termination = {
        code: 0,
        signal: null,
        message: 'WINDOW_PRIVATE_SENTINEL',
      };
    },
  ]) {
    const files = materialFiles();
    const identity = JSON.parse(files.get('identity.json'));
    mutate(identity);
    files.set('identity.json', Buffer.from(JSON.stringify(identity)));
    assert.throws(() => encodeSheetEvidence(files, sourceSha));
  }
});
