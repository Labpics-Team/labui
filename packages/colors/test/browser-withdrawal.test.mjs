import assert from 'node:assert/strict';
import { test } from 'vitest';
import { createThemeRuntime } from '../runtime.mjs';
import { declaration } from './runtime-support.mjs';

test('reports cleanup failure when withdrawal fails before host attachment', async () => {
  // Given: input rejection and a browser boundary that cannot withdraw.
  const cleanup = new Error('withdrawal refused');
  const input = new Error('invalid authored input');
  const runtime = createThemeRuntime({
    config: {},
    prepare: declaration,
    readInputs() {
      throw input;
    },
    makeHost() {
      throw new Error('host must not be constructed');
    },
    loader: async () => ({ owner: {}, abi: {} }),
    withdraw() {
      throw cleanup;
    },
  });
  // When: runtime handles the failed input.
  const state = await runtime.refresh();
  // Then: withdrawal failure is observable rather than swallowed by onState.
  assert.equal(state.state, 'failed');
  assert.equal(state.reason, 'cleanup_failed');
  assert.equal(state.cleanup, cleanup);
  assert.equal(state.error, input);
});
