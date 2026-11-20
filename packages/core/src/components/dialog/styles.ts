import { dialogProfile as p } from '@labpics/ui-tokens';
import { slotStyleCss } from '../../slot-projection.js';
import { authoredTextBoxCss } from '../../typography.js';

const rem = (n: number) => `${n / 16}rem`;
export const dialogCss = `
.lab-dialog-trigger { display: inline-flex; align-items: center; padding: 0; border: 0; background: none; font: inherit; color: inherit; cursor: pointer; }
.lab-dialog-trigger:focus-visible, .lab-dialog-close:focus-visible { outline: var(--lab-focus-ring-width) solid var(--lab-border-focus); outline-offset: var(--lab-focus-ring-offset); }
.lab-dialog-plane {
  position: fixed; inset: 0; width: 100%; height: 100dvh; max-width: none; max-height: none;
  box-sizing: border-box; margin: 0; padding: 0; border: 0; background: transparent;
  color: inherit; font: inherit; overflow: visible; pointer-events: none;
}
.lab-dialog-plane::backdrop { background: transparent; }
.lab-dialog-plane:not([open]) { display: none; }
.lab-dialog-backdrop { position: absolute; inset: 0; background: var(--lab-${p.roles.scrim}); pointer-events: auto; }
.lab-dialog-positioner { position: absolute; inset: 0; display: grid; place-items: center; padding: ${rem(p.viewportGap)}; box-sizing: border-box; }
.lab-dialog-content {
  --_lab-dialog-radius: ${rem(p.radius)};
  position: relative; display: flex; flex-direction: column; gap: ${rem(p.contentGap)};
  box-sizing: border-box; inline-size: min(100%, ${rem(p.intrinsicWidth)}); min-inline-size: 0;
  max-block-size: 100%; overflow: auto; overscroll-behavior: contain; pointer-events: auto;
  padding: ${rem(p.padding)}; border-radius: var(--_lab-dialog-radius); corner-shape: round;
  box-shadow: inset 0 0 0 ${rem(p.strokeWidth)} var(--lab-${p.roles.border});
  color: var(--lab-${p.roles.heading}); font-family: var(--lab-font-family);
}
${Object.entries(p.widths)
  .map(
    ([size, width]) =>
      `.lab-dialog-content[data-size='${size}'] { inline-size: min(100%, ${rem(width)}); }`,
  )
  .join('\n')}
.lab-dialog-header { display: flex; flex-flow: row-reverse wrap; align-items: flex-start; gap: ${rem(p.labelGap)}; min-inline-size: 0; }
.lab-dialog-labels { display: flex; flex: 1 1 min-content; flex-direction: column; gap: ${rem(p.labelGap)}; min-inline-size: 0; }
.lab-dialog-heading, .lab-dialog-description { margin: 0; overflow-wrap: break-word; }
.lab-dialog-heading { font-size: ${rem(p.heading.fontSize)}; line-height: ${p.heading.lineHeight / p.heading.fontSize}; font-weight: ${p.heading.fontWeight}; letter-spacing: ${p.heading.letterSpacing / p.heading.fontSize}em; }
.lab-dialog-description, .lab-dialog-body { color: var(--lab-${p.roles.description}); font-size: ${rem(p.description.fontSize)}; line-height: ${p.description.lineHeight / p.description.fontSize}; font-weight: ${p.description.fontWeight}; letter-spacing: ${p.description.letterSpacing / p.description.fontSize}em; }
${authoredTextBoxCss('.lab-dialog-heading, .lab-dialog-description')}
.lab-dialog-body:empty { display: none; }
.lab-dialog-body[hidden], .lab-dialog-actions[hidden] { display: none; }
.lab-dialog-actions { display: flex; flex-wrap: wrap; gap: ${rem(p.actionGap)}; min-inline-size: 0; }
${slotStyleCss('.lab-dialog-actions > *, .lab-dialog-actions ::slotted(*)', { flex: `1 1 ${p.actionMinInlineEm}em`, 'min-inline-size': '0', 'max-inline-size': '100%' })}
.lab-dialog-close { --_lab-dialog-close-radius: ${rem(p.actionGap)}; display: inline-flex; order: -1; align-self: flex-start; align-items: center; justify-content: center; flex: none; inline-size: ${rem(p.iconSize)}; block-size: ${rem(p.iconSize)}; padding: 0; border: 0; border-radius: var(--_lab-dialog-close-radius); color: var(--lab-label-secondary); background: transparent; cursor: pointer; }
.lab-dialog-close > * { inline-size: 100%; block-size: 100%; }
.lab-dialog-content:has(.lab-dialog-close) { gap: ${rem(p.labelGap)}; }
.lab-popover-positioner { position: fixed; inset: auto; margin: 0; padding: 0; max-inline-size: calc(100vw - ${rem(p.viewportGap * 2)}); pointer-events: none; }
.lab-popover-positioner .lab-dialog-content { inline-size: 100%; max-block-size: var(--_lab-popover-available-height, calc(100dvh - ${rem(p.viewportGap * 2)})); padding: ${rem(p.radius)}; gap: ${rem(p.labelGap)}; }
${Object.entries(p.popoverWidths)
  .map(
    ([size, width]) =>
      `.lab-popover-positioner[data-size='${size}'] { inline-size: ${rem(width)}; }`,
  )
  .join('\n')}
.lab-popover-arrow { position: absolute; inline-size: ${rem(p.actionGap * 2)}; block-size: ${rem(p.actionGap)}; background: var(--lab-bg-secondary); clip-path: polygon(0 100%, 50% 0, 100% 100%); pointer-events: none; }
.lab-popover-positioner[data-side='bottom'] .lab-popover-arrow { top: ${rem(-p.actionGap)}; }
.lab-popover-positioner[data-side='top'] .lab-popover-arrow { bottom: ${rem(-p.actionGap)}; transform: rotate(180deg); }
.lab-popover-positioner[data-side='right'] .lab-popover-arrow { left: ${rem(-p.actionGap * 1.5)}; transform: rotate(-90deg); }
.lab-popover-positioner[data-side='left'] .lab-popover-arrow { right: ${rem(-p.actionGap * 1.5)}; transform: rotate(90deg); }
@media (max-width: ${rem(p.intrinsicWidth)}) { .lab-dialog-content, .lab-popover-positioner .lab-dialog-content { padding: min(${rem(p.radius)}, ${p.radius}px); gap: ${rem(p.radius)}; } }
@media (forced-colors: active) { .lab-dialog-content { outline: ${rem(p.strokeWidth)} solid CanvasText; } .lab-dialog-close { color: ButtonText; } .lab-dialog-backdrop { background: Canvas; opacity: .5; } }
`;
