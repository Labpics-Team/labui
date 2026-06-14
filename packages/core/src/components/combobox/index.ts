/**
 * `@labpics/ui-core/combobox` — the filterable text-input + listbox element.
 *
 * Self-registers `<lab-combobox>` on import (side-effect) and re-exports the class +
 * axis types + the shared filter so the React twin can share ONE public-API source of
 * truth (and the SAME default filter, so narrowing is one rule across both renderers).
 */
export * from './lab-combobox.js';
