/**
 * `@labpics/ui-core/pin-input` — the segmented code-field element.
 *
 * Self-registers `<lab-pin-input>` on import (side-effect) and re-exports the class +
 * axis types so the React twin can share ONE public-API source of truth (the axis
 * unions and the value-type union come from here — no drift between renderers).
 */
export * from './lab-pin-input.js';
