import { shadowProfile } from '@labpics/ui-shadow';
import { switchProfile as p } from '@labpics/ui-tokens';

const rem = (px: number): string => `${px / 16}rem`;
const role = (name: string): string => `var(--lab-${name})`;
const alpha = (name: string, opacity: number): string =>
  `color-mix(in srgb, ${role(name)} ${opacity * 100}%, transparent)`;
const shadow = (name: string): string =>
  `var(--lab-shadow-${name}, ${shadowProfile.levels[name]
    ?.map(
      (s) =>
        `${rem(s.x)} ${rem(s.y)} ${rem(s.blur)} ${rem(s.spread)} ${alpha(s.colorRole, s.opacity)}`,
    )
    .join(', ')})`;
const cutout = (path: typeof p.cutout.on): string => {
  const size = p.cutout.viewBox / p.cutout.diameterRatio;
  const offset = (size - p.cutout.viewBox) / 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}"><defs><mask id="cut"><rect width="100%" height="100%" fill="white"/><path transform="translate(${offset} ${offset})" fill="black" fill-rule="${path.windingRule.toLowerCase()}" d="${path.data}"/></mask></defs><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="white" mask="url(#cut)"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
};
const sizes = Object.entries(p.sizes)
  .map(
    ([size, m]) => `
[data-lab-switch][data-size="${size}"] {
  --_switch-width: var(--lab-size-switch-track-${size}, ${rem(m.trackWidth)});
  --_switch-height: var(--lab-size-switch-track-h-${size}, ${rem(m.trackHeight)});
  min-block-size: ${rem(m.controlHeight)};
  gap: ${rem(m.labelGap)};
  font-size: ${rem(m.fontSize)};
  line-height: ${m.lineHeight / m.fontSize};
  font-weight: ${m.fontWeight};
  letter-spacing: ${m.letterSpacing / m.fontSize}em;
}`,
  )
  .join('\n');
const pressedShadow = p.thumb.coloredPressedShadow
  .map(
    (s) =>
      `${rem(s.x)} ${rem(s.y)} ${rem(s.blur)} ${rem(s.spread)} ${alpha(s.colorRole, s.opacity)}`,
  )
  .join(', ');

const forcedColorsCss = `
@media (forced-colors: active) {
  [data-lab-switch] .lab-switch-control { outline: 1px solid ButtonText; }
  [data-lab-switch][data-checked] .lab-switch-control { background: Highlight; }
  [data-lab-switch] .lab-switch-thumb::before { background: ButtonText; }
  [data-lab-switch][data-checked] .lab-switch-thumb::before { background: HighlightText; }
}
`;

