import { themeProfile } from './profile.mjs';
import { ThemeUpdateError, createThemeProgram, initializeColors } from './program.mjs';

export { ThemeUpdateError, initializeColors };

const attached = new WeakSet();
const SCOPE_ATTR = 'data-labui-color-scope';

function inheritedAttribute(root, name) {
  for (let current = root; current; ) {
    const value = current.getAttribute(name);
    if (value !== null) return value;
    current = current.assignedSlot ?? current.parentElement ?? current.getRootNode().host;
  }
  return undefined;
}

/** Each scope observes only its own theme attributes, never descendants or frames. */
export function createThemeScope(root, options = {}) {
  if (!root?.style || !root?.setAttribute) throw new TypeError('A theme scope needs an element');
  if (attached.has(root))
    throw new ThemeUpdateError('already_attached', 'The element already has a theme scope');
  const view = root.ownerDocument.defaultView;
  const scopeId = view.crypto.getRandomValues(new Uint32Array(4)).join('-');
  let originalScopeId;
  const sheet = root.ownerDocument.createElement('style');
  const attributes = ['data-theme', 'data-contrast'];
  let originalAttributes;
  let disposed = false;
  let state = null;
  let program;
  let customBackgrounds;

  const currentAxes = () => ({
    theme:
      inheritedAttribute(root, 'data-theme') ??
      (view.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
    contrast: inheritedAttribute(root, 'data-contrast') ?? 'normal',
  });

  const observer = new view.MutationObserver(() => {
    if (!state || disposed) return;
    const axes = currentAxes();
    if (axes.theme === state.theme && axes.contrast === state.contrast) return;
    scope.update(axes);
  });

  function restoreAcceptedAxes() {
    if (!state) return;
    root.setAttribute('data-theme', state.theme);
    root.setAttribute('data-contrast', state.contrast);
    observer.takeRecords();
  }

  const scope = {
    get state() {
      return state;
    },
    update(input = {}) {
      let nextProgram;
      try {
        if (disposed) throw new ThemeUpdateError('disposed', 'Theme scope has been disposed');
        const axes = currentAxes();
        const theme = input.theme ?? axes.theme;
        const contrast = input.contrast ?? axes.contrast;
        const profile = themeProfile(theme, contrast);
        const backgrounds = input.backgrounds ?? customBackgrounds ?? [profile.background];
        const changed = !state || theme !== state.theme || contrast !== state.contrast;
        nextProgram = changed ? createThemeProgram(theme, contrast) : program;
        const values = nextProgram.update(backgrounds);
        // Resolve everything before publishing. A selector prevents a previous
        // palette from overriding a raw attribute switch before its microtask.
        const css = Object.entries(values)
          .map(([name, value]) => `${name}:${value};`)
          .join('');
        if (!state) {
          originalScopeId = root.getAttribute(SCOPE_ATTR);
          originalAttributes = attributes.map((name) => root.getAttribute(name));
        }
        sheet.textContent = `[${SCOPE_ATTR}="${scopeId}"][data-theme="${theme}"][data-contrast="${contrast}"]{${css}}`;
        root.setAttribute(SCOPE_ATTR, scopeId);
        if (!sheet.isConnected) root.append(sheet);
        root.setAttribute('data-theme', theme);
        root.setAttribute('data-contrast', contrast);
        observer.takeRecords();
        if (changed) program?.dispose();
        program = nextProgram;
        state = Object.freeze({
          theme,
          contrast,
          backgrounds: Object.freeze(backgrounds.map((rgb) => Object.freeze([...rgb]))),
        });
        if (input.backgrounds !== undefined) customBackgrounds = state.backgrounds;
        return { ok: true, state };
      } catch (error) {
        if (nextProgram && nextProgram !== program) nextProgram.dispose();
        // Attribute requests are reconciled in the same microtask, before paint.
        if (!disposed) restoreAcceptedAxes();
        options.onError?.(error);
        return { ok: false, error, state };
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      observer.disconnect();
      program?.dispose();
      sheet.remove();
      if (root.getAttribute(SCOPE_ATTR) === scopeId) {
        if (originalScopeId === null) root.removeAttribute(SCOPE_ATTR);
        else root.setAttribute(SCOPE_ATTR, originalScopeId);
      }
      attributes.forEach((name, index) => {
        const current = index === 0 ? state?.theme : state?.contrast;
        if (!state || root.getAttribute(name) !== current) return;
        if (originalAttributes[index] === null) root.removeAttribute(name);
        else root.setAttribute(name, originalAttributes[index]);
      });
      attached.delete(root);
    },
  };
  observer.observe(root, { attributes: true, attributeFilter: attributes });
  attached.add(root);
  return scope;
}
