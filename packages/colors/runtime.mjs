import { prepareEngineConfig } from './prepare-config.mjs';
import { compileTheme, withRoleOverrides } from './program.mjs';

import { loadColors, nextRevision, observationKey } from './runtime-inputs.mjs';
import { snapshotState } from './runtime-snapshot.mjs';
export { loadColors } from './runtime-inputs.mjs';

// allow: SIZE_OK — единая state machine generation/retire/inCore; разрыв замыканий меняет reentry guards.
/** Imperative shell: выбор, математика, revision и replay остаются у Core attachment. */
export function createThemeRuntime({
  config,
  readInputs,
  makeHost,
  loader = loadColors,
  onState = () => {},
  wasmUrl,
  prepare = prepareEngineConfig,
  withdraw = () => {},
  finalize = () => {},
}) {
  const input = structuredClone(config);
  const models = new Map();
  const programs = new Map();
  let loaded;
  let flight;
  let loadAbort;
  let generation = 0;
  let active;
  let disposed = false;
  let cancelled = false;
  let terminal;
  let finishing = false;
  let terminalWithdrawn = false;
  let applications = Promise.resolve();
  let state = Object.freeze({ state: 'waiting', reason: 'loading', revision: null });

  const publish = (next) => {
    state = Object.freeze(next);
    try {
      onState(state);
    } catch (error) {
      globalThis.reportError?.(error);
    }
    return state;
  };
  const current = (requestedGeneration) =>
    !disposed && !cancelled && generation === requestedGeneration;
  const release = (retiring) => {
    if (retiring.releasing) return;
    retiring.releasing = true;
    try {
      // Фаза отмечается только после успешного эффекта; throw сохраняет owner для retry.
      if (!retiring.revoked) {
        retiring.host.revoke();
        retiring.revoked = true;
      }
      if (!retiring.closed) {
        retiring.host.close();
        retiring.closed = true;
      }
      if (retiring.attachment) {
        if (!retiring.coreDisposed) {
          retiring.attachment.dispose(true);
          retiring.coreDisposed = true;
        }
        retiring.attachment.free();
        retiring.attachment = undefined;
      }
      if (active === retiring) active = undefined;
    } catch (cleanup) {
      // Ошибка принадлежит cleanup owner, даже если reentry уже сменил generation.
      publish({ state: 'failed', reason: 'cleanup_failed', revision: null, cleanup });
      throw cleanup;
    } finally {
      retiring.releasing = false;
    }
    // Любой успешный release, включая замену декларации, завершает pending terminal.
    if (terminal && !finishing && !retiring.inCore) finish();
  };
  const retire = (retiring = active) => {
    if (!retiring) return withdraw();
    retiring.retired = true;
    if (retiring.inCore) {
      // install ещё может завершить внешний эффект; окончательный revoke — после unwind.
      try {
        retiring.host.revoke();
      } finally {
        if (!retiring.closed) {
          retiring.host.close();
          retiring.closed = true;
        }
      }
    } else {
      release(retiring);
    }
  };
  const finish = () => {
    if (!terminal) return state;
    if (finishing || active?.inCore || active?.releasing) {
      // Уже известный отказ сохраняется без повторной публикации и listener retry-цикла.
      if (state.reason === 'cleanup_failed') return state;
      return publish({ state: 'waiting', reason: 'cleanup_pending', revision: null });
    }
    finishing = true;
    try {
      if (!terminalWithdrawn) {
        retire();
        if (active) return state;
        terminalWithdrawn = true;
      }
      if (terminal === 'disposed') finalize();
      const completed = terminal;
      terminal = undefined;
      terminalWithdrawn = false;
      disposed = completed === 'disposed';
      return publish({ state: completed, reason: disposed ? null : 'cancelled', revision: null });
    } catch (cleanup) {
      return publish({ state: 'failed', reason: 'cleanup_failed', revision: null, cleanup });
    } finally {
      finishing = false;
      // Listener может усилить cancel до dispose; это намерение не теряется при reentry.
      if (terminal && state.reason !== 'cleanup_failed' && !active?.releasing) finish();
    }
  };
  const coreCall = (attachment, call) => {
    attachment.inCore = true;
    try {
      return call();
    } finally {
      attachment.inCore = false;
      if (attachment.retired) {
        try {
          release(attachment);
        } catch (cleanup) {
          // Ошибка освобождения наблюдаема, но не превращает отмену в старый Failed.
          publish({ state: 'failed', reason: 'cleanup_failed', revision: null, cleanup });
        }
      }
      if (terminal && state.reason !== 'cleanup_failed') finish();
    }
  };
  const fail = (error, requestedGeneration) => {
    try {
      retire();
    } catch (cleanup) {
      if (requestedGeneration !== undefined && !current(requestedGeneration)) return state;
      return publish({ state: 'failed', reason: 'cleanup_failed', revision: null, error, cleanup });
    }
    if (requestedGeneration !== undefined && !current(requestedGeneration)) return state;
    return publish({
      state: 'failed',
      reason: error?.code ?? 'runtime_error',
      revision: null,
      error,
    });
  };
  const apply = (requestedGeneration, read) => {
    if (!current(requestedGeneration)) return state;
    let snapshot;
    try {
      const inputs = read();
      if (!current(requestedGeneration)) return state;
      const { theme, contrast, observation, overrides = [] } = inputs;
      if (!['light', 'dark'].includes(theme) || !['normal', 'more'].includes(contrast)) {
        throw new Error('неизвестная тема или режим контраста');
      }
      const baseKey = `${theme}/${contrast}`;
      const overridesKey = JSON.stringify(overrides);
      const key = `${baseKey}/${overridesKey}`;
      if (!models.has(contrast)) models.set(contrast, prepare(input, contrast));
      if (!current(requestedGeneration)) return state;
      const baseModel = models.get(contrast);
      let cached = programs.get(baseKey);
      if (cached?.overridesKey !== overridesKey) {
        const { model, selected } = withRoleOverrides(
          baseModel,
          baseModel.themes[theme],
          overrides,
        );
        if (selected.pending.length) throw new Error(selected.pending.join('; '));
        cached = { overridesKey, selected, program: compileTheme(loaded.abi, model, selected) };
        // Один вариант на тему/контраст ограничивает память при авторских изменениях.
        programs.set(baseKey, cached);
      }
      if (!current(requestedGeneration)) return state;
      const { program, selected } = cached;
      const observedKey = observationKey(observation);
      if (!current(requestedGeneration)) return state;
      if (active?.retired || active?.key !== key || (active && !active.host.isCurrent())) {
        retire();
        if (!current(requestedGeneration)) return state;
        const host = makeHost(program, selected, overrides);
        const attached = {
          attachment: undefined,
          host,
          key,
          revision: 0n,
          observation: null,
          requestedGeneration,
          inCore: false,
          retired: false,
        };
        if (!current(requestedGeneration)) {
          retire(attached);
          return state;
        }
        active = attached;
        try {
          coreCall(attached, () => {
            attached.attachment = loaded.owner.attachProgramWire(
              program.wire,
              1,
              program.bindings,
              (intent) => {
                if (attached.retired || !current(attached.requestedGeneration)) return false;
                // ACK отражает настоящий install, даже если он вызвал cancel/dispose.
                return host.install(intent);
              },
            );
          });
        } catch (error) {
          retire(attached);
          throw error;
        }
      }
      if (!current(requestedGeneration)) return state;
      const attached = active;
      attached.requestedGeneration = requestedGeneration;
      const revision =
        attached.observation === observedKey ? attached.revision : nextRevision(attached);
      snapshot = coreCall(attached, () =>
        observation.kind === 'observed'
          ? attached.attachment.updateObserved(
              revision,
              new Uint32Array([1]),
              Uint8Array.from(observation.surface),
              1,
            )
          : attached.attachment.updateUnknown(revision, 1),
      );
      if (!current(requestedGeneration)) return state;
      attached.observation = observedKey;
      const next = snapshotState(snapshot, { theme, contrast });
      snapshot.free();
      snapshot = undefined;
      return publish(next);
    } catch (error) {
      return current(requestedGeneration) ? fail(error, requestedGeneration) : state;
    } finally {
      snapshot?.free();
    }
  };
  const enqueue = (requestedGeneration, read) => {
    const result = applications.then(() => apply(requestedGeneration, read));
    applications = result.then(
      () => {},
      () => {},
    );
    return result;
  };
  const refresh = (read = readInputs) => {
    if (disposed) return Promise.resolve(state);
    if (terminal) return Promise.resolve(finish());
    cancelled = false;
    const requestedGeneration = ++generation;
    if (loaded) return enqueue(requestedGeneration, read);
    if (!flight) {
      loadAbort = new AbortController();
      const signal = loadAbort.signal;
      const started = Promise.resolve()
        .then(() => loader({ signal, wasmUrl }))
        .then((value) => {
          if (flight === started && !signal.aborted) loaded = value;
          return value;
        })
        .finally(() => {
          if (flight === started) flight = undefined;
        });
      flight = started;
    }
    return flight.then(
      () => (current(requestedGeneration) ? enqueue(requestedGeneration, read) : state),
      (error) => (current(requestedGeneration) ? fail(error, requestedGeneration) : state),
    );
  };
  return {
    get state() {
      return state;
    },
    refresh,
    cancel() {
      if (disposed) return state;
      ++generation;
      cancelled = true;
      loadAbort?.abort();
      flight = undefined;
      terminal ??= 'cancelled';
      if (active?.inCore) {
        try {
          retire();
        } catch (cleanup) {
          return publish({ state: 'failed', reason: 'cleanup_failed', revision: null, cleanup });
        }
        return publish({ state: 'waiting', reason: 'cleanup_pending', revision: null });
      }
      return finish();
    },
    dispose() {
      if (disposed) return state;
      ++generation;
      cancelled = true;
      loadAbort?.abort();
      flight = undefined;
      terminal = 'disposed';
      if (active?.inCore) {
        try {
          retire();
        } catch (cleanup) {
          return publish({ state: 'failed', reason: 'cleanup_failed', revision: null, cleanup });
        }
        return publish({ state: 'waiting', reason: 'cleanup_pending', revision: null });
      }
      return finish();
    },
  };
}
