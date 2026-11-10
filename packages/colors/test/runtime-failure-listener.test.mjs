import assert from 'node:assert/strict';
import { test } from 'vitest';
import { createThemeRuntime } from '../runtime.mjs';
import { declaration, recorderAbi } from './runtime-support.mjs';

for (const listener of [false, true]) {
  test(`retains persistent cleanup cause with failure listener ${listener}`, async () => {
    // Given: здоровый owner и persistent revoke fault при замене темы.
    const fault = new Error('persistent revoke refused');
    const counts = { revoke: 0, dispose: 0, free: 0, finalize: 0, listener: 0 };
    const states = [];
    let theme = 'light';
    let broken = false;
    let nested;
    const runtime = createThemeRuntime({
      config: {},
      prepare: declaration,
      readInputs: () => ({
        theme,
        contrast: 'normal',
        observation: { kind: 'observed', surface: [255, 255, 255] },
      }),
      loader: async () => ({
        abi: recorderAbi(),
        owner: {
          attachProgramWire: () => ({
            updateObserved: () => ({
              state: 'ready',
              reason: null,
              revision: 1n,
              snapshotVersion: 1,
              outputCount: () => 1,
              free() {},
            }),
            dispose() {
              counts.dispose++;
            },
            free() {
              counts.free++;
            },
          }),
        },
      }),
      makeHost: () => ({
        isCurrent: () => true,
        install: () => true,
        revoke() {
          counts.revoke++;
          if (broken) throw fault;
        },
        close() {},
      }),
      finalize() {
        counts.finalize++;
      },
      onState(state) {
        states.push(state);
        // Никакого one-shot listener workaround: каждый failure вызывает public dispose.
        if (listener && state.reason === 'cleanup_failed') {
          counts.listener++;
          assert.ok(counts.listener < 5, 'failure publication must not recurse indefinitely');
          nested = runtime.dispose();
        }
      },
    });
    assert.equal((await runtime.refresh()).state, 'ready');
    states.length = 0;
    broken = true;
    theme = 'dark';
    // When: replacement revoke fails and its synchronous listener records terminal intent.
    const failed = await runtime.refresh();
    const before = { ...counts };
    // Then: known phase/cause persists until explicit retry after boundary restoration.
    assert.equal(failed.state, 'failed');
    assert.equal(failed.reason, 'cleanup_failed');
    assert.equal(runtime.state.reason, 'cleanup_failed');
    assert.equal(failed.cleanup, fault);
    assert.ok(states.every((state) => state.reason === 'cleanup_failed'));
    if (listener) {
      assert.equal(nested.reason, 'cleanup_failed');
      assert.equal(nested.cleanup, fault);
      assert.equal(counts.listener, 1);
      assert.equal(before.revoke, 1);
    }
    assert.equal(before.dispose, 0);
    assert.equal(before.free, 0);
    broken = false;
    assert.equal(runtime.dispose().state, 'disposed');
    assert.equal(counts.dispose, 1);
    assert.equal(counts.free, 1);
    assert.equal(counts.finalize, 1);
  });
}
