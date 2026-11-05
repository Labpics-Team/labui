import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decodeSheetEvidence, sheetFailureLog, validateObservation } from './sheet.mjs';

const SOURCE = 'a'.repeat(40);

// Только инертная проекция значений; эти данные не обозначают native outcome.
function readback(factory) {
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
      factory,
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
  assert.doesNotMatch(line, /PRIVATE_FACTORY_VALUE/);
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
  return result.observation.error.factory;
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
