/**
 * Однострочный ввод с настоящим HTML input. Native control сохраняет значение,
 * выделение и IME; общий field-a11y связывает подпись, helper и ошибку.
 * Геометрия из components.json и inputCss общая с React и native-профилем.
 * leading/trailing — авторские области по краям поля; подпись не закрашивает фон.
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
import { inputCss } from './styles.js';

export type { LabFieldSize as LabInputSize, LabFieldType as LabInputType };

let inputSeq = 0;
const implicitSubmissionTypes = new Set([
  'text',
  'search',
  'tel',
  'url',
  'email',
  'password',
  'date',
  'month',
  'week',
  'time',
  'datetime-local',
  'number',
]);

export class LabInput extends LabElement {
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
    name: { reflect: true },
    hasLeading: { state: true },
    hasTrailing: { state: true },
    disabledByForm: { state: true },
    maxLength: { type: Number, attribute: 'maxlength' },
    minLength: { type: Number, attribute: 'minlength' },
    pattern: {},
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
  private declare hasLeading: boolean;
  private declare hasTrailing: boolean;
  private declare disabledByForm: boolean;
  declare maxLength: number | undefined;
  declare minLength: number | undefined;
  declare pattern: string;
  private readonly internals?: ElementInternals;
  private resetValue: string | undefined;

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
    this.hasLeading = false;
    this.hasTrailing = false;
    this.disabledByForm = false;
    this.pattern = '';
    if (typeof ElementInternals !== 'undefined') this.internals = this.attachInternals();
  }

  static override styles = [
    unsafeCSS(inputCss),
    css`
      :host { display: block; min-width: 0; }
      ::slotted(svg), ::slotted(img), ::slotted(lab-icon) {
        flex: none;
        width: var(--lab-size-input-icon);
        height: var(--lab-size-input-icon);
      }
    `,
  ];

  private readonly onSlotChange = (event: Event): void => {
    const slot = event.target as HTMLSlotElement;
    const present = slot
      .assignedNodes()
      .some((node) => node.nodeType === 1 || node.textContent?.trim());
    if (slot.name === 'leading') this.hasLeading = present;
    else this.hasTrailing = present;
  };

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

  private syncForm(input: HTMLInputElement): void {
    this.internals?.setFormValue(input.disabled ? null : input.value);
    input.setCustomValidity(this.invalid && this.error ? this.error : '');
    this.internals?.setValidity(input.validity, input.validationMessage, input);
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
    const input = this.renderRoot.querySelector<HTMLInputElement>('input');
    if (input) {
      input.value = value;
      this.syncForm(input);
    } else this.internals?.setFormValue(this.disabled || this.disabledByForm ? null : value);
  }
  checkValidity(): boolean {
    return this.internals?.checkValidity() ?? true;
  }
  reportValidity(): boolean {
    return this.internals?.reportValidity() ?? true;
  }

  override updated(_changed: PropertyValues): void {
    // Apply the computed ARIA contract onto the native control. The native
    // attributes (value, disabled, readonly, required, placeholder) are bound in
    // `render()`; the describedby/invalid/errormessage/required ARIA is the field's
    // OWN responsibility and is set here from the single shared helper, so the Lit
    // and React renderers compute it identically.
    const input = this.renderRoot.querySelector<HTMLInputElement>('input.lab-field-control');
    if (!input) return;
    this.resetValue ??= this.value;
    const aria = fieldControlAria(this.a11yInput());
    setOrRemove(input, 'aria-describedby', aria['aria-describedby']);
    setOrRemove(input, 'aria-invalid', aria['aria-invalid']);
    setOrRemove(input, 'aria-errormessage', aria['aria-errormessage']);
    setOrRemove(input, 'aria-required', aria['aria-required']);
    // Keep the reflected `value` in sync with edits so SSR + the property agree.
    if (input.value !== this.value) this.value = input.value;
    this.syncForm(input);
  }

  private readonly onInput = (event: Event): void => {
    const input = event.target as HTMLInputElement;
    this.value = input.value;
    this.syncForm(input);
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

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    const input = event.target as HTMLInputElement;
    const form = this.internals?.form;
    if (
      event.key !== 'Enter' ||
      event.isComposing ||
      !form ||
      !implicitSubmissionTypes.has(input.type)
    )
      return;
    // Trusted keyboard dispatch can run microtasks between bubbling listeners.
    // A following task observes cancellation at every ancestor.
    setTimeout(() => {
      if (
        event.defaultPrevented ||
        !this.isConnected ||
        this.internals?.form !== form ||
        input.disabled
      )
        return;
      const root = form.getRootNode() as Document | ShadowRoot;
      const submitter = [
        ...root.querySelectorAll<HTMLButtonElement | HTMLInputElement>('button, input'),
      ].find(
        (element) =>
          element.form === form && (element.type === 'submit' || element.type === 'image'),
      );
      if (submitter) {
        if (!submitter.matches(':disabled')) submitter.click();
        return;
      }
      const blocking = [...form.elements].filter((element) =>
        element instanceof HTMLInputElement
          ? implicitSubmissionTypes.has(element.type)
          : element instanceof LabInput &&
            implicitSubmissionTypes.has(
              element.renderRoot.querySelector<HTMLInputElement>('input')?.type ?? 'text',
            ),
      );
      if (blocking.length <= 1) form.requestSubmit();
    }, 0);
  };

  override render(): TemplateResult {
    const ids = fieldPartIds(this.fieldId);
    const showError = fieldErrorIsActive(this.a11yInput());
    return html`
      <div data-lab-input data-type=${this.type} data-size=${this.size} part="field"
        ?data-label-hidden=${this.labelHidden} ?data-unlabelled=${!this.label}
        ?data-disabled=${this.disabled || this.disabledByForm} ?data-readonly=${this.readonly}
        ?data-invalid=${this.invalid} ?data-leading=${this.hasLeading} ?data-trailing=${this.hasTrailing}>
      <div class="lab-input-frame" part="frame">
        <label id=${ids.label} class="lab-field-label" for=${ids.control} part="label">
          <span class="label-text">${this.label}</span
          >${this.required ? html`<span class="lab-field-required-mark" aria-hidden="true"> *</span>` : nothing}
        </label>
        <span class="lab-input-adornment lab-input-leading"><slot name="leading" @slotchange=${this.onSlotChange}></slot></span>
        <input
          id=${ids.control}
          class="lab-field-control"
          part="control"
          .value=${live(this.value)}
          type=${this.inputType}
          name=${this.name || nothing}
          placeholder=${this.placeholder || nothing}
          autocomplete=${this.autocomplete || nothing}
          maxlength=${this.maxLength ?? nothing}
          minlength=${this.minLength ?? nothing}
          pattern=${this.pattern || nothing}
          ?disabled=${this.disabled || this.disabledByForm}
          ?readonly=${this.readonly}
          ?required=${this.required}
          @input=${this.onInput}
          @change=${this.onChange}
          @keydown=${this.onKeyDown}
        />
        <span class="lab-input-adornment lab-input-trailing"><slot name="trailing" @slotchange=${this.onSlotChange}></slot></span>
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
