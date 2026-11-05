import defaultConfig from './labui.config.json' with { type: 'json' };
import { prepareEngineConfig } from './prepare-config.mjs';
import { projectTheme, themePropertyNames } from './program.mjs';
import { createThemeRuntime } from './runtime.mjs';

const scopeAttribute = 'data-lab-colors-scope';
const canvasProperty = '--lab-canvas-input';

function cssText(sheet) {
  return [...sheet.cssRules].map((rule) => rule.cssText).join('\n');
}

const scopeSelector = (id) => `[${scopeAttribute}="${id}"]`;
const maskText = (id, names) =>
  `${scopeSelector(id)}{${names.map((name) => `${name}:initial!important;`).join('')}}`;

function prepareCss(view, text, names) {
  const candidate = new view.CSSStyleSheet();
  candidate.replaceSync(text);
  if (candidate.cssRules.length !== 1 || candidate.cssRules[0].style.length !== names.length) {
    throw new Error('CSS parser не принял полный scope');
  }
  return cssText(candidate);
}

function nearestMode(scope, attribute, values, media) {
  for (
    let current = scope;
    current;
    current = current.parentElement ?? current.getRootNode().host
  ) {
    if (!current.hasAttribute(attribute)) continue;
    const mode = current.getAttribute(attribute);
    if (mode === 'auto') return media.matches ? values[1] : values[0];
    if (!values.includes(mode)) throw new Error(`неизвестное значение ${attribute}`);
    return mode;
  }
  return media.matches ? values[1] : values[0];
}

/** Наблюдение ограничено явной равномерной непрозрачной sRGB8-подложкой. */
export function readOpaqueBackdrop(element) {
  const view = element?.ownerDocument?.defaultView;
  if (!view || !element.isConnected) return { kind: 'unknown', reason: 'backdrop_detached' };
  const style = view.getComputedStyle(element);
  if (style.backgroundImage !== 'none')
    return { kind: 'unknown', reason: 'unsupported_backdrop_composition' };
  for (
    let current = element;
    current;
    current = current.parentElement ?? current.getRootNode().host
  ) {
    const ancestor = current === element ? style : view.getComputedStyle(current);
    if (
      ancestor.filter !== 'none' ||
      ancestor.backdropFilter !== 'none' ||
      ancestor.mixBlendMode !== 'normal' ||
      ancestor.opacity !== '1'
    ) {
      return { kind: 'unknown', reason: 'unsupported_backdrop_composition' };
    }
  }
  const parsed =
    /^rgba?\(\s*(\d+)\s*[, ]\s*(\d+)\s*[, ]\s*(\d+)(?:\s*[,/]\s*(\d+(?:\.\d+)?))?\s*\)$/u.exec(
      style.backgroundColor,
    );
  if (!parsed || (parsed[4] !== undefined && Number(parsed[4]) !== 1)) {
    return { kind: 'unknown', reason: 'backdrop_is_not_opaque_srgb8' };
  }
  const surface = parsed.slice(1, 4).map(Number);
  if (surface.some((value) => value < 0 || value > 255)) {
    return { kind: 'unknown', reason: 'backdrop_is_not_opaque_srgb8' };
  }
  return { kind: 'observed', surface };
}

function pointSignature(points, composites) {
  const paints = points.map(({ slot, sinkOutput, source, opacity }) => [
    slot,
    sinkOutput,
    [...source],
    opacity,
  ]);
  const roots = composites.map(({ root, scenario, source }) => [root, scenario, [...source]]);
  paints.sort((a, b) => a[0] - b[0]);
  roots.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return JSON.stringify([paints, roots]);
}

function createAtomicHost({ scope, styleRoot, sheet, id, program, selected }) {
  const names = themePropertyNames(selected);
  const expectedScope = program.bindings.emissions
    .map(({ sinkOutput }) => sinkOutput)
    .sort((a, b) => a - b);
  const expectedOutputs = new Map(
    program.bindings.emissions.map(({ slot, sinkOutput }) => [slot, sinkOutput]),
  );
  const expectedRoots = new Set(program.bindings.presentations.map(({ root }) => root));
  const selector = scopeSelector(id);
  const masking = maskText(id, names);
  let active = true;
  let epoch = null;
  let sequence = 0n;
  let revision = null;
  let signature = pointSignature([], []);
  let installedText;

  const belongs = () =>
    active &&
    scope.isConnected &&
    scope.getRootNode() === styleRoot &&
    scope.getAttribute(scopeAttribute) === id &&
    styleRoot.adoptedStyleSheets.includes(sheet);
  const replace = (text) => {
    if (!belongs()) throw new Error('CSS lease утрачен');
    const preparedText = prepareCss(scope.ownerDocument.defaultView, text, names);
    sheet.replaceSync(preparedText);
    installedText = preparedText;
  };
  replace(masking);
  return {
    isCurrent() {
      return belongs() && cssText(sheet) === installedText;
    },
    install(intent) {
      try {
        if (!belongs() || cssText(sheet) !== installedText) return false;
        const { operation, bindingEpoch, expectedSequence, desiredSequence } = intent;
        if (
          typeof bindingEpoch !== 'bigint' ||
          bindingEpoch <= 0n ||
          expectedSequence !== sequence ||
          (epoch !== null && bindingEpoch !== epoch) ||
          typeof intent.revision !== 'bigint' ||
          intent.revision <= 0n
        )
          return false;
        if (
          intent.scope.length !== expectedScope.length ||
          [...intent.scope].some((value, index) => value !== expectedScope[index])
        )
          return false;
        const { points, presentationComposites } = intent;
        const desiredSignature = pointSignature(points, presentationComposites);
        if (operation === 'confirmExact') {
          return (
            epoch === bindingEpoch &&
            desiredSequence === sequence &&
            intent.revision === revision &&
            signature === desiredSignature
          );
        }
        if (desiredSequence !== expectedSequence + 1n) return false;
        let text = masking;
        if (operation === 'setAll') {
          const seen = new Set();
          for (const { slot, sinkOutput } of points) {
            if (expectedOutputs.get(slot) !== sinkOutput || seen.has(slot)) return false;
            seen.add(slot);
          }
          if (
            seen.size !== expectedOutputs.size ||
            presentationComposites.length !== expectedRoots.size
          )
            return false;
          const roots = new Set();
          for (const point of presentationComposites) {
            if (point.scenario !== 1 || !expectedRoots.has(point.root) || roots.has(point.root))
              return false;
            roots.add(point.root);
          }
          const { vars } = projectTheme(program, selected, points, presentationComposites);
          if (vars.size !== names.length || names.some((name) => !vars.has(name))) return false;
          text = `${selector}{${names.map((name) => `${name}:${vars.get(name)}!important;`).join('')}}`;
        } else if (operation !== 'revokeAll' || points.length || presentationComposites.length) {
          return false;
        }
        replace(text);
        // Публикация всего подготовленного CSS слоя — единственный внешний эффект.
        epoch = bindingEpoch;
        sequence = desiredSequence;
        revision = intent.revision;
        signature = desiredSignature;
        return true;
      } catch {
        return false;
      }
    },
    revoke() {
      // Наш слой стилей остаётся доступен для отзыва после удаления области из документа.
      sheet.replaceSync(masking);
      installedText = cssText(sheet);
    },
    close() {
      active = false;
    },
  };
}

