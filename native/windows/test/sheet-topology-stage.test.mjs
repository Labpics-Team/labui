import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decodeSheetEvidence, sheetFailureLog, validateObservation } from './sheet.mjs';

const SOURCE = 'a'.repeat(40);
const sample = {
  index: 11,
  inputs: 8,
  combine: 'Add',
  source: 'repeat',
  named: false,
  blur: true,
  mask: true,
  hresult: -2147024809,
  cleanupHresult: null,
};

function readback(topology) {
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
      topology,
    },
  };
  const line = sheetFailureLog({
    sourceSha: SOURCE,
    name: 'Light-Blur',
    phase: 'render',
    pid: 42,
    observation,
    error: new Error('PRIVATE_STAGE_NOT_FOR_LOG'),
    cleanupError: null,
    stderrBytes: 0,
  });
  assert.doesNotMatch(line, /PRIVATE_STAGE_NOT_FOR_LOG/);
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
  return JSON.parse(line.slice('LABUI_SHEET_FAILURE_JSON '.length)).observation.error.topology;
}

test('topology stage distinguishes build and factory for the same failure HRESULT', () => {
  const rows = ['build', 'factory'].map((stage) => ({ ...sample, stage }));
  assert.deepEqual(readback(rows), rows);
});

test('topology stage preserves legacy rows without inventing a known operation', () => {
  assert.deepEqual(readback([sample]), [sample]);
  assert.deepEqual(readback([{ ...sample, stage: null }]), [{ ...sample, stage: null }]);
});

test('topology stage accepts only the two closed operation names', () => {
  for (const stage of ['Factory', 'render', 'PRIVATE_STAGE_NOT_FOR_LOG', 42, {}, ['factory']])
    assert.deepEqual(readback([{ ...sample, stage }]), [{ ...sample, stage: null }]);
});
