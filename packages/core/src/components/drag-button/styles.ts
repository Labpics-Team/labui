import { dragButtonProfile as p } from '@labpics/ui-tokens';
import { buttonFillCss } from '../button/fill.js';

const rem = (value: number) => `${value / 16}rem`;
const maskWidth = p.mask.count * p.mask.width + (p.mask.count - 1) * p.mask.gap;
// Figma's layer blur is a diameter. Keep the mask right-anchored, as in the authored frame.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${maskWidth + p.mask.blur * 2}" height="${p.mask.height + p.mask.blur * 2}" viewBox="${-p.mask.blur} ${-p.mask.blur} ${maskWidth + p.mask.blur * 2} ${p.mask.height + p.mask.blur * 2}"><defs><filter id="b" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="${p.mask.blur / 2}"/></filter></defs>${Array.from({ length: p.mask.count }, (_, i) => `<rect x="${i * (p.mask.width + p.mask.gap)}" width="${p.mask.width}" height="${p.mask.height}" fill="white" filter="url(#b)"/>`).join('')}</svg>`;
export const dragButtonCss = `
[data-lab-drag-button] {
  --lab-drag-progress: 0;
  appearance: none; display: block; position: relative; box-sizing: border-box;
  width: 100%; min-width: ${rem(p.height)}; min-height: ${rem(p.height)};
  padding: ${rem(p.padding)}; border: 0; border-radius: ${rem(p.radius)};
  background: transparent; color: var(--lab-${p.roles.label});
  font-family: var(--lab-font-family); font-size: ${rem(p.fontSize)}; line-height: ${p.lineHeight / p.fontSize};
  font-weight: ${p.fontWeight}; letter-spacing: ${p.letterSpacing / p.fontSize}em;
  text-align: center; touch-action: pan-y; user-select: none; cursor: pointer; isolation: isolate;
  -webkit-tap-highlight-color: transparent;
}
[data-lab-drag-button] > .lab-drag-track {
  position: absolute; inset: 0; border-radius: inherit; overflow: hidden; pointer-events: none;
  display: grid; align-items: center; direction: ltr;
  grid-template-columns: minmax(calc(var(--lab-size-button-m) + ${rem(p.padding * 2)}), 1fr) minmax(0, max-content) minmax(${rem(p.padding * 2)}, 1fr);
  mask-image: url('data:image/svg+xml,${encodeURIComponent(svg)}');
  mask-size: ${rem(maskWidth + p.mask.blur * 2)} ${rem(p.mask.height + p.mask.blur * 2)};
  mask-position: calc(100% + ${rem(p.mask.blur)}) center; mask-repeat: no-repeat;
}
[data-lab-drag-button]:dir(rtl) > .lab-drag-track { transform: scaleX(-1); }
[data-lab-drag-button]:dir(rtl) .lab-drag-helper { transform: scaleX(-1); direction: rtl; }
.lab-drag-track::after { content: ''; position: absolute; inset: 0; border-radius: inherit; background: var(--lab-${p.roles.track}); }
.lab-drag-helper { grid-column: 2; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
[data-lab-drag-button]:not([data-status='idle']) .lab-drag-helper { visibility: hidden; }
[data-lab-drag-button] > .lab-drag-fill {
  position: relative; display: flex; align-items: center; justify-content: flex-end; box-sizing: border-box;
  width: calc(var(--lab-size-button-m) + (100% - var(--lab-size-button-m)) * var(--lab-drag-progress));
  min-height: var(--lab-size-button-m); border-radius: var(--lab-radius-button-m); overflow: hidden;
  background-color: var(--lab-fill-accent); color: var(--lab-label-on-accent); pointer-events: none;
}
[data-lab-drag-button][data-dragging=""] > .lab-drag-fill::before {
  content: ''; position: absolute; width: ${rem(p.glow.size)}; height: ${rem(p.glow.size)};
  left: calc(50% + ${rem(p.glow.offsetX)}); top: calc(50% + ${rem(p.glow.offsetY)}); transform: translate(-50%, -50%);
  border-radius: 50%; background: var(--lab-${p.glow.colorRole}); opacity: ${p.glow.opacity}; filter: blur(${rem(p.glow.blur / 2)});
}
[data-lab-drag-button][data-status='danger'] > .lab-drag-fill { background-color: var(--lab-fill-danger); color: var(--lab-label-on-danger); }
[data-lab-drag-button]:not([data-status='idle']) > .lab-drag-fill { width: 100%; justify-content: center; }
.lab-drag-chevron { display: grid; place-items: center; flex: none; width: var(--lab-size-button-m); min-height: var(--lab-size-button-m); }
[data-lab-drag-button]:dir(rtl) .lab-drag-chevron { transform: scaleX(-1); }
.lab-drag-result { max-width: 100%; box-sizing: border-box; display: inline-flex; justify-content: center; align-items: center; padding: var(--lab-space-button-m-y) var(--lab-space-button-m-x); }
.lab-drag-result-text { min-width: 0; padding-inline: var(--lab-space-button-label-x); overflow-wrap: anywhere; }
.lab-drag-icon { width: var(--lab-size-button-m-icon); height: var(--lab-size-button-m-icon); display: inline-flex; flex: none; }
.lab-drag-icon > *, .lab-drag-chevron > * { width: var(--lab-size-button-m-icon) !important; height: var(--lab-size-button-m-icon) !important; }
.lab-drag-spinner { width: var(--lab-size-button-m-icon); height: var(--lab-size-button-m-icon); background: currentColor; mask: var(--lab-shape-loader) center / contain no-repeat; animation: lab-drag-spin var(--lab-motion-loader-period) var(--lab-motion-loader-steps) infinite; }
[data-lab-drag-button] [hidden] { display: none; }
[data-lab-drag-button]:focus-visible { outline: var(--lab-focus-ring-width) solid var(--lab-border-focus); outline-offset: var(--lab-focus-ring-offset); }
[data-lab-drag-button][aria-disabled='true'] { cursor: default; }
[data-lab-drag-button][data-status='pending'] { cursor: progress; }
[data-lab-drag-button]:disabled > .lab-drag-fill { background: var(--lab-fill-quaternary); color: var(--lab-label-quaternary); box-shadow: none; }
.lab-drag-announcement { position: absolute; width: 1px; height: 1px; clip-path: inset(50%); overflow: hidden; }
${buttonFillCss('[data-lab-drag-button] > .lab-drag-fill', '[data-lab-drag-button][data-status="idle"]:hover:not(:disabled) > .lab-drag-fill', '[data-lab-drag-button][data-dragging=""] > .lab-drag-fill')}
@keyframes lab-drag-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .lab-drag-spinner { animation: none; } }
@media (forced-colors: active) {
  [data-lab-drag-button] { outline: 1px solid ButtonText; outline-offset: -1px; }
  [data-lab-drag-button] > .lab-drag-track { mask: none; }
  [data-lab-drag-button] > .lab-drag-fill { background: Highlight; color: HighlightText; }
}
`;
