import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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

// Source-only: текущая factory scheme проходит оба настоящих wire-проектора.
export function assertSheetSourceProjection(producer, projector, codec) {
  const cases = producer.slice(
    producer.indexOf('private static readonly Case[] cases'),
    producer.indexOf('internal static CompositionEffectFactory CreateFactory'),
  );
  const sources = [...cases.matchAll(/new\(\d+,\s*(?:true|false),\s*"([^"]+)"/g)]
    .map((match) => match[1]);
  assert.equal(sources.length, 20, 'Sheet: bounded source cases missing');
  const csharp = projector.match(/\["source"\]\s*=\s*Known\(row\["source"\],([^)]*)\)/)?.[1];
  const javascript = codec.match(/source:\s*known\(row\.source,\s*\[([^\]]*)\]\)/)?.[1];
  assert.ok(csharp && javascript, 'Sheet: actual source projectors missing');
  const csharpValues = new Set([...csharp.matchAll(/"([^"]+)"/g)].map((match) => match[1]));
  const javascriptValues = new Set([...javascript.matchAll(/'([^']+)'/g)].map((match) => match[1]));
  assert.deepEqual([...csharpValues].sort(), [...javascriptValues].sort(), 'Sheet: source vocabularies differ');
  for (const source of sources)
    assert.ok(csharpValues.has(source), 'Sheet: current source scheme is lost in projection');
}

test('current Sheet factory source schemes survive both real wire projectors', async () => {
  const files = await Promise.all([
    readFile(new URL('../Rendering/SheetSourceTopologyProbe.cs', import.meta.url), 'utf8'),
    readFile(new URL('../../../examples/windows/SheetSourceTopology.cs', import.meta.url), 'utf8'),
    readFile(new URL('./sheet.mjs', import.meta.url), 'utf8'),
  ]);
  assertSheetSourceProjection(...files);
});

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

test('balanced Add preserves raw factory success or failure without clearing the primary failure', () => {
  for (const hresult of [0, -2147024809]) {
    const balanced = { ...sample, index: 15, combine: 'BalancedAdd', stage: 'factory', hresult };
    assert.deepEqual(readback([sample, balanced]), [sample, balanced]);
  }
});

test('topology accepts all twenty cases and rejects an oversized diagnostic without truncation', () => {
  const rows = Array.from({ length: 16 }, (_, index) => ({
    ...sample,
    index,
    combine: index === 15 ? 'BalancedAdd' : 'Add',
    stage: 'factory',
  }));
  rows.push(
    {
      ...sample,
      index: 16,
      inputs: 1,
      combine: 'Gaussian',
      mask: false,
      stage: 'factory',
      levelStart: 7,
      sigmas: [12],
    },
    {
      ...sample,
      index: 17,
      inputs: 1,
      combine: 'Gaussian',
      mask: false,
      stage: 'factory',
      sigmas: [64],
    },
    { ...sample, index: 18, inputs: 2, stage: 'factory', levelStart: 6, sigmas: [6, 12] },
    { ...sample, index: 19, blur: false, mask: false, stage: 'factory' },
  );
  assert.deepEqual(readback(rows), rows);
  assert.equal(readback([...rows, sample]), null);
});

test('balanced Add retains closed combine names and the index boundary', () => {
  const balanced = { ...sample, index: 15, combine: 'BalancedAdd', stage: 'factory' };
  for (const combine of [
    'balancedAdd',
    'BinaryAdd',
    'PRIVATE_STAGE_NOT_FOR_LOG',
    42,
    {},
    ['BalancedAdd'],
  ])
    assert.deepEqual(readback([{ ...balanced, combine }]), [{ ...balanced, combine: null }]);
  for (const index of [-1, 20, 1.5, '15'])
    assert.deepEqual(readback([{ ...balanced, index }]), [{ ...balanced, index: null }]);
});

test('actual sigma diagnostics preserve only single Gaussian and the selected Add pair', () => {
  for (const hresult of [0, -2147024809]) {
    const rows = [
      {
        ...sample,
        index: 16,
        inputs: 1,
        combine: 'Gaussian',
        mask: false,
        stage: 'factory',
        levelStart: 7,
        sigmas: [12],
        hresult,
      },
      {
        ...sample,
        index: 17,
        inputs: 1,
        combine: 'Gaussian',
        mask: false,
        stage: 'factory',
        sigmas: [64],
        hresult,
      },
      {
        ...sample,
        index: 18,
        inputs: 2,
        stage: 'factory',
        levelStart: 6,
        sigmas: [6, 12],
        hresult,
      },
      { ...sample, index: 19, blur: false, stage: 'factory', hresult },
    ];
    assert.deepEqual(readback(rows), rows);
  }
});

test('sigma diagnostics reject unknown, nonfinite and oversized values while retaining the failure', () => {
  const gaussian = {
    ...sample,
    index: 16,
    inputs: 1,
    combine: 'Gaussian',
    mask: false,
    levelStart: 7,
    sigmas: [12],
  };
  for (const sigmas of [
    null,
    [],
    [1, 2, 3],
    [-1],
    [Number.NaN],
    [Number.POSITIVE_INFINITY],
    [1e308],
    ['12'],
    [{}],
    new Array(1),
    'PRIVATE_STAGE_NOT_FOR_LOG',
  ])
    assert.deepEqual(readback([{ ...gaussian, sigmas }]), [{ ...gaussian, sigmas: null }]);
  for (const levelStart of [-1, 8, 1.5, '7', {}, null])
    assert.deepEqual(readback([{ ...gaussian, levelStart }]), [{ ...gaussian, levelStart: null }]);
  for (const combine of ['gaussian', 'GaussianBlur', 'PRIVATE_STAGE_NOT_FOR_LOG'])
    assert.deepEqual(readback([{ ...gaussian, combine }]), [{ ...gaussian, combine: null }]);
});
