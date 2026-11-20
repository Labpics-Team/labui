import { shadowProfile } from '@labpics/ui-shadow';
import { menuProfile as p } from '@labpics/ui-tokens';
import { kbdCss } from '../kbd/styles.js';

const rem = (n: number) => `${n / 16}rem`;
const shadow = (name: string) => {
  const layers = shadowProfile.levels[name];
  if (!layers) throw new TypeError(`Unknown menu shadow: ${name}`);
  return `var(--lab-shadow-${name}, ${layers
    .map(
      (layer) =>
        `${rem(layer.x)} ${rem(layer.y)} ${rem(layer.blur)} ${rem(layer.spread)} color-mix(in srgb, var(--lab-${layer.colorRole}) ${layer.opacity * 100}%, transparent)`,
    )
    .join(',')})`;
};

/** One authored paint for all renderers and all three menu presentations. */
export const menuCss = `
.lab-menu-family { display: inline-block; vertical-align: middle; font-family: var(--lab-font-family); }
.lab-menu-positioner {
  position: fixed; inset: auto; margin: 0; padding: 0; border: 0;
  inline-size: ${rem(p.width)}; max-inline-size: calc(100vw - 1rem);
  background: transparent; color: inherit; overflow: visible; z-index: var(--lab-z-dropdown);
}
.lab-menu-positioner::backdrop { background: transparent; pointer-events: none; }
.lab-menu-surface {
  --lab-material-shadow: ${shadow(p.dropdown.shadow)};
  --lab-surface-stroke-width: ${rem(p.strokeWidth)};
  --lab-surface-stroke-color: var(--lab-${p.roles.border});
  position: relative; isolation: isolate; inline-size: 100%; border-radius: ${rem(p.radius)};
}
.lab-menu-content {
  box-sizing: border-box; position: relative; isolation: isolate;
  inline-size: 100%; margin: 0; padding: ${rem(p.padding)};
  border: 0;
  border-radius: ${rem(p.radius)}; outline: none;
  max-block-size: min(var(--available-height, 100vh), calc(100vh - 1rem)); overflow-y: auto;
  font-family: var(--lab-font-family); font-size: ${rem(p.fontSize)};
  font-weight: ${p.fontWeight}; line-height: ${p.lineHeight / p.fontSize};
  letter-spacing: ${p.letterSpacing / p.fontSize}em; color: var(--lab-${p.roles.label});
  text-align: start;
}
.lab-menu-surface[data-variant="context"], .lab-menu-surface[data-variant="menubar"] {
  --lab-material-shadow: ${shadow(p.context.shadow)};
}
.lab-menu-content[hidden] { display: none; }
.lab-menu-heading {
  padding: ${rem(p.header.padding)}; font-size: ${rem(p.header.fontSize)};
  line-height: ${p.header.lineHeight / p.header.fontSize}; font-weight: ${p.header.fontWeight};
  letter-spacing: ${p.header.letterSpacing / p.header.fontSize}em;
}
.lab-menu-item {
  box-sizing: border-box; display: flex; align-items: center; position: relative;
  gap: 0; padding: ${rem(p.row.paddingY)} ${rem(p.row.paddingX)};
  border-radius: ${rem(p.row.radius)}; cursor: default; user-select: none;
  color: var(--lab-${p.roles.label}); outline: none; min-inline-size: 0;
}
.lab-menu-content:not([data-variant="dropdown"]) .lab-menu-item { margin-block-start: ${rem(p.context.rowGap)}; }
.lab-menu-content:not([data-variant="dropdown"]) .lab-menu-item:not([data-leading]) { padding-inline-start: ${rem(p.context.labelInset)}; }
.lab-menu-item[data-highlighted] { background: var(--lab-${p.roles.highlight}); }
.lab-menu-item[data-tone="accent"] .lab-menu-leading { color: var(--lab-${p.roles.accent}); }
.lab-menu-item[data-tone="danger"] { color: var(--lab-${p.roles.danger}); }
.lab-menu-item[data-disabled], .lab-menu-item[data-disabled] .lab-menu-leading { color: var(--lab-${p.roles.disabled}); }
.lab-menu-item[data-disabled] .lab-menu-accessory { visibility: hidden; }
.lab-menu-label { flex: 1; min-inline-size: 0; overflow-wrap: anywhere; }
.lab-menu-item > .lab-menu-leading { margin-inline-end: ${rem(p.row.labelGap)}; }
.lab-menu-icon { display: inline-flex; flex: none; inline-size: ${rem(p.row.iconSize)}; block-size: ${rem(p.row.iconSize)}; align-items: center; justify-content: center; }
.lab-menu-accessory { display: inline-flex; flex: none; gap: ${rem(p.row.accessoryGap)}; margin-inline-start: ${rem(p.row.accessoryGap)}; align-items: center; }
.lab-menu-selection { position: relative; }
.lab-menu-indicator { visibility: hidden; }
.lab-menu-selection > .lab-menu-icon { position: absolute; inset: 0; }
.lab-menu-item[aria-checked="true"] .lab-menu-indicator { visibility: visible; }
.lab-menu-item[aria-checked="true"] .lab-menu-icon-fallback { visibility: hidden; }
.lab-menu-radio-dot {
  inline-size: ${rem(p.radio.dotSize)}; block-size: ${rem(p.radio.dotSize)}; border-radius: 50%;
  background: linear-gradient(to bottom, color-mix(in srgb, var(--lab-${p.radio.highlightRole}) ${p.radio.highlightOpacity * 100}%, transparent), transparent), currentColor;
}
.lab-menu-chevron:dir(rtl) { transform: scaleX(-1); }
.lab-menu-separator { block-size: ${rem(p.strokeWidth)}; background: var(--lab-${p.roles.border}); margin-block-start: ${rem(p.row.separatorGap)}; }
[data-menu-heading] > .lab-menu-separator { margin-block-start: 0; }
.lab-menu-trigger, .lab-menubar-item {
  box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center;
  gap: ${rem(p.row.labelGap)}; border: 0; background: transparent; color: var(--lab-${p.roles.label});
  font: inherit; font-family: var(--lab-font-family); font-size: ${rem(p.fontSize)};
  line-height: ${p.lineHeight / p.fontSize}; font-weight: ${p.fontWeight}; letter-spacing: ${p.letterSpacing / p.fontSize}em;
  padding: ${rem(p.menubar.paddingY)} ${rem(p.menubar.paddingX)}; border-radius: ${rem(p.menubar.itemRadius)};
  cursor: pointer; white-space: nowrap;
}
.lab-menu-trigger:hover:not(:disabled), .lab-menubar-item:hover:not(:disabled):not([data-state="open"]) { background: var(--lab-${p.roles.highlight}); }
.lab-menu-trigger:disabled, .lab-menubar-item:disabled { color: var(--lab-${p.roles.disabled}); cursor: default; }
.lab-menu-trigger:focus-visible, .lab-menubar-item:focus-visible, .lab-menu-context-trigger:focus-visible {
  outline: var(--lab-focus-ring-width) solid var(--lab-border-focus); outline-offset: var(--lab-focus-ring-offset);
}
.lab-menu-context-trigger { display: block; }
.lab-menubar {
  --lab-surface-stroke-width: ${rem(p.strokeWidth)};
  --lab-surface-stroke-color: var(--lab-${p.roles.border});
  display: inline-flex; position: relative; isolation: isolate; box-sizing: border-box;
  padding: ${rem(p.menubar.padding)}; border-radius: ${rem(p.menubar.radius)};
  border: 0;
}
.lab-menu-surface:not([data-lab-material-contour]), .lab-menubar:not([data-lab-material-contour]) {
  box-shadow: inset 0 0 0 ${rem(p.strokeWidth)} var(--lab-${p.roles.border}), var(--lab-material-shadow, 0 0 transparent);
}
.lab-menubar-item[data-state="open"] {
  background: var(--lab-${p.roles.activeBackground}); color: var(--lab-${p.roles.activeLabel});
  border-radius: ${rem(p.menubar.activeRadius)}; box-shadow: ${shadow(p.menubar.activeShadow)};
}
${kbdCss}
`;
