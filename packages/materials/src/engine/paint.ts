/** Author paints inside the backdrop filter, shared by Acrylic and Glass.
 * Filtering the host would also filter its text and establish a different
 * Backdrop Root. A blending child instead loses the backdrop under isolation
 * or transforms. This transfer operates directly on the captured backdrop.
 */
import { parseRgb } from '../luminance';
import { materialPaintTables } from '../material-paints';
import { materialBlendMode } from '../profile';
import { type EngineHandle, ensureHiddenDefs, removeFilter, trailingRaf } from './mount';

const SVGNS = 'http://www.w3.org/2000/svg';
let uid = 0;

export function attach(el: HTMLElement): EngineHandle {
  const doc = el.ownerDocument;
  const filter = doc.createElementNS(SVGNS, 'filter');
  const id = `lab-material-paint-${++uid}`;
  filter.setAttribute('id', id);
  filter.setAttribute('filterUnits', 'userSpaceOnUse');
  filter.setAttribute('color-interpolation-filters', 'sRGB');
  filter.setAttribute('x', '0');
  filter.setAttribute('y', '0');
  const noise = doc.createElementNS(SVGNS, 'feImage');
  noise.setAttribute('x', '0');
  noise.setAttribute('y', '0');
  noise.setAttribute('preserveAspectRatio', 'none');
  noise.setAttribute('result', 'noise-cell');
  const tile = doc.createElementNS(SVGNS, 'feTile');
  tile.setAttribute('in', 'noise-cell');
  tile.setAttribute('result', 'noise-tile');
  const grain = doc.createElementNS(SVGNS, 'feBlend');
  grain.setAttribute('in', 'noise-tile');
  grain.setAttribute('in2', 'SourceGraphic');
  grain.setAttribute('mode', 'normal');
  grain.setAttribute('result', 'grain');
  const transfer = doc.createElementNS(SVGNS, 'feComponentTransfer');
  const channels = ['R', 'G', 'B'].map((channel) => {
    const fn = doc.createElementNS(SVGNS, `feFunc${channel}`);
    fn.setAttribute('type', 'table');
    transfer.appendChild(fn);
    return fn;
  });
  // CSS blur can carry coverage alpha at a viewport/filter edge. Author paints
  // describe an opaque backdrop; surface clipping owns the outside coverage.
  const alpha = doc.createElementNS(SVGNS, 'feFuncA');
  alpha.setAttribute('type', 'linear');
  alpha.setAttribute('slope', '0');
  alpha.setAttribute('intercept', '1');
  transfer.appendChild(alpha);
  filter.append(noise, tile, grain, transfer);
  ensureHiddenDefs('lab-material-paint-defs', el).appendChild(filter);

  let signature = '';
  const setRegion = (): void => {
    for (const [name, value] of [
      ['width', el.offsetWidth],
      ['height', el.offsetHeight],
    ] as const) {
      const next = String(Math.max(1, value));
      if (filter.getAttribute(name) !== next) filter.setAttribute(name, next);
    }
  };
  const refresh = (): void => {
    const cs = getComputedStyle(el);
    const normalValue = cs.getPropertyValue('--_tint').trim();
    const blendValue = cs.getPropertyValue('--_blend').trim();
    const theme = el.getAttribute('data-lab-material-theme') === 'dark' ? 'dark' : 'light';
    const acrylic = el.getAttribute('data-lab-material-mode') === 'acrylic';
    const noiseValue = cs.getPropertyValue('--_acrylic-noise');
    const noiseSize = cs.getPropertyValue('--_acrylic-noise-size').trim();
    const next = `${normalValue}|${blendValue}|${theme}|${acrylic}|${noiseValue}|${noiseSize}`;
    if (next === signature) return;
    const normal = parseRgb(normalValue);
    const blend = parseRgb(blendValue);
    if (!normal || !blend) {
      // Missing/invalid roles keep the CSS fallback. Never keep a stale theme.
      el.style.removeProperty('--_material-paint-filter');
      el.style.removeProperty('--_surface-paint');
      el.style.removeProperty('--_noise');
      signature = '';
      return;
    }
    const tables = materialPaintTables({ normal, blend, blendMode: materialBlendMode(theme) });
    const noiseUrl = noiseValue.match(/url\(["']?([^"')]+)["']?\)/)?.[1];
    if (acrylic && noiseUrl) {
      noise.setAttribute('href', noiseUrl);
      noise.setAttribute('width', noiseSize);
      noise.setAttribute('height', noiseSize);
      transfer.setAttribute('in', 'grain');
    } else {
      noise.removeAttribute('href');
      transfer.setAttribute('in', 'SourceGraphic');
    }
    channels.forEach((channel, i) => channel.setAttribute('tableValues', tables[i] ?? ''));
    el.style.setProperty('--_material-paint-filter', `url(#${id})`);
    el.style.setProperty('--_surface-paint', 'transparent');
    el.style.setProperty('--_noise', 'none');
    signature = next;
  };
  setRegion();
  refresh();
  const raf = trailingRaf(setRegion);
  const resize = new ResizeObserver(() => raf.schedule());
  resize.observe(el);
  return {
    refresh,
    destroy(): void {
      resize.disconnect();
      raf.cancel();
      removeFilter(filter);
      el.style.removeProperty('--_material-paint-filter');
      el.style.removeProperty('--_surface-paint');
      el.style.removeProperty('--_noise');
    },
  };
}
