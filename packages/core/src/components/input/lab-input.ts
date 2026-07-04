/**
 * `<lab-input>` — a single-line text field: a real `<input>` wired to a label, an
 * optional helper/description, and an optional error message via genuine ARIA.
 *
 * OPT-OUT (documented, per core-CONTRACT §1): a text input is PRESENTATIONAL on
 * the Behaviors seam. `@zag-js` ships NO plain text-input machine because the
 * native `<input>` already owns its value, caret, selection, keyboard and editing —
 * there is no shared interaction state for a machine to be the source of truth of.
 * Wiring one would be an onion around an `<input>` (craft-arch: no onion for a
 * native control). So this element extends `LabElement` for the shared base
 * conventions (`delegatesFocus`, the token contract) but does NOT call
 * `runMachine`, exactly like Card / Badge.
 *
 * What the field DOES own — and must get right — is the FORM-FIELD a11y wiring the
 * platform does not give for free: the programmatic association of the label, the
 * description, and the error to the control. That is REAL ARIA, computed once by
 * the shared `field-a11y` helper so the Lit element and the React twin cannot
 * drift: the control is labelled by a `<label for>`, `aria-describedby` lists the
 * helper id and (only when invalid + a message exists) the error id,
 * `aria-invalid` + `aria-errormessage` are set only when an error is actually
 * shown, and `aria-required` reflects the required input. No fabricated role, no
 * hand-rolled state the native input gives for free.
 *
 * Axes (the form-field model — Type × Size × State):
 *   - type:  neutral | danger | warning | success   (sentiment of the field)
 *   - size:  s | m | l
 *   - state: disabled · readonly · invalid · required   (reflected, drive CSS + ARIA)
 *
 * Host focus delegation: `delegatesFocus` (from `LabElement`) moves focus to the
 * inner `<input>` when the host is focused, and the `<label for>` focuses it on
 * click — so the whole field is one focus target with no fabricated tabindex.
 *
 * Token contract (core-CONTRACT §2): ONLY semantic --lab-* roles + dimensions via
 * the shared `field-styles`. No hex, no primitive, no colour-role fallback.
 */
import { type PropertyValues, type TemplateResult, css, html, nothing } from 'lit';
import { LabElement } from '../../lit/lab-element.js';
import {
  type FieldA11yInput,
  type LabFieldSize,
  type LabFieldType,
  fieldControlAria,
  fieldErrorIsActive,
  fieldPartIds,
} from '../field/field-a11y.js';
import { fieldStyles } from '../field/field-styles.js';

export type { LabFieldSize as LabInputSize, LabFieldType as LabInputType };

let inputSeq = 0;

export class LabInput extends LabElement {
  static override properties = {
    type: { reflect: true },
    size: { reflect: true },
    /** Visible label text. Always rendered into a real `<label for>`. */
    label: {},
    /** When set, the label is clipped (kept in the a11y tree, visually hidden). */
    labelHidden: { type: Boolean, attribute: 'label-hidden', reflect: true },
    /** Helper / description text shown below the control and linked via describedby. */
    helper: {},
    /** Error message; announced (role="alert") and linked only when `invalid`. */
    error: {},
    /** Current value (mirrors the native input; uncontrolled by default). */
    value: {},
    /** Placeholder text for the empty control. */
    placeholder: {},
    /** Native input type (text | email | password | …). */
    inputType: { attribute: 'input-type' },
    /** Native autocomplete token, passed straight to the input. */
    autocomplete: {},
    /** Non-editable: the control reads its value but cannot be changed. */
    readonly: { type: Boolean, reflect: true },
    /** Non-interactive and dimmed. */
    disabled: { type: Boolean, reflect: true },
    /** Required — sets aria-required and the native `required`. */
    required: { type: Boolean, reflect: true },
    /** Invalid — drives aria-invalid / aria-errormessage and the danger styling. */
    invalid: { type: Boolean, reflect: true },
    /** Native form field name. */
    name: {},
  };

  declare type: LabFieldType;
  declare size: LabFieldSize;
  declare label: string;
  declare labelHidden: boolean;
  declare helper: string;
  declare error: string;
  declare value: string;
  declare placeholder: string;
  declare inputType: string;
  declare autocomplete: string;
  declare readonly: boolean;
  declare disabled: boolean;
  declare required: boolean;
  declare invalid: boolean;
  declare name: string;

