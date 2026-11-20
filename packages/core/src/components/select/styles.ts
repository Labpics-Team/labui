import { selectProfile as p } from '@labpics/ui-tokens';
import { slotSizeCss } from '../../slot-projection.js';
import { chipCss } from '../chip/styles.js';

const rem = (px: number) => `${px / 16}rem`;
const g = p.chevron;
const chevron = `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${g.viewBox} ${g.viewBox}"><path transform="translate(${g.x} ${g.y})" d="${g.data}"/></svg>`)}")`;
const sizes = Object.entries(p.sizes)
  .map(
    ([size, m]) => `
[data-lab-select][data-size="${size}"] {
  --_select-height: ${rem(m.height)}; --_select-radius: ${rem(m.radius)};
  --_select-start: ${rem(m.paddingStart)}; --_select-end: ${rem(m.paddingEnd)};
  --_select-y: ${rem(m.paddingY)}; --_select-gap: ${rem(m.gap)};
  --_select-leading: ${rem(m.leadingSize)}; --_select-font: ${rem(m.fontSize)};
  --_select-line: ${m.lineHeight / m.fontSize}; --_select-weight: ${m.fontWeight};
  --_select-tracking: ${m.letterSpacing / m.fontSize}em;
}`,
  )
  .join('\n');

// Chips and the floating caption stay above their sibling trigger inside this
// control's own stacking context. They never compete with the global dropdown.
const stackCss = `
[data-lab-select] .lab-select-control { isolation: isolate; }
[data-lab-select] .lab-select-control .lab-select-chips,
[data-lab-select] .lab-select-control .lab-select-label { z-index: 1; }
`;

const forcedColorsCss = `
@media (forced-colors: active) {
  [data-lab-select] .lab-select-trigger::before,
  [data-lab-select] .lab-select-outline { border-color: ButtonText; }
  [data-lab-select][data-disabled] { color: GrayText; }
  .lab-select-item[data-highlighted] { outline: 1px solid Highlight; }
}
`;

