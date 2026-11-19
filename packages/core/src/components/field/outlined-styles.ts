/** Авторская рамка с прозрачным разрывом под подпись; общий CSS Lit/React. */
export const outlinedFieldCss = String.raw`
:is([data-lab-input], [data-lab-textarea]) {
  --_input-label-font: var(--lab-font-size-input-label);
  --_input-label-line: var(--lab-line-height-input-label);
  --_input-label-height: calc(var(--_input-label-font) * var(--_input-label-line));
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
:is([data-lab-input], [data-lab-textarea])[data-size="s"] {
  --_input-height: var(--lab-size-input-s);
  --_input-radius: var(--lab-radius-input-s);
  --_input-pad-x: var(--lab-space-input-s-x);
  --_input-pad-y: var(--lab-space-input-s-y);
  --_input-font: var(--lab-font-size-input-s);
  --_input-weight: var(--lab-font-weight-input-s);
  --_input-line: var(--lab-line-height-input-s);
  --_input-tracking: var(--lab-letter-spacing-input-s);
}
:is([data-lab-input], [data-lab-textarea])[data-size="l"] {
  --_input-height: var(--lab-size-input-l);
  --_input-radius: var(--lab-radius-input-l);
  --_input-pad-x: var(--lab-space-input-l-x);
  --_input-pad-y: var(--lab-space-input-l-y);
  --_input-font: var(--lab-font-size-input-l);
  --_input-weight: var(--lab-font-weight-input-l);
  --_input-line: var(--lab-line-height-input-l);
  --_input-tracking: var(--lab-letter-spacing-input-l);
}
:is([data-lab-input], [data-lab-textarea])[data-leading] { --_input-start: var(--lab-size-input-adornment); }
:is([data-lab-input], [data-lab-textarea])[data-type="danger"], :is([data-lab-input], [data-lab-textarea])[data-invalid] {
  --_input-border: var(--lab-border-danger);
  --_input-label: var(--lab-label-danger);
}
:is([data-lab-input], [data-lab-textarea])[data-type="warning"] {
  --_input-border: var(--lab-border-warning-strong);
  --_input-label: var(--lab-label-warning-primary);
}
:is([data-lab-input], [data-lab-textarea])[data-type="success"] {
  --_input-border: var(--lab-border-success-strong);
  --_input-label: var(--lab-label-success-primary);
}
:is([data-lab-input], [data-lab-textarea]) .lab-input-frame {
  position: relative;
  isolation: isolate;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  min-width: 0;
  min-height: var(--_input-height);
  border-radius: var(--_input-radius);
  color: var(--lab-label-primary);
  background: transparent;
}
:is([data-lab-input], [data-lab-textarea]) .lab-input-frame > .lab-field-label {
  position: relative;
  grid-column: 1 / -1;
  grid-row: 1;
  inset-block-start: calc(-1 * var(--lab-space-input-label-overhang));
  margin-inline-start: var(--_input-start);
  margin-block-end: calc(-1 * var(--_input-label-height));
  max-width: calc(100% - var(--_input-start) - var(--_input-radius));
  padding-inline: var(--lab-space-input-label-x);
  color: var(--_input-label);
  font-size: var(--_input-label-font);
  font-weight: var(--lab-font-weight-input-label);
  line-height: var(--_input-label-height);
  letter-spacing: 0;
  white-space: normal;
  overflow-wrap: anywhere;
  z-index: 1;
}
:is([data-lab-input], [data-lab-textarea]) .lab-field-control {
  grid-column: 2;
  grid-row: 2;
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
:is([data-lab-input], [data-lab-textarea])[data-leading] .lab-field-control {
  padding-inline-start: var(--lab-space-input-label-x);
}
:is([data-lab-input], [data-lab-textarea])[data-trailing] .lab-field-control {
  padding-inline-end: var(--lab-space-input-label-x);
}
:is([data-lab-input], [data-lab-textarea]) .lab-field-control::placeholder {
  color: var(--lab-label-tertiary);
  opacity: 1;
}
:is([data-lab-input], [data-lab-textarea]) .lab-input-outline {
  position: absolute;
  inset: calc(-.5 * var(--_input-label-font)) 0 0;
  margin: 0;
  padding: 0;
  padding-inline-start: calc(var(--_input-start) - var(--lab-stroke-input));
  min-width: 0;
  border: var(--lab-stroke-input) solid var(--_input-border);
  border-radius: inherit;
  pointer-events: none;
}
:is([data-lab-input], [data-lab-textarea]) .lab-input-outline legend {
  display: block;
  float: none;
  width: auto;
  max-width: calc(100% - var(--_input-radius));
  height: var(--_input-label-font);
  padding: 0 var(--lab-space-input-label-x);
  font-size: var(--_input-label-font);
  font-weight: var(--lab-font-weight-input-label);
  line-height: var(--_input-label-height);
  letter-spacing: 0;
  visibility: hidden;
  white-space: nowrap;
  overflow: hidden;
}
:is([data-lab-input], [data-lab-textarea])[data-label-hidden] .lab-field-label {
  width: 1px;
  height: 1px;
  padding: 0;
  clip-path: inset(50%);
}
:is([data-lab-input], [data-lab-textarea])[data-label-hidden] .lab-input-outline legend,
:is([data-lab-input], [data-lab-textarea])[data-unlabelled] .lab-input-outline legend {
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
:is([data-lab-input], [data-lab-textarea])[data-type="danger"] .lab-input-frame,
:is([data-lab-input], [data-lab-textarea])[data-invalid] .lab-input-frame { --_input-border: var(--lab-border-danger); }
:is([data-lab-input], [data-lab-textarea])[data-type="warning"] .lab-input-frame { --_input-border: var(--lab-border-warning-strong); }
:is([data-lab-input], [data-lab-textarea])[data-type="success"] .lab-input-frame { --_input-border: var(--lab-border-success-strong); }
:is([data-lab-input], [data-lab-textarea])[data-invalid] .lab-input-frame {
  --_input-border: var(--lab-border-danger);
  --_input-label: var(--lab-label-danger);
}
:is([data-lab-input], [data-lab-textarea]) .lab-input-frame:has(:focus-visible) {
  outline: var(--lab-focus-ring-width) solid var(--_input-border);
  outline-offset: var(--lab-focus-ring-offset);
}
:is([data-lab-input], [data-lab-textarea])[data-disabled] { opacity: .5; }
:is([data-lab-input], [data-lab-textarea])[data-disabled] .lab-field-control { cursor: not-allowed; }
:is([data-lab-input], [data-lab-textarea]) .lab-input-adornment {
  grid-row: 2;
  box-sizing: border-box;
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: var(--lab-size-input-adornment);
  color: var(--_input-label);
}
:is([data-lab-input], [data-lab-textarea]) .lab-input-leading {
  grid-column: 1;
  padding-inline: var(--lab-space-input-adornment-outer) var(--lab-space-input-adornment-inner);
}
:is([data-lab-input], [data-lab-textarea]) .lab-input-trailing {
  grid-column: 3;
  padding-inline: var(--lab-space-input-adornment-inner) var(--lab-space-input-adornment-outer);
}
:is([data-lab-input], [data-lab-textarea]):not([data-leading]) .lab-input-leading,
:is([data-lab-input], [data-lab-textarea]):not([data-trailing]) .lab-input-trailing { display: none; }
:is([data-lab-input], [data-lab-textarea]) .lab-input-adornment > svg,
:is([data-lab-input], [data-lab-textarea]) .lab-input-adornment > img {
  width: var(--lab-size-input-icon);
  height: var(--lab-size-input-icon);
}
:is([data-lab-input], [data-lab-textarea]) .lab-field-helper, :is([data-lab-input], [data-lab-textarea]) .lab-field-error {
  padding-inline: var(--lab-space-input-helper-x);
  font-size: var(--lab-font-size-input-label);
  font-weight: var(--lab-font-weight-input-label);
  line-height: var(--lab-line-height-input-label);
  letter-spacing: 0;
  color: var(--lab-label-secondary);
}
:is([data-lab-input], [data-lab-textarea]) .lab-field-error, :is([data-lab-input], [data-lab-textarea]) .lab-field-required-mark {
  color: var(--lab-label-danger);
}

/* Textarea shares the outline. Its authored specimen has one multiline size;
   s/l retain the public Input family's typography as density extensions. */
[data-lab-textarea] {
  --_input-label-font: var(--lab-font-size-textarea-label);
  --_input-label-height: var(--lab-line-height-textarea-label);
}
[data-lab-textarea] .lab-field-control {
  display: block;
  padding: var(--lab-space-textarea-top) var(--lab-space-textarea-end)
    var(--lab-space-textarea-bottom) var(--lab-space-textarea-start);
  min-height: calc(var(--_textarea-rows, 3) * 1lh + var(--lab-space-textarea-top) + var(--lab-space-textarea-bottom));
  resize: vertical;
}
[data-lab-textarea][data-auto-resize] .lab-field-control {
  field-sizing: content;
  resize: none;
  overflow-y: hidden;
}
[data-lab-textarea][data-type="neutral"]:not([data-invalid]):not([data-disabled]) .lab-input-frame:focus-within {
  --_input-border: var(--lab-border-focus);
  --_input-label: var(--lab-label-primary);
}
[data-lab-textarea][data-filled],
[data-lab-textarea][data-type="danger"],
[data-lab-textarea][data-type="warning"],
[data-lab-textarea][data-type="success"] { --_input-label: var(--lab-label-primary); }
[data-lab-textarea][data-type="danger"] .lab-input-frame,
[data-lab-textarea][data-invalid] .lab-input-frame { --_input-border: var(--lab-border-danger); }
[data-lab-textarea][data-type="warning"] .lab-input-frame { --_input-border: var(--lab-border-warning-strong); }
[data-lab-textarea][data-type="success"] .lab-input-frame { --_input-border: var(--lab-border-success-strong); }
[data-lab-textarea][data-invalid] .lab-input-frame {
  --_input-border: var(--lab-border-danger);
  --_input-label: var(--lab-label-primary);
}
[data-lab-textarea][data-type="danger"] .lab-field-helper { color: var(--lab-label-danger-secondary); }
[data-lab-textarea][data-disabled],
[data-lab-textarea]:has(.lab-field-control:disabled) {
  opacity: 1;
  --_input-border: var(--lab-border-soft);
  --_input-label: var(--lab-label-quaternary);
}
[data-lab-textarea][data-disabled] .lab-field-control,
[data-lab-textarea][data-disabled] .lab-field-control::placeholder,
[data-lab-textarea][data-disabled] .lab-field-helper,
[data-lab-textarea]:has(.lab-field-control:disabled) .lab-field-control,
[data-lab-textarea]:has(.lab-field-control:disabled) .lab-field-control::placeholder,
[data-lab-textarea]:has(.lab-field-control:disabled) .lab-field-helper { color: var(--lab-label-quaternary); }
[data-lab-textarea][data-disabled] .lab-input-frame,
[data-lab-textarea]:has(.lab-field-control:disabled) .lab-input-frame {
  --_input-border: var(--lab-border-soft);
  --_input-label: var(--lab-label-quaternary);
}
[data-lab-textarea] .lab-field-control:disabled { resize: none; }
`;