  /** Stable per-instance base id, so the part ids never collide across fields. */
  private readonly fieldId = `lab-input-${++inputSeq}`;

  constructor() {
    super();
    this.type = 'neutral';
    this.size = 'm';
    this.label = '';
    this.labelHidden = false;
    this.helper = '';
    this.error = '';
    this.value = '';
    this.placeholder = '';
    this.inputType = 'text';
    this.autocomplete = '';
    this.readonly = false;
    this.disabled = false;
    this.required = false;
    this.invalid = false;
    this.name = '';
  }

  static override styles = [
    fieldStyles,
    css`
      .control {
        display: block;
      }
    `,
  ];

  /** The semantic inputs the shared a11y helper resolves the ARIA contract from. */
  private a11yInput(): FieldA11yInput {
    return {
      id: this.fieldId,
      invalid: this.invalid,
      required: this.required,
      hasHelper: this.helper.length > 0,
      hasError: this.error.length > 0,
    };
  }

  override updated(_changed: PropertyValues): void {
    // Apply the computed ARIA contract onto the native control. The native
    // attributes (value, disabled, readonly, required, placeholder) are bound in
    // `render()`; the describedby/invalid/errormessage/required ARIA is the field's
    // OWN responsibility and is set here from the single shared helper, so the Lit
    // and React renderers compute it identically.
    const input = this.renderRoot.querySelector<HTMLInputElement>('input.control');
    if (!input) return;
    const aria = fieldControlAria(this.a11yInput());
    setOrRemove(input, 'aria-describedby', aria['aria-describedby']);
    setOrRemove(input, 'aria-invalid', aria['aria-invalid']);
    setOrRemove(input, 'aria-errormessage', aria['aria-errormessage']);
    setOrRemove(input, 'aria-required', aria['aria-required']);
    // Keep the reflected `value` in sync with edits so SSR + the property agree.
    if (input.value !== this.value) this.value = input.value;
  }

  private readonly onInput = (event: Event): void => {
    const input = event.target as HTMLInputElement;
    this.value = input.value;
    this.dispatchEvent(
      new CustomEvent<{ value: string }>('lab-input', {
        detail: { value: input.value },
        bubbles: true,
        composed: true,
      }),
    );
  };

  private readonly onChange = (event: Event): void => {
    const input = event.target as HTMLInputElement;
    this.dispatchEvent(
      new CustomEvent<{ value: string }>('lab-change', {
        detail: { value: input.value },
        bubbles: true,
        composed: true,
      }),
    );
  };

  override render(): TemplateResult {
    const ids = fieldPartIds(this.fieldId);
    const showError = fieldErrorIsActive(this.a11yInput());
    return html`
      <div class="field" part="field">
        <label id=${ids.label} class="label" for=${ids.control} part="label">
          <span class="label-text">${this.label}</span
          >${this.required ? html`<span class="required-mark" aria-hidden="true"> *</span>` : nothing}
        </label>
        <input
          id=${ids.control}
          class="control"
          part="control"
          .value=${this.value}
          type=${this.inputType}
          name=${this.name || nothing}
          placeholder=${this.placeholder || nothing}
          autocomplete=${this.autocomplete || nothing}
          ?disabled=${this.disabled}
          ?readonly=${this.readonly}
          ?required=${this.required}
          @input=${this.onInput}
          @change=${this.onChange}
        />
        ${
          this.helper
            ? html`<span id=${ids.helper} class="helper" part="helper">${this.helper}</span>`
            : nothing
        }
        ${
          showError
            ? html`<span id=${ids.error} class="error" part="error" role="alert">${this.error}</span>`
            : nothing
        }
      </div>
    `;
  }
}

/** Set an attribute when the value is defined, otherwise remove it (never "" vs none confusion). */
function setOrRemove(el: Element, name: string, value: string | undefined): void {
  if (value === undefined) el.removeAttribute(name);
  else el.setAttribute(name, value);
}

declare global {
  interface HTMLElementTagNameMap {
    'lab-input': LabInput;
  }
}

// Idempotent registration — safe across Lit SSR and client module instances.
if (typeof customElements !== 'undefined' && !customElements.get('lab-input')) {
  customElements.define('lab-input', LabInput);
}
