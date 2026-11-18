import { type PropertyValues, type TemplateResult, css, html, nothing, unsafeCSS } from 'lit';
import { LabElement } from '../../lit/lab-element.js';
import { type LabChipMode, type LabChipSize, chipSelected } from './contract.js';
import { chipCss } from './styles.js';

export type { LabChipMode, LabChipSize } from './contract.js';

/** One native button, with explicit filter, action or removal semantics. */
export class LabChip extends LabElement {
  static formAssociated = true;
  static override properties = {
    mode: { reflect: true, useDefault: true },
    size: { reflect: true, useDefault: true },
    sharp: { type: Boolean, reflect: true },
    active: { type: Boolean, reflect: true },
    selected: { type: Boolean, reflect: true },
    defaultSelected: { type: Boolean, attribute: 'default-selected', reflect: true },
    controlled: { type: Boolean, reflect: true },
    disabled: { type: Boolean, reflect: true },
    loading: { type: Boolean, reflect: true },
    showLeading: { type: Boolean, attribute: 'show-leading', reflect: true },
    ariaLabel: { attribute: 'aria-label', reflect: true },
    name: { reflect: true, useDefault: true },
    value: { reflect: true, useDefault: true },
    disabledByForm: { state: true },
  };
  declare mode: LabChipMode;
  declare size: LabChipSize;
  declare sharp: boolean;
  declare active: boolean;
  declare selected: boolean;
  declare defaultSelected: boolean;
  declare controlled: boolean;
  declare disabled: boolean;
  declare loading: boolean;
  declare showLeading: boolean;
  declare ariaLabel: string | null;
  declare name: string;
  declare value: string;
  private declare disabledByForm: boolean;
  private readonly internals?: ElementInternals;
  private initialSelected?: boolean;

  constructor() {
    super();
    this.mode = 'filter';
    this.size = 'm';
    this.sharp = false;
    this.active = false;
    this.selected = false;
    this.defaultSelected = false;
    this.controlled = false;
    this.disabled = false;
    this.loading = false;
    this.showLeading = false;
    this.ariaLabel = null;
    this.name = '';
    this.value = 'on';
    this.disabledByForm = false;
    if (typeof ElementInternals !== 'undefined') this.internals = this.attachInternals();
  }
  override click(): void {
    this.renderRoot.querySelector<HTMLButtonElement>('button')?.click();
  }
  static override styles = [
    unsafeCSS(chipCss),
    css`
    :host { display: inline-flex; max-inline-size: 100%; min-inline-size: 0; vertical-align: middle; }
    ::slotted([slot='leading']) { inline-size: 100%; block-size: 100%; }
  `,
  ];
  protected override willUpdate(changed: PropertyValues): void {
    if (this.initialSelected === undefined) {
      this.initialSelected = this.selected || (!this.controlled && this.defaultSelected);
      this.selected = this.initialSelected;
    } else if (changed.has('defaultSelected')) this.initialSelected = this.defaultSelected;
  }
  private syncForm(): void {
    this.internals?.setFormValue(
      this.mode === 'filter' && this.selected && !this.disabled && !this.disabledByForm
        ? this.value
        : null,
      this.selected ? 'true' : 'false',
    );
  }
  private readonly activate = (event: MouseEvent): void => {
    if (this.disabled || this.disabledByForm || this.loading) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (event.defaultPrevented) return;
    if (this.mode === 'filter') {
      const selected = !this.selected;
      const accepted = this.dispatchEvent(
        new CustomEvent<{ selected: boolean }>('selected-change', {
          detail: { selected },
          bubbles: true,
          composed: true,
          cancelable: true,
        }),
      );
      if (accepted && !this.controlled) this.selected = selected;
      this.syncForm();
    } else if (this.mode === 'remove') {
      this.dispatchEvent(new CustomEvent('remove', { bubbles: true, composed: true }));
    } else {
      this.dispatchEvent(new CustomEvent('action', { bubbles: true, composed: true }));
    }
  };
  formDisabledCallback(disabled: boolean): void {
    this.disabledByForm = disabled;
  }
  formResetCallback(): void {
    if (!this.controlled) {
      this.selected = this.initialSelected ?? false;
      this.syncForm();
    }
  }
  formStateRestoreCallback(state: string | File | FormData): void {
    if (!this.controlled && typeof state === 'string') {
      this.selected = state === 'true';
      this.syncForm();
    }
  }
  get form(): HTMLFormElement | null {
    return this.internals?.form ?? null;
  }
  override updated(): void {
    this.syncForm();
  }
  override render(): TemplateResult {
    const selected = chipSelected(
      this.mode,
      this.selected || (!this.controlled && !this.hasUpdated && this.defaultSelected),
    );
    const disabled = this.disabled || this.disabledByForm;
    return html`<button type="button" part="button" data-lab-chip data-size=${this.size}
      ?data-selected=${selected} ?data-sharp=${this.sharp} ?data-active=${this.active}
      ?data-loading=${this.loading} ?data-leading=${this.showLeading} ?disabled=${disabled}
      aria-pressed=${this.mode === 'filter' ? String(selected) : nothing}
      aria-busy=${this.loading ? 'true' : nothing} aria-disabled=${this.loading || disabled ? 'true' : nothing}
      aria-label=${this.ariaLabel || nothing} @click=${this.activate}>
      <span class="lab-chip-leading" aria-hidden="true"><slot name="leading"></slot></span>
      <span class="lab-chip-content" part="content"><span class="lab-chip-label" part="label"><slot></slot></span>
        ${selected ? html`<span class="lab-chip-close" aria-hidden="true"></span>` : nothing}
      </span><span class="lab-chip-glow" aria-hidden="true"></span>
    </button>`;
  }
}
declare global {
  interface HTMLElementTagNameMap {
    'lab-chip': LabChip;
  }
}
if (typeof customElements !== 'undefined' && !customElements.get('lab-chip'))
  customElements.define('lab-chip', LabChip);
