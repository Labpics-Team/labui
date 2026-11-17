/** Paint transfers operate on the captured backdrop, leaving content untouched.
 * Identical recipes share one immutable SVG resource per document/shadow tree.
 */
import { parseRgb } from '../luminance';
import { type MaterialPaints, compileMaterialPaint, materialPaintTables } from '../material-paints';
import { materialBlendMode, materialProfile } from '../profile';
import {
  type EngineHandle,
  ensureHiddenDefs,
  removeFilter,
  supportsBackdropFilterUrl,
} from './mount';

const SVGNS = 'http://www.w3.org/2000/svg';
let uid = 0;
interface PaintResource {
  readonly filter: SVGFilterElement | null;
  readonly fill: string;
  readonly key: string;
  readonly resources: Map<string, PaintResource>;
  refs: number;
}
const trees = new WeakMap<Document | ShadowRoot, Map<string, PaintResource>>();

type PaintRenderer = 'backdrop-svg' | 'capture-svg' | 'capture-blend' | 'normal';
/** CSS.supports accepts SVG backdrop filters that Gecko/WebKit don't render.
 * These narrow adapters follow actual display pixels, not screenshot support.
 * iOS Firefox uses WebKit, so its FxiOS token must not select Gecko's adapter.
 */
function paintRenderer(): PaintRenderer {
  if (supportsBackdropFilterUrl()) return 'backdrop-svg';
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  if (/Firefox\//.test(ua)) return 'capture-svg';
  if (/AppleWebKit\//.test(ua) && CSS.supports('mix-blend-mode', 'color-dodge'))
    return 'capture-blend';
  return 'normal';
}

function acquire(
  el: HTMLElement,
  key: string,
  paints: MaterialPaints,
  noiseUrl: string | undefined,
  noiseSize: string,
  renderer: PaintRenderer,
): PaintResource {
  const root = el.getRootNode();
  const tree = root.nodeType === 11 ? (root as ShadowRoot) : el.ownerDocument;
  let resources = trees.get(tree);
  if (!resources) {
    resources = new Map();
    trees.set(tree, resources);
  }
  const existing = resources.get(key);
  if (existing) {
    existing.refs++;
    return existing;
  }
  if (renderer === 'normal' || renderer === 'capture-blend') {
    const compiled = compileMaterialPaint(paints);
    const c = compiled.fill.a > 0 ? compiled.fill : paints.normal;
    const resource = {
      filter: null,
      fill: renderer === 'capture-blend' ? 'transparent' : `rgb(${c.r} ${c.g} ${c.b} / ${c.a})`,
      key,
      resources,
      refs: 1,
    };
    resources.set(key, resource);
    return resource;
  }
  const filter = el.ownerDocument.createElementNS(SVGNS, 'filter');
  filter.id = `lab-material-paint-${++uid}`;
  // The region follows each consumer's box. Primitive dimensions (noise grain)
  // remain local CSS pixels, so differently sized surfaces share the resource.
  filter.setAttribute('filterUnits', 'objectBoundingBox');
  filter.setAttribute('primitiveUnits', 'userSpaceOnUse');
  filter.setAttribute('color-interpolation-filters', 'sRGB');
  for (const [name, value] of Object.entries({ x: '0', y: '0', width: '1', height: '1' }))
    filter.setAttribute(name, value);
  const transfer = el.ownerDocument.createElementNS(SVGNS, 'feComponentTransfer');
  if (noiseUrl) {
    const noise = el.ownerDocument.createElementNS(SVGNS, 'feImage');
    for (const [name, value] of Object.entries({
      x: '0',
      y: '0',
      width: noiseSize,
      height: noiseSize,
      href: noiseUrl,
      preserveAspectRatio: 'none',
      result: 'noise-cell',
    }))
      noise.setAttribute(name, value);
    const tile = el.ownerDocument.createElementNS(SVGNS, 'feTile');
    tile.setAttribute('in', 'noise-cell');
    tile.setAttribute('result', 'noise-tile');
    const grain = el.ownerDocument.createElementNS(SVGNS, 'feBlend');
    grain.setAttribute('in', 'noise-tile');
    grain.setAttribute('in2', 'SourceGraphic');
    grain.setAttribute('mode', materialProfile.noise.blendMode);
    grain.setAttribute('result', 'grain');
    filter.append(noise, tile, grain);
    transfer.setAttribute('in', 'grain');
  }
  const tables = materialPaintTables(paints);
  for (const [index, channel] of ['R', 'G', 'B'].entries()) {
    const fn = el.ownerDocument.createElementNS(SVGNS, `feFunc${channel}`);
    fn.setAttribute('type', 'table');
    fn.setAttribute('tableValues', tables[index] ?? '');
    transfer.append(fn);
  }
  const alpha = el.ownerDocument.createElementNS(SVGNS, 'feFuncA');
  alpha.setAttribute('type', 'linear');
  alpha.setAttribute('slope', '0');
  alpha.setAttribute('intercept', '1');
  transfer.append(alpha);
  filter.append(transfer);
  ensureHiddenDefs('lab-material-paint-defs', el).append(filter);
  const resource = { filter, fill: 'transparent', key, resources, refs: 1 };
  resources.set(key, resource);
  return resource;
}

function release(resource: PaintResource | undefined): void {
  if (!resource || --resource.refs) return;
  resource.resources.delete(resource.key);
  if (resource.filter) removeFilter(resource.filter);
}

export function attach(el: HTMLElement): EngineHandle {
  const renderer = paintRenderer();
  let held: PaintResource | undefined;
  let capture: HTMLElement | undefined;
  let signature = '';
  let disposed = false;
  const clear = (): void => {
    release(held);
    held = undefined;
    signature = '';
    el.style.removeProperty('--_material-paint-filter');
    el.style.removeProperty('--_surface-paint');
    el.style.removeProperty('--_noise');
    capture?.remove();
    capture = undefined;
    el.removeAttribute('data-lab-material-paint-renderer');
  };
  const refresh = (): void => {
    if (disposed) return;
    const cs = getComputedStyle(el);
    const normalValue = cs.getPropertyValue('--_tint').trim();
    const blendValue = cs.getPropertyValue('--_blend').trim();
    const theme = el.getAttribute('data-lab-material-theme') === 'dark' ? 'dark' : 'light';
    const acrylic = el.getAttribute('data-lab-material-mode') === 'acrylic';
    const noiseValue = acrylic ? cs.getPropertyValue('--_acrylic-noise') : '';
    const noiseSize = cs.getPropertyValue('--_acrylic-noise-size').trim();
    const next = `${normalValue}|${blendValue}|${theme}|${noiseValue}|${noiseSize}`;
    if (next === signature) return;
    const normal = parseRgb(normalValue);
    const blend = parseRgb(blendValue);
    if (!normal || !blend) {
      clear();
      return;
    }
    const noiseUrl = noiseValue.match(/url\(["']?([^"')]+)["']?\)/)?.[1];
    const resource = acquire(
      el,
      next,
      { normal, blend, blendMode: materialBlendMode(theme) },
      noiseUrl,
      noiseSize,
      renderer,
    );
    const previous = held;
    held = resource;
    signature = next;
    el.style.setProperty(
      '--_material-paint-filter',
      resource.filter ? `url(#${resource.filter.id})` : 'opacity(1)',
    );
    el.style.setProperty('--_surface-paint', resource.fill);
    if (resource.filter) el.style.setProperty('--_noise', 'none');
    if (renderer === 'capture-svg' || renderer === 'capture-blend') {
      if (!capture) {
        capture = el.ownerDocument.createElement('div');
        capture.className = 'lab-material__paint';
        capture.setAttribute('aria-hidden', 'true');
        const layers =
          renderer === 'capture-svg' ? ['capture'] : ['capture', 'grain', 'normal', 'blend'];
        for (const layer of layers) {
          const node = el.ownerDocument.createElement('div');
          node.className = `lab-material__${layer}`;
          capture.append(node);
        }
        el.prepend(capture);
      }
      el.setAttribute('data-lab-material-paint-renderer', renderer);
    }
    release(previous);
  };
  refresh();
  return {
    refresh,
    destroy(): void {
      if (disposed) return;
      disposed = true;
      clear();
    },
  };
}
