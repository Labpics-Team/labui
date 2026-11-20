import { selectProfile } from '@labpics/ui-tokens';
import { selectCss } from '../select/styles.js';
import { outlinedFieldCss } from './outlined-styles.js';

const g = selectProfile.chevron;
const chevron = `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${g.viewBox} ${g.viewBox}"><path transform="translate(${g.x} ${g.y})" d="${g.data}"/></svg>`)}")`;

/** Extensions compose the authored Input, Dropdown and Chip geometry. There is no
 * separate Figma master or copied field palette to keep in sync. */
export const extensionFieldCss = `${outlinedFieldCss}
${selectCss}
.lab-combobox-positioner[popover] { position: fixed; inset: auto; margin: 0; padding: 0; border: 0; background: transparent; color: inherit; overflow: visible; }
.lab-combobox-positioner .lab-select-content { max-inline-size: calc(100vw - 2rem); max-block-size: min(16rem, var(--available-height, 16rem)); }
.lab-extension-control { display: flex; align-items: center; min-inline-size: 0; grid-row: 2; grid-column: 1 / -1; }
.lab-extension-control > .lab-field-control { flex: 1; inline-size: 0; }
.lab-extension-trigger { appearance: none; display: inline-flex; align-items: center; justify-content: center; flex: none; align-self: stretch; inline-size: var(--lab-size-input-adornment); margin: 0; padding: var(--lab-space-input-adornment-inner); border: 0; background: transparent; color: var(--lab-label-secondary); font: inherit; font-size: var(--_input-font); line-height: 1; cursor: pointer; border-radius: var(--_input-radius); }
.lab-extension-trigger:disabled, .lab-extension-trigger[data-disabled] { color: var(--lab-label-quaternary); cursor: default; }
.lab-extension-trigger:focus-visible { outline: var(--lab-focus-ring-width) solid var(--lab-border-focus); outline-offset: calc(-1 * var(--lab-focus-ring-offset)); }
.lab-extension-trigger:hover:not(:disabled):not([data-disabled]) { background: var(--lab-fill-quaternary); color: var(--lab-label-primary); }
.lab-extension-chevron { inline-size: var(--lab-size-input-icon); block-size: var(--lab-size-input-icon); background: currentColor; mask: ${chevron} center / contain no-repeat; transition: transform var(--lab-motion-transition-duration) var(--lab-motion-transition-easing); }
.lab-extension-trigger[data-state="open"] .lab-extension-chevron { transform: rotate(180deg); }
[data-lab-number-input] [data-part="scrubber"] { cursor: ew-resize; }
.lab-number-input-triggers { display: flex; align-self: stretch; flex: none; }
.lab-tags-input-control { flex-wrap: wrap; box-sizing: border-box; gap: var(--lab-space-input-label-x); min-block-size: var(--_input-height); padding: var(--_input-pad-y) var(--_input-pad-x); }
.lab-tags-input-control > .lab-tags-input-input { flex: 1 1 6ch; inline-size: 6ch; min-inline-size: 0; min-block-size: 1lh; padding: 0; border-radius: 0; }
.lab-tags-input-item { max-inline-size: 100%; min-inline-size: 0; }
.lab-tags-input-item [data-part="item-preview"] { display: inline-flex; align-items: center; gap: var(--_chip-gap); min-inline-size: 0; }
.lab-tags-input-item [data-part="item-text"] { min-inline-size: 0; overflow-wrap: anywhere; white-space: normal; }
.lab-tags-input-delete { appearance: none; display: inline-flex; align-items: center; justify-content: center; align-self: stretch; flex: none; min-inline-size: var(--_chip-close); padding: 0; margin: 0; border: 0; background: transparent; color: inherit; cursor: pointer; }
.lab-tags-input-delete:disabled { cursor: default; }
.lab-tags-input-delete:focus-visible { outline: var(--lab-focus-ring-width) solid var(--lab-border-focus); outline-offset: var(--lab-focus-ring-offset); }
.lab-tags-input-item[data-highlighted] { outline: var(--lab-focus-ring-width) solid var(--lab-border-focus); outline-offset: var(--lab-focus-ring-offset); }
.lab-tags-input-edit { min-inline-size: 2ch; max-inline-size: 100%; padding: 0; border: 0; outline: none; background: transparent; color: inherit; font: inherit; }
.lab-tags-input-item [hidden] { display: none; }
.lab-combobox-empty, [data-lab-combobox] .empty { padding: .5rem; color: var(--lab-label-tertiary); }
@media (prefers-reduced-motion: reduce) { .lab-extension-chevron { transition: none; } }
`;
