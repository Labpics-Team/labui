import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

import config from '../labui.config.json' with { type: 'json' };
import { prepareEngineConfig } from '../prepare-config.mjs';
import { createThemeRuntime } from '../runtime.mjs';
import { declaration, deferred, recorderAbi } from './runtime-support.mjs';

function harness(loader, hooks = {}) {
  const operations = [];
  const surfaces = [];
  const abi = recorderAbi();
  let inputs = {
    theme: 'light',
    contrast: 'normal',
    observation: { kind: 'observed', surface: [255, 255, 255] },
  };
  let refusal = false;
  let intact = true;
  let installed = false;
  let inCore = false;
  const owner = {
    attachProgramWire(_wire, _stream, bindings, install) {
      operations.push(['attach', bindings.emissions.length]);
      let version = 0;
      let previous = null;
      const snapshot = (revision, state) => ({
        revision,
        snapshotVersion: version,
        state,
        reason: state === 'failed' ? 'infeasible' : null,
        outputCount: () => (state === 'ready' ? bindings.emissions.length : 0),
        free() {
          operations.push(['snapshot-free']);
        },
      });
      const attachment = {
        updateObserved(revision, _scenarios, surface) {
          if (previous !== revision) ++version;
          previous = revision;
          inCore = true;
          try {
            operations.push(['ack', install({ operation: refusal ? 'revokeAll' : 'setAll' })]);
          } finally {
            inCore = false;
          }
          operations.push(['observed', revision, version]);
          surfaces.push([...surface]);
          return snapshot(revision, refusal ? 'failed' : 'ready');
        },
        updateUnknown(revision) {
          if (previous !== revision) ++version;
          previous = revision;
          inCore = true;
          try {
            operations.push(['ack', install({ operation: 'revokeAll' })]);
          } finally {
            inCore = false;
          }
          operations.push(['unknown', revision]);
          return snapshot(revision, 'stale');
        },
        dispose(confirmed) {
          assert.equal(confirmed, true);
          assert.equal(inCore, false, 'attachment освобождён внутри вызова Core');
          operations.push(['dispose']);
        },
        free() {
          assert.equal(inCore, false, 'attachment free внутри вызова Core');
          operations.push(['free']);
        },
      };
      inCore = true;
      try {
        hooks.attach?.(runtime);
      } finally {
        inCore = false;
      }
      return attachment;
    },
  };
  const runtime = createThemeRuntime({
    config: hooks.full ? config : {},
    readInputs: () => hooks.read?.(runtime, inputs) ?? inputs,
    prepare: hooks.full ? prepareEngineConfig : () => declaration(),
    onState: (state) => hooks.state?.(runtime, state),
    makeHost: () => {
      hooks.host?.(runtime);
      let open = true;
      return {
        isCurrent() {
          return open && intact;
        },
        install(intent) {
          if (!open) return false;
          operations.push(['install', intent.operation]);
          installed = intent.operation === 'setAll';
          hooks.install?.(runtime, intent);
          return true;
        },
        revoke() {
          operations.push(['external-revoke']);
          installed = false;
          intact = true;
        },
        close() {
          open = false;
          operations.push(['close']);
        },
      };
    },
    loader: loader ?? (() => Promise.resolve({ owner, abi })),
  });
  return {
    runtime,
    owner,
    abi,
    operations,
    surfaces,
    installed: () => installed,
    inputs(next) {
      inputs = { ...inputs, ...next };
    },
    refuse(value) {
      refusal = value;
    },
    damage() {
      intact = false;
    },
  };
}

test('новая observation пересчитывает тот же attachment; повтор подтверждает прежнюю revision', async () => {
  const h = harness();
  assert.equal((await h.runtime.refresh()).state, 'ready');
  const initial = h.runtime.state;
  await h.runtime.refresh();
  assert.equal(h.runtime.state.revision, initial.revision);
  assert.equal(h.runtime.state.snapshotVersion, initial.snapshotVersion);
  h.inputs({ observation: { kind: 'observed', surface: [20, 30, 40] } });
  await h.runtime.refresh();
  assert.equal(h.runtime.state.revision, 2n);
  assert.equal(h.operations.filter(([kind]) => kind === 'attach').length, 1);
  assert.equal(h.abi.instances.length, 1);
  h.runtime.dispose();
});

