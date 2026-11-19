import { shadowProfile } from '@labpics/ui-shadow';
import { segmentedProfile as p } from '@labpics/ui-tokens';

const rem = (px: number) => `${px / 16}rem`;
const role = (name: string) => `var(--lab-${name})`;
const shadow = shadowProfile.levels[p.activeShadow]
  ?.map(
    (s) =>
      `${rem(s.x)} ${rem(s.y)} ${rem(s.blur)} ${rem(s.spread)} color-mix(in srgb, ${role(s.colorRole)} ${s.opacity * 100}%, transparent)`,
  )
  .join(', ');

/** Both DOM renderers consume the same author profile. */
export const segmentedCss = `
[data-lab-segmented] {
  display: flex; box-sizing: border-box; position: relative; min-inline-size: 0; max-inline-size: 100%;
  padding: ${rem(p.padding)}; background: ${role(p.roles.track)}; overflow-x: auto; overflow-y: hidden;
  scrollbar-width: thin; font-family: var(--lab-font-family); corner-shape: superellipse(var(--lab-radius-corner-k, 1.1));
}
${Object.entries(p.shapes)
  .map(
    ([name, shape]) => `
[data-lab-segmented][data-shape="${name}"] { border-radius: ${rem(shape.trackRadius)}; --_segment-radius: ${rem(shape.controlRadius)}; }
`,
  )
  .join('')}
[data-lab-segmented] > .lab-segment {
  display: flex; flex: 1 0 0; align-items: center; justify-content: center; position: relative; isolation: isolate;
  box-sizing: border-box; min-inline-size: max-content; min-block-size: ${rem(p.controlHeight)};
  gap: ${rem(p.gap)}; padding: ${rem(p.controlPadding)}; border-radius: var(--_segment-radius); corner-shape: round;
  color: ${role(p.roles.inactiveLabel)}; cursor: pointer; -webkit-tap-highlight-color: transparent;
  font-size: ${rem(p.fontSize)}; line-height: ${p.lineHeight / p.fontSize}; font-weight: ${p.fontWeight};
  letter-spacing: ${p.letterSpacing / p.fontSize}em; white-space: nowrap;
}
[data-lab-segmented] > .lab-segment[data-icon-only] { padding: ${rem(p.iconOnlyPadding)}; }
[data-lab-segmented] > .lab-segment:hover:not(:has(input:disabled)):not([data-selected]) { background: ${role(p.roles.hover)}; color: ${role(p.roles.label)}; }
[data-lab-segmented] > .lab-segment[data-selected] { color: ${role(p.roles.label)}; }
[data-lab-segmented] > .lab-segment:has(input:disabled) { color: ${role(p.roles.disabledLabel)}; cursor: default; }
[data-lab-segmented] > .lab-segment > input { position: absolute; inset: 0; inline-size: 100%; block-size: 100%; opacity: 0; margin: 0; cursor: inherit; }
[data-lab-segmented] > .lab-segment > .lab-segment-active { position: absolute; inset: 0; z-index: -1; pointer-events: none; border-radius: inherit; corner-shape: round; }
[data-lab-segmented] > .lab-segment[data-selected] > .lab-segment-active { background: ${role(p.roles.activeFill)}; box-shadow: var(--lab-shadow-${p.activeShadow}, ${shadow}); }
[data-lab-segmented] > .lab-segment:not(:first-child):not([data-selected])::before {
  content: ''; position: absolute; inset-block: ${rem(p.separatorInset)}; inset-inline-start: 0;
  inline-size: ${rem(p.strokeWidth)}; background: ${role(p.roles.border)};
}
[data-lab-segmented] > .lab-segment[data-selected] + .lab-segment::before { display: none; }
.lab-segment-icon { display: inline-flex; flex: none; inline-size: ${rem(p.iconSize)}; block-size: ${rem(p.iconSize)}; }
.lab-segment-icon > * { inline-size: 100%; block-size: 100%; }
.lab-segment[data-icon-only] > .lab-segment-icon { inline-size: ${rem(p.iconOnlySize)}; block-size: ${rem(p.iconOnlySize)}; }
.lab-segment[data-icon-only] > .lab-segment-label { position: absolute; inline-size: 1px; block-size: 1px; overflow: hidden; clip-path: inset(50%); }
[data-lab-segmented] > .lab-segment:has(input:focus-visible) { outline: ${rem(p.focus.width)} solid ${role(p.roles.focus)}; outline-offset: ${rem(-p.focus.inset)}; }
@media (forced-colors: active) {
  [data-lab-segmented] { background: Canvas; outline: 1px solid ButtonText; outline-offset: -1px; }
  [data-lab-segmented] > .lab-segment { color: ButtonText; }
  [data-lab-segmented] > .lab-segment[data-selected] { color: Highlight; outline: 1px solid Highlight; outline-offset: -1px; }
  [data-lab-segmented] > .lab-segment:has(input:disabled) { color: GrayText; }
  [data-lab-segmented] > .lab-segment:has(input:focus-visible) { outline: 2px solid Highlight; }
}
`;
