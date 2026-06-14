/**
 * `@labpics/ui-core/tags-input` — the tokenized text-field element.
 *
 * Self-registers `<lab-tags-input>` on import (side-effect) and re-exports the class +
 * axis types + the shared chip-control translations so the React twin can share ONE
 * public-API source of truth (and the SAME accessible names for the delete trigger / edit
 * input, so the chip a11y is one rule across both renderers).
 */
export * from './lab-tags-input.js';
