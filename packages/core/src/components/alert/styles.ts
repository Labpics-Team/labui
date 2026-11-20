import { alertProfile as p } from '@labpics/ui-tokens';
import { slotSizeCss } from '../../slot-projection.js';
import { authoredTextBoxCss } from '../../typography.js';

const rem = (px: number) => `${px / 16}rem`;
export const alertCss = `
[data-lab-alert] { display: flex; flex-direction: column; min-inline-size: 0; max-inline-size: 100%; text-align: start; }
[data-lab-alert][hidden] { display: none; }
.lab-alert-surface {
  box-sizing: border-box; display: flex; align-items: flex-start; min-inline-size: 0;
  gap: ${rem(p.actionGap)}; padding: ${rem(p.padding)};
  border-radius: ${rem(p.radius)}; corner-shape: round;
  box-shadow: inset 0 0 0 ${rem(p.strokeWidth)} var(--lab-${p.roles.border});
}
.lab-alert-label { display: flex; align-items: flex-start; flex: 1 1 auto; min-inline-size: 0; gap: ${rem(p.labelGap)}; }
.lab-alert-icon { display: inline-flex; flex: none; width: ${rem(p.iconSize)}; height: ${rem(p.iconSize)}; color: var(--lab-${p.roles.icon}); }
[data-lab-alert][data-type='danger'] .lab-alert-icon { color: var(--lab-${p.roles.dangerIcon}); }
${slotSizeCss('.lab-alert-icon > *, .lab-alert-icon ::slotted(*)', '100%', '100%')}
.lab-alert-close > * { width: 100% !important; height: 100% !important; }
.lab-alert-content { display: flex; flex-direction: column; min-inline-size: 0; padding-inline-start: ${rem(p.contentPaddingStart)}; }
.lab-alert-heading, .lab-alert-description { margin: 0; overflow-wrap: anywhere; font-family: var(--lab-font-family); }
.lab-alert-heading { color: var(--lab-${p.roles.heading}); font-size: ${rem(p.heading.fontSize)}; line-height: ${p.heading.lineHeight / p.heading.fontSize}; font-weight: ${p.heading.fontWeight}; letter-spacing: ${p.heading.letterSpacing / p.heading.fontSize}em; }
.lab-alert-description { color: var(--lab-${p.roles.description}); font-size: ${rem(p.description.fontSize)}; line-height: ${p.description.lineHeight / p.description.fontSize}; font-weight: ${p.description.fontWeight}; letter-spacing: ${p.description.letterSpacing / p.description.fontSize}em; }
${authoredTextBoxCss('.lab-alert-heading, .lab-alert-description')}
.lab-alert-close {
  appearance: none; display: inline-flex; align-items: center; justify-content: center; flex: none;
  width: ${rem(p.iconSize)}; height: ${rem(p.iconSize)}; padding: 0; border: 0;
  background: transparent; color: var(--lab-${p.roles.close}); cursor: pointer; border-radius: ${rem(p.stack.radius)};
}
.lab-alert-close:hover { color: var(--lab-${p.roles.heading}); }
.lab-alert-close:focus-visible { outline: var(--lab-focus-ring-width) solid var(--lab-${p.roles.focus}); outline-offset: var(--lab-focus-ring-offset); }
.lab-alert-layer {
  position: relative; height: ${rem(p.stack.height)}; flex: none; overflow: hidden;
  border-radius: 0 0 ${rem(p.stack.radius)} ${rem(p.stack.radius)}; corner-shape: round; pointer-events: none;
}
.lab-alert-layer > .lab-material { position: absolute; inset: auto 0 0; height: ${rem(p.stack.height * 2)}; border-radius: inherit; corner-shape: round; opacity: var(--_alert-layer-opacity); }
.lab-alert-layer > .lab-material::after { content: ''; position: absolute; inset: auto 0 0; height: ${rem(p.stack.height)}; border-radius: inherit; box-shadow: inset 0 0 0 ${rem(p.strokeWidth)} var(--lab-${p.roles.border}); }
/* The capture owns group opacity. Applying opacity to the wrapper would create a
 * backdrop root and prevent the material from sampling the scene behind it. */
.lab-alert-layer[data-depth='1'] { margin-inline: ${rem(p.stack.first.inset)}; --_alert-layer-opacity: ${p.stack.first.opacity}; }
.lab-alert-layer[data-depth='2'] { margin-inline: ${rem(p.stack.second.inset)}; --_alert-layer-opacity: ${p.stack.second.opacity}; }
.lab-alert-announcement { position: absolute; width: 1px; height: 1px; clip-path: inset(50%); overflow: hidden; }
@media (forced-colors: active) {
  .lab-alert-surface { outline: ${rem(p.strokeWidth)} solid CanvasText; }
  .lab-alert-close { color: ButtonText; }
  .lab-alert-close:focus-visible { outline-color: Highlight; }
  .lab-alert-layer > .lab-material::after { border: ${rem(p.strokeWidth)} solid CanvasText; box-sizing: border-box; }
}
`;
