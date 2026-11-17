export const snackbarCss = `
[data-lab-snackbar] {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  gap: var(--lab-space-snackbar-action-gap);
  padding: var(--lab-space-snackbar-y) var(--lab-space-snackbar-end)
    var(--lab-space-snackbar-y) var(--lab-space-snackbar-start);
  border-radius: var(--lab-radius-snackbar);
  box-shadow: inset 0 0 0 var(--lab-stroke-snackbar) var(--lab-border-base);
  color: var(--lab-label-primary);
  font-family: var(--lab-font-family);
  font-size: var(--lab-font-size-snackbar);
  line-height: var(--lab-line-height-snackbar);
  font-weight: var(--lab-font-weight-snackbar);
  letter-spacing: 0;
}
[data-lab-snackbar][hidden] { display: none; }
.lab-snackbar-label {
  display: flex;
  align-items: center;
  gap: var(--lab-space-snackbar-label-gap);
  min-width: 0;
}
.lab-snackbar-message { overflow-wrap: anywhere; }
.lab-snackbar-timer {
  display: grid;
  place-items: center;
  position: relative;
  flex: none;
  inline-size: var(--lab-size-snackbar-timer);
  block-size: var(--lab-size-snackbar-timer);
  color: var(--lab-label-brand-primary);
}
.lab-snackbar-timer[hidden] { display: none; }
.lab-snackbar-timer[data-warning] { color: var(--lab-label-danger-primary); }
.lab-snackbar-timer svg { position: absolute; inset: 0; inline-size: 100%; block-size: 100%; }
.lab-snackbar-action { flex: none; }
.lab-snackbar-announcement {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
@media (forced-colors: active) {
  [data-lab-snackbar] { outline: var(--lab-stroke-snackbar) solid CanvasText; }
}
`;
