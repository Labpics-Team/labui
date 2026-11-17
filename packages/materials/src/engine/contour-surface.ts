import { materialContour } from './contour';
import { type EngineHandle, ensureHiddenDefs, removeFilter } from './mount';
import { placePaintCapture } from './paint-capture';
import { resolveCornerRadii } from './rounded-shape';

const NS = 'http://www.w3.org/2000/svg';
let sequence = 0;
const attr = (s: string): string =>
  s.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');

function authorSmoothing(css: CSSStyleDeclaration): number {
  return Number.parseFloat(css.getPropertyValue('--lab-corner-smoothing')) || 0;
}

export interface SurfaceShapeOptions {
  readonly smoothing: number;
}
export interface SurfaceShapeHandle {
  refresh(): void;
  destroy(): void;
}

/** Explicit component lifecycle port. Image/rim children may consume
 * --lab-contour-clip; --lab-material-shadow supplies the complete CSS stack.
 * The component calls refresh after changing its author shape or theme inputs.
 */
export function mountSurfaceShape(
  el: HTMLElement,
  options: SurfaceShapeOptions,
): SurfaceShapeHandle {
  return attach(el, options) as SurfaceShapeHandle;
}

/** Split a computed CSS list while preserving colour functions. */
function split(value: string, separator: ',' | ' '): string[] {
  let level = 0;
  let start = 0;
  const parts: string[] = [];
  for (let i = 0; i <= value.length; i++) {
    const c = value[i];
    if (c === '(') level++;
    if (c === ')') level--;
    if (i === value.length || (!level && (separator === ',' ? c === ',' : /\s/.test(c ?? '')))) {
      const part = value.slice(start, i).trim();
      if (part) parts.push(part);
      start = i + 1;
    }
  }
  return parts;
}

interface Shadow {
  x: number;
  y: number;
  blur: number;
  spread: number;
  color: string;
  inset: boolean;
}

function shadows(css: string): Shadow[] {
  if (!css || css === 'none') return [];
  return split(css, ',').map((part) => {
    const tokens = split(part, ' ');
    const lengths = tokens.filter((t) => /^-?(?:\d*\.)?\d+(?:px)?$/.test(t)).map(Number.parseFloat);
    return {
      x: lengths[0] ?? 0,
      y: lengths[1] ?? 0,
      blur: lengths[2] ?? 0,
      spread: lengths[3] ?? 0,
      color: tokens.filter((t) => t !== 'inset' && !/^-?(?:\d*\.)?\d+(?:px)?$/.test(t)).join(' '),
      inset: tokens.includes('inset'),
    };
  });
}

/** Author drop-shadow stacks are parallel, not successive drop-shadow filters.
 * The host stays unfiltered: its content, overflow and progressive veil survive.
 */
function shadowMarkup(list: readonly Shadow[]): string {
  const primitives = list
    .map((s, i) => {
      const spread = s.spread
        ? `<feMorphology in="SourceAlpha" operator="${(s.spread > 0) !== s.inset ? 'dilate' : 'erode'}" radius="${Math.abs(s.spread)}" result="spread-${i}"/>`
        : '';
      return `${spread}<feGaussianBlur in="${s.spread ? `spread-${i}` : 'SourceAlpha'}" stdDeviation="${s.blur / 2}"/><feOffset dx="${s.x}" dy="${s.y}"/><feComposite in2="SourceAlpha" operator="${s.inset ? 'arithmetic" k2="-1" k3="1' : 'out'}" result="alpha-${i}"/><feFlood flood-color="${attr(s.color)}"/><feComposite in2="alpha-${i}" operator="in" result="shadow-${i}"/>`;
    })
    .join('');
  // CSS's first shadow is painted on top.
  return `${primitives}<feMerge>${list.map((_, i) => `<feMergeNode in="shadow-${list.length - i - 1}"/>`).join('')}</feMerge>`;
}

