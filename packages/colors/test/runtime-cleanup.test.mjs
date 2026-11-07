import assert from 'node:assert/strict';
import { test } from 'vitest';
import { createThemeRuntime } from '../runtime.mjs';
import { declaration, recorderAbi } from './runtime-support.mjs';

function fixture({ failure = 'none', during = 'none' } = {}) {
  const events = [];
  let broken = true;
  let inCore = false;
  let install;
  const fault = new Error('cleanup boundary refused');
  const attachment = {
    updateObserved() {
      inCore = true;
      try {
        if (during === 'cancel') runtime.cancel();
        if (during === 'dispose') runtime.dispose();
        if (during === 'install-cancel' || during === 'install-dispose') {
          assert.equal(install({ operation: 'setAll' }), true);
        }
        return {
          state: 'ready',
          reason: null,
          revision: 1n,
          snapshotVersion: 1,
          outputCount: () => 1,
          free() {
            events.push('snapshot-free');
          },
        };
      } finally {
        inCore = false;
      }
    },
    dispose() {
      assert.equal(inCore, false);
      events.push('dispose');
      if (during === 'release') runtime.dispose();
    },
    free() {
      assert.equal(inCore, false);
      events.push('free');
    },
  };
  const runtime = createThemeRuntime({
    config: {},
    prepare: declaration,
    readInputs: () => ({
      theme: 'light',
      contrast: 'normal',
      observation: { kind: 'observed', surface: [255, 255, 255] },
    }),
    loader: async () => ({
      abi: recorderAbi(),
      owner: {
        attachProgramWire(_wire, _stream, _bindings, callback) {
          install = callback;
          return attachment;
        },
      },
    }),
    makeHost: () => ({
      isCurrent: () => true,
      install() {
        runtime[during === 'install-cancel' ? 'cancel' : 'dispose']();
        events.push('install-effect');
        return true;
      },
      revoke() {
        events.push('revoke');
        if (failure === 'revoke' && broken) throw fault;
      },
      close() {
        events.push('close');
      },
    }),
    finalize() {
      events.push('finalize');
      if (failure === 'finalize' && broken) throw fault;
    },
  });
  return {
    runtime,
    events,
    fault,
    restore() {
      broken = false;
    },
  };
}

for (const action of ['cancel', 'dispose']) {
  test(`retains retiring Core owner when revoke fails during ${action}`, async () => {
    // Given: healthy owner, transient revoke failure.
    const f = fixture({ failure: 'revoke' });
    assert.equal((await f.runtime.refresh()).state, 'ready');
    // When: cleanup fails, then the same public operation retries after restoration.
    const failed = f.runtime[action]();
    f.restore();
    const terminal = f.runtime[action]();
    // Then: failure is truthful and the retained attachment is freed exactly once.
    assert.equal(failed.reason, 'cleanup_failed');
    assert.equal(failed.cleanup, f.fault);
    assert.equal(terminal.state, action === 'cancel' ? 'cancelled' : 'disposed');
    f.runtime.dispose();
    assert.equal(f.events.filter((e) => e === 'dispose').length, 1);
    assert.equal(f.events.filter((e) => e === 'free').length, 1);
  });
}

test('retries only unfinished finalize after Core release', async () => {
  // Given: browser finalize fails after successful Core release.
  const f = fixture({ failure: 'finalize' });
  await f.runtime.refresh();
  // When: dispose is retried after the boundary recovers.
  const failed = f.runtime.dispose();
  f.restore();
  const completed = f.runtime.dispose();
  // Then: terminal is delayed and destructive Core cleanup is not replayed.
  assert.equal(failed.state, 'failed');
  assert.equal(failed.reason, 'cleanup_failed');
  assert.equal(completed.state, 'disposed');
  assert.equal(f.events.filter((e) => e === 'dispose').length, 1);
  assert.equal(f.events.filter((e) => e === 'free').length, 1);
  assert.equal(f.events.filter((e) => e === 'finalize').length, 2);
});

for (const during of ['cancel', 'dispose', 'release', 'install-cancel', 'install-dispose']) {
  test(`finishes cleanup exactly once after ${during} reentry`, async () => {
    // Given: cleanup requested from Core update or attachment disposal.
    const f = fixture({ during });
    // When: the real runtime reaches and unwinds that callback.
    const result = await f.runtime.refresh();
    if (during === 'release') f.runtime.dispose();
    // Then: the owner is freed only outside Core, exactly once.
    if (during !== 'release')
      assert.equal(result.state, during.endsWith('cancel') ? 'cancelled' : 'disposed');
    if (during.startsWith('install-'))
      assert.ok(f.events.lastIndexOf('revoke') > f.events.indexOf('install-effect'));
    assert.equal(f.events.filter((e) => e === 'dispose').length, 1);
    assert.equal(f.events.filter((e) => e === 'free').length, 1);
    assert.equal(f.runtime.dispose().state, 'disposed');
  });
}
