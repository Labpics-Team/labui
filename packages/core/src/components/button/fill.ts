/** Shared authored Button gradient and inner edge, also used by Drag Button. */
export function buttonFillCss(base: string, hover: string, pressed: string): string {
  return `
${base} {
  --_button-light: var(--lab-label-static-light-primary);
  --_button-highlight: var(--lab-state-button-highlight);
  background-image: linear-gradient(to bottom, color-mix(in srgb, var(--_button-light) var(--_button-highlight), transparent), transparent);
  box-shadow: inset var(--lab-space-button-inner-x) var(--lab-space-button-inner-y) var(--lab-space-button-inner-blur) var(--lab-fx-control-inner);
}
${hover} { --_button-highlight: var(--lab-state-button-hover-highlight); }
${pressed} {
  --_button-light: var(--lab-label-static-dark-primary);
  --_button-highlight: var(--lab-state-button-pressed-shade);
  box-shadow: inset var(--lab-space-button-inner-x) calc(-1 * var(--lab-space-button-inner-y)) var(--lab-space-button-inner-blur) var(--lab-fx-control-inner);
}`;
}
