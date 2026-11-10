export interface LengthProbe {
  readonly element: HTMLElement;
  read(): number;
  restore(): void;
  destroy(): void;
}

const PROPERTIES = {
  '--lab-veil-strength': '24px',
  '--lab-veil-feather': 'auto',
  '--lab-size-sheet-body-blur': '0px',
} as const;
type LengthProperty = keyof typeof PROPERTIES;

function projection(property: LengthProperty): string {
  return `${property.replace('--lab-', '--_lab-')}-measure-v1`;
}

function probeClass(property: LengthProperty): string {
  return `lab-material__length--${property.slice('--lab-'.length)}`;
}

// Публичный токен остаётся нетипизированным: em/cqw вычисляются на поверхности,
// а не на предке, который объявил значение. Приватная проекция не наследует
// ошибочное значение от соседней поверхности; наследуется только готовый px.
const PROJECTION_CSS = `${Object.entries(PROPERTIES)
  .map(([property, fallback]) => {
    const key = projection(property as LengthProperty);
    const selector =
      property === '--lab-size-sheet-body-blur' ? '.lab-material--sheet' : '[data-veil]';
    return `@property ${key}-length{syntax:"<length>";inherits:false;initial-value:-1px}
@property ${key}-number{syntax:"<number>";inherits:false;initial-value:-1}
${selector}{${key}-value:var(${property},${fallback});${key}-length:var(${property},${fallback});${key}-number:var(${property},${fallback});
${key}-width:calc(var(${key}-length) + var(${key}-number)*1px + 2px)}
@container style(${key}-value: ){.${probeClass(property as LengthProperty)}{--_lab-material-length-empty:1px}}
${fallback === 'auto' ? `@container style(${key}-value:auto){.${probeClass(property as LengthProperty)}{--_lab-material-length-auto:2px}}` : ''}`;
  })
  .join(
    '\n',
  )}\n@container style(--_lab-material-length-ready:ready){.lab-material__length{--_lab-material-length-supported:1}}`;

interface ProjectionStyles {
  readonly element: HTMLStyleElement;
  users: number;
  restore(): void;
}
const styles = new WeakMap<Document | ShadowRoot, ProjectionStyles>();

function acquireStyles(root: Document | ShadowRoot): () => void {
  let held = styles.get(root);
  if (!held) {
    const document = root instanceof Document ? root : root.ownerDocument;
    const element = document.createElement('style');
    element.className = 'lab-material__length-types';
    element.textContent = PROJECTION_CSS;
    held = {
      element,
      users: 0,
      restore(): void {
        const parent = root instanceof Document ? root.head : root;
        if (element.parentNode !== parent) parent.appendChild(element);
      },
    };
    styles.set(root, held);
  }
  held.users++;
  try {
    held.restore();
  } catch (error) {
    if (--held.users === 0) {
      held.element.remove();
      styles.delete(root);
    }
    throw error;
  }
  const owned = held;
  return (): void => {
    if (--owned.users !== 0) return;
    owned.element.remove();
    styles.delete(root);
  };
}

/** Вычисление на исходной поверхности, наблюдение — инертным дочерним боксом. */
export function createLengthProbe(
  surface: HTMLElement,
  parent: HTMLElement,
  property: LengthProperty,
): LengthProbe {
  const element = surface.ownerDocument.createElement('span');
  const key = projection(property);
  element.className = `lab-material__length ${probeClass(property)}`;
  element.setAttribute('aria-hidden', 'true');
  element.style.cssText =
    'all:initial;display:block;position:absolute;left:0;top:0;height:calc(var(--_lab-material-length-empty,0px) + var(--_lab-material-length-auto,0px));padding:0;border:0;margin:0;min-width:0;max-width:none;box-sizing:content-box;visibility:hidden;pointer-events:none';
  parent.style.setProperty('--_lab-material-length-ready', 'ready');
  // Ошибка даёт 0×0; пустой токен и auto, включая default, различаются высотой.
  // Разрешённые длина/число, включая ноль, дают ширину для ResizeObserver.
  element.style.width = `var(${key}-width)`;
  let document: Document | null = null;
  let root: ShadowRoot | null = null;
  let releaseDocument: (() => void) | undefined;
  let releaseRoot: (() => void) | undefined;

  function restore(): void {
    const nextDocument = surface.ownerDocument;
    const node = surface.getRootNode();
    const nextRoot = node instanceof ShadowRoot ? node : null;
    if (document !== nextDocument || root !== nextRoot) {
      releaseRoot?.();
      releaseDocument?.();
      document = nextDocument;
      root = nextRoot;
      // Chromium/WebKit пока игнорируют @property внутри Shadow DOM.
      // Регистрация принадлежит Document, локальный лист задаёт проекции host.
      releaseDocument = acquireStyles(document);
      releaseRoot = root ? acquireStyles(root) : undefined;
    }
    styles.get(document)?.restore();
    if (root) styles.get(root)?.restore();
    if (element.parentNode !== parent) parent.appendChild(element);
  }

  try {
    restore();
  } catch (error) {
    releaseRoot?.();
    releaseDocument?.();
    element.remove();
    throw error;
  }
  return {
    element,
    read(): number {
      restore();
      const view = surface.ownerDocument.defaultView;
      if (!view) throw new RangeError('lab-material: поверхность не имеет Window');
      const cs = view.getComputedStyle(surface);
      const raw = cs.getPropertyValue(property).trim();
      if (!raw) {
        const fallback = PROPERTIES[property];
        if (fallback.endsWith('px')) return Number(fallback.slice(0, -2));
      }
      const numeric = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(raw);
      const pixels = /^([+-]?(?:\d+|\d*\.\d+)(?:e[+-]?\d+)?)px$/i.exec(raw);
      // CSS может ограничить бесконечное число конечной проекцией. Legacy px
      // проверяется до этого преобразования, чтобы ошибка не стала радиусом.
      if (numeric || pixels) {
        const value = Number(pixels ? pixels[1] : raw);
        if (!Number.isFinite(value) || value < 0) {
          throw new RangeError(`lab-material: недопустимая длина ${property}`);
        }
        return value;
      }
      if (raw && !view.CSS.supports('filter', `blur(${raw})`)) {
        throw new RangeError(`lab-material: недопустимая длина ${property}`);
      }
      if (typeof view.CSS.registerProperty !== 'function') {
        throw new RangeError('lab-material: измерение требует CSS Properties and Values API');
      }
      if (
        view
          .getComputedStyle(element)
          .getPropertyValue('--_lab-material-length-supported')
          .trim() !== '1'
      ) {
        throw new RangeError('lab-material: измерение требует container style queries');
      }
      const measured = cs.getPropertyValue(`${key}-length`).trim();
      const value = measured.endsWith('px') ? Number(measured.slice(0, -2)) : Number.NaN;
      if (!Number.isFinite(value) || value < 0) {
        throw new RangeError(`lab-material: не получена длина ${property} в px`);
      }
      return value;
    },
    restore,
    destroy(): void {
      element.remove();
      releaseRoot?.();
      releaseDocument?.();
      releaseRoot = undefined;
      releaseDocument = undefined;
    },
  };
}
