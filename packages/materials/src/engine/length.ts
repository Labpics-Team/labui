export interface LengthProbe {
  readonly element: HTMLElement;
  read(): number;
  restore(): void;
  destroy(): void;
}

const PROPERTIES = {
  '--lab-veil-strength': '24px',
  '--lab-veil-feather': 'auto',
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
    return `@property ${key}-length{syntax:"<length>";inherits:false;initial-value:-1px}
@property ${key}-number{syntax:"<number>";inherits:false;initial-value:-1}
[data-veil]{${key}-length:var(${property},${fallback});${key}-number:var(${property},${fallback});
${key}-width:calc(var(${key}-length) + var(${key}-number)*1px + 2px)}
@container style(${property}: ){.${probeClass(property as LengthProperty)}{--_lab-material-length-empty:1px}}`;
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
  held.restore();
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
    'all:initial;display:block;position:absolute;left:0;top:0;height:var(--_lab-material-length-empty,0px);padding:0;border:0;margin:0;min-width:0;max-width:none;box-sizing:content-box;visibility:hidden;pointer-events:none';
  parent.style.setProperty('--_lab-material-length-ready', 'ready');
  // Обе ошибки дают 0px. Любая разрешённая длина/число, включая ноль,
  // даёт положительный бокс: valid→invalid тоже будит ResizeObserver.
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

  restore();
  return {
    element,
    read(): number {
      restore();
      const view = surface.ownerDocument.defaultView;
      if (!view || typeof view.CSS.registerProperty !== 'function') {
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
      const cs = view.getComputedStyle(surface);
      const raw = cs.getPropertyValue(property).trim();
      if (!raw) {
        const fallback = PROPERTIES[property];
        if (fallback.endsWith('px')) return Number(fallback.slice(0, -2));
      }
      const numeric = /^\+?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(raw);
      if (raw && !numeric && !view.CSS.supports('filter', `blur(${raw})`)) {
        throw new RangeError(`lab-material: недопустимая длина ${property}`);
      }
      const measured = cs.getPropertyValue(`${key}-${numeric ? 'number' : 'length'}`).trim();
      const value = numeric
        ? measured
          ? Number(measured)
          : Number.NaN
        : measured.endsWith('px')
          ? Number(measured.slice(0, -2))
          : Number.NaN;
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
