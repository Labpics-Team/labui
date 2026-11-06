import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decodeSheetEvidence, sheetFailureLog, validateObservation } from './sheet.mjs';

const SOURCE = 'a'.repeat(40);

// Только инертная проекция значений; эти данные не обозначают native outcome.
function readback(factory, ...pairs) {
  const [branches, field = 'factory', pairField = 'branches'] = pairs;
  return errorReadback({
    factory,
    ...(pairs.length > 0 ? { [pairField]: branches } : {}),
  })[field];
}

function errorReadback(fields) {
  const observation = {
    pid: 42,
    windowHandle: '17',
    observedAtUnixMs: 150,
    theme: 'Light',
    requestedMaterial: 'Blur',
    rendererReady: false,
    error: {
      origin: 'unhandled',
      type: 'ArgumentException',
      hresult: -2147024809,
      site: 'Compositor.CreateEffectFactory',
      ...fields,
    },
  };
  const line = sheetFailureLog({
    sourceSha: SOURCE,
    name: 'Light-Blur',
    phase: 'render',
    pid: 42,
    observation,
    error: new Error('PRIVATE_FACTORY_VALUE'),
    stderrBytes: 0,
  });
  assert.doesNotMatch(line, /PRIVATE_(FACTORY|BRANCH)_VALUE/);
  assert.throws(() => decodeSheetEvidence(line, SOURCE));
  assert.throws(
    () =>
      validateObservation(observation, {
        pid: 42,
        startedAtUnixMs: 100,
        observedUntilUnixMs: 200,
        theme: 'Light',
        material: 'Blur',
      }),
    (failure) => failure.sheetPhase === 'render',
  );
  const result = JSON.parse(line.slice('LABUI_SHEET_FAILURE_JSON '.length));
  assert.equal(result.observation.rendererReady, false);
  assert.equal(result.observation.error.hresult, -2147024809);
  return result.observation.error;
}

test('factory failure identifies the actual call without admitting the failed renderer', () => {
  for (const name of [
    'ghostPair0',
    'ghostPair1',
    'ghostPair2',
    'ghostPair3',
    'progressive',
    'ghost',
    'body',
    'final',
  ])
    for (const operation of ['factory', 'brush', 'binding'])
      assert.deepEqual(readback({ name, operation }), { name, operation });
});

test('factory failure rejects private names, unknown fields and malformed values', () => {
  const factory = { name: 'ghostPair0', operation: 'factory' };
  assert.equal(readback(null), null);
  for (const value of [
    [],
    'PRIVATE_FACTORY_VALUE',
    42,
    {},
    { name: 'ghostPair0' },
    { operation: 'factory' },
    { ...factory, name: 'PRIVATE_FACTORY_VALUE' },
    { ...factory, operation: 'PRIVATE_FACTORY_VALUE' },
    { ...factory, name: 'GhostPair0' },
    { ...factory, operation: 'Factory' },
    { ...factory, name: ['ghostPair0'] },
    { ...factory, operation: ['factory'] },
    { ...factory, extra: 'PRIVATE_FACTORY_VALUE' },
    { ...factory, properties: { token: 'PRIVATE_FACTORY_VALUE' } },
  ])
    assert.equal(readback(value), null);
});

test('actual AlphaMask factory outcomes retain both branch slots and the primary renderer failure', () => {
  const factory = { name: 'ghostPair0', operation: 'factory' };
  for (const rows of [
    [
      { hresult: 0, cleanupHresult: null },
      { hresult: 0, cleanupHresult: null },
    ],
    [
      { hresult: -2147024809, cleanupHresult: null },
      { hresult: 0, cleanupHresult: -2147467259 },
    ],
    [
      { hresult: null, cleanupHresult: null },
      { hresult: null, cleanupHresult: null },
    ],
  ])
    assert.deepEqual(readback(factory, rows, 'branches'), rows);
  assert.equal(readback(factory, null, 'branches'), null);
});

test('actual factory pairs retain raw outcomes without admitting the failed renderer', () => {
  const factory = { name: 'final', operation: 'factory' };
  for (const rows of [
    [
      { hresult: 0, cleanupHresult: null },
      { hresult: -2147024809, cleanupHresult: null },
    ],
    [
      { hresult: -2147024809, cleanupHresult: null },
      { hresult: 0, cleanupHresult: -2147467259 },
    ],
    [
      { hresult: null, cleanupHresult: null },
      { hresult: null, cleanupHresult: null },
    ],
  ])
    for (const field of ['clamping', 'sigma'])
      assert.deepEqual(readback(factory, rows, field, field), rows);
});

