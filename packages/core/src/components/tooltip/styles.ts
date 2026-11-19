import { tooltipProfile as p } from '@labpics/ui-tokens';

const rem = (n: number) => `${n / 16}rem`;
const shadow = p.shadow
  .map(
    (layer) =>
      `${rem(layer.x)} ${rem(layer.y)} ${rem(layer.blur)} ${rem(layer.spread)} color-mix(in srgb, var(--lab-${layer.colorRole}) ${layer.opacity * 100}%, transparent)`,
  )
  .join(',');
const mask = (data: string, transform = '') =>
  `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${p.tail.width}" height="${p.tail.bubble.height}" viewBox="0 0 ${p.tail.width} ${p.tail.bubble.height}"><path fill="white" d="${data}" transform="${transform}"/></svg>`)}")`;

/** Source body and both authored tails; renderers share the same paint. */
export const tooltipCss = `
.lab-tooltip-positioner {
  position: fixed; inset: auto; margin: 0; padding: 0; border: 0;
  width: max-content; max-width: min(${rem(p.maxWidth)}, calc(100vw - 16px));
  background: transparent; color: inherit; overflow: visible;
  z-index: var(--lab-z-tooltip); font-family: var(--lab-font-family);
}
.lab-tooltip-positioner::backdrop { background: transparent; pointer-events: none; }
.lab-tooltip-content {
  --_tooltip-surface: var(--lab-${p.types.neutral.surfaceRole});
  --_tooltip-label: var(--lab-${p.types.neutral.labelRole});
  --lab-material-shadow: ${shadow};
  position: relative; isolation: isolate; box-sizing: border-box;
  min-width: ${rem(p.minWidth)}; padding: ${rem(p.padding)};
  border-radius: ${rem(p.radius)}; color: var(--_tooltip-label);
  font-family: var(--lab-font-family); font-size: ${rem(p.fontSize)};
  font-weight: ${p.fontWeight}; line-height: ${p.lineHeight / p.fontSize};
  letter-spacing: ${p.letterSpacing / p.fontSize}em; text-align: center;
  overflow-wrap: anywhere; box-shadow: var(--lab-material-shadow);
}
.lab-tooltip-content::before {
  content: ''; position: absolute; inset: 0; z-index: -1;
  border-radius: inherit; background: var(--_tooltip-surface);
  clip-path: var(--lab-contour-clip, none); pointer-events: none;
}
${Object.entries(p.types)
  .map(
    ([type, roles]) => `.lab-tooltip-content[data-type="${type}"] {
  --_tooltip-surface: var(--lab-${roles.surfaceRole});
  --_tooltip-label: var(--lab-${roles.labelRole});
}`,
  )
  .join('\n')}
/* S/L are explicit compatibility extensions; M is the authored Body specimen. */
.lab-tooltip-content[data-size="s"] { padding: 8px; font-size: 14px; line-height: 20px; }
.lab-tooltip-content[data-size="l"] { padding: 16px; }
.lab-tooltip-content[hidden] { display: none; }
.lab-tooltip-arrow {
  position: absolute; width: ${rem(p.tail.width)}; height: ${rem(p.tail.height)};
  pointer-events: none;
}
.lab-tooltip-arrow::before {
  content: ''; display: block; width: ${rem(p.tail.width)}; height: ${rem(p.tail.bubble.height)};
  background: var(--_tooltip-surface); mask: ${mask(p.tail.chevron.data)} center top / 100% 100% no-repeat;
}
.lab-tooltip-arrow[data-tail="bubble"]::before { mask-image: ${mask(p.tail.bubble.data, `translate(${p.tail.bubble.x} ${p.tail.bubble.y})`)}; }
.lab-tooltip-positioner[data-side="top"] .lab-tooltip-arrow { top: 100%; }
.lab-tooltip-positioner[data-side="bottom"] .lab-tooltip-arrow { bottom: 100%; transform: rotate(180deg); }
.lab-tooltip-positioner[data-side="left"] .lab-tooltip-arrow { left: 100%; width: ${rem(p.tail.height)}; height: ${rem(p.tail.width)}; }
.lab-tooltip-positioner[data-side="left"] .lab-tooltip-arrow::before { transform-origin: 0 0; transform: translateY(${rem(p.tail.width)}) rotate(-90deg); }
.lab-tooltip-positioner[data-side="right"] .lab-tooltip-arrow { right: 100%; width: ${rem(p.tail.height)}; height: ${rem(p.tail.width)}; }
.lab-tooltip-positioner[data-side="right"] .lab-tooltip-arrow::before { transform-origin: 0 0; transform: translateX(${rem(p.tail.height)}) rotate(90deg); }
.lab-tooltip-arrow[hidden] { display: none; }
.lab-tooltip-fallback {
  font: inherit; color: inherit; border: 0; padding: 0; background: none;
  display: inline-flex; cursor: default;
}
.lab-tooltip-fallback:focus-visible { outline: var(--lab-focus-ring-width) solid var(--lab-border-focus); outline-offset: var(--lab-focus-ring-offset); }
`;
