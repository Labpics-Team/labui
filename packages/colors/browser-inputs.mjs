const canvasProperty = '--lab-canvas-input';

export function parseInlineColor({ name, declaration, priority }) {
  const unsupported = () => {
    const error = new Error(`--lab-${name}: нужен явный sRGB8 цвет без !important`);
    error.code = 'unsupported_role_override';
    return error;
  };
  if (priority) throw unsupported();
  if (declaration.toLowerCase() === 'transparent') return { source: [0, 0, 0], opacity: 0 };
  const hex = /^#([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/iu.exec(declaration);
  if (hex) {
    const digits = hex[1].length < 5 ? [...hex[1]].map((digit) => digit + digit).join('') : hex[1];
    const source = [0, 2, 4].map((offset) => Number.parseInt(digits.slice(offset, offset + 2), 16));
    return {
      source,
      opacity: digits.length === 8 ? Number.parseInt(digits.slice(6), 16) / 255 : 1,
    };
  }
  const rgb = /^rgba?\(([^()]+)\)$/iu.exec(declaration);
  if (!rgb) throw unsupported();
  let channels;
  let alpha;
  if (rgb[1].includes(',')) {
    const values = rgb[1].split(',').map((value) => value.trim());
    if (![3, 4].includes(values.length)) throw unsupported();
    channels = values.slice(0, 3);
    alpha = values[3];
  } else {
    const values = rgb[1].split('/').map((value) => value.trim());
    if (![1, 2].includes(values.length)) throw unsupported();
    channels = values[0].split(/\s+/u);
    alpha = values[1];
  }
  if (channels.length !== 3 || channels.some((value) => !/^\d+$/u.test(value))) throw unsupported();
  const source = channels.map(Number);
  if (source.some((value) => !Number.isInteger(value) || value < 0 || value > 255))
    throw unsupported();
  if (alpha !== undefined && !/^(?:\d+(?:\.\d*)?|\.\d+)%?$/u.test(alpha)) throw unsupported();
  const opacity =
    alpha === undefined ? 1 : Number.parseFloat(alpha) / (alpha.endsWith('%') ? 100 : 1);
  if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) throw unsupported();
  return { source, opacity };
}

export function nearestMode(scope, attribute, values, media) {
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

export function authoredCanvas({ scope, backdrop, config, modelFor }) {
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