test('borrowed factory pairs reject unknown fields, malformed integers and partial arrays', () => {
  const factory = { name: 'ghostPair0', operation: 'factory' };
  const row = { hresult: 0, cleanupHresult: null };
  for (const rows of [
    [],
    [row],
    [row, row, row],
    new Array(2),
    [row, null],
    [row, { ...row, extra: 'PRIVATE_BRANCH_VALUE' }],
    [row, { ...row, hresult: 'PRIVATE_BRANCH_VALUE' }],
    [row, { ...row, cleanupHresult: 1.5 }],
    [row, { ...row, hresult: 2147483648 }],
    [row, { ...row, hresult: -2147483649 }],
    [row, { ...row, hresult: Number.NaN }],
    [row, { ...row, cleanupHresult: {} }],
    [row, { ...row, hresult: undefined }],
  ])
    for (const field of ['branches', 'clamping', 'sigma'])
      assert.equal(readback(factory, rows, field, field), null);
});

test('actual factory diagnostics retain raw build/factory and cleanup outcomes while the primary renderer still fails', () => {
  const factory = { name: 'final', operation: 'factory' };
  for (const field of ['actualThree', 'actualLayer'])
    for (const stage of ['build', 'factory'])
      for (const hresult of [-2147483648, -2147024809, 0, 2147483647])
        for (const cleanupHresult of [null, -2147483648, 2147483647]) {
          const outcome = { stage, hresult, cleanupHresult };
          const error = errorReadback({ factory, [field]: outcome });
          assert.deepEqual(error.factory, factory);
          assert.deepEqual(error[field], outcome);
          assert.equal(
            Object.hasOwn(error, field === 'actualThree' ? 'actualLayer' : 'actualThree'),
            false,
          );
        }
});

test('actual factory diagnostics reject unknown fields, private text and missing measurement instead of inventing PASS', () => {
  const factory = { name: 'final', operation: 'factory' };
  const actualThree = { stage: 'factory', hresult: 0, cleanupHresult: null };
  for (const value of [
    null,
    [],
    [actualThree],
    42,
    'PRIVATE_BRANCH_VALUE',
    {},
    { stage: 'factory', hresult: 0 },
    { ...actualThree, stage: null },
    { ...actualThree, stage: 'Factory' },
    { ...actualThree, stage: 'brush' },
    { ...actualThree, stage: 'binding' },
    { ...actualThree, stage: 'PRIVATE_BRANCH_VALUE' },
    { ...actualThree, hresult: null },
    { ...actualThree, hresult: undefined },
    { ...actualThree, hresult: 1.5 },
    { ...actualThree, hresult: 2147483648 },
    { ...actualThree, hresult: -2147483649 },
    { ...actualThree, hresult: Number.NaN },
    { ...actualThree, hresult: Number.POSITIVE_INFINITY },
    { ...actualThree, hresult: 'PRIVATE_BRANCH_VALUE' },
    { ...actualThree, cleanupHresult: undefined },
    { ...actualThree, cleanupHresult: {} },
    { ...actualThree, cleanupHresult: 1.5 },
    { ...actualThree, cleanupHresult: 2147483648 },
    { ...actualThree, cleanupHresult: -2147483649 },
    { ...actualThree, message: 'PRIVATE_BRANCH_VALUE' },
  ])
    for (const field of ['actualThree', 'actualLayer'])
      assert.equal(errorReadback({ factory, [field]: value })[field], null);
});

test('legacy factory, branch and sigma shapes survive without an actual-three field', () => {
  const factory = { name: 'final', operation: 'factory' };
  const pair = [
    { hresult: -2147024809, cleanupHresult: null },
    { hresult: 0, cleanupHresult: null },
  ];
  const legacy = errorReadback({ factory, branches: pair, sigma: pair });
  assert.deepEqual(legacy.factory, factory);
  assert.deepEqual(legacy.branches, pair);
  assert.deepEqual(legacy.sigma, pair);
  assert.equal(Object.hasOwn(legacy, 'actualThree'), false);
  assert.equal(Object.hasOwn(legacy, 'actualLayer'), false);
  const measured = errorReadback({
    factory,
    branches: pair,
    sigma: pair,
    actualThree: { stage: 'factory', hresult: 0, cleanupHresult: null },
  });
  assert.deepEqual(measured, {
    ...legacy,
    actualThree: { stage: 'factory', hresult: 0, cleanupHresult: null },
  });
  assert.equal(Object.hasOwn(measured, 'actualLayer'), false);
  const actualLayer = { stage: 'factory', hresult: -2147024809, cleanupHresult: -2147467259 };
  assert.deepEqual(
    errorReadback({
      factory,
      branches: pair,
      sigma: pair,
      actualThree: measured.actualThree,
      actualLayer,
    }),
    { ...measured, actualLayer },
  );
  assert.deepEqual(
    errorReadback({
      factory,
      branches: pair,
      sigma: pair,
      actualThree: measured.actualThree,
      actualLayer: {},
    }),
    { ...measured, actualLayer: null },
  );
});
