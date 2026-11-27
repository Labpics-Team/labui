/** Shared geometry and text anatomy for the two web renderers. */
export const cardCss = `
/* Light-DOM slot presence is available before custom elements are registered. */
lab-card { --_card-slotted-top-radius: var(--lab-radius-card-surface); }
lab-card:has(> [slot="media"]) { --_card-slotted-top-radius: 0px; }
[data-lab-card] {
  --_card-padding: var(--lab-space-card-padding);
  --lab-surface-stroke-width: var(--lab-stroke-card);
  --lab-surface-stroke-color: var(--lab-border-base);
  position: relative;
  isolation: isolate;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  border-radius: var(--lab-radius-card-surface);
  color: var(--lab-label-primary);
  font-family: var(--lab-font-family);
}
[data-lab-card][data-padding="none"] { --_card-padding: 0px; }
[data-lab-card][data-padding="s"] { --_card-padding: var(--lab-space-sm); }
[data-lab-card][data-padding="m"] { --_card-padding: var(--lab-space-md); }
[data-lab-card] > .lab-card-image {
  position: absolute;
  inset: var(--lab-contour-inset, 0px);
  border-radius: inherit;
  overflow: clip;
  clip-path: var(--lab-contour-clip, none);
  pointer-events: none;
  z-index: -2;
}
.lab-card-image > img { inline-size: 100%; block-size: 100%; object-fit: cover; }
.lab-card-media {
  position: relative;
  flex: 0 0 auto;
  min-block-size: 0;
  overflow: clip;
  border-start-start-radius: inherit;
  border-start-end-radius: inherit;
  clip-path: var(--lab-contour-clip, none);
}
[data-lab-card][data-image] > .lab-card-media { flex: 1 1 var(--lab-size-card-media); }
.lab-card-media img { display: block; inline-size: 100%; block-size: auto; }
.lab-card-media .lab-card-default-image {
  position: absolute;
  inset: 0;
  inline-size: 100%;
  block-size: 100%;
  object-fit: cover;
}
.lab-card-content {
  --lab-corner-smoothing: var(--lab-shape-card-smoothing);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: var(--lab-space-card-gap);
  padding: var(--_card-padding) min(var(--_card-padding), 10%);
  border-radius: inherit;
  flex: 1;
}
/* Empty slots contribute no box before hydration as well as after slotchange. */
.lab-card-content > .lab-card-region { display: contents; }
[data-lab-card][data-media] > .lab-card-content {
  border-start-start-radius: 0;
  border-start-end-radius: 0;
}
[data-lab-card][data-image] > .lab-card-content { flex: none; }
[data-lab-card][data-variant="outlined"] > .lab-card-content {
  background: var(--lab-bg-primary);
}
[data-lab-card][data-variant="filled"] > .lab-card-content {
  background: var(--lab-fill-primary);
}
[data-lab-card][data-interactive]:focus-within {
  outline: var(--lab-focus-ring-width) solid var(--lab-border-focus);
  outline-offset: var(--lab-focus-ring-offset);
}
.lab-card-text { display: flex; flex-direction: column; gap: var(--lab-space-card-caption-gap); }
.lab-card-title-group { display: flex; flex-direction: column; gap: var(--lab-space-card-text-gap); }
.lab-card-title-row { display: flex; flex-wrap: wrap; align-items: center; gap: var(--lab-space-card-title-gap); }
.lab-card-title, .lab-card-hint, .lab-card-description, .lab-card-caption { margin: 0; overflow-wrap: anywhere; }
.lab-card-title, .lab-card-hint {
  font-size: var(--lab-font-size-card-title);
  line-height: var(--lab-line-height-card-title);
  font-weight: var(--lab-font-weight-card-title);
  letter-spacing: var(--lab-letter-spacing-card-title);
}
.lab-card-hint { color: var(--lab-label-secondary); }
.lab-card-description {
  color: var(--lab-label-secondary);
  font-size: var(--lab-font-size-card-description);
  line-height: var(--lab-line-height-card-description);
  font-weight: var(--lab-font-weight-card-description);
  letter-spacing: var(--lab-letter-spacing-card-description);
}
.lab-card-caption {
  color: var(--lab-label-secondary);
  font-size: var(--lab-font-size-card-caption);
  line-height: var(--lab-line-height-card-caption);
  font-weight: var(--lab-font-weight-card-caption);
  letter-spacing: var(--lab-letter-spacing-card-caption);
}
@media (forced-colors: active) {
  [data-lab-card] { outline: 1px solid CanvasText; }
}
`;