test('observe cancel на полном Program не публикует старую попытку; новый запрос восстанавливается', async () => {
  let cancel = false;
  const h = harness(undefined, {
    full: true,
    read(runtime, inputs) {
      if (cancel) {
        cancel = false;
        runtime.cancel();
      }
      return inputs;
    },
  });
  await h.runtime.refresh();
  const before = h.surfaces.length;
  cancel = true;
  const stopped = await h.runtime.refresh();
  assert.equal(stopped.state, 'cancelled');
  assert.equal(h.runtime.state.state, 'cancelled');
  assert.equal(h.surfaces.length, before);
  assert.equal((await h.runtime.refresh()).state, 'ready');
  h.runtime.dispose();
});

test('observe dispose на полном Program сохраняет terminal даже при отказе закрытого host', async () => {
  let dispose = false;
  const h = harness(undefined, {
    full: true,
    read(runtime, inputs) {
      if (dispose) {
        dispose = false;
        runtime.dispose();
      }
      return inputs;
    },
    host(runtime) {
      if (runtime.state.state === 'disposed') throw new Error('CSS scope закрыт');
    },
  });
  await h.runtime.refresh();
  const before = h.surfaces.length;
  dispose = true;
  const stopped = await h.runtime.refresh();
  assert.equal(stopped.state, 'disposed');
  assert.equal(h.runtime.state.state, 'disposed');
  assert.equal(h.surfaces.length, before);
  await h.runtime.refresh();
  assert.equal(h.surfaces.length, before);
  const fresh = harness(undefined, { full: true });
  assert.equal((await fresh.runtime.refresh()).state, 'ready');
  fresh.runtime.dispose();
});

for (const action of ['cancel', 'dispose']) {
  test(`observe ${action}, затем throw сохраняет terminal и не публикует старый Failed`, async () => {
    let stop = false;
    const h = harness(undefined, {
      read(runtime, inputs) {
        if (stop) {
          runtime[action]();
          throw new Error('прежнее наблюдение завершилось после освобождения');
        }
        return inputs;
      },
    });
    await h.runtime.refresh();
    stop = true;
    assert.equal((await h.runtime.refresh()).state, action === 'cancel' ? 'cancelled' : 'disposed');
    assert.equal(h.installed(), false);
    h.runtime.dispose();
  });

  test(`install ${action} возвращает настоящий ACK, отзывает scope и освобождает после unwind`, async () => {
    let stop = false;
    const h = harness(undefined, {
      install(runtime) {
        if (stop) {
          stop = false;
          runtime[action]();
        }
      },
    });
    await h.runtime.refresh();
    h.inputs({ observation: { kind: 'observed', surface: [0, 0, 0] } });
    stop = true;
    const start = h.operations.length;
    assert.equal((await h.runtime.refresh()).state, action === 'cancel' ? 'cancelled' : 'disposed');
    const events = h.operations.slice(start);
    assert.deepEqual(
      events.find(([kind]) => kind === 'ack'),
      ['ack', true],
    );
    assert.ok(
      events.findIndex(([kind]) => kind === 'observed') <
        events.findIndex(([kind]) => kind === 'dispose'),
    );
    assert.equal(events.filter(([kind]) => kind === 'dispose').length, 1);
    assert.equal(events.filter(([kind]) => kind === 'free').length, 1);
    assert.equal(h.installed(), false);
    if (action === 'cancel') {
      assert.equal((await h.runtime.refresh()).state, 'ready');
      assert.equal(h.operations.filter(([kind]) => kind === 'attach').length, 2);
      assert.equal(h.installed(), true);
    }
    h.runtime.dispose();
  });
}

