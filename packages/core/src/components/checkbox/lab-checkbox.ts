import { type PropertyValues, type TemplateResult, css, html, nothing, unsafeCSS } from 'lit';
import { LabElement } from '../../lit/lab-element.js';
import type {
  LabSelectionChecked,
  LabSelectionSize,
  LabSelectionType,
  LabSelectionVariant,
} from '../selection/contract.js';
import { type SelectionMotion, mountSelectionMotion } from '../selection/runtime.js';
import { selectionCss } from '../selection/styles.js';

export type LabCheckboxType = LabSelectionType;
export type LabCheckboxSize = LabSelectionSize;
export type LabCheckboxChecked = LabSelectionChecked;

/** Native tri-state checkbox; FACE submits the shadow input's value to its form. */
export class LabCheckbox extends LabElement {
  static formAssociated = true;
  static override properties = {
    type: { reflect: true },
    size: { reflect: true },
    variant: { reflect: true },
    checked: { type: Boolean, reflect: true },
    indeterminate: { type: Boolean, reflect: true },
    defaultChecked: { type: Boolean, attribute: 'default-checked', reflect: true },
    defaultIndeterminate: { type: Boolean, attribute: 'default-indeterminate', reflect: true },
    controlled: { type: Boolean, reflect: true },
    disabled: { type: Boolean, reflect: true },
    required: { type: Boolean, reflect: true },
    name: { reflect: true },
    value: { reflect: true },
    ariaLabel: { attribute: 'aria-label', reflect: true },
    disabledByForm: { state: true },
    hasStart: { state: true },
    hasEnd: { state: true },
    hasDescription: { state: true },
  };
  declare type: LabCheckboxType;
  declare size: LabCheckboxSize;
  declare variant: LabSelectionVariant;
  declare checked: boolean;
  declare indeterminate: boolean;
  declare defaultChecked: boolean;
  declare defaultIndeterminate: boolean;
  declare controlled: boolean;
  declare disabled: boolean;
  declare required: boolean;
  declare name: string;
  declare value: string;
  declare ariaLabel: string | null;
  private declare disabledByForm: boolean;
  private declare hasStart: boolean;
  private declare hasEnd: boolean;
  private declare hasDescription: boolean;
  private readonly internals?: ElementInternals;
  private motion?: SelectionMotion;
  private resetState?: LabCheckboxChecked;
  private labelObserver?: MutationObserver;
  private observedLabels: Node[] = [];

