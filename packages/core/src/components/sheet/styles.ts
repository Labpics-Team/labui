import { materialProfile } from '@labpics/ui-materials';

/** Общая геометрия и оформление Sheet для Lit и React. */
export const sheetCss = String.raw`
/* Геометрия Core Sheet; native DOM сохраняет те же semantic paints и материалы. */
.lab-sheet-positioner {
  --_sheet-inset: var(--lab-space-sheet-x, 1rem);
  --_sheet-bottom: var(--lab-space-sheet-bottom, 1rem);
  --_sheet-gap: var(--lab-space-sheet-content-gap, 1.5rem);
  --_sheet-overlap: var(--lab-sheet-ghost-overlap, ${materialProfile.compositions.sheet.ghost.overlap}px);
  color: var(--lab-label-primary);
  position: fixed;
  inset: 0;
  height: 100dvh;
  overflow: clip;
  pointer-events: none;
  z-index: var(--lab-z-modal, 1200);
}
.lab-sheet-backdrop {
  position: fixed;
  inset: 0;
  z-index: var(--lab-z-modal-underlay, 1100);
  pointer-events: auto;
}
.lab-sheet-backdrop[hidden],
.lab-sheet-positioner[hidden],
.lab-sheet-content[hidden] {
  display: none;
}
.lab-sheet-frame {
  --_sheet-top: 0px;
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.lab-sheet-ghost {
  --lab-veil-axis-length: calc(var(--_sheet-top) + var(--_sheet-overlap));
  position: absolute;
  inset: 0 0 auto;
  height: min(100%, var(--lab-veil-axis-length));
  pointer-events: none;
  background: var(--lab-bg-overlay-ghost);
}
.lab-sheet-content {
  box-sizing: border-box;
  position: absolute;
  inset: 0;
  transform: translateY(var(--_sheet-top));
  height: max(0px, calc(100% - var(--_sheet-top)));
  min-width: 0;
  min-height: 0;
  border-radius: var(--lab-radius-sheet-top, 2rem) var(--lab-radius-sheet-top, 2rem) 0 0;
  /* biome-ignore lint/correctness/noUnknownProperty lint/correctness/noUnknownFunction: CSS Borders 4 сохраняет контур Core Sheet; Biome 1.9.4 старше свойства. */
  corner-shape: superellipse(var(--lab-radius-corner-k, 1.1));
  color: var(--lab-label-primary);
  font: inherit;
  font-size: var(--lab-font-size-md, 1rem);
  letter-spacing: var(--lab-letter-spacing-md, -0.0083em);
  line-height: var(--lab-line-height-md, 1.5);
}
.lab-sheet-surface {
  /* The position is consumed by the parent transform, not by form descendants. */
  --_sheet-top: initial;
  box-sizing: border-box;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--_sheet-panel-gap, 0px);
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  padding: 0 min(var(--_sheet-inset), 5%) var(--_sheet-bottom);
  border-radius: inherit;
  /* biome-ignore lint/correctness/noUnknownProperty: CSS Borders 4; поверхность наследует контур Core Sheet. */
  corner-shape: inherit;
  box-shadow: var(--lab-elevation-modal);
}
.lab-sheet-content:focus-visible,
.lab-sheet-close:focus-visible {
  outline: var(--lab-focus-ring-width) solid var(--lab-border-focus);
  outline-offset: calc(-1 * var(--lab-focus-ring-offset));
}
.lab-sheet-handle:focus-visible {
  outline: none;
}
.lab-sheet-handle:focus-visible .lab-sheet-indicator {
  outline: var(--lab-focus-ring-width) solid var(--lab-border-focus);
  outline-offset: var(--lab-focus-ring-offset);
}
.lab-sheet-handle {
  position: relative;
  flex: none;
  width: 100%;
  height: var(--lab-size-sheet-drag-area, 1.5rem);
  padding: 0;
  border: 0;
  background: none;
  touch-action: none;
  cursor: grab;
}
.lab-sheet-handle[data-dragging] {
  cursor: grabbing;
}
.lab-sheet-indicator {
  position: absolute;
  top: var(--lab-space-sheet-drag-top, 0.875rem);
  left: 50%;
  width: var(--lab-size-sheet-drag-width, 2.25rem);
  height: var(--lab-size-sheet-drag-height, 0.25rem);
  transform: translateX(calc(-50% + var(--lab-space-sheet-drag-center-offset, 0.03125rem)));
  border-radius: var(--lab-radius-pill, 9999px);
  background: var(--lab-label-tertiary);
  pointer-events: none;
}
.lab-sheet-panel-body {
  display: flex;
  flex: 0 1 auto;
  flex-direction: column;
  min-height: 0;
  max-height: max(
    0px,
    calc(
      var(--_sheet-visible-height) -
      var(--lab-size-sheet-drag-area, 1.5rem) -
      var(--_sheet-panel-gap, 0px) -
      var(--_sheet-bottom)
    )
  );
  overflow: auto;
  overscroll-behavior: contain;
}
.lab-sheet-panel-content {
  /* Natural content is the measurement input; the scroll area is its output. */
  display: flex;
  flex: none;
  flex-direction: column;
  gap: var(--_sheet-body-gap, 0px);
}
.lab-sheet-body {
  display: block;
  flex: none;
}
.lab-sheet-panel-heading {
  display: flex;
  flex: none;
  flex-direction: column;
  gap: var(--lab-space-sheet-header-gap);
}
.lab-sheet-heading,
.lab-sheet-description {
  flex: none;
  margin: 0;
}
.lab-sheet-heading {
  font-size: var(--lab-font-size-sheet-title);
  font-weight: var(--lab-font-weight-sheet-title);
  line-height: var(--lab-line-height-sheet-title);
  letter-spacing: var(--lab-letter-spacing-sheet-title);
}
.lab-sheet-description {
  color: var(--lab-label-secondary);
  font-size: var(--lab-font-size-sheet-description);
  font-weight: var(--lab-font-weight-sheet-description);
  line-height: var(--lab-line-height-sheet-description);
  letter-spacing: var(--lab-letter-spacing-sheet-description);
}
.lab-sheet-close {
  position: absolute;
  top: var(--lab-space-md, 1rem);
  right: var(--_sheet-inset);
  width: var(--lab-space-7, 1.75rem);
  height: var(--lab-space-7, 1.75rem);
  border: 0;
  background: none;
  color: var(--lab-label-secondary);
  font: inherit;
  cursor: pointer;
}
.lab-sheet-preset {
  position: absolute;
  width: 0;
  max-height: 100%;
  visibility: hidden;
  pointer-events: none;
}
.lab-sheet-preset-full {
  height: var(--lab-size-sheet-body-full, 48.5rem);
}
.lab-sheet-preset-two-thirds {
  height: var(--lab-size-sheet-body-two-thirds, 33.75rem);
}
.lab-sheet-preset-one-third {
  height: var(--lab-size-sheet-body-one-third, 16.875rem);
}
.lab-sheet-overlap {
  height: var(--_sheet-overlap);
}
.lab-sheet-gap {
  height: var(--_sheet-gap);
}
`;