test('refresh внутри observe сериализует новый запрос и не выпускает прежний вход', async () => {
  let again = false;
  let next;
  const h = harness(undefined, {
    read(runtime, inputs) {
      if (again) {
        again = false;
        next = runtime.refresh(() => ({
          ...inputs,
          observation: { kind: 'observed', surface: [0, 0, 0] },
        }));
      }
      return inputs;
    },
  });
  await h.runtime.refresh();
  const before = h.surfaces.length;
  again = true;
  await h.runtime.refresh();
  assert.equal((await next).state, 'ready');
  assert.equal(h.surfaces.length, before + 1);
  assert.deepEqual(h.surfaces.at(-1), [0, 0, 0]);
  assert.equal(h.installed(), true);
  h.runtime.dispose();
});

test('refresh внутри публикации ставит следующий запрос после unwind', async () => {
  let again = false;
  let next;
  const h = harness(undefined, {
    state(runtime, state) {
      if (again && state.state === 'ready') {
        again = false;
        next = runtime.refresh();
      }
    },
  });
  await h.runtime.refresh();
  again = true;
  await h.runtime.refresh();
  assert.equal((await next).state, 'ready');
  assert.equal(h.operations.filter(([kind]) => kind === 'attach').length, 1);
  assert.ok(
    h.operations.filter(([kind]) => kind === 'ack').every(([, accepted]) => accepted === true),
  );
  h.runtime.dispose();
});

test('refresh внутри install сохраняет фактический ACK и последовательно применяет новый вход', async () => {
  let again = false;
  let next;
  const h = harness(undefined, {
    install(runtime) {
      if (again) {
        again = false;
        next = runtime.refresh(() => ({
          theme: 'light',
          contrast: 'normal',
          observation: { kind: 'observed', surface: [0, 0, 0] },
        }));
      }
    },
  });
  await h.runtime.refresh();
  again = true;
  await h.runtime.refresh();
  assert.equal((await next).state, 'ready');
  assert.deepEqual(h.surfaces.at(-1), [0, 0, 0]);
  assert.equal(h.operations.filter(([kind]) => kind === 'attach').length, 1);
  assert.ok(
    h.operations.filter(([kind]) => kind === 'ack').every(([, accepted]) => accepted === true),
  );
  h.runtime.dispose();
});

for (const action of ['cancel', 'dispose']) {
  test(`attach ${action} не публикует первый результат и освобождает созданный attachment`, async () => {
    const h = harness(undefined, {
      attach(runtime) {
        runtime[action]();
      },
    });
    assert.equal((await h.runtime.refresh()).state, action === 'cancel' ? 'cancelled' : 'disposed');
    assert.equal(h.surfaces.length, 0);
    assert.equal(h.operations.filter(([kind]) => kind === 'dispose').length, 1);
    assert.equal(h.operations.filter(([kind]) => kind === 'free').length, 1);
    assert.equal(h.installed(), false);
    h.runtime.dispose();
  });
}

test('настоящий frame tick не теряет black после white/black/white и не решает каждый кадр', async () => {
  const white = [255, 255, 255];
  const black = [0, 0, 0];
  const samples = [white, black, white, black];
  let reads = 0;
  const read = (_runtime, inputs) => ({
    ...inputs,
    observation: { kind: 'observed', surface: samples[reads++] ?? black },
  });
  const h = harness(undefined, { full: true, read });
  await h.runtime.refresh();
  const source = readFileSync(new URL('../browser.mjs', import.meta.url), 'utf8');
  const start = source.indexOf('  const tick = () => {');
  const end = source.indexOf('  const resume = () => {', start);
  assert.ok(start >= 0 && end > start, 'не найден production frame callback');
  let flight;
  const tick = new Function(
    'inputs',
    'refresh',
    'view',
    'scope',
    'runtime',
    'currentHost',
    `let frame = null; let closed = false; let paused = false; let lastInputs = null;\n${source.slice(start, end)}\nreturn tick;`,
  )(
    () => read(h.runtime, { theme: 'light', contrast: 'normal' }),
    (read) => {
      flight = h.runtime.refresh(read);
      return flight;
    },
    { requestAnimationFrame: () => 1 },
    { isConnected: true },
    h.runtime,
    { isCurrent: () => true },
  );
  for (let index = 0; index < 3; index++) {
    tick();
    await flight;
    await Promise.resolve();
  }
  assert.deepEqual(h.surfaces.at(-1), black);
  const settled = h.surfaces.length;
  for (let index = 0; index < 5; index++) {
    tick();
    await flight;
    await Promise.resolve();
  }
  assert.equal(h.surfaces.length, settled);
  h.runtime.dispose();
});

