import { type PropertyValues, type TemplateResult, css, html, nothing, unsafeCSS } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { LabElement } from '../../lit/lab-element.js';
import { navigateRadio } from '../selection/contract.js';
import { type LabSegmentedItem, type LabSegmentedStyle, parseSegmentedItems } from './contract.js';
import { mountSegmentedMotion } from './runtime.js';
import { segmentedCss } from './styles.js';
export type { LabSegmentedItem, LabSegmentedStyle } from './contract.js';

/** A compact form-associated single choice, without navigation panels. */
export class LabSegmentedControl extends LabElement {
  static formAssociated = true;
  static override properties = {
    shape: { reflect: true },
    value: { converter: { fromAttribute: (value: string | null) => value ?? undefined } },
    defaultValue: { attribute: 'default-value', reflect: true },
    name: { reflect: true },
    label: { reflect: true },
    dir: { reflect: true },
    disabled: { type: Boolean, reflect: true },
    required: { type: Boolean, reflect: true },
    items: {
      type: Array,
      reflect: true,
      useDefault: true,
      converter: { fromAttribute: parseSegmentedItems },
    },
    disabledByForm: { state: true },
  };
  declare shape: LabSegmentedStyle;
  declare value: string | null | undefined;
  declare defaultValue: string | null;
  declare name: string;
  declare label: string;
  declare disabled: boolean;
  declare required: boolean;
  declare items: readonly LabSegmentedItem[];
  private declare disabledByForm: boolean;
  private localValue: string | null | undefined;
  private readonly internals?: ElementInternals;
  private motion?: ReturnType<typeof mountSegmentedMotion>;

  constructor() {
    super();
    this.shape = 'rounded';
    this.value = undefined;
    this.defaultValue = null;
    this.name = '';
    this.label = '';
    this.disabled = false;
    this.required = false;
    this.items = [];
    this.disabledByForm = false;
    if (typeof ElementInternals !== 'undefined') this.internals = this.attachInternals();
  }
  static override styles = [
    unsafeCSS(segmentedCss),
    css`
    :host { display: block; min-inline-size: 0; max-inline-size: 100%; }
    .lab-segment-icon ::slotted(*) { width: 100%; height: 100%; }
  `,
  ];
  get selectedValue(): string | null {
    return this.value === undefined
      ? this.localValue === undefined
        ? this.defaultValue
        : this.localValue
      : this.value;
  }
  private get inputs(): HTMLInputElement[] {
    return Array.from(this.renderRoot.querySelectorAll('input'));
  }
  protected override willUpdate(_changed: PropertyValues): void {
    if (this.localValue === undefined) this.localValue = this.defaultValue;
  }
  private syncForm(): void {
    const inputs = this.inputs;
    for (const input of inputs) input.checked = input.value === this.selectedValue;
    const selected = inputs.find((input) => input.checked && !input.disabled);
    this.internals?.setFormValue(selected?.value ?? null, JSON.stringify(this.selectedValue));
    const anchor = inputs.find((input) => !input.disabled);
    const missing = this.required && !selected && !!anchor;
    this.internals?.setValidity(
      missing ? { valueMissing: true } : {},
      missing ? 'Выберите один вариант.' : '',
      anchor,
    );
  }
  private readonly onChange = (event: Event): void => {
    const input = event.target as HTMLInputElement;
    if (!input.checked || input.disabled) return;
    if (this.value === undefined) this.localValue = input.value;
    this.dispatchEvent(
      new CustomEvent<{ value: string }>('value-change', {
        detail: { value: input.value },
        bubbles: true,
        composed: true,
      }),
    );
    this.syncForm();
    this.requestUpdate();
  };
  formDisabledCallback(disabled: boolean): void {
    this.disabledByForm = disabled;
  }
  formResetCallback(): void {
    if (this.value === undefined) this.localValue = this.defaultValue;
    this.syncForm();
    this.requestUpdate();
  }
  formStateRestoreCallback(state: string | File | FormData): void {
    if (this.value !== undefined || typeof state !== 'string') return;
    try {
      const value: unknown = JSON.parse(state);
      this.localValue = typeof value === 'string' ? value : null;
    } catch {
      this.localValue = state;
    }
    this.syncForm();
    this.requestUpdate();
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
  override connectedCallback(): void {
    const existing = this.shadowRoot?.querySelector<HTMLElement>('[data-lab-segmented]');
    if (!this.hasUpdated && this.value === undefined && existing?.hasAttribute('data-controlled'))
      this.value = existing.getAttribute('data-value');
    else if (!this.hasUpdated && this.value === undefined && existing)
      this.localValue = existing.querySelector<HTMLInputElement>('input:checked')?.value ?? null;
    super.connectedCallback();
    if (this.hasUpdated) this.requestUpdate();
  }
  override updated(): void {
    this.syncForm();
    const root = this.renderRoot.querySelector<HTMLElement>('[data-lab-segmented]');
    if (root) {
      this.motion ??= mountSegmentedMotion(root);
      this.motion.update();
    }
  }
  override disconnectedCallback(): void {
    this.motion?.dispose();
    this.motion = undefined;
    super.disconnectedCallback();
  }
  override render(): TemplateResult {
    const value = this.selectedValue;
    const disabled = this.disabled || this.disabledByForm;
    const tabStop = (
      this.items.find((item) => item.value === value && !item.disabled) ??
      this.items.find((item) => !item.disabled)
    )?.value;
    return html`<div data-lab-segmented data-shape=${this.shape} role="radiogroup"
      aria-label=${this.label || this.getAttribute('aria-label') || nothing} aria-required=${this.required}
      ?data-controlled=${this.value !== undefined} data-value=${this.value ?? nothing} dir=${this.dir || nothing}
      @keydown=${(event: KeyboardEvent) => navigateRadio(event, this.inputs)}>
      ${repeat(
        this.items,
        (item) => item.value,
        (item) => html`
        <label class="lab-segment" ?data-selected=${item.value === value} ?data-icon-only=${item.iconOnly}>
          <span class="lab-segment-active" aria-hidden="true"></span>
          ${item.icon ? html`<span class="lab-segment-icon" aria-hidden="true"><slot name=${item.icon}></slot></span>` : nothing}
          <span class="lab-segment-label">${item.label}</span>
          ${!item.iconOnly && item.iconEnd ? html`<span class="lab-segment-icon" aria-hidden="true"><slot name=${item.iconEnd}></slot></span>` : nothing}
          <input type="radio" name=${this.name || 'segmented'} value=${item.value} ?checked=${item.value === value}
            ?disabled=${disabled || item.disabled} ?required=${this.required} tabindex=${item.value === tabStop && !disabled ? 0 : -1} @change=${this.onChange} />
        </label>`,
      )}
    </div>`;
  }
}
declare global {
  interface HTMLElementTagNameMap {
    'lab-segmented-control': LabSegmentedControl;
  }
}
if (typeof customElements !== 'undefined' && !customElements.get('lab-segmented-control'))
  customElements.define('lab-segmented-control', LabSegmentedControl);
