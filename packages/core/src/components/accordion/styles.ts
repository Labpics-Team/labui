import { accordionProfile as p } from '@labpics/ui-tokens';

const rem = (px: number) => `${px / 16}rem`;
const g = p.chevron;
const chevron = `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${g.viewBox} ${g.viewBox}"><path transform="translate(${g.x} ${g.y})" d="${g.data}"/></svg>`)}")`;
const sizes = Object.entries(p.sizes)
  .map(
    ([size, m]) => `
[data-lab-accordion][data-size="${size}"] {
  --_accordion-pad: ${rem(m.padding)}; --_accordion-radius: ${rem(m.radius)};
  --_accordion-gap: ${rem(m.gap)}; --_accordion-content-gap: ${rem(m.contentGap)};
  --_accordion-font: ${rem(m.fontSize)}; --_accordion-line: ${m.lineHeight / m.fontSize};
  --_accordion-icon: ${rem(m.iconSize)};
}`,
  )
  .join('\n');
const forcedColorsCss = `
@media (forced-colors: active) {
  [data-lab-accordion] .lab-accordion-trigger { color: ButtonText; }
  [data-lab-accordion] .lab-accordion-content { color: CanvasText; }
  [data-lab-accordion] .lab-accordion-trigger:disabled { color: GrayText; }
  [data-lab-accordion] .lab-accordion-trigger:focus-visible { outline-color: Highlight; }
}
`;

export const accordionCss = `
${sizes}
[data-lab-accordion] { display: flex; flex-direction: column; min-inline-size: 0; font-family: var(--lab-font-family); }
[data-lab-accordion][data-orientation="horizontal"] { flex-direction: row; }
[data-lab-accordion] .lab-accordion-item { --_accordion-open: 0; flex: 1; min-inline-size: 0; border-radius: var(--_accordion-radius); }
[data-lab-accordion] .lab-accordion-item[data-state="open"] { --_accordion-open: 1; }
[data-lab-accordion] .lab-accordion-item:not([data-disabled]):hover { background: var(--lab-${p.roles.hover}); }
[data-lab-accordion] .lab-accordion-heading { margin: 0; font: inherit; }
[data-lab-accordion] .lab-accordion-trigger { appearance: none; display: flex; align-items: center; gap: var(--_accordion-gap); box-sizing: border-box; inline-size: 100%; margin: 0; padding: var(--_accordion-pad); border: 0; border-radius: var(--_accordion-radius); background: transparent; color: var(--lab-${p.roles.label}); font: inherit; font-size: var(--_accordion-font); line-height: var(--_accordion-line); font-weight: ${p.titleWeight}; letter-spacing: ${p.titleTracking}em; text-align: start; cursor: pointer; }
[data-lab-accordion] .lab-accordion-trigger { padding-block-end: calc(var(--_accordion-pad) * (1 - var(--_accordion-open)) + var(--_accordion-content-gap) * var(--_accordion-open)); }
[data-lab-accordion] .lab-accordion-trigger:disabled { color: var(--lab-${p.roles.disabled}); cursor: default; }
[data-lab-accordion] .lab-accordion-trigger:focus-visible { outline: var(--lab-focus-ring-width) solid var(--lab-${p.roles.focus}); outline-offset: calc(0px - var(--lab-focus-ring-offset)); }
[data-lab-accordion] .lab-accordion-label { flex: 1; min-inline-size: 0; overflow-wrap: anywhere; }
[data-lab-accordion] .lab-accordion-indicator { display: block; flex: none; inline-size: var(--_accordion-icon); block-size: var(--_accordion-icon); background: currentColor; mask: ${chevron} center / contain no-repeat; }
[data-lab-accordion] .lab-accordion-indicator[data-state="open"] { align-self: flex-start;  }
[data-lab-accordion] .lab-accordion-indicator { transform: rotate(calc(180deg * var(--_accordion-open))); }
[data-lab-accordion] .lab-accordion-body { box-sizing: border-box; min-inline-size: 0; padding: 0 calc(var(--_accordion-pad) + var(--_accordion-icon) + var(--_accordion-gap)) var(--_accordion-pad) var(--_accordion-pad); color: var(--lab-${p.roles.body}); font-size: var(--_accordion-font); font-weight: ${p.bodyWeight}; line-height: var(--_accordion-line); letter-spacing: ${p.bodyTracking / p.sizes.m.fontSize}em; overflow-wrap: anywhere; }
[data-lab-accordion]:dir(rtl) .lab-accordion-body { padding-inline: var(--_accordion-pad) calc(var(--_accordion-pad) + var(--_accordion-icon) + var(--_accordion-gap)); }
[data-lab-accordion] .lab-accordion-content[hidden] { display: none; }
[data-lab-accordion] .lab-accordion-item[data-disclosing] > .lab-accordion-content { display: block; overflow: hidden; height: calc(var(--_accordion-height) * var(--_accordion-open)); }
${forcedColorsCss}
`;
