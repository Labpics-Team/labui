import { paginationProfile as p } from '@labpics/ui-tokens';

const rem = (value: number) => `${value / 16}rem`;
const role = (value: string) => `var(--lab-${value})`;
const glyph = p.glyphs.chevron;
const chevron = `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${glyph.viewBox} ${glyph.viewBox}'><path transform='translate(${glyph.x} ${glyph.y})' d='${glyph.data}'/></svg>`)}")`;
const stackCss = `
[data-lab-pagination] { isolation: isolate; }
.lab-pagination-surface { z-index: -1; }
`;
const forcedColorsCss = `
@media (forced-colors: active) {
  [data-lab-pagination] .lab-pagination-control { color: ButtonText; border-color: ButtonText; }
  [data-lab-pagination] .lab-pagination-control[aria-current] { color: Highlight; outline: 1px solid Highlight; }
  [data-lab-pagination] .lab-pagination-control[aria-disabled='true'], [data-lab-pagination] .lab-pagination-control:disabled { color: GrayText; }
  [data-lab-pagination] .lab-pagination-dot { background: ButtonText; opacity: 1; }
  [data-lab-pagination] [aria-current] .lab-pagination-dot { background: Highlight; }
  [data-lab-pagination] .lab-pagination-control:focus-visible { outline-color: Highlight; }
}
`;

/** One authored sheet for React light DOM and Lit shadow DOM. */
export const paginationCss = `
[data-lab-pagination] {
  --_pg-radius: ${rem(p.radius)}; --_pg-pill: ${rem(p.compact.radius)};
  --_pg-dot: ${rem(p.compact.dot)}; --_pg-opacity: ${p.compact.inactiveOpacity};
  display: flex; flex-wrap: wrap; align-items: center; gap: ${rem(p.gap)};
  position: relative; inline-size: fit-content; max-inline-size: 100%; box-sizing: border-box;
  color: ${role(p.roles.label)}; font-family: var(--lab-font-family);
  font-size: ${rem(p.fontSize)}; line-height: ${p.lineHeight / p.fontSize}; font-weight: ${p.fontWeight}; letter-spacing: 0;
}
.lab-pagination-control, .lab-pagination-ellipsis {
  appearance: none; box-sizing: border-box; display: inline-flex; flex: none; align-items: center; justify-content: center;
  min-inline-size: ${rem(p.control)}; min-block-size: ${rem(p.control)}; padding: 0 ${rem(p.padding)}; margin: 0;
  border: ${rem(p.stroke)} solid ${role(p.roles.border)}; border-radius: var(--_pg-radius); corner-shape: round;
  color: inherit; font: inherit; text-decoration: none; background: transparent;
}
.lab-pagination-control { cursor: pointer; }
.lab-pagination-control:hover:not(:disabled):not([aria-disabled='true']):not([aria-current]) { background: ${role(p.roles.hover)}; }
.lab-pagination-control[aria-current] { background: ${role(p.roles.active)}; border-color: transparent; }
.lab-pagination-control:disabled, .lab-pagination-control[aria-disabled='true'] { color: ${role(p.roles.disabled)}; cursor: default; }
.lab-pagination-control:focus-visible { outline: ${rem(p.focus.width)} solid ${role(p.roles.focus)}; outline-offset: ${rem(p.focus.offset)}; }
.lab-pagination-trigger { color: ${role(p.roles.chevron)}; }
.lab-pagination-trigger:hover:not(:disabled):not([aria-disabled='true']) { color: ${role(p.roles.label)}; }
.lab-pagination-chevron { inline-size: ${rem(p.icon)}; block-size: ${rem(p.icon)}; background: currentColor; mask: ${chevron} center / contain no-repeat; }
.lab-pagination-next .lab-pagination-chevron, .lab-pagination-prev:dir(rtl) .lab-pagination-chevron { transform: scaleX(-1); }
.lab-pagination-next:dir(rtl) .lab-pagination-chevron { transform: none; }
.lab-pagination-ellipsis { border-color: transparent; color: ${role(p.roles.chevron)}; user-select: none; }
.lab-pagination-dots { inline-size: ${rem(p.icon)}; block-size: ${rem(p.icon)}; display: flex; justify-content: center; gap: ${rem(p.glyphs.ellipsis.gap)}; padding-block-start: ${rem(p.glyphs.ellipsis.offsetY)}; box-sizing: border-box; }
.lab-pagination-dots i { display: block; inline-size: ${rem(p.glyphs.ellipsis.diameter)}; block-size: ${rem(p.glyphs.ellipsis.diameter)}; background: currentColor; border-radius: var(--_pg-pill); }
[data-lab-pagination][data-variant='compact'] { gap: 0; padding: 0 ${rem(p.compact.padding - p.compact.gap / 2)}; border-radius: var(--_pg-pill); color: ${role(p.compact.colorRole)}; }
[data-lab-pagination][data-ambient] { --_pg-opacity: ${p.compact.ambientInactiveOpacity}; color: ${role(p.compact.ambientColorRole)}; }
[data-lab-pagination][data-variant='compact'] .lab-pagination-control {
  min-inline-size: 0; min-block-size: ${rem(p.compact.height)}; padding: ${rem(p.compact.padding)} ${rem(p.compact.gap / 2)}; border: 0; border-radius: var(--_pg-pill); background: transparent;
}
.lab-pagination-surface { position: absolute; inset: 0; border-radius: inherit; pointer-events: none; }
.lab-pagination-dot { display: block; position: relative; flex: none; inline-size: var(--_pg-dot); block-size: ${rem(p.compact.dot)}; border-radius: var(--_pg-pill); background: currentColor; opacity: var(--_pg-opacity); overflow: hidden; }
.lab-pagination-control[data-receding] .lab-pagination-dot { transform: scale(${p.compact.recedingDot / p.compact.dot}); }
.lab-pagination-control[aria-current] .lab-pagination-dot { opacity: 1; }
.lab-pagination-control[aria-current][data-progress] .lab-pagination-dot { inline-size: ${rem(p.compact.track)}; background: transparent; }
.lab-pagination-control[data-progress] .lab-pagination-dot::before, .lab-pagination-progress { content: ''; display: block; position: absolute; inset: 0; border-radius: inherit; background: currentColor; }
.lab-pagination-control[data-progress] .lab-pagination-dot::before { opacity: var(--_pg-opacity); }
.lab-pagination-progress { transform: scaleX(var(--_pg-progress, 0)); transform-origin: left; }
.lab-pagination-control:dir(rtl) .lab-pagination-progress { transform-origin: right; }
[data-lab-pagination][data-disabled] .lab-pagination-dot { opacity: var(--_pg-opacity); }
${stackCss}
${forcedColorsCss}
`;
