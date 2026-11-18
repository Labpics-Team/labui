import { chipProfile as p } from '@labpics/ui-tokens';

const rem = (px: number) => `${px / 16}rem`;
const role = (name: string) => `var(--lab-${name})`;
const alpha = (name: string, opacity: number) =>
  `color-mix(in srgb, ${role(name)} ${opacity * 100}%, transparent)`;
const sizes = Object.entries(p.sizes)
  .map(([size, m]) => {
    const glyph = p.close[size as keyof typeof p.close];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${glyph.viewBox} ${glyph.viewBox}"><path transform="translate(${glyph.x} ${glyph.y})" d="${glyph.data}"/></svg>`;
    return `[data-lab-chip][data-size="${size}"] {
    --_chip-height: ${rem(m.height)}; --_chip-baseline: ${rem(m.baseline)}; --_chip-radius: ${rem(m.radius)};
    --_chip-pad-x: ${rem(m.paddingX)}; --_chip-pad-y: ${rem(m.paddingY)};
    --_chip-gap: ${rem(m.gap)}; --_chip-leading: ${rem(m.leadingSize)}; --_chip-close: ${rem(m.closeSize)};
    --_chip-glyph: url("data:image/svg+xml,${encodeURIComponent(svg)}");
    font-size: ${rem(m.fontSize)}; line-height: ${m.lineHeight / m.fontSize};
    font-weight: ${m.fontWeight}; letter-spacing: ${m.letterSpacing}em;
  }`;
  })
  .join('\n');

const stackCss = `
[data-lab-chip] { isolation: isolate; }
[data-lab-chip] .lab-chip-glow { z-index: -1; }
[data-lab-chip][data-selected] .lab-chip-glow { z-index: auto; }
`;

const forcedColorsCss = `
@media (forced-colors: active) {
  /* Keep the user's system palette as a complete foreground/background pair.
   * UA text backplates otherwise cover HighlightText with ButtonFace. Direct
   * paint properties also isolate this palette from authored state variables. */
  [data-lab-chip] { forced-color-adjust: none; background: ButtonFace; color: ButtonText; outline: none; }
  [data-lab-chip]::before { border-color: ButtonText; }
  [data-lab-chip] .lab-chip-close { background: currentColor; }
  [data-lab-chip] .lab-chip-glow { display: none; }
  [data-lab-chip][data-selected] { background: Highlight; color: HighlightText; }
  [data-lab-chip][data-selected]::before { border-color: Highlight; }
  [data-lab-chip]:is(:hover, [data-hovered], :active, [data-pressed]):not(:disabled):not([data-loading]) .lab-chip-label { text-decoration: underline; }
  [data-lab-chip]:is(:focus-visible, [data-focused]) { outline: 2px solid Highlight; outline-offset: 2px; }
  [data-lab-chip]:disabled { background: ButtonFace; color: GrayText; }
  [data-lab-chip]:disabled::before { border-color: GrayText; }
  [data-lab-chip]:disabled .lab-chip-leading { opacity: 1; }
  [data-lab-chip][data-loading] .lab-chip-content { background: currentColor; }
}
`;

