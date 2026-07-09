/**
 * `field-styles` — the shared scoped styles for `<lab-input>` and `<lab-textarea>`.
 *
 * Both fields paint the SAME surface: a bordered control over a base background,
 * a label above it, helper text and an error message below. Only the control tag
 * differs (`<input>` vs `<textarea>`), so the visual contract lives here ONCE and
 * each element splices it into its `static styles`. This keeps the two fields from
 * drifting and keeps the token contract in one auditable place.
 *
 * Token contract (core-CONTRACT §2): consumes ONLY semantic --lab-* roles +
 * dimension tokens via `litVar`. Colour roles carry NO literal fallback (a missing
 * role is a loud bug, never papered over); only dimension tokens take a literal
 * fallback so the field is usable before tokens load. The sentiment `type` axis
 * re-points the border + label to the matching --lab-*-{danger|warning|success}
 * role; `--lab-border-focus` is the focus ring.
 */
import { type CSSResult, css } from 'lit';
import { litVar } from '../../css.js';

/**
 * The field's shared scoped CSS. The control element is matched by the `.control`
 * class (an `<input>` in Input, a `<textarea>` in Textarea), so a single rule set
 * styles both. Size knobs are custom properties the `size` axis re-binds, so the
 * type/state rules never repeat per size.
 */
export const fieldStyles: CSSResult = css`
  :host {
    /* Size knobs the size axis maps onto. Dimension tokens may carry a literal
       fallback so the field is usable before tokens load; colour roles never do. */
    --_field-pad-x: ${litVar('--lab-space-md', '1rem')};
    --_field-pad-y: ${litVar('--lab-space-sm', '0.5rem')};
    --_field-radius: ${litVar('--lab-radius-control', '0.5rem')};
    --_field-gap: ${litVar('--lab-space-xs', '0.25rem')};
    --_field-font: ${litVar('--lab-font-size-md', '1rem')};
    --_field-tracking: ${litVar('--lab-letter-spacing-md', '-0.0083em')};
    --_field-label-font: ${litVar('--lab-font-size-xs', '0.8333rem')};
    --_field-label-tracking: ${litVar('--lab-letter-spacing-xs', '-0.0009em')};
    --_field-help-font: ${litVar('--lab-font-size-xxs', '0.6944rem')};
    --_field-help-tracking: ${litVar('--lab-letter-spacing-xxs', '0.0064em')};
    --_field-line: ${litVar('--lab-line-height-md', '1.5')};

    display: block;
  }

  :host([size='s']) {
    --_field-pad-x: ${litVar('--lab-space-sm', '0.5rem')};
    --_field-pad-y: ${litVar('--lab-space-xs', '0.25rem')};
    --_field-font: ${litVar('--lab-font-size-xs', '0.8333rem')};
    --_field-tracking: ${litVar('--lab-letter-spacing-xs', '-0.0009em')};
  }
  :host([size='l']) {
    --_field-pad-x: ${litVar('--lab-space-lg', '1.5rem')};
    --_field-pad-y: ${litVar('--lab-space-md', '1rem')};
    --_field-font: ${litVar('--lab-font-size-lg', '1.2rem')};
    --_field-tracking: ${litVar('--lab-letter-spacing-lg', '-0.0194em')};
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--_field-gap);
    font: inherit;
  }

  /* Label — a real <label for>, the strongest association. The hidden-label mode
     keeps it in the a11y tree (clip), never display:none (which removes it). */
  .label {
    font-size: var(--_field-label-font);
    letter-spacing: var(--_field-label-tracking);
    line-height: var(--_field-line);
    color: ${litVar('--lab-label-secondary')};
  }
  :host([required]) .required-mark {
    color: ${litVar('--lab-label-danger')};
  }
  :host([label-hidden]) .label {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    border: 0;
    clip: rect(0 0 0 0);
    clip-path: inset(50%);
    overflow: hidden;
    white-space: nowrap;
  }

  /* The control surface — a bordered box over the base background. The transparent
     border is always present so sentiment rules only swap its colour; the box never
     resizes between states (CLS, craft-frontend P4). */
  .control {
    box-sizing: border-box;
    width: 100%;
    margin: 0;
    padding: var(--_field-pad-y) var(--_field-pad-x);
    font: inherit;
    font-size: var(--_field-font);
    letter-spacing: var(--_field-tracking);
    line-height: var(--_field-line);
    color: ${litVar('--lab-label-primary')};
    background-color: ${litVar('--lab-bg-primary')};
    border: ${litVar('--lab-stroke-hairline')} solid ${litVar('--lab-border-base')};
    border-radius: var(--_field-radius);
    transition: border-color 120ms ease;
    appearance: none;
  }

  .control::placeholder {
    color: ${litVar('--lab-label-tertiary')};
    opacity: 1;
  }

  .control:hover:not(:disabled):not([readonly]) {
    border-color: ${litVar('--lab-border-strong')};
  }

  /* Focus-visible ring from the focus role — never a removed outline. */
  .control:focus-visible {
    border-color: ${litVar('--lab-border-focus')};
    outline: ${litVar('--lab-focus-ring-width')} solid ${litVar('--lab-border-focus')};
    outline-offset: ${litVar('--lab-focus-ring-offset')};
  }

  /* Sentiment: the type axis re-points border + label. Driven by the reflected
     type attribute (the styling contract), independent of size. */
  :host([type='danger']) .control {
    border-color: ${litVar('--lab-border-danger')};
  }
  :host([type='danger']) .control:focus-visible {
    outline: ${litVar('--lab-focus-ring-width')} solid ${litVar('--lab-border-danger')};
    outline-offset: ${litVar('--lab-focus-ring-offset')};
  }
  :host([type='warning']) .control {
    border-color: ${litVar('--lab-border-warning-strong')};
  }
  :host([type='warning']) .control:focus-visible {
    outline: ${litVar('--lab-focus-ring-width')} solid ${litVar('--lab-border-warning-strong')};
    outline-offset: ${litVar('--lab-focus-ring-offset')};
  }
  :host([type='success']) .control {
    border-color: ${litVar('--lab-border-success-strong')};
  }
  :host([type='success']) .control:focus-visible {
    outline: ${litVar('--lab-focus-ring-width')} solid ${litVar('--lab-border-success-strong')};
    outline-offset: ${litVar('--lab-focus-ring-offset')};
  }

  /* Readonly: a flatter, non-editable surface that still reads its value. */
  .control:read-only {
    background-color: ${litVar('--lab-fill-primary')};
    border-color: ${litVar('--lab-border-soft')};
  }

  /* Disabled: dimmed and non-interactive (native :disabled on the control). */
  .control:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  /* Helper / description text — below the control, low-emphasis. */
  .helper {
    font-size: var(--_field-help-font);
    letter-spacing: var(--_field-help-tracking);
    line-height: var(--_field-line);
    color: ${litVar('--lab-label-tertiary')};
  }

  /* Error message — the sentiment-danger text, announced via role="alert". Only
     rendered when invalid + a message exists, so it is never an empty live region. */
  .error {
    font-size: var(--_field-help-font);
    letter-spacing: var(--_field-help-tracking);
    line-height: var(--_field-line);
    color: ${litVar('--lab-label-danger')};
  }

  @media (prefers-reduced-motion: reduce) {
    .control {
      transition: none;
    }
  }
`;
