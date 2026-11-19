import { pinInputProfile as p } from '@labpics/ui-tokens';

const rem = (value: number) => `${value / 16}rem`;
const role = (value: string) => `var(--lab-${value})`;

/** One authored paint for Lit, React and all generated web adapters. */
export const pinInputCss = `
[data-lab-pin-input] { display: flex; flex-direction: column; align-items: flex-start; gap: ${rem(p.fieldGap)}; max-inline-size: 100%; font-family: var(--lab-font-family); }
${Object.entries(p.sizes)
  .map(
    ([size, m]) => `
[data-lab-pin-input][data-size="${size}"] { --_pin-width: ${rem(m.width)}; --_pin-height: ${rem(m.height)}; --_pin-radius: ${rem(m.radius)}; --_pin-gap: ${rem(m.gap)}; --_pin-dot: ${rem(m.dot)}; --_pin-font: ${rem(m.fontSize)}; --_pin-line: ${m.lineHeight / m.fontSize}; --_pin-weight: ${m.fontWeight}; --_pin-tracking: ${m.letterSpacing / m.fontSize}em; }
`,
  )
  .join('')}
[data-lab-pin-input] .lab-pin-input-control { display: flex; flex-wrap: nowrap; gap: var(--_pin-gap); padding: 0; margin: 0; border: 0; background: transparent; }
[data-lab-pin-input] .lab-pin-input-cell { position: relative; flex: none; inline-size: var(--_pin-width); block-size: var(--_pin-height); }
[data-lab-pin-input] .lab-pin-input-segment { box-sizing: border-box; display: block; margin: 0; padding: 0; inline-size: 100%; block-size: 100%; min-inline-size: 0; border: ${rem(p.strokeWidth)} solid ${role(p.roles.border)}; border-radius: var(--_pin-radius); corner-shape: round; background: ${role(p.roles.background)}; color: ${role(p.roles.label)}; font-family: inherit; font-size: var(--_pin-font); line-height: var(--_pin-line); font-weight: var(--_pin-weight); letter-spacing: var(--_pin-tracking); text-align: center; appearance: none; outline: none; transition: background-color var(--lab-motion-transition-duration) var(--lab-motion-transition-easing), border-color var(--lab-motion-transition-duration) var(--lab-motion-transition-easing); }
[data-lab-pin-input] .lab-pin-input-segment[data-filled], [data-lab-pin-input] .lab-pin-input-segment:focus { border-color: ${role(p.roles.activeBorder)}; }
[data-lab-pin-input] .lab-pin-input-segment:hover:not(:disabled):not([readonly]) { background: linear-gradient(${role(p.roles.hover)}, ${role(p.roles.hover)}), ${role(p.roles.background)}; }
[data-lab-pin-input] .lab-pin-input-segment:focus-visible { outline: ${rem(p.focus.width)} solid ${role(p.roles.focus)}; outline-offset: ${rem(p.focus.offset)}; }
[data-lab-pin-input][data-type="danger"] .lab-pin-input-segment, [data-lab-pin-input][data-invalid] .lab-pin-input-segment { border-color: ${role(p.roles.danger)}; }
[data-lab-pin-input][data-type="danger"] .lab-pin-input-segment:focus-visible, [data-lab-pin-input][data-invalid] .lab-pin-input-segment:focus-visible { outline-color: ${role(p.roles.danger)}; }
${['warning', 'success'].map((type) => `[data-lab-pin-input][data-type="${type}"]:not([data-invalid]) .lab-pin-input-segment { border-color: var(--lab-border-${type}-strong); }`).join('\n')}
[data-lab-pin-input] .lab-pin-input-segment:disabled { color: ${role(p.roles.disabledLabel)}; border-color: ${role(p.roles.disabledBorder)}; cursor: not-allowed; }
[data-lab-pin-input] .lab-pin-input-segment[readonly] { background: ${role(p.roles.readonlyBackground)}; }
[data-lab-pin-input] .lab-pin-input-segment::placeholder { color: ${role(p.roles.placeholder)}; opacity: 1; }
[data-lab-pin-input] .lab-pin-input-segment[type="password"] { color: transparent; caret-color: transparent; }
[data-lab-pin-input] .lab-pin-input-segment[type="password"][data-filled] + .lab-pin-input-dot { position: absolute; pointer-events: none; inset: 0; margin: auto; inline-size: var(--_pin-dot); block-size: var(--_pin-dot); border-radius: 50%; background: ${role(p.roles.label)}; }
[data-lab-pin-input] .lab-pin-input-segment[type="password"]:disabled + .lab-pin-input-dot { background: ${role(p.roles.disabledLabel)}; }
[data-lab-pin-input] .lab-field-label, [data-lab-pin-input] .lab-field-helper, [data-lab-pin-input] .lab-field-error { font-size: ${rem(p.caption.fontSize)}; line-height: ${p.caption.lineHeight / p.caption.fontSize}; font-weight: ${p.caption.fontWeight}; letter-spacing: ${p.caption.letterSpacing / p.caption.fontSize}em; color: ${role(p.roles.caption)}; }
[data-lab-pin-input] .lab-field-error, [data-lab-pin-input] .lab-field-required-mark { color: var(--lab-label-danger); }
[data-lab-pin-input][data-label-hidden] .lab-field-label { position: absolute; inline-size: 1px; block-size: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
@media (prefers-reduced-motion: reduce) { [data-lab-pin-input] .lab-pin-input-segment { transition: none; } }
@media (forced-colors: active) {
  [data-lab-pin-input] .lab-pin-input-segment { background: Canvas; color: CanvasText; border-color: ButtonText; }
  [data-lab-pin-input] .lab-pin-input-segment:focus-visible { outline-color: Highlight; }
  [data-lab-pin-input] .lab-pin-input-segment:disabled { border-color: GrayText; color: GrayText; }
  [data-lab-pin-input] .lab-pin-input-segment[type="password"] { color: transparent; }
  [data-lab-pin-input] .lab-pin-input-segment[type="password"][data-filled] + .lab-pin-input-dot { background: CanvasText; forced-color-adjust: none; }
}
`;
