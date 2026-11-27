/**
 * Native multiline editing and form association. Input and Textarea use one
 * authored outline; both renderers share field ARIA and content-size fallback.
 * Enter, selection and IME belong to the browser, so no interaction machine runs.
 */
import { type PropertyValues, type TemplateResult, css, html, nothing, unsafeCSS } from 'lit';
import { live } from 'lit/directives/live.js';
import { LabElement } from '../../lit/lab-element.js';
import {
  type FieldA11yInput,
  type LabFieldSize,
  type LabFieldType,
  fieldControlAria,
  fieldErrorIsActive,
  fieldPartIds,
} from '../field/field-a11y.js';
import { outlinedFieldCss } from '../field/outlined-styles.js';
import { TextareaResize, textareaRows } from './runtime.js';

export type { LabFieldSize as LabTextareaSize, LabFieldType as LabTextareaType };

let textareaSeq = 0;

export class LabTextarea extends LabElement {
  static formAssociated = true;
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
    /** Current value (mirrors the native textarea; uncontrolled by default). */
    value: {},
    /** Placeholder text for the empty control. */
    placeholder: {},
    /** Initial visible text rows (native textarea `rows`). */
    rows: { type: Number },
    /** Grow the control to fit its content as the user types (local view state). */
    autoResize: { type: Boolean, attribute: 'auto-resize', reflect: true },
    /** Non-editable: the control reads its value but cannot be changed. */
    readonly: { type: Boolean, reflect: true },
    /** Non-interactive and dimmed. */
    disabled: { type: Boolean, reflect: true },
    /** Required — sets aria-required and the native `required`. */
    required: { type: Boolean, reflect: true },
    /** Invalid — drives aria-invalid / aria-errormessage and the danger styling. */
    invalid: { type: Boolean, reflect: true },
    /** Native form field name. */
    name: { reflect: true },
    autocomplete: {},
    maxLength: { type: Number, attribute: 'maxlength' },
    minLength: { type: Number, attribute: 'minlength' },
    disabledByForm: { state: true },
  };

  declare type: LabFieldType;
  declare size: LabFieldSize;
  declare label: string;
  declare labelHidden: boolean;
  declare helper: string;
  declare error: string;
  declare value: string;
  declare placeholder: string;
  declare rows: number;
  declare autoResize: boolean;
  declare readonly: boolean;
  declare disabled: boolean;
  declare required: boolean;
  declare invalid: boolean;
  declare name: string;
  declare autocomplete: string;
  declare maxLength: number | undefined;
  declare minLength: number | undefined;
  private declare disabledByForm: boolean;
  private readonly internals?: ElementInternals;
  private resetValue: string | undefined;
  private resizeControl?: TextareaResize;

  /** Stable per-instance base id, so the part ids never collide across fields. */
  private fieldId = `lab-textarea-${++textareaSeq}`;

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
    this.rows = 3;
    this.autoResize = false;
    this.readonly = false;
    this.disabled = false;
    this.required = false;
    this.invalid = false;
    this.name = '';
    this.autocomplete = '';
    this.disabledByForm = false;
    if (typeof ElementInternals !== 'undefined') this.internals = this.attachInternals();
  }

  static override styles = [
    unsafeCSS(outlinedFieldCss),
    css`
      :host { display: block; min-width: 0; }
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
    const control = this.renderRoot.querySelector<HTMLTextAreaElement>('textarea');
    if (!control) return;
    this.resetValue ??= this.value;
    const aria = fieldControlAria(this.a11yInput());
    setOrRemove(control, 'aria-describedby', aria['aria-describedby']);
    setOrRemove(control, 'aria-invalid', aria['aria-invalid']);
    setOrRemove(control, 'aria-errormessage', aria['aria-errormessage']);
    setOrRemove(control, 'aria-required', aria['aria-required']);
    this.syncForm(control);
    this.resizeControl ??= new TextareaResize(control);
    this.resizeControl.setEnabled(this.autoResize);
    this.resizeControl.update();
  }

  override disconnectedCallback(): void {
    this.resizeControl?.disconnect();
    super.disconnectedCallback();
  }

  override connectedCallback(): void {
    const existing = this.shadowRoot?.querySelector<HTMLTextAreaElement>('textarea');
    if (!this.hasUpdated && existing) {
      // A server may have rendered other requests before this document. Retain
      // its identity so hydration and later updates reference the existing parts.
      if (existing.id) this.fieldId = existing.id;
      if (existing.value !== existing.defaultValue) {
        this.resetValue = existing.defaultValue;
        this.value = existing.value;
      }
    }
    super.connectedCallback();
    this.requestUpdate();
  }

  private syncForm(control: HTMLTextAreaElement): void {
    this.internals?.setFormValue(control.disabled ? null : control.value);
    control.setCustomValidity(this.invalid && this.error ? this.error : '');
    this.internals?.setValidity(
      control.willValidate ? control.validity : {},
      control.validationMessage,
      control,
    );
  }

  formDisabledCallback(disabled: boolean): void {
    this.disabledByForm = disabled;
  }

  formResetCallback(): void {
    this.restoreValue(this.resetValue ?? '');
  }

  formStateRestoreCallback(state: string | File | FormData): void {
    if (typeof state === 'string') this.restoreValue(state);
  }

  private restoreValue(value: string): void {
    this.value = value;
    const control = this.renderRoot.querySelector<HTMLTextAreaElement>('textarea');
    if (control) {
      control.value = value;
      this.syncForm(control);
    }
    this.resizeControl?.update();
  }

  checkValidity(): boolean {
    return this.internals?.checkValidity() ?? true;
  }

  reportValidity(): boolean {
    return this.internals?.reportValidity() ?? true;
  }

  private readonly onInput = (event: Event): void => {
    const control = event.target as HTMLTextAreaElement;
    this.value = control.value;
    this.syncForm(control);
    this.resizeControl?.update();
    this.dispatchEvent(
      new CustomEvent<{ value: string }>('lab-input', {
        detail: { value: control.value },
        bubbles: true,
        composed: true,
      }),
    );
  };

  private readonly onChange = (event: Event): void => {
    const control = event.target as HTMLTextAreaElement;
    this.dispatchEvent(
      new CustomEvent<{ value: string }>('lab-change', {
        detail: { value: control.value },
        bubbles: true,
        composed: true,
      }),
    );
  };

  override render(): TemplateResult {
    const ids = fieldPartIds(this.fieldId);
    const showError = fieldErrorIsActive(this.a11yInput());
    const aria = fieldControlAria(this.a11yInput());
    const rows = textareaRows(this.rows);
    return html`
      <div data-lab-textarea data-type=${this.type} data-size=${this.size} part="field"
        style=${`--_textarea-rows: ${rows}`}
        ?data-label-hidden=${this.labelHidden} ?data-unlabelled=${!this.label}
        ?data-disabled=${this.disabled || this.disabledByForm} ?data-readonly=${this.readonly}
        ?data-invalid=${this.invalid} ?data-filled=${!!this.value} ?data-auto-resize=${this.autoResize}>
      <div class="lab-input-frame" part="frame">
        <label id=${ids.label} class="lab-field-label" for=${ids.control} part="label">
          <span class="label-text">${this.label}</span
          >${this.required ? html`<span class="lab-field-required-mark" aria-hidden="true"> *</span>` : nothing}
        </label>
        <textarea
          id=${ids.control}
          class="lab-field-control"
          part="control"
          .value=${live(this.value)}
          rows=${rows}
          name=${this.name || nothing}
          placeholder=${this.placeholder || nothing}
          autocomplete=${this.autocomplete || nothing}
          maxlength=${this.maxLength ?? nothing}
          minlength=${this.minLength ?? nothing}
          aria-describedby=${aria['aria-describedby'] ?? nothing}
          aria-invalid=${aria['aria-invalid'] ?? nothing}
          aria-errormessage=${aria['aria-errormessage'] ?? nothing}
          aria-required=${aria['aria-required'] ?? nothing}
          ?disabled=${this.disabled || this.disabledByForm}
          ?readonly=${this.readonly}
          ?required=${this.required}
          @input=${this.onInput}
          @change=${this.onChange}
        ></textarea>
        <fieldset class="lab-input-outline" aria-hidden="true"><legend>${this.label}${this.required ? ' *' : ''}</legend></fieldset>
      </div>
        ${
          this.helper
            ? html`<span id=${ids.helper} class="lab-field-helper" part="helper">${this.helper}</span>`
            : nothing
        }
        ${
          showError
            ? html`<span id=${ids.error} class="lab-field-error" part="error" role="alert">${this.error}</span>`
            : nothing
        }
      </div>
    `;
  }
}

/** Set an attribute when the value is defined, otherwise remove it. */
function setOrRemove(el: Element, name: string, value: string | undefined): void {
  if (value === undefined) el.removeAttribute(name);
  else el.setAttribute(name, value);
}

declare global {
  interface HTMLElementTagNameMap {
    'lab-textarea': LabTextarea;
  }
}

// Idempotent registration — safe across Lit SSR and client module instances.
if (typeof customElements !== 'undefined' && !customElements.get('lab-textarea')) {
  customElements.define('lab-textarea', LabTextarea);
}