  constructor() {
    super();
    this.type = 'accent';
    this.size = 'm';
    this.variant = 'plain';
    this.checked = false;
    this.indeterminate = false;
    this.defaultChecked = false;
    this.defaultIndeterminate = false;
    this.controlled = false;
    this.disabled = false;
    this.required = false;
    this.name = '';
    this.value = 'on';
    this.ariaLabel = null;
    this.disabledByForm = false;
    this.hasStart = false;
    this.hasEnd = false;
    this.hasDescription = false;
    if (typeof ElementInternals !== 'undefined') this.internals = this.attachInternals();
    this.addEventListener('click', (event) => {
      if (event.composedPath()[0] === this && !event.defaultPrevented) this.input?.click();
    });
  }
  static override styles = [
    unsafeCSS(selectionCss),
    css`
    :host { display: inline-flex; min-inline-size: 0; max-inline-size: 100%; vertical-align: middle; }
    :host([variant='card']), :host([variant='row']) { display: flex; }
    ::slotted([slot='label-start']) { min-inline-size: 0; overflow-wrap: anywhere; }
    .lab-selection-label-start:has(slot:empty) { display: contents; }
  `,
  ];
  private get input(): HTMLInputElement | null {
    return this.renderRoot.querySelector('input');
  }
  private get state(): LabCheckboxChecked {
    return this.indeterminate ? 'indeterminate' : this.checked;
  }
  protected override willUpdate(changed: PropertyValues): void {
    if (this.resetState === undefined) {
      this.resetState = this.controlled
        ? this.state
        : this.indeterminate || this.defaultIndeterminate
          ? 'indeterminate'
          : this.checked || this.defaultChecked;
      this.setState(this.resetState);
    } else if (changed.has('defaultChecked') || changed.has('defaultIndeterminate')) {
      this.resetState = this.defaultIndeterminate ? 'indeterminate' : this.defaultChecked;
    }
  }
  private setState(value: LabCheckboxChecked): void {
    this.indeterminate = value === 'indeterminate';
    this.checked = value === true;
  }
  private syncForm(): void {
    const input = this.input;
    if (!input) return;
    input.checked = this.checked && !this.indeterminate;
    input.indeterminate = this.indeterminate;
    this.internals?.setFormValue(
      input.disabled || !input.checked || input.indeterminate ? null : this.value,
      String(this.state),
    );
    this.internals?.setValidity(input.validity, input.validationMessage, input);
    this.motion?.update();
  }
  private readonly onChange = (event: Event): void => {
    const checked = (event.target as HTMLInputElement).checked;
    if (!this.controlled) this.setState(checked);
    this.dispatchEvent(
      new CustomEvent<{ checked: LabCheckboxChecked }>('checked-change', {
        detail: { checked },
        bubbles: true,
        composed: true,
      }),
    );
    this.syncForm();
    this.requestUpdate();
  };
  private readonly onSlotChange = (event: Event): void => {
    const slot = event.target as HTMLSlotElement;
    const present = slot
      .assignedNodes()
      .some((node) => node.nodeType === 1 || node.textContent?.trim());
    if (slot.name === 'label-start') this.hasStart = present;
    else if (slot.name === 'description') this.hasDescription = present;
    else if (!slot.name) this.hasEnd = present;
  };
  formDisabledCallback(disabled: boolean): void {
    this.disabledByForm = disabled;
  }
  formResetCallback(): void {
    if (!this.controlled) {
      this.setState(this.resetState ?? false);
      this.syncForm();
    }
  }
  formStateRestoreCallback(state: string | File | FormData): void {
    if (!this.controlled && typeof state === 'string') {
      this.setState(state === 'indeterminate' ? state : state === 'true');
      this.syncForm();
    }
  }
  get form(): HTMLFormElement | null {
    return this.internals?.form ?? null;
  }
  get validity(): ValidityState | undefined {
    return this.internals?.validity;
  }
  get validationMessage(): string {
    return this.internals?.validationMessage ?? '';
  }
  checkValidity(): boolean {
    return this.internals?.checkValidity() ?? true;
  }
  reportValidity(): boolean {
    return this.internals?.reportValidity() ?? true;
  }
  override updated(): void {
    const input = this.input;
    const root = this.renderRoot.querySelector<HTMLElement>('[data-lab-selection]');
    if (!input || !root) return;
    const labels = Array.from(this.internals?.labels ?? []);
    if (
      labels.length !== this.observedLabels.length ||
      labels.some((label, i) => label !== this.observedLabels[i])
    ) {
      this.labelObserver?.disconnect();
      this.observedLabels = labels;
      if (labels.length) {
        this.labelObserver ??= new MutationObserver(() => this.requestUpdate());
        for (const label of labels)
          this.labelObserver.observe(label, {
            childList: true,
            characterData: true,
            subtree: true,
          });
      }
    }
    this.syncForm();
    this.motion ??= mountSelectionMotion(root, input);
    this.motion.update();
  }
  override connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated) this.requestUpdate();
  }
  override disconnectedCallback(): void {
    this.labelObserver?.disconnect();
    this.observedLabels = [];
    this.motion?.dispose();
    this.motion = undefined;
    super.disconnectedCallback();
  }
  override render(): TemplateResult {
    const mixed =
      this.indeterminate || (!this.controlled && !this.hasUpdated && this.defaultIndeterminate);
    const checked =
      !mixed && (this.checked || (!this.controlled && !this.hasUpdated && this.defaultChecked));
    const disabled = this.disabled || this.disabledByForm;
    const external = Array.from(this.internals?.labels ?? [])
      .map((label) => label.textContent ?? '')
      .join(' ')
      .trim();
    const accessibleName = this.ariaLabel || external;
    const labels =
      this.hasStart || this.hasEnd || !accessibleName ? `${this.uid}-start ${this.uid}-label` : '';
    return html`<label part="root" data-lab-checkbox data-lab-selection data-kind="checkbox" data-type=${this.type} data-size=${this.variant === 'plain' ? this.size : 'l'} data-variant=${this.variant}
      ?data-checked=${checked} ?data-selected=${checked || mixed} ?data-indeterminate=${mixed} ?data-disabled=${disabled}>
      <span class="lab-selection-label-start" id=${`${this.uid}-start`}><slot name="label-start" @slotchange=${this.onSlotChange}></slot></span>
      <span class="lab-selection-icon" aria-hidden="true"><slot name="icon"></slot></span>
      <span class="lab-selection-control control lab-checkbox-control" part="control" aria-hidden="true" data-state=${mixed ? 'indeterminate' : checked ? 'checked' : 'unchecked'}><span class="lab-selection-mark"></span></span>
      <input id=${`${this.uid}-input`} type="checkbox" ?checked=${checked} aria-checked=${mixed ? 'mixed' : String(checked)} ?disabled=${disabled} ?required=${this.required}
        name=${this.name || nothing} value=${this.value} aria-labelledby=${labels || nothing} aria-label=${labels ? nothing : accessibleName || nothing}
        aria-describedby=${this.hasDescription ? `${this.uid}-description` : nothing} @change=${this.onChange} />
      <span class="lab-selection-label lab-checkbox-label" part="label"><span id=${`${this.uid}-label`}><slot @slotchange=${this.onSlotChange}></slot></span>
        <span class="lab-selection-description" id=${`${this.uid}-description`}><slot name="description" @slotchange=${this.onSlotChange}></slot></span></span>
    </label>`;
  }
}
declare global {
  interface HTMLElementTagNameMap {
    'lab-checkbox': LabCheckbox;
  }
}
if (typeof customElements !== 'undefined' && !customElements.get('lab-checkbox'))
  customElements.define('lab-checkbox', LabCheckbox);
