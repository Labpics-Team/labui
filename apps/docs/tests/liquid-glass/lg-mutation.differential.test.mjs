import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
// Liquid Glass — Class-D mutation bite-proof (test plan #8). The genuine TDD-RED.
//
// For each of the 10 effect dimensions (lens/MAX_PULL, dispersion, blur, tint,
// rim-sheen, depth, saturate, brightness, contrast, reduced-tint-opacity) the
// harness weakens it in a THROWAWAY engine copy and asserts the ch02 visual gate
// reports pass:false (the weakening is CAUGHT). A gate that cannot catch a
// deliberate break is theater — `allCaught === true` proves it is not.
//
// THE CONTRACT UNDER TEST (ch03 must create it):
//   prototypes/liquid-glass/lg-harness.mjs — exports async `runMutationHarness()`
//   ported from C:/Users/Daniel/lg-mutate-test.mjs (external absolute paths and
//   the foreign @playwright path DROPPED; HARDENED points at prototypes/
//   liquid-glass/; GATE at the ch02-ported gate against the frozen repo baseline).
//   It mkdtemp-copies the engine, weakens ONE dimension, re-runs the gate in diff
//   mode, and collects { dimension: caught } + allCaught — never mutating the
//   committed engine.
//
// RED until lg-harness.mjs exports runMutationHarness(). Failure is an explicit
// assertion about the MISSING harness contract — never a bare import crash.
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const HARNESS = resolve(HERE, '../../../../prototypes/liquid-glass/lg-harness.mjs');

// The 10 dimensions the gate MUST catch (the bite-proof set). Each must appear in
// the harness result as `caught === true`.
const DIMENSIONS = [
  'lens-strength',
  'dispersion',
  'blur',
  'tint',
  'rim-sheen',
  'depth',
  'saturate',
  'brightness',
  'contrast',
  'reduced-tint-opacity',
];

let harness = null;
let importError = null;
try {
  harness = await import(`file://${HARNESS}`);
} catch (err) {
  importError = err;
}

test(
  'mutation harness catches all 10 deliberately-weakened dimensions (allCaught)',
  { skip: process.env.CI ? 'Skip heavy mutation testing in CI to avoid timeouts' : false },
  async () => {
    assert.ok(
      harness !== null,
      `repo harness prototypes/liquid-glass/lg-harness.mjs must exist (ch03 port of lg-mutate-test.mjs, external paths dropped); import failed: ${importError ? importError.message : 'unknown'}`,
    );
    assert.equal(
      typeof harness.runMutationHarness,
      'function',
      `lg-harness.mjs must export async runMutationHarness(), got ${typeof harness?.runMutationHarness}`,
    );

    const result = await harness.runMutationHarness();

    // Every dimension must be present AND caught — a missing dimension is a silent
    // hole in the bite-proof set.
    for (const dim of DIMENSIONS) {
      assert.equal(
        result[dim],
        true,
        `mutation '${dim}' must be CAUGHT (the gate must report pass:false when it is weakened)`,
      );
    }
    assert.equal(
      result.allCaught,
      true,
      'allCaught must be true — a gate that cannot catch a deliberate break is theater',
    );
  },
);