/** One author profile paints Lit and React, including the opacity-zero skeleton. */
export const chipCss = `
[data-lab-chip] {
  --_chip-fill: transparent; --_chip-border: ${role(p.roles.border)};
  --_chip-label: ${role(p.roles.label)}; --_chip-close-color: ${role(p.roles.close)};
  --_chip-gradient: linear-gradient(transparent, transparent);
  appearance: none; position: relative; box-sizing: border-box;
  display: inline-flex; align-items: center; justify-content: center; vertical-align: middle;
  min-inline-size: 0; max-inline-size: 100%; min-block-size: var(--_chip-height);
  padding: var(--_chip-pad-y) var(--_chip-pad-x); gap: var(--_chip-gap);
  border: 0; border-radius: var(--_chip-radius); corner-shape: round;
  background: var(--_chip-gradient), var(--_chip-fill); color: var(--_chip-label);
  font-family: var(--lab-font-family); text-align: start; cursor: pointer;
  outline: ${rem(p.focus.width)} solid transparent; outline-offset: ${rem(p.focus.offset)}; -webkit-tap-highlight-color: transparent;
}
${sizes}
[data-lab-chip][data-sharp] { --_chip-radius: ${rem(p.sharpRadius)}; }
[data-lab-chip]::before {
  content: ''; position: absolute; inset: 0; pointer-events: none;
  border: ${rem(p.strokeWidth)} solid var(--_chip-border); border-radius: inherit; corner-shape: round;
}
[data-lab-chip][data-selected] { --_chip-fill: ${role(p.roles.selected)}; --_chip-border: transparent; }
[data-lab-chip]:is(:hover, [data-hovered]):not(:disabled):not([data-loading]) { --_chip-fill: ${role(p.roles.hover)}; }
[data-lab-chip][data-active]:not(:disabled):not([data-loading]) {
  --_chip-fill: ${alpha(p.roles.activeFill, p.active.tintOpacity)};
  --_chip-border: transparent; --_chip-label: ${role(p.roles.activeLabel)};
}
[data-lab-chip][data-active][data-selected]:not(:disabled):not([data-loading]) {
  --_chip-fill: ${role(p.roles.activeFill)}; --_chip-label: ${role(p.roles.activeSelectedLabel)};
  --_chip-close-color: ${role(p.roles.activeSelectedLabel)};
  --_chip-gradient: linear-gradient(to bottom, ${alpha(p.roles.highlight, p.active.highlightOpacity)}, ${alpha(p.roles.highlight, 0)});
}
[data-lab-chip]:is(:active, [data-pressed]):not(:disabled):not([data-loading]) {
  --_chip-fill: transparent; --_chip-gradient: linear-gradient(transparent, transparent);
  --_chip-border: ${role(p.roles.border)}; --_chip-label: ${role(p.roles.label)}; --_chip-close-color: ${role(p.roles.close)};
}
[data-lab-chip][data-selected]:is(:active, [data-pressed]):not(:disabled):not([data-loading]) {
  --_chip-fill: ${role(p.roles.hover)}; --_chip-border: transparent;
}
[data-lab-chip] .lab-chip-glow { position: absolute; inset: 0; overflow: hidden; border-radius: inherit; corner-shape: round; pointer-events: none; opacity: 0; }
.lab-chip-glow::before {
  content: ''; position: absolute; inline-size: ${rem(p.glow.diameter)}; block-size: ${rem(p.glow.diameter)};
  inset-inline-start: calc(50% - ${rem(p.glow.diameter / 2)} + ${rem(p.glow.centerOffset)});
  top: calc(50% - ${rem(p.glow.diameter / 2)}); border-radius: 50%; corner-shape: round;
  background: ${role(p.roles.glow)}; filter: blur(${rem(p.glow.blur / 2)}); opacity: ${p.glow.opacity};
}

[data-lab-chip][data-selected] .lab-chip-glow::before { inset-inline-start: calc(50% - ${rem(p.glow.diameter / 2)} + ${rem(p.glow.selectedCenterOffset)}); }
[data-lab-chip]:is(:active, [data-pressed]):not(:disabled):not([data-loading]) .lab-chip-glow { opacity: 1; }
[data-lab-chip]:is(:focus-visible, [data-focused]) { outline-color: ${role(p.roles.focus)}; }
.lab-chip-content { display: inline-flex; flex-wrap: wrap; align-items: center; gap: var(--_chip-gap); min-inline-size: 0; min-block-size: 1lh; border-radius: ${rem(p.skeleton.radius)}; corner-shape: round; }
.lab-chip-label { flex: 1 1 auto; min-inline-size: 0; overflow-wrap: anywhere; }
.lab-chip-close { flex: none; inline-size: var(--_chip-close); block-size: var(--_chip-close); background: var(--_chip-close-color); mask: var(--_chip-glyph) center / contain no-repeat; }
.lab-chip-leading { display: none; flex: none; inline-size: var(--_chip-leading); block-size: var(--_chip-leading); }
[data-lab-chip][data-leading] .lab-chip-leading { display: inline-flex; }
.lab-chip-leading > * { inline-size: 100%; block-size: 100%; }
[data-lab-chip]:disabled { --_chip-label: ${role(p.roles.disabledLabel)}; --_chip-close-color: ${role(p.roles.disabledLabel)}; cursor: not-allowed; }
[data-lab-chip]:disabled[data-selected] { --_chip-fill: ${role(p.roles.disabledSelected)}; }
[data-lab-chip]:disabled .lab-chip-leading { opacity: ${p.disabledLeadingOpacity}; }

/* Medium's alphabetic baseline is authored at 18px inside its 24px line box.
 * Trim exposes the real alphabetic edge; bottom alignment pins it to that baseline
 * across Chromium and WebKit without measuring or shifting the glyphs by hand.
 * Small already matches with its negative leading and retains the native line box. */
@supports (text-box-trim: trim-both) {
  [data-lab-chip][data-size="m"] .lab-chip-label {
    text-box-trim: trim-both; text-box-edge: cap alphabetic; align-self: flex-end;
    margin-block-start: calc(var(--_chip-baseline) - 1cap);
    margin-block-end: calc(1lh - var(--_chip-baseline));
  }
}
[data-lab-chip][data-loading] { cursor: progress; }
[data-lab-chip][data-loading] .lab-chip-content { background: ${role(p.roles.skeleton)}; }
[data-lab-chip][data-loading] .lab-chip-content > * { opacity: 0; }
[data-lab-chip][data-size="s"]:not([data-sharp]) .lab-chip-content { border-radius: ${rem(p.skeleton.roundedSmallRadius)}; }
${stackCss}
${forcedColorsCss}
`;
