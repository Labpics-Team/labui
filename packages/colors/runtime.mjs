import { prepareEngineConfig } from './prepare-config.mjs';
import { compileTheme } from './program.mjs';

const revisionLimit = (1n << 64n) - 1n;

/** Загрузчик использует единственную инициализацию WASM, принадлежащую пакету Colors. */
export async function loadColors({ signal, wasmUrl } = {}) {
  signal?.throwIfAborted();
  const [owner, v1, v3] = await Promise.all([
    import('@labpics/colors'),
    import('@labpics/colors/program-wire/abi-v1.js'),
    import('@labpics/colors/program-wire/abi-v3.js'),
  ]);
  signal?.throwIfAborted();
  if (wasmUrl !== undefined) {
    const response = await fetch(wasmUrl, { signal });
    if (!response.ok) throw new Error(`WASM: HTTP ${response.status}`);
    const bytes = await response.arrayBuffer();
    signal?.throwIfAborted();
    await owner.default({ module_or_path: bytes });
  } else {
    await owner.default();
  }
  signal?.throwIfAborted();
  return { owner, abi: { ...v1, ...v3 } };
}

function observationKey(observation) {
  if (observation.kind === 'unknown') return `unknown:${observation.reason}`;
  const surface = observation.surface;
  if (
    observation.kind !== 'observed' ||
    !surface ||
    surface.length !== 3 ||
    ![...surface].every((value) => Number.isInteger(value) && value >= 0 && value <= 255)
  ) {
    throw new Error('наблюдение должно содержать один явный sRGB8 backdrop');
  }
  return `observed:${[...surface].join(',')}`;
}

/** Imperative shell: выбор, математика, revision и replay остаются у Core attachment. */
export function createThemeRuntime({
  config,
  readInputs,
  makeHost,
  loader = loadColors,
  onState = () => {},
  wasmUrl,
  prepare = prepareEngineConfig,
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
  const nextRevision = (attachment) => {
    if (attachment.revision === revisionLimit) throw new Error('revision исчерпана');
    return ++attachment.revision;
  };
  const release = (retiring) => {
    // После unwind повторный revoke убирает и эффект незавершённого host.install.
    try {
      retiring.host.revoke();
    } finally {
      retiring.host.close();
    }
    if (retiring.attachment) {
      retiring.attachment.dispose(true);
      retiring.attachment.free();
      retiring.attachment = undefined;
    }
  };
  const retire = (retiring = active) => {
    if (!retiring) return;
    if (active === retiring) active = undefined;
    retiring.retired = true;
    if (retiring.inCore) {
      try {
        retiring.host.revoke();
      } finally {
        retiring.host.close();
      }
    } else {
      release(retiring);
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
          publish({ ...state, reason: 'cleanup_failed', cleanup });
        }
      }
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
      const { theme, contrast, observation } = inputs;
      if (!['light', 'dark'].includes(theme) || !['normal', 'more'].includes(contrast)) {
        throw new Error('неизвестная тема или режим контраста');
      }
      const key = `${theme}/${contrast}`;
      if (!models.has(contrast)) models.set(contrast, prepare(input, contrast));
      if (!current(requestedGeneration)) return state;
      const model = models.get(contrast);
      const selected = model.themes[theme];
      if (selected.pending.length) throw new Error(selected.pending.join('; '));
      if (!programs.has(key)) programs.set(key, compileTheme(loaded.abi, model, selected));
      if (!current(requestedGeneration)) return state;
      const program = programs.get(key);
      const observedKey = observationKey(observation);
      if (!current(requestedGeneration)) return state;
      if (active?.key !== key || (active && !active.host.isCurrent())) {
        retire();
        if (!current(requestedGeneration)) return state;
        const host = makeHost(program, selected);
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
      const next = {
        state: snapshot.state,
        reason: snapshot.reason,
        revision: snapshot.revision,
        snapshotVersion: snapshot.snapshotVersion,
        theme,
        contrast,
        outputCount: snapshot.outputCount(),
      };
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
      try {
        retire();
        return publish({ state: 'cancelled', reason: 'cancelled', revision: null });
      } catch (error) {
        return fail(error);
      }
    },
    dispose() {
      if (disposed) return state;
      ++generation;
      cancelled = true;
      loadAbort?.abort();
      flight = undefined;
      try {
        retire();
        disposed = true;
        return publish({ state: 'disposed', reason: null, revision: null });
      } catch (error) {
        return fail(error);
      }
    },
  };
}
