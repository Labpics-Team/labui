import { createInlineAuthority } from './browser-authority.mjs';
import { createAtomicHost } from './browser-host.mjs';
import {
  authoredCanvas,
  nearestMode,
  parseInlineColor,
  readOpaqueBackdrop,
} from './browser-inputs.mjs';
import defaultConfig from './labui.config.json' with { type: 'json' };
import { prepareEngineConfig } from './prepare-config.mjs';
import { themePropertyNames } from './program.mjs';
import { createThemeRuntime } from './runtime.mjs';

export { readOpaqueBackdrop } from './browser-inputs.mjs';
const scopeAttribute = 'data-lab-colors-scope';
const attachedScopes = new WeakSet();

/** Подключает один полный Program к одному CSS scope и явному независимому backdrop. */
export function attachLabuiColors({
  scope,
  backdrop,
  config = defaultConfig,
  observe,
  canvas,
  wasmUrl,
  onState = () => {},
} = {}) {
  const document = scope?.ownerDocument;
  const view = document?.defaultView;
  if (!view?.CSSStyleSheet || !scope.isConnected) {
    throw new Error('контекст не поддерживает атомарный CSS scope');
  }
  if (attachedScopes.has(scope) || scope.hasAttribute(scopeAttribute))
    throw new Error('CSS scope уже имеет владельца');
  if (!backdrop && !observe)
    throw new Error('нужна явная независимая подложка или observation provider');
  if (canvas !== undefined && canvas !== 'authored')
    throw new Error('неизвестная декларация canvas');
  if (!backdrop && canvas === 'authored') throw new Error('canvas требует явный backdrop');
  const source = structuredClone(config);
  const readBackdrop = observe ?? (() => readOpaqueBackdrop(backdrop));
  const scheme = view.matchMedia('(prefers-color-scheme: dark)');
  const contrast = view.matchMedia('(prefers-contrast: more)');
  const models = new Map();
  const modelFor = (config, mode) => {
    if (!models.has(mode)) models.set(mode, prepareEngineConfig(config, mode));
    return models.get(mode);
  };
  const initialTheme = nearestMode(scope, 'data-theme', ['light', 'dark'], scheme);
  const initialMode = nearestMode(scope, 'data-contrast', ['normal', 'more'], contrast);
  const initialNames = themePropertyNames(modelFor(source, initialMode).themes[initialTheme]);
  const authority = createInlineAuthority(scope, initialNames);
  let canvasInput = null;
  attachedScopes.add(scope);
  try {
    authority.acquire();
    if (canvas === 'authored')
      canvasInput = authoredCanvas({ scope, backdrop, config: source, modelFor });
  } catch (error) {
    try {
      authority.dispose();
    } catch (cleanup) {
      throw new AggregateError([error, cleanup], 'не удалось восстановить CSS scope', {
        cause: error,
      });
    } finally {
      attachedScopes.delete(scope);
    }
    throw error;
  }
  const inputs = () => {
    const theme = nearestMode(scope, 'data-theme', ['light', 'dark'], scheme);
    const mode = nearestMode(scope, 'data-contrast', ['normal', 'more'], contrast);
    canvasInput?.select(theme, mode);
    return {
      theme,
      contrast: mode,
      observation: readBackdrop(),
      overrides: authority.inputs().map((declaration) => ({
        ...declaration,
        ...parseInlineColor(declaration),
      })),
    };
  };
  scope.setAttribute('data-lab-colors-state', 'waiting');
  let frame = null;
  let closed = false;
  let paused = false;
  let lastInputs = null;
  let currentHost = null;
  let resolveReady;
  const ready = new Promise((resolve) => {
    resolveReady = resolve;
  });
  const runtime = createThemeRuntime({
    config: source,
    readInputs: inputs,
    makeHost(program, selected, overrides) {
      const host = createAtomicHost({ authority, program, selected, overrides });
      currentHost = host;
      return {
        ...host,
        close() {
          host.close();
          if (currentHost === host) currentHost = null;
        },
      };
    },
    wasmUrl,
    prepare: modelFor,
    withdraw: () => authority.revoke(),
    finalize() {
      // Runtime terminal публикуется только после полного восстановления browser owners.
      authority.dispose();
      canvasInput?.dispose();
      document.removeEventListener('visibilitychange', visibility);
      view.removeEventListener('pagehide', suspend);
      view.removeEventListener('pageshow', resume);
      closed = true;
      attachedScopes.delete(scope);
    },
    onState(state) {
      if (state.state !== 'waiting' || state.reason !== 'loading') resolveReady(state);
      scope.setAttribute('data-lab-colors-state', state.state);
      if (runtime.state !== state) return;
      scope.dispatchEvent(new view.CustomEvent('lab-colors-state', { detail: state }));
      if (runtime.state !== state) return;
      onState(state);
    },
  });
  const refresh = (read) => {
    if (closed) return Promise.resolve(runtime.state);
    paused = false;
    return runtime.refresh(read);
  };
  const tick = () => {
    frame = null;
    if (closed || paused) return;
    if (!scope.isConnected) {
      runtime.cancel();
      paused = true;
      return;
    }
    try {
      const observed = structuredClone(inputs());
      if (closed || paused) return;
      const key = JSON.stringify(observed);
      if (lastInputs !== key || currentHost?.isCurrent() === false || !authority.isCurrent()) {
        lastInputs = key;
        refresh(() => observed);
      }
    } catch (error) {
      if (closed || paused) return;
      const key = `invalid:${error?.message ?? String(error)}`;
      if (lastInputs !== key || !authority.isCurrent()) {
        lastInputs = key;
        refresh(() => {
          throw error;
        });
      }
    }
    if (!closed && !paused) frame = view.requestAnimationFrame(tick);
  };
  const resume = () => {
    if (closed) return;
    paused = false;
    lastInputs = null;
    if (frame === null && document.visibilityState !== 'hidden')
      frame = view.requestAnimationFrame(tick);
    return refresh();
  };
  const suspend = () => {
    if (frame !== null) view.cancelAnimationFrame(frame);
    frame = null;
    paused = true;
    runtime.cancel();
  };
  const visibility = () => (document.visibilityState === 'hidden' ? suspend() : resume());
  document.addEventListener('visibilitychange', visibility);
  view.addEventListener('pagehide', suspend);
  view.addEventListener('pageshow', resume);
  refresh();
  if (document.visibilityState !== 'hidden') frame = view.requestAnimationFrame(tick);
  else suspend();
  return {
    ready,
    get state() {
      return runtime.state;
    },
    refresh() {
      return resume() ?? Promise.resolve(runtime.state);
    },
    cancel() {
      suspend();
      return runtime.state;
    },
    dispose() {
      if (closed) return runtime.state;
      if (frame !== null) view.cancelAnimationFrame(frame);
      frame = null;
      paused = true;
      return runtime.dispose();
    },
  };
}