/** Dropdown and Multiselect share behavior; their authored compositions differ. */
export const selectCss = `
${chipCss}
${sizes}
[data-lab-select] { display: inline-flex; flex-direction: column; min-inline-size: 0; max-inline-size: 100%; gap: .25rem; font-family: var(--lab-font-family); color: var(--lab-${p.roles.label}); }
[data-lab-select] .lab-select-label { font-size: .75rem; font-weight: 500; line-height: 1; color: var(--lab-${p.roles.caption}); }
[data-lab-select] .lab-select-control { position: relative; min-inline-size: 0; border-radius: var(--_select-radius); }
[data-lab-select] .lab-select-trigger { position: relative; box-sizing: border-box; appearance: none; display: flex; align-items: center; justify-content: space-between; gap: var(--_select-gap); inline-size: 100%; min-inline-size: 0; min-block-size: var(--_select-height); margin: 0; padding: var(--_select-y) var(--_select-end) var(--_select-y) var(--_select-start); border: 0; border-radius: inherit; background: transparent; color: inherit; font: inherit; font-size: var(--_select-font); line-height: var(--_select-line); font-weight: var(--_select-weight); letter-spacing: var(--_select-tracking); text-align: start; cursor: pointer; }
[data-lab-select]:dir(rtl) .lab-select-trigger { padding-inline: var(--_select-start) var(--_select-end); }
[data-lab-select]:not([data-multiple]) .lab-select-trigger::before { content: ''; position: absolute; inset: 0; border: ${rem(p.stroke)} solid var(--lab-${p.roles.border}); border-radius: inherit; pointer-events: none; }
[data-lab-select]:not([data-disabled]) .lab-select-control:hover { background: var(--lab-${p.roles.hover}); }
[data-lab-select][data-multiple]:not([data-disabled]) .lab-select-control:hover { background: radial-gradient(ellipse ${p.multiple.hover.radiusX * 100}% ${p.multiple.hover.radiusY * 100}% at ${p.multiple.hover.centerX * 100}% ${p.multiple.hover.centerY * 100}%, transparent, var(--lab-${p.roles.hover})); }
[data-lab-select] .lab-select-trigger:focus-visible { outline: var(--lab-focus-ring-width) solid var(--lab-${p.roles.focus}); outline-offset: var(--lab-focus-ring-offset); }
[data-lab-select] .lab-select-value { display: inline-flex; align-items: center; min-inline-size: 0; gap: ${rem(p.leadingGap)}; }
[data-lab-select] .lab-select-value-text { min-inline-size: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
[data-lab-select] .lab-select-leading { display: inline-flex; flex: none; inline-size: var(--_select-leading); block-size: var(--_select-leading); }
[data-lab-select] .lab-select-leading[hidden], [data-lab-select] .lab-select-leading:empty { display: none; }
${slotSizeCss('[data-lab-select] .lab-select-leading > *, [data-lab-select] .lab-select-leading ::slotted(*)', '100%', '100%')}
[data-lab-select] .lab-select-indicator { display: block; flex: none; inline-size: ${rem(g.viewBox)}; block-size: ${rem(g.viewBox)}; background: currentColor; mask: ${chevron} center / contain no-repeat; }
[data-lab-select] .lab-select-indicator[data-state="open"] { transform: rotate(180deg); }
[data-lab-select][data-disabled] { color: var(--lab-${p.roles.disabled}); }
[data-lab-select][data-disabled] .lab-select-trigger { cursor: default; }
[data-lab-select][data-disabled] .lab-select-label { color: inherit; }
[data-lab-select][data-multiple] { --_select-height: ${rem(p.multiple.height)}; --_select-radius: ${rem(p.multiple.radius)}; inline-size: 100%; }
[data-lab-select][data-multiple] .lab-select-control { display: grid; grid-template-columns: minmax(0, 1fr); }
[data-lab-select][data-multiple] .lab-select-trigger { grid-area: 1 / 1; min-block-size: ${rem(p.multiple.height)}; padding: ${rem(p.sizes.m.paddingY)} ${rem(p.multiple.chevronEnd)} ${rem(p.sizes.m.paddingY)} ${rem(p.multiple.placeholderStart)}; font-size: ${rem(p.sizes.m.fontSize)}; line-height: ${p.sizes.m.lineHeight / p.sizes.m.fontSize}; font-weight: ${p.sizes.m.fontWeight}; letter-spacing: ${p.sizes.m.letterSpacing / p.sizes.m.fontSize}em; }
[data-lab-select][data-multiple] .lab-select-trigger .lab-select-value-text { color: var(--lab-${p.roles.placeholder}); }
[data-lab-select][data-multiple] .lab-select-indicator { margin-inline-start: auto; color: var(--lab-${p.roles.caption}); }
[data-lab-select][data-multiple][data-disabled] .lab-select-trigger .lab-select-value-text,
[data-lab-select][data-multiple][data-disabled] .lab-select-indicator { color: inherit; }
[data-lab-select][data-multiple] .lab-select-chips { position: relative; grid-area: 1 / 1; display: flex; align-items: center; flex-wrap: wrap; gap: ${rem(p.multiple.gap)}; min-inline-size: 0; padding: ${rem(p.multiple.paddingY)} ${rem(p.multiple.paddingEnd)} ${rem(p.multiple.paddingY)} ${rem(p.multiple.paddingStart)}; pointer-events: none; }
[data-lab-select]:dir(rtl) .lab-select-chips { padding-inline: ${rem(p.multiple.paddingStart)} ${rem(p.multiple.paddingEnd)}; }
[data-lab-select] .lab-select-chips > button { pointer-events: auto; }
[data-lab-select][data-multiple] .lab-select-label { position: absolute; inset-block-start: ${rem(-p.multiple.labelOverhang)}; inset-inline-start: ${rem(p.multiple.labelStart)}; max-inline-size: calc(100% - 2.5rem); font-size: ${rem(p.multiple.labelFontSize)}; line-height: ${p.multiple.labelLineHeight / p.multiple.labelFontSize}; font-weight: ${p.multiple.labelWeight}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; pointer-events: none; }
[data-lab-select] .lab-select-outline { position: absolute; inset: ${rem(-p.multiple.labelFontSize / 2)} 0 0; min-inline-size: 0; margin: 0; padding: 0; padding-inline-start: ${rem(p.multiple.labelStart - p.multiple.labelGap - p.stroke)}; border: ${rem(p.stroke)} solid var(--lab-${p.roles.border}); border-radius: inherit; pointer-events: none; }
[data-lab-select] .lab-select-outline legend { display: block; float: none; visibility: hidden; inline-size: auto; max-inline-size: calc(100% - 1.5rem); block-size: ${rem(p.multiple.labelFontSize)}; padding: 0 ${rem(p.multiple.labelGap)}; font-size: ${rem(p.multiple.labelFontSize)}; line-height: 1; font-weight: ${p.multiple.labelWeight}; white-space: nowrap; overflow: hidden; }
[data-lab-select]:not([data-label-visible]) .lab-select-outline legend { max-inline-size: 0; padding: 0; }
[data-lab-select][data-multiple] .lab-select-control:focus-within .lab-select-outline,
[data-lab-select][data-multiple] .lab-select-control:has([data-state="open"]) .lab-select-outline { border-color: var(--lab-${p.roles.focus}); }
[data-lab-select][data-multiple] .lab-select-control:focus-within .lab-select-label,
[data-lab-select][data-multiple] .lab-select-control:has([data-state="open"]) .lab-select-label { color: var(--lab-${p.roles.label}); }
[data-lab-select] .lab-select-label-hidden, [data-lab-select] .lab-select-hidden { position: absolute; inline-size: 1px; block-size: 1px; margin: -1px; padding: 0; border: 0; clip: rect(0 0 0 0); clip-path: inset(50%); overflow: hidden; white-space: nowrap; }
.lab-select-content { box-sizing: border-box; min-inline-size: var(--reference-width, 12rem); max-block-size: 16rem; overflow-y: auto; margin: 0; padding: .25rem; list-style: none; border-radius: .75rem; background: var(--lab-bg-secondary); color: var(--lab-label-primary); border: 1px solid var(--lab-border-soft); box-shadow: var(--lab-elevation-overlay); font-family: var(--lab-font-family); font-size: 1rem; line-height: 1.5; letter-spacing: -.015625em; z-index: var(--lab-z-dropdown, 900); }
.lab-select-content[hidden] { display: none; }
.lab-select-content:focus-visible { outline: none; }
.lab-select-item { display: flex; align-items: center; justify-content: space-between; gap: .5rem; padding: .25rem .5rem; border-radius: .25rem; cursor: pointer; user-select: none; }
.lab-select-item[data-highlighted] { background: var(--lab-fill-quaternary); }
.lab-select-item[data-state="checked"] { color: var(--lab-label-accent); }
.lab-select-item[data-disabled] { color: var(--lab-label-quaternary); cursor: default; }
.lab-select-item-text { overflow-wrap: anywhere; min-inline-size: 0; }
.lab-select-item-indicator { flex: none; }
${stackCss}
${forcedColorsCss}
`;
