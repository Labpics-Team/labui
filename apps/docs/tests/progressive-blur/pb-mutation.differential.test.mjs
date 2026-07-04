import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
// Progressive blur — Class-D mutation bite-proof (launches Chromium).
//
// Eight dimensions are deliberately weakened in throwaway engine copies —
// feather, level count, easing, blur strength, strip tightness, axis,
// superlevel coverage, reduced-transparency — and the
// NAMED isolating check must flip to fail for each. A gate that survives a
// deliberate break is theater. Runs in `test:engine` (e2e job).
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const HARNESS = resolve(HERE, '../../../../prototypes/progressive-blur/pb-harness.mjs');

const DIMENSIONS = [
  'feather',
  'level-count',
  'easing',
  'blur-strength',
  'strip-tightness',
  'axis',
  'superlevel-coverage',
  'reduced-transparency',
];

test('mutation harness catches all 8 deliberately-weakened dimensions', async () => {
  const harness = await import(`file://${HARNESS}`);
  assert.equal(
    typeof harness.runPbMutations,
    'function',
    'pb-harness must export runPbMutations()',
  );
  const result = await harness.runPbMutations();
  for (const dim of DIMENSIONS) {
    assert.equal(result[dim], true, `mutation '${dim}' must be CAUGHT — ${result.detail?.[dim]}`);
  }
  assert.equal(result.allCaught, true, 'allCaught must be true');
});