export function attach(el: HTMLElement, options?: SurfaceShapeOptions): EngineHandle {
  let clear: (() => void) | undefined;
  let refreshShape: (() => void) | undefined;
  let observer: ResizeObserver | undefined;
  let raf = 0;
  let disposed = false;
  const refresh = (): void => {
    if (disposed) return;
    const css = getComputedStyle(el);
    const smoothing = options?.smoothing ?? authorSmoothing(css);
    if (!(smoothing > 0)) {
      clear?.();
      clear = undefined;
      refreshShape = undefined;
      observer?.disconnect();
      observer = undefined;
      return;
    }
    if (refreshShape) {
      refreshShape();
      return;
    }
    const positionBefore = el.style.position;
    const positioned = css.position === 'static';
    if (positioned) el.style.position = 'relative';
    const id = `lab-contour-${++sequence}`;
    const defs = ensureHiddenDefs('lab-material-contour-defs', el);
    const clip = el.ownerDocument.createElementNS(NS, 'clipPath');
    clip.id = id;
    clip.setAttribute('clipPathUnits', 'userSpaceOnUse');
    const path = el.ownerDocument.createElementNS(NS, 'path');
    clip.append(path);
    const rimMask = el.ownerDocument.createElementNS(NS, 'mask');
    rimMask.id = `${id}-rim`;
    rimMask.setAttribute('maskUnits', 'userSpaceOnUse');
    rimMask.setAttribute('x', '0');
    rimMask.setAttribute('y', '0');
    const rimPath = el.ownerDocument.createElementNS(NS, 'path');
    rimPath.setAttribute('fill', 'none');
    rimPath.setAttribute('stroke', 'white');
    rimPath.setAttribute('stroke-width', '2');
    rimMask.append(rimPath);
    defs.append(clip, rimMask);
    const holder = el.ownerDocument.createElement('div');
    holder.className = 'lab-material__contour';
    holder.setAttribute('aria-hidden', 'true');
    const face = el.ownerDocument.createElement('div');
    face.className = 'lab-material__contour-face';
    face.setAttribute('aria-hidden', 'true');
    const probe = el.ownerDocument.createElement('div');
    probe.hidden = true;
    probe.style.boxShadow = 'var(--lab-material-shadow, none)';
    probe.style.borderTop =
      'var(--lab-surface-stroke-width, 0px) solid var(--lab-surface-stroke-color, transparent)';
    face.append(probe);
    const shadowNodes = [false, true].map((inset) => {
      const svg = el.ownerDocument.createElementNS(NS, 'svg');
      svg.classList.add('lab-material__contour-shadow');
      if (inset) svg.classList.add('lab-material__contour-shadow--inset');
      svg.setAttribute('aria-hidden', 'true');
      const filter = el.ownerDocument.createElementNS(NS, 'filter');
      filter.id = `${id}-${inset ? 'inner' : 'outer'}`;
      filter.setAttribute('filterUnits', 'userSpaceOnUse');
      filter.setAttribute('color-interpolation-filters', 'sRGB');
      const drawing = el.ownerDocument.createElementNS(NS, 'path');
      drawing.setAttribute('fill', 'black');
      drawing.setAttribute('filter', `url(#${filter.id})`);
      svg.append(filter, drawing);
      holder.prepend(svg);
      return { svg, filter, drawing, inset };
    });
    const rim = el.ownerDocument.createElement('div');
    rim.className = 'lab-material__contour-rim';
    if (!el.matches('.lab-material')) {
      face.hidden = true;
      rim.hidden = true;
    }
    holder.prepend(face);
    holder.append(rim);
    el.prepend(holder);
    const placement = placePaintCapture(el, holder);
    const strokeBox = el.ownerDocument.createElement('div');
    strokeBox.className = 'lab-material__contour-stroke';
    strokeBox.setAttribute('aria-hidden', 'true');
    const strokeSvg = el.ownerDocument.createElementNS(NS, 'svg');
    const strokePath = el.ownerDocument.createElementNS(NS, 'path');
    strokePath.setAttribute('fill', 'none');
    strokePath.setAttribute('clip-path', `url(#${id})`);
    strokeSvg.append(strokePath);
    strokeBox.append(strokeSvg);
    let strokePlacement: EngineHandle | undefined;
    el.setAttribute('data-lab-material-contour', '');
    el.style.setProperty('--lab-contour-clip', `url(#${id})`);
    el.style.setProperty('--_material-contour-rim', `url(#${id}-rim)`);
    let key = '';
    let shadowKey: string | undefined;
    let strokeKey: string | undefined;
    let usedShadows: Shadow[] = [];
    refreshShape = () => {
      placement.refresh?.();
      const cs = getComputedStyle(el);
      const w = Math.max(1, el.offsetWidth);
      const h = Math.max(1, el.offsetHeight);
      const radii = resolveCornerRadii(w, h, [
        cs.borderTopLeftRadius,
        cs.borderTopRightRadius,
        cs.borderBottomRightRadius,
        cs.borderBottomLeftRadius,
      ]);
      const contour = materialContour(w, h, radii, options?.smoothing ?? authorSmoothing(cs));
      // CSS resolves relative lengths, currentColor, and colour-mix for us.
      // Cache the resolved values, not a custom-property string that could stay
      // unchanged while its font or colour dependencies change.
      const decoration = getComputedStyle(probe);
      const shadow = decoration.boxShadow;
      let restamp = contour.key !== key;
      if (restamp) {
        key = contour.key;
        path.setAttribute('d', contour.path);
        rimPath.setAttribute('d', contour.path);
        strokePath.setAttribute('d', contour.path);
        strokeSvg.setAttribute('width', String(w));
        strokeSvg.setAttribute('height', String(h));
        rimMask.setAttribute('width', String(w));
        rimMask.setAttribute('height', String(h));
        for (const item of shadowNodes) {
          item.svg.setAttribute('width', String(w));
          item.svg.setAttribute('height', String(h));
          item.drawing.setAttribute('d', contour.path);
        }
      }
      const stroke = `${decoration.borderTopWidth}|${decoration.borderTopColor}`;
      if (stroke !== strokeKey) {
        strokeKey = stroke;
        const width = Number.parseFloat(decoration.borderTopWidth) || 0;
        strokePath.setAttribute('stroke-width', String(width * 2));
        strokePath.setAttribute('stroke', decoration.borderTopColor);
        if (width > 0 && !strokePlacement) strokePlacement = placePaintCapture(el, strokeBox, 2);
        if (!width && strokePlacement) {
          strokePlacement.destroy();
          strokePlacement = undefined;
        }
      }
      if (shadow !== shadowKey) {
        shadowKey = shadow;
        usedShadows = shadows(shadow);
        restamp = true;
        for (const item of shadowNodes) {
          const matching = usedShadows.filter((s) => s.inset === item.inset);
          item.svg.style.display = matching.length ? '' : 'none';
          item.filter.innerHTML = shadowMarkup(matching);
        }
      }
      if (restamp)
        for (const item of shadowNodes) {
          const matching = usedShadows.filter((s) => s.inset === item.inset);
          const pad = Math.max(
            1,
            ...matching.map(
              (s) => Math.max(Math.abs(s.x), Math.abs(s.y)) + s.blur * 2 + Math.abs(s.spread),
            ),
          );
          item.filter.setAttribute('x', String(-pad));
          item.filter.setAttribute('y', String(-pad));
          item.filter.setAttribute('width', String(w + 2 * pad));
          item.filter.setAttribute('height', String(h + 2 * pad));
        }
    };
    clear = () => {
      strokePlacement?.destroy();
      strokeBox.remove();
      placement.destroy();
      holder.remove();
      removeFilter(clip);
      removeFilter(rimMask);
      el.removeAttribute('data-lab-material-contour');
      el.style.removeProperty('--lab-contour-clip');
      el.style.removeProperty('--_material-contour-rim');
      if (positioned && el.style.position === 'relative') el.style.position = positionBefore;
    };
    if (!observer) {
      observer = new ResizeObserver(() => {
        if (!raf)
          raf = requestAnimationFrame(() => {
            raf = 0;
            refresh();
          });
      });
      observer.observe(el);
    }
    refreshShape();
  };
  refresh();
  return {
    refresh,
    destroy: () => {
      disposed = true;
      observer?.disconnect();
      if (raf) cancelAnimationFrame(raf);
      clear?.();
    },
  };
}
