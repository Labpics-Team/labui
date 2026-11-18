import { badgeProfile as p } from '@labpics/ui-tokens';

const variants = Object.keys(p.colors)
  .map(
    (color) => `
[data-lab-badge][data-color="${color}"][data-type="fill"] {
  background-color: var(--lab-badge-fill-${color});
  color: var(--lab-badge-label-on-${color});
  --_badge-icon: var(--lab-badge-icon-on-${color});
}
[data-lab-badge][data-color="${color}"][data-type="tinted"] {
  background-color: var(--lab-badge-tint-${color});
  color: var(--lab-badge-label-${color});
  --_badge-icon: var(--lab-badge-label-${color});
}`,
  )
  .join('\n');

/** One stylesheet paints Lit shadow content and native React markup. */
export const badgeCss = `
[data-lab-badge] {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  vertical-align: middle;
  min-block-size: var(--lab-size-badge);
  padding: var(--lab-space-badge-y) var(--lab-space-badge-x);
  border-radius: var(--lab-radius-badge);
  font-family: inherit;
  font-size: var(--lab-font-size-badge);
  font-weight: var(--lab-font-weight-badge);
  line-height: var(--lab-line-height-badge);
  letter-spacing: var(--lab-letter-spacing-badge);
  white-space: nowrap;
}
.lab-badge-label { display: inline-block; }
[data-lab-badge] .lab-badge-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--_badge-icon);
  flex: none;
}
[data-lab-badge] .lab-badge-icon > *, [data-lab-badge] .lab-badge-icon::slotted(*) {
  display: block;
  inline-size: var(--lab-size-badge-icon);
  block-size: var(--lab-size-badge-icon);
  margin-inline-end: var(--lab-space-badge-gap);
}
[data-lab-badge] .lab-badge-label ~ .lab-badge-icon > *, [data-lab-badge] .lab-badge-label ~ .lab-badge-icon::slotted(*) {
  margin-inline-start: var(--lab-space-badge-gap);
  margin-inline-end: 0;
}
[data-lab-badge] .lab-badge-icon > * > svg { display: block; inline-size: 100%; block-size: 100%; }
[data-lab-badge] .lab-badge-dot { display: contents; }
[data-lab-badge] .lab-badge-dot > *, [data-lab-badge] .lab-badge-dot::slotted(*) {
  inline-size: .5em; block-size: .5em; border-radius: var(--lab-radius-full); background: currentColor;
  margin-inline-end: var(--lab-space-badge-gap);
}
${variants}
[data-lab-badge][data-disabled="true"][data-color] {
  background-color: var(--lab-${p.disabled.fillRole});
  color: var(--lab-${p.disabled.labelRole});
  --_badge-icon: var(--lab-${p.disabled.labelRole});
}
`;
