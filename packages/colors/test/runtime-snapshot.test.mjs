import assert from 'node:assert/strict';
import { test } from 'vitest';
import { snapshotState } from '../runtime-snapshot.mjs';

test('Core optional reason is translated to the public nullable reason', () => {
  for (const [reason, expected] of [
    [undefined, null],
    [null, null],
    ['infeasible', 'infeasible'],
  ]) {
    const state = snapshotState(
      { state: 'ready', reason, revision: 1n, snapshotVersion: 2, outputCount: () => 3 },
      { theme: 'light', contrast: 'normal' },
    );
    assert.equal(state.reason, expected);
    assert.equal(state.outputCount, 3);
  }
});
