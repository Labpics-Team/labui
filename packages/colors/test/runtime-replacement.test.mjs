import assert from 'node:assert/strict';
import { test } from 'vitest';
import { createThemeRuntime } from '../runtime.mjs';
import { declaration, recorderAbi } from './runtime-support.mjs';

for (const entrance of ['replacement', 'failure', 'explicit']) {
  for (const action of ['cancel', 'dispose']) {
    test(`drains ${action} reentry after ${entrance} retirement`, async () => {
      // Given: один здоровый host; reentry возникает внутри обычного revoke без throw.
      const events = [];
      const counts = { dispose: 0, free: 0, finalize: 0, attach: 0 };
      let theme = 'light';
      let inputBroken = false;
      let armed = false;
      let nested;
      const runtime = createThemeRuntime({
        config: {},
        prepare: declaration,
        readInputs() {
          if (inputBroken) throw new Error('input refused');
          return {
            theme,
            contrast: 'normal',
            observation: { kind: 'observed', surface: [255, 255, 255] },
          };
        },
        loader: async () => ({
          abi: recorderAbi(),
          owner: {
            attachProgramWire() {
              counts.attach++;
              return {
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
              };
            },
          },
        }),
        makeHost: () => ({
          isCurrent: () => true,
          install: () => true,
          revoke() {
            if (armed) {
              armed = false;
              nested = runtime[action]();
            }
          },
          close() {},
        }),
        finalize() {
          counts.finalize++;
        },
        onState(state) {
          events.push(state.state);
        },
      });
      assert.equal((await runtime.refresh()).state, 'ready');
      events.length = 0;
      armed = true;
      theme = 'dark';
      inputBroken = entrance === 'failure';
      // When: public replacement/failure/explicit path reaches and unwinds revoke.
      const result = entrance === 'explicit' ? runtime[action]() : await runtime.refresh();
      // Then: pending is truthful, final state requires no second manual request/frame.
      const expected = action === 'cancel' ? 'cancelled' : 'disposed';
      assert.equal(nested.state, 'waiting');
      assert.equal(nested.reason, 'cleanup_pending');
      assert.equal(result.state, expected);
      assert.equal(runtime.state.state, expected);
      assert.deepEqual(events, ['waiting', expected]);
      assert.equal(counts.attach, 1);
      assert.equal(counts.dispose, 1);
      assert.equal(counts.free, 1);
      assert.equal(counts.finalize, action === 'dispose' ? 1 : 0);
    });
  }
}

test('drains dispose escalation from replacement cancel terminal listener', async () => {
  // Given: terminal listener усиливает cancel до dispose, без рекурсивного release.
  const counts = { dispose: 0, free: 0, finalize: 0 };
  let theme = 'light';
  let armed = false;
  let nested;
  const events = [];
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
        if (armed) {
          armed = false;
          runtime.cancel();
        }
      },
      close() {},
    }),
    finalize() {
      counts.finalize++;
    },
    onState(state) {
      events.push(state.state);
      if (state.state === 'cancelled') nested = runtime.dispose();
    },
  });
  await runtime.refresh();
  armed = true;
  theme = 'dark';
  // When: replacement unwinds, then the completed cancel listener requests dispose.
  const result = await runtime.refresh();
  // Then: final terminal priority is disposed, nested state is pending, release exactly once.
  assert.equal(result.state, 'disposed');
  assert.equal(nested.reason, 'cleanup_pending');
  assert.equal(runtime.state.state, 'disposed');
  assert.equal(events.at(-1), 'disposed');
  assert.deepEqual(counts, { dispose: 1, free: 1, finalize: 1 });
});
