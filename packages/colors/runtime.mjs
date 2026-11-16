import { themeProfile } from './profile.mjs';
import { ThemeUpdateError, createThemeProgram, initializeColors } from './program.mjs';

export { ThemeUpdateError, initializeColors };

const attached = new WeakSet();

function inheritedAttribute(root, name) {
  for (let current = root; current; ) {
    const value = current.getAttribute(name);
    if (value !== null) return value;
    current = current.assignedSlot ?? current.parentElement ?? current.getRootNode().host;
  }
  return undefined;
}

/** One explicit scope, no observer, document scan, global palette or frame loop. */
export function createThemeScope(root, options = {}) {
  if (!root?.style || !root?.setAttribute) throw new TypeError('A theme scope needs an element');
  if (attached.has(root))
    throw new ThemeUpdateError('already_attached', 'The element already has a theme scope');
  attached.add(root);
  let disposed = false;
  let state = null;
  let program;
  const original = new Map();
  const installed = new Map();
  const attributes = ['data-theme', 'data-contrast'];
  const originalAttributes = attributes.map((name) => root.getAttribute(name));

  return {
    get state() {
      return state;
    },
    update(input = {}) {
      let nextProgram;
      try {
        if (disposed) throw new ThemeUpdateError('disposed', 'Theme scope has been disposed');
        const theme =
          input.theme ??
          state?.theme ??
          inheritedAttribute(root, 'data-theme') ??
          (root.ownerDocument.defaultView?.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light');
        const contrast =
          input.contrast ??
          state?.contrast ??
          inheritedAttribute(root, 'data-contrast') ??
          'normal';
        const profile = themeProfile(theme, contrast);
        const backgrounds =
          input.backgrounds ?? (state?.theme === theme ? state.backgrounds : [profile.background]);
        const changed = !state || theme !== state.theme || contrast !== state.contrast;
        nextProgram = changed ? createThemeProgram(theme, contrast) : program;
        const values = nextProgram.update(backgrounds);
        // Synchronous staging: rejection above cannot mutate the DOM or metadata.
        const style = root.ownerDocument.createElement('span').style;
        style.cssText = root.style.cssText;
        for (const [name, value] of Object.entries(values)) {
          if (!original.has(name))
            original.set(name, [
              root.style.getPropertyValue(name),
              root.style.getPropertyPriority(name),
            ]);
          style.setProperty(name, value);
        }
        root.style.cssText = style.cssText;
        root.setAttribute('data-theme', theme);
        root.setAttribute('data-contrast', contrast);
        for (const name of Object.keys(values))
          installed.set(name, [
            root.style.getPropertyValue(name),
            root.style.getPropertyPriority(name),
          ]);
        if (changed) program?.dispose();
        program = nextProgram;
        state = Object.freeze({
          theme,
          contrast,
          backgrounds: Object.freeze(backgrounds.map((rgb) => Object.freeze([...rgb]))),
        });
        return { ok: true, state };
      } catch (error) {
        if (nextProgram && nextProgram !== program) nextProgram.dispose();
        options.onError?.(error);
        return { ok: false, error, state };
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      program?.dispose();
      for (const [name, [value, installedPriority]] of installed) {
        if (
          root.style.getPropertyValue(name) !== value ||
          root.style.getPropertyPriority(name) !== installedPriority
        )
          continue;
        const [before, priority] = original.get(name);
        if (before) root.style.setProperty(name, before, priority);
        else root.style.removeProperty(name);
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
}