function authoredCanvas({ scope, backdrop, config, modelFor }) {
  const previousSource = scope.style.getPropertyValue(canvasProperty);
  const previousSourcePriority = scope.style.getPropertyPriority(canvasProperty);
  const previousBackground = backdrop.style.getPropertyValue('background-color');
  const previousBackgroundPriority = backdrop.style.getPropertyPriority('background-color');
  let installed;
  backdrop.style.setProperty('background-color', `var(${canvasProperty})`);
  return {
    select(theme, contrast) {
      const model = modelFor(config, contrast);
      const source = model.sources[model.themes[theme].background];
      const value = `rgb(${source.join(' ')})`;
      if (installed !== value) {
        scope.style.setProperty(canvasProperty, value);
        installed = value;
      }
    },
    dispose() {
      if (
        scope.style.getPropertyValue(canvasProperty) === installed &&
        scope.style.getPropertyPriority(canvasProperty) === ''
      ) {
        if (previousSource)
          scope.style.setProperty(canvasProperty, previousSource, previousSourcePriority);
        else scope.style.removeProperty(canvasProperty);
      }
      if (
        backdrop.style.getPropertyValue('background-color') === `var(${canvasProperty})` &&
        backdrop.style.getPropertyPriority('background-color') === ''
      ) {
        if (previousBackground)
          backdrop.style.setProperty(
            'background-color',
            previousBackground,
            previousBackgroundPriority,
          );
        else backdrop.style.removeProperty('background-color');
      }
    },
  };
}

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
  const styleRoot = scope?.getRootNode();
  if (!view?.CSSStyleSheet || !scope.isConnected || !styleRoot.adoptedStyleSheets) {
    throw new Error('контекст не поддерживает атомарный CSS scope');
  }
  if (scope.hasAttribute(scopeAttribute)) throw new Error('CSS scope уже имеет владельца');
  if (!backdrop && !observe)
    throw new Error('нужна явная независимая подложка или observation provider');
  if (canvas !== undefined && canvas !== 'authored')
    throw new Error('неизвестная декларация canvas');
  if (!backdrop && canvas === 'authored') throw new Error('canvas требует явный backdrop');
  const source = structuredClone(config);
  const readBackdrop = observe ?? (() => readOpaqueBackdrop(backdrop));
  const id = view.crypto.randomUUID();
  const sheet = new view.CSSStyleSheet();
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
  // До первого ответа Core эта область уже полностью отозвана.
  sheet.replaceSync(prepareCss(view, maskText(id, initialNames), initialNames));
  const canvasInput =
    canvas === 'authored' ? authoredCanvas({ scope, backdrop, config: source, modelFor }) : null;
  const inputs = () => {
    const theme = nearestMode(scope, 'data-theme', ['light', 'dark'], scheme);
    const mode = nearestMode(scope, 'data-contrast', ['normal', 'more'], contrast);
    canvasInput?.select(theme, mode);
    return { theme, contrast: mode, observation: readBackdrop() };
  };
  scope.setAttribute(scopeAttribute, id);
  styleRoot.adoptedStyleSheets = [...styleRoot.adoptedStyleSheets, sheet];
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
    makeHost(program, selected) {
      const host = createAtomicHost({ scope, styleRoot, sheet, id, program, selected });
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
      if (lastInputs !== key || currentHost?.isCurrent() === false) {
        lastInputs = key;
        refresh(() => observed);
      }
    } catch (error) {
      if (closed || paused) return;
      const key = `invalid:${error?.message ?? String(error)}`;
      if (lastInputs !== key) {
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
      const state = runtime.dispose();
      if (state.state !== 'disposed') return state;
      closed = true;
      document.removeEventListener('visibilitychange', visibility);
      view.removeEventListener('pagehide', suspend);
      view.removeEventListener('pageshow', resume);
      styleRoot.adoptedStyleSheets = styleRoot.adoptedStyleSheets.filter(
        (candidate) => candidate !== sheet,
      );
      if (scope.getAttribute(scopeAttribute) === id) scope.removeAttribute(scopeAttribute);
      canvasInput?.dispose();
      return state;
    },
  };
}
