/** Авторская рамка с прозрачным разрывом под подпись; общий CSS Lit/React. */
export const inputCss = String.raw`
[data-lab-input] {
  --_input-height: var(--lab-size-input-m);
  --_input-radius: var(--lab-radius-input-m);
  --_input-pad-x: var(--lab-space-input-m-x);
  --_input-pad-y: var(--lab-space-input-m-y);
  --_input-font: var(--lab-font-size-input-m);
  --_input-weight: var(--lab-font-weight-input-m);
  --_input-line: var(--lab-line-height-input-m);
  --_input-tracking: var(--lab-letter-spacing-input-m);
  --_input-border: var(--lab-border-base);
  --_input-label: var(--lab-label-secondary);
  --_input-start: var(--_input-pad-x);
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: var(--lab-space-input-helper-gap);
  font: inherit;
}
[data-lab-input][data-size="s"] {
  --_input-height: var(--lab-size-input-s);
  --_input-radius: var(--lab-radius-input-s);
  --_input-pad-x: var(--lab-space-input-s-x);
  --_input-pad-y: var(--lab-space-input-s-y);
  --_input-font: var(--lab-font-size-input-s);
  --_input-weight: var(--lab-font-weight-input-s);
  --_input-line: var(--lab-line-height-input-s);
  --_input-tracking: var(--lab-letter-spacing-input-s);
}
[data-lab-input][data-size="l"] {
  --_input-height: var(--lab-size-input-l);
  --_input-radius: var(--lab-radius-input-l);
  --_input-pad-x: var(--lab-space-input-l-x);
  --_input-pad-y: var(--lab-space-input-l-y);
  --_input-font: var(--lab-font-size-input-l);
  --_input-weight: var(--lab-font-weight-input-l);
  --_input-line: var(--lab-line-height-input-l);
  --_input-tracking: var(--lab-letter-spacing-input-l);
}
[data-lab-input][data-leading] { --_input-start: var(--lab-size-input-adornment); }
[data-lab-input][data-type="danger"], [data-lab-input][data-invalid] {
  --_input-border: var(--lab-border-danger);
  --_input-label: var(--lab-label-danger);
}
[data-lab-input][data-type="warning"] {
  --_input-border: var(--lab-border-warning-strong);
  --_input-label: var(--lab-label-warning-primary);
}
[data-lab-input][data-type="success"] {
  --_input-border: var(--lab-border-success-strong);
  --_input-label: var(--lab-label-success-primary);
}
[data-lab-input] .lab-input-frame {
  position: relative;
  isolation: isolate;
  display: flex;
  align-items: center;
  min-width: 0;
  min-height: var(--_input-height);
  border-radius: var(--_input-radius);
  color: var(--lab-label-primary);
  background: transparent;
}
[data-lab-input] .lab-input-frame > .lab-field-label {
  position: absolute;
  inset-block-start: calc(-1 * var(--lab-space-input-label-overhang));
  inset-inline-start: var(--_input-start);
  max-width: calc(100% - var(--_input-start) - var(--_input-radius));
  padding-inline: var(--lab-space-input-label-x);
  color: var(--_input-label);
  font-size: var(--lab-font-size-input-label);
  font-weight: var(--lab-font-weight-input-label);
  line-height: var(--lab-line-height-input-label);
  letter-spacing: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  z-index: 1;
}
[data-lab-input] .lab-field-control {
  box-sizing: border-box;
  flex: 1;
  min-width: 0;
  width: 100%;
  min-height: var(--_input-height);
  margin: 0;
  padding: var(--_input-pad-y) var(--_input-pad-x);
  border: 0;
  border-radius: inherit;
  outline: none;
  color: inherit;
  background: transparent;
  font: inherit;
  font-size: var(--_input-font);
  font-weight: var(--_input-weight);
  line-height: var(--_input-line);
  letter-spacing: var(--_input-tracking);
  appearance: none;
}
[data-lab-input][data-leading] .lab-field-control {
  padding-inline-start: var(--lab-space-input-label-x);
}
[data-lab-input][data-trailing] .lab-field-control {
  padding-inline-end: var(--lab-space-input-label-x);
}
[data-lab-input] .lab-field-control::placeholder {
  color: var(--lab-label-tertiary);
  opacity: 1;
}
[data-lab-input] .lab-input-outline {
  position: absolute;
  inset: calc(-.5 * var(--lab-font-size-input-label)) 0 0;
  margin: 0;
  padding: 0;
  padding-inline-start: calc(var(--_input-start) - var(--lab-stroke-input));
  min-width: 0;
  border: var(--lab-stroke-input) solid var(--_input-border);
  border-radius: inherit;
  pointer-events: none;
}
[data-lab-input] .lab-input-outline legend {
  display: block;
  float: none;
  width: auto;
  max-width: calc(100% - var(--_input-radius));
  height: var(--lab-font-size-input-label);
  padding: 0 var(--lab-space-input-label-x);
  font-size: var(--lab-font-size-input-label);
  font-weight: var(--lab-font-weight-input-label);
  line-height: var(--lab-line-height-input-label);
  letter-spacing: 0;
  visibility: hidden;
  white-space: nowrap;
  overflow: hidden;
}
[data-lab-input][data-label-hidden] .lab-field-label {
  width: 1px;
  height: 1px;
  padding: 0;
  clip-path: inset(50%);
}
[data-lab-input][data-label-hidden] .lab-input-outline legend,
[data-lab-input][data-unlabelled] .lab-input-outline legend {
  max-width: 0;
  padding: 0;
}
[data-lab-input]:not([data-disabled]):not([data-readonly]) .lab-input-frame:hover {
  --_input-border: var(--lab-border-strong);
}
[data-lab-input]:not([data-disabled]) .lab-input-frame:focus-within {
  --_input-border: var(--lab-border-focus);
  --_input-label: var(--lab-label-accent);
}
[data-lab-input][data-type="danger"] .lab-input-frame,
[data-lab-input][data-invalid] .lab-input-frame { --_input-border: var(--lab-border-danger); }
[data-lab-input][data-type="warning"] .lab-input-frame { --_input-border: var(--lab-border-warning-strong); }
[data-lab-input][data-type="success"] .lab-input-frame { --_input-border: var(--lab-border-success-strong); }
[data-lab-input][data-invalid] .lab-input-frame {
  --_input-border: var(--lab-border-danger);
  --_input-label: var(--lab-label-danger);
}
[data-lab-input] .lab-input-frame:has(:focus-visible) {
  outline: var(--lab-focus-ring-width) solid var(--_input-border);
  outline-offset: var(--lab-focus-ring-offset);
}
[data-lab-input][data-disabled] { opacity: .5; }
[data-lab-input][data-disabled] .lab-field-control { cursor: not-allowed; }
[data-lab-input] .lab-input-adornment {
  box-sizing: border-box;
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: var(--lab-size-input-adornment);
  color: var(--_input-label);
}
[data-lab-input] .lab-input-leading {
  padding-inline: var(--lab-space-input-adornment-outer) var(--lab-space-input-adornment-inner);
}
[data-lab-input] .lab-input-trailing {
  padding-inline: var(--lab-space-input-adornment-inner) var(--lab-space-input-adornment-outer);
}
[data-lab-input]:not([data-leading]) .lab-input-leading,
[data-lab-input]:not([data-trailing]) .lab-input-trailing { display: none; }
[data-lab-input] .lab-input-adornment > svg,
[data-lab-input] .lab-input-adornment > img {
  width: var(--lab-size-input-icon);
  height: var(--lab-size-input-icon);
}
[data-lab-input] .lab-field-helper, [data-lab-input] .lab-field-error {
  padding-inline: var(--lab-space-input-helper-x);
  font-size: var(--lab-font-size-input-label);
  font-weight: var(--lab-font-weight-input-label);
  line-height: var(--lab-line-height-input-label);
  letter-spacing: 0;
  color: var(--lab-label-secondary);
}
[data-lab-input] .lab-field-error, [data-lab-input] .lab-field-required-mark {
  color: var(--lab-label-danger);
}
`;