test('unknown и отказ не выпускают ready; допустимое наблюдение восстанавливает runtime', async () => {
  const h = harness();
  await h.runtime.refresh();
  h.inputs({ observation: { kind: 'unknown', reason: 'gradient' } });
  assert.equal((await h.runtime.refresh()).state, 'stale');
  assert.ok(
    h.operations.some(([kind, operation]) => kind === 'install' && operation === 'revokeAll'),
  );
  h.inputs({ observation: { kind: 'observed', surface: [0, 0, 0] } });
  h.refuse(true);
  assert.equal((await h.runtime.refresh()).state, 'failed');
  h.refuse(false);
  h.inputs({ observation: { kind: 'observed', surface: [255, 255, 255] } });
  assert.equal((await h.runtime.refresh()).state, 'ready');
  h.runtime.dispose();
});

test('смена declaration отзывает полный старый lease до нового attachment', async () => {
  const h = harness();
  await h.runtime.refresh();
  h.inputs({ theme: 'dark' });
  await h.runtime.refresh();
  const events = h.operations.map(([kind]) => kind);
  assert.ok(events.indexOf('external-revoke') < events.indexOf('dispose'));
  assert.ok(events.indexOf('dispose') < events.indexOf('free'));
  assert.equal(h.operations.filter(([kind]) => kind === 'attach').length, 2);
  h.runtime.dispose();
});

test('повреждённый host отзывается перед повторной публикацией полного Program', async () => {
  const h = harness();
  await h.runtime.refresh();
  h.damage();
  assert.equal((await h.runtime.refresh()).state, 'ready');
  assert.equal(h.operations.filter(([kind]) => kind === 'attach').length, 2);
  const events = h.operations.map(([kind]) => kind);
  assert.ok(events.indexOf('external-revoke') < events.indexOf('dispose'));
  assert.ok(events.indexOf('free') < events.lastIndexOf('attach'));
  h.runtime.dispose();
});

test('late init после cancel не заменяет новую committed owner', async () => {
  const old = deferred();
  const fresh = deferred();
  let requests = 0;
  const h = harness(() => (++requests === 1 ? old.promise : fresh.promise));
  const stale = h.runtime.refresh();
  await Promise.resolve();
  h.runtime.cancel();
  const current = h.runtime.refresh();
  await Promise.resolve();
  fresh.resolve({ owner: h.owner, abi: h.abi });
  await current;
  const committed = h.runtime.state;
  const badOwner = {
    attachProgramWire() {
      throw new Error('late owner was selected');
    },
  };
  old.resolve({ owner: badOwner, abi: h.abi });
  await stale;
  await h.runtime.refresh();
  assert.equal(h.runtime.state.state, 'ready');
  assert.equal(h.runtime.state.revision, committed.revision);
  assert.equal(h.operations.filter(([kind]) => kind === 'attach').length, 1);
  h.runtime.dispose();
});

test('dispose отменяет pending continuation; повтор dispose не выполняет новый эффект', async () => {
  const pending = deferred();
  const h = harness(() => pending.promise);
  const result = h.runtime.refresh();
  await Promise.resolve();
  assert.equal(h.runtime.dispose().state, 'disposed');
  pending.resolve({ owner: h.owner, abi: h.abi });
  await result;
  h.runtime.dispose();
  assert.equal(h.operations.length, 0);
});
