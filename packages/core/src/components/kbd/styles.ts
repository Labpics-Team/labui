import { kbdProfile as p } from '@labpics/ui-tokens';

const rem = (px: number) => `${px / 16}rem`;
// Coverage is independent of the role used to paint the outside bottom stroke.
const bottomMask = `
.lab-kbd-key::after {
  mask:
    radial-gradient(circle at right top, transparent var(--_kbd-radius), #000 0) left top / var(--_kbd-radius) var(--_kbd-radius) no-repeat,
    radial-gradient(circle at left top, transparent var(--_kbd-radius), #000 0) right top / var(--_kbd-radius) var(--_kbd-radius) no-repeat,
    linear-gradient(#000 0 0) bottom / 100% var(--_kbd-depth) no-repeat;
}
`;
const sizes = Object.entries(p.sizes)
  .map(
    ([size, m]) => `
[data-lab-kbd][data-size="${size}"] {
  --_kbd-height: ${rem(m.height)};
  --_kbd-radius: ${rem(m.radius)};
  --_kbd-depth: ${rem(m.bottomStrokeWidth)};
  --_kbd-pad-x: ${rem(m.paddingX)};
  --_kbd-pad-y: ${rem(m.paddingY)};
  font-size: ${rem(m.fontSize)};
  line-height: ${m.lineHeight / m.fontSize};
}`,
  )
  .join('\n');

/** Shared by Lit and React. The outside bottom stroke is geometry, not elevation. */
export const kbdCss = `
[data-lab-kbd] {
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
  gap: ${rem(p.gap)};
  color: var(--lab-${p.labelRole});
  font-family: var(--lab-font-family);
  font-weight: ${p.fontWeight};
  letter-spacing: ${p.letterSpacing}em;
  white-space: nowrap;
}
${sizes}
.lab-kbd-key {
  box-sizing: border-box;
  position: relative;
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  min-inline-size: var(--_kbd-height);
  min-block-size: var(--_kbd-height);
  padding: var(--_kbd-pad-y) var(--_kbd-pad-x);
  border-radius: var(--_kbd-radius);
  corner-shape: round;
  background: linear-gradient(to bottom, var(--lab-${p.firstFillRole}), var(--lab-${p.fillEndRole}));
}
[data-lab-kbd] > .lab-kbd-key { font: inherit; letter-spacing: inherit; }
.lab-kbd-key + .lab-kbd-key {
  background: linear-gradient(to bottom, var(--lab-${p.remainingFillRole}), var(--lab-${p.fillEndRole}));
}
.lab-kbd-key::before {
  content: "";
  position: absolute;
  inset: 0;
  border: ${rem(p.strokeWidth)} solid var(--lab-${p.borderRole});
  border-radius: inherit;
  corner-shape: round;
  pointer-events: none;
}
.lab-kbd-key::after {
  content: "";
  position: absolute;
  inset-inline: 0;
  bottom: calc(-1 * var(--_kbd-depth));
  height: calc(var(--_kbd-radius) + var(--_kbd-depth));
  border-radius: 0 0 calc(var(--_kbd-radius) + var(--_kbd-depth)) calc(var(--_kbd-radius) + var(--_kbd-depth));
  corner-shape: round;
  background: var(--lab-${p.bottomBorderRole});
  pointer-events: none;
}
${bottomMask}
`;