/** The Figma profile paints both renderers. The thumb mask exposes the actual track. */
export const switchCss = `
[data-lab-switch] {
  --_switch-position: 0;
  --_switch-padding: ${p.thumb.padding};
  --_switch-track: ${role(p.track.neutralRole)};
  --_switch-focus: ${role(p.focus.neutralRole)};
  --_switch-shadow: ${shadow(p.thumb.shadow)};
  --_switch-thumb: ${role(p.thumb.fillRole)};
  --_switch-gradient: none;
  --_switch-inner: none;
  --_switch-cutout: none;
  --_switch-shade: ${alpha('bg-static-light', p.coloredFill.highlight)};
  --_switch-tail: ${alpha('bg-static-light', p.coloredFill.gradientTailOpacity.default)};
  --_switch-inner-y: ${rem(p.innerShadow.y)};
  box-sizing: border-box;
  position: relative;
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  max-inline-size: 100%;
  min-inline-size: 0;
  vertical-align: middle;
  color: ${role(p.labelRole)};
  font-family: var(--lab-font-family);
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
  touch-action: manipulation;
  overflow-wrap: anywhere;
}
${sizes}
[data-lab-switch][data-checked] { --_switch-position: 1; }
[data-lab-switch][data-appearance="accent"] {
  --_switch-track: ${role(p.track.accentRole)};
  --_switch-focus: ${role(p.focus.accentRole)};
}
[data-lab-switch][data-appearance="danger"] {
  --_switch-track: ${role(p.track.dangerRole)};
  --_switch-focus: ${role(p.focus.dangerRole)};
}
[data-lab-switch]:not([data-appearance="neutral"]) {
  --_switch-gradient: linear-gradient(to bottom, var(--_switch-shade), var(--_switch-tail));
  --_switch-inner: inset ${rem(p.innerShadow.x)} var(--_switch-inner-y) ${rem(p.innerShadow.blur)} ${role(p.innerShadow.colorRole)};
}
[data-lab-switch][data-hovered] {
  --_switch-padding: ${p.thumb.hoverPadding};
  --_switch-shadow: ${shadow(p.thumb.hoverShadow)};
  --_switch-shade: ${alpha('bg-static-light', p.coloredFill.hoverHighlight)};
  --_switch-tail: ${alpha('bg-static-light', p.coloredFill.gradientTailOpacity.hover)};
}
[data-lab-switch][data-appearance="neutral"][data-hovered] { --_switch-track: ${role(p.track.neutralHoverRole)}; }
[data-lab-switch][data-appearance="neutral"][data-hovered][data-icon] { --_switch-shadow: ${shadow(p.thumb.neutralIconHoverShadow)}; }
[data-lab-switch][data-pressed] {
  --_switch-padding: ${p.thumb.pressedPadding};
  --_switch-shadow: ${shadow(p.thumb.shadow)};
  --_switch-shade: ${alpha('bg-static-dark', p.coloredFill.pressedShade)};
  --_switch-tail: ${alpha('bg-static-dark', p.coloredFill.gradientTailOpacity.pressed)};
  --_switch-inner-y: ${rem(p.innerShadow.pressedY)};
}
${Object.entries(p.sizes)
  .filter(([, m]) => m.trackHeight >= p.thumb.coloredPressedShadowMinimumTrackHeight)
  .map(
    ([size]) =>
      `[data-lab-switch][data-pressed][data-size="${size}"]:not([data-appearance="neutral"]) { --_switch-shadow: ${pressedShadow}; }`,
  )
  .join('\n')}
[data-lab-switch][data-icon] { --_switch-cutout: ${cutout(p.cutout.off)}; }
[data-lab-switch][data-icon][data-checked] { --_switch-cutout: ${cutout(p.cutout.on)}; }
[data-lab-switch][data-custom-off]:not([data-checked]),
[data-lab-switch][data-custom-on][data-checked] { --_switch-cutout: none; }
${p.cutout.hideOnColoredPressed ? '[data-lab-switch][data-pressed]:not([data-appearance="neutral"]) { --_switch-cutout: none; }' : ''}
[data-lab-switch][data-disabled], [data-lab-switch]:has(input:disabled) {
  --_switch-track: ${role(p.track.disabledRole)};
  --_switch-thumb: ${role(p.thumb.disabledFillRole)};
  --_switch-gradient: none;
  --_switch-inner: none;
  --_switch-shadow: none;
  --_switch-padding: ${p.thumb.padding};
  --_switch-inset: ${p.thumb.padding};
  cursor: not-allowed;
}
[data-lab-switch] .lab-switch-control {
  position: relative;
  flex: none;
  inline-size: var(--_switch-width);
  block-size: var(--_switch-height);
  border-radius: var(--lab-radius-pill);
  corner-shape: round;
  background-color: var(--_switch-track);
  background-image: var(--_switch-gradient);
  box-shadow: var(--_switch-inner);
}
[data-lab-switch]:has(input:focus-visible) .lab-switch-control {
  outline: ${rem(p.focus.width)} solid var(--_switch-focus);
  outline-offset: ${rem(p.focus.offset)};
}
[data-lab-switch] .lab-switch-thumb {
  --_switch-inset-length: calc(var(--_switch-inset, var(--_switch-padding)) * ${rem(1)});
  position: absolute;
  inset-block-start: var(--_switch-inset-length);
  inset-inline-start: calc(var(--_switch-inset-length) + (var(--_switch-width) - var(--_switch-height)) * var(--_switch-progress, var(--_switch-position)));
  inline-size: calc(var(--_switch-height) - 2 * var(--_switch-inset-length));
  block-size: calc(var(--_switch-height) - 2 * var(--_switch-inset-length));
  border-radius: var(--lab-radius-circle);
  corner-shape: round;
  box-shadow: var(--_switch-shadow);
}
[data-lab-switch] .lab-switch-thumb::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  corner-shape: round;
  background: var(--_switch-thumb);
  mask-image: var(--_switch-cutout);
  mask-size: 100% 100%;
}
[data-lab-switch][data-disabled] .lab-switch-thumb,
[data-lab-switch]:has(input:disabled) .lab-switch-thumb { --_switch-inset-length: ${rem(p.thumb.padding)}; }
[data-lab-switch] .lab-switch-icon {
  position: absolute;
  inset: 25%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--_switch-track);
  line-height: 1;
  pointer-events: none;
}
[data-lab-switch] .lab-switch-icon > :is(svg, img, lab-icon) { inline-size: 100%; block-size: 100%; }
[data-lab-switch]:not([data-checked]) .lab-switch-icon-on,
[data-lab-switch][data-checked] .lab-switch-icon-off { display: none; }
[data-lab-switch] .lab-switch-label {
  display: contents;
  min-inline-size: 0;
  max-inline-size: 100%;
  overflow-wrap: anywhere;
}
[data-lab-switch] input {
  position: absolute;
  inline-size: 1px;
  block-size: 1px;
  margin: -1px;
  padding: 0;
  border: 0;
  clip-path: inset(50%);
  overflow: hidden;
  white-space: nowrap;
}
${forcedColorsCss}
`;
