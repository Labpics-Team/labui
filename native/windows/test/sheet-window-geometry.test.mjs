import assert from 'node:assert/strict';
import test from 'node:test';
import { sheetFailureLog, validateObservation } from './sheet.mjs';

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
