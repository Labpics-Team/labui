/**
 * `<lab-textarea>` — a multi-line text field: a real `<textarea>` wired to a label,
 * an optional helper/description, and an optional error message via genuine ARIA.
 *
 * OPT-OUT (documented, per core-CONTRACT §1): like `<lab-input>`, a textarea is
 * PRESENTATIONAL on the Behaviors seam — `@zag-js` ships no plain text-input
 * machine because the native `<textarea>` already owns its value, caret, selection,
 * keyboard and editing. So this element extends `LabElement` for the shared base
 * conventions but does NOT call `runMachine`.
 *
 * It OWNS the same form-field a11y wiring as Input, computed by the SAME shared
 * `field-a11y` helper — the only structural difference between the two is the
 * control element (`<textarea>` vs `<input>`) and the multi-line extras (`rows`,
 * optional `auto-resize`). Because the a11y + token contract is shared, the two
 * fields cannot drift.
 *
 * Auto-resize honesty: when `auto-resize` is set, the control grows to fit its
 * content. That is LOCAL view state (a height that tracks the text), not shared
 * interaction state — it is computed from the native `scrollHeight` on input, the
 * same way the React twin does it. It is not a faked machine.
 *
 * Axes (the form-field model — Type × Size × State + rows / auto-resize):
 *   - type:  neutral | danger | warning | success   (sentiment of the field)
 *   - size:  s | m | l
 *   - rows:  initial visible text rows (native textarea rows)
 *   - autoResize: grow to fit content (local view behaviour)
 *   - state: disabled · readonly · invalid · required   (reflected, drive CSS + ARIA)
 *
 * Token contract (core-CONTRACT §2): ONLY semantic --lab-* roles + dimensions via
 * the shared `field-styles`. No hex, no primitive, no colour-role fallback.
 */
import { type PropertyValues, type TemplateResult, css, html, nothing } from 'lit';
import {
  type FieldA11yInput,
  type LabFieldSize,
  type LabFieldType,
  fieldControlAria,
  fieldErrorIsActive,
  fieldPartIds,
} from '../field/field-a11y.js';
import { fieldStyles } from '../field/field-styles.js';
import { LabElement } from '../../lit/lab-element.js';

export type { LabFieldSize as LabTextareaSize, LabFieldType as LabTextareaType };

let textareaSeq = 0;

export class LabTextarea extends LabElement {
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
  declare rows: number;
  declare autoResize: boolean;
  declare readonly: boolean;
  declare disabled: boolean;
  declare required: boolean;
  declare invalid: boolean;
  declare name: string;

  /** Stable per-instance base id, so the part ids never collide across fields. */
  private readonly fieldId = `lab-textarea-${++textareaSeq}`;

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
  }

  static override styles = [
    fieldStyles,
    css`
      .control {
        display: block;
        resize: vertical;
        min-height: calc(var(--_field-line) * 2em);
      }
      /* When auto-resizing, the height is computed from content, so the manual
         resize grip is removed and overflow is hidden to avoid a flash of scroll. */
      :host([auto-resize]) .control {
        resize: none;
        overflow: hidden;
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
    const control = this.renderRoot.querySelector<HTMLTextAreaElement>('textarea.control');
    if (!control) return;
    const aria = fieldControlAria(this.a11yInput());
    setOrRemove(control, 'aria-describedby', aria['aria-describedby']);
    setOrRemove(control, 'aria-invalid', aria['aria-invalid']);
    setOrRemove(control, 'aria-errormessage', aria['aria-errormessage']);
    setOrRemove(control, 'aria-required', aria['aria-required']);
    if (control.value !== this.value) this.value = control.value;
    if (this.autoResize) this.fitToContent(control);
  }

  /** Grow the control to fit its content (auto-resize): reset, then track scrollHeight. */
  private fitToContent(control: HTMLTextAreaElement): void {
    control.style.height = 'auto';
    control.style.height = `${control.scrollHeight}px`;
  }

  private readonly onInput = (event: Event): void => {
    const control = event.target as HTMLTextAreaElement;
    this.value = control.value;
    if (this.autoResize) this.fitToContent(control);
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
    return html`
      <div class="field" part="field">
        <label id=${ids.label} class="label" for=${ids.control} part="label">
          <span class="label-text">${this.label}</span
          >${this.required ? html`<span class="required-mark" aria-hidden="true"> *</span>` : nothing}
        </label>
        <textarea
          id=${ids.control}
          class="control"
          part="control"
          .value=${this.value}
          rows=${this.rows}
          name=${this.name || nothing}
          placeholder=${this.placeholder || nothing}
          ?disabled=${this.disabled}
          ?readonly=${this.readonly}
          ?required=${this.required}
          @input=${this.onInput}
          @change=${this.onChange}
        ></textarea>
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
