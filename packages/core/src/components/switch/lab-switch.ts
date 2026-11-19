import { type PropertyValues, type TemplateResult, css, html, nothing, unsafeCSS } from 'lit';
import { LabElement } from '../../lit/lab-element.js';
import { type LabSwitchSize, type LabSwitchType, switchAppearance } from './contract.js';
import { type SwitchMotion, mountSwitchMotion } from './runtime.js';
import { switchCss } from './styles.js';

export type { LabSwitchSize, LabSwitchType } from './contract.js';

/** Native checkbox and form-associated host; the same profile and Motion as React. */
export class LabSwitch extends LabElement {
  static formAssociated = true;
  static override properties = {
    type: { reflect: true },
    size: { reflect: true },
    checked: { type: Boolean, reflect: true },
    defaultChecked: { type: Boolean, attribute: 'default-checked', reflect: true },
    /** Explicit controlled mode: checked-change requests a value, checked supplies it. */
    controlled: { type: Boolean, reflect: true },
    disabled: { type: Boolean, reflect: true },
    required: { type: Boolean, reflect: true },
    icon: { type: Boolean, reflect: true },
    ariaLabel: { attribute: 'aria-label', reflect: true },
    name: { reflect: true },
    value: { reflect: true },
    disabledByForm: { state: true },
    hasStart: { state: true },
    hasEnd: { state: true },
    hasIconOn: { state: true },
    hasIconOff: { state: true },
  };
  declare type: LabSwitchType;
  declare size: LabSwitchSize;
  declare checked: boolean;
  declare defaultChecked: boolean;
  declare controlled: boolean;
  declare disabled: boolean;
  declare required: boolean;
  declare icon: boolean;
  declare ariaLabel: string | null;
  declare name: string;
  declare value: string;
  private declare disabledByForm: boolean;
  private declare hasStart: boolean;
  private declare hasEnd: boolean;
  private declare hasIconOn: boolean;
  private declare hasIconOff: boolean;
  private readonly internals?: ElementInternals;
  private motion?: SwitchMotion;
  private resetChecked?: boolean;
  private labelObserver?: MutationObserver;
  private observedLabels: Node[] = [];

  constructor() {
    super();
    this.type = 'accent';
    this.size = 'm';
    this.checked = false;
    this.defaultChecked = false;
    this.controlled = false;
    this.disabled = false;
    this.required = false;
    this.icon = false;
    this.ariaLabel = null;
    this.name = '';
    this.value = 'on';
    this.disabledByForm = false;
    this.hasStart = false;
    this.hasEnd = false;
    this.hasIconOn = false;
    this.hasIconOff = false;
    if (typeof ElementInternals !== 'undefined') this.internals = this.attachInternals();
    // FACE makes the host labelable; its activation forwards to the real checkbox.
    this.addEventListener('click', (event) => {
      if (event.composedPath()[0] === this && !event.defaultPrevented) {
        this.renderRoot.querySelector<HTMLInputElement>('input')?.click();
      }
    });
  }
  static override styles = [
    unsafeCSS(switchCss),
    css`
    :host { display: inline-flex; max-inline-size: 100%; min-inline-size: 0; vertical-align: middle; }
    .lab-switch-label-start { display: contents; }
    ::slotted([slot='label-start']) { min-inline-size: 0; max-inline-size: 100%; overflow-wrap: anywhere; }
    ::slotted(svg), ::slotted(img), ::slotted(lab-icon) { inline-size: 100%; block-size: 100%; }
  `,
  ];
  protected override willUpdate(changed: PropertyValues): void {
    if (this.resetChecked === undefined) {
      this.resetChecked = this.controlled ? this.checked : this.checked || this.defaultChecked;
      this.checked = this.resetChecked;
    } else if (changed.has('defaultChecked')) {
      this.resetChecked = this.defaultChecked;
    }
  }
  private readonly onSlotChange = (event: Event): void => {
    const slot = event.target as HTMLSlotElement;
    const present = slot
      .assignedNodes()
      .some((node) => node.nodeType === 1 || node.textContent?.trim());
    if (slot.name === 'label-start') this.hasStart = present;
    else if (slot.name === 'icon-on') this.hasIconOn = present;
    else if (slot.name === 'icon-off') this.hasIconOff = present;
    else this.hasEnd = present;
  };
  private syncForm(input: HTMLInputElement): void {
    this.internals?.setFormValue(
      input.disabled || !input.checked ? null : this.value,
      input.checked ? 'true' : 'false',
    );
    this.internals?.setValidity(input.validity, input.validationMessage, input);
  }
  private readonly onChange = (event: Event): void => {
    const input = event.target as HTMLInputElement;
    const checked = input.checked;
    if (!this.controlled) this.checked = checked;
    this.dispatchEvent(
      new CustomEvent<{ checked: boolean }>('checked-change', {
        detail: { checked },
        bubbles: true,
        composed: true,
      }),
    );
    input.checked = this.checked;
    this.syncForm(input);
    this.requestUpdate();
  };
  formDisabledCallback(disabled: boolean): void {
    this.disabledByForm = disabled;
  }
  formResetCallback(): void {
    if (!this.controlled) this.restoreChecked(this.resetChecked ?? false);
  }
  formStateRestoreCallback(state: string | File | FormData): void {
    if (!this.controlled && typeof state === 'string') this.restoreChecked(state === 'true');
  }
  private restoreChecked(checked: boolean): void {
    this.checked = checked;
    const input = this.renderRoot.querySelector<HTMLInputElement>('input');
    if (input) {
      input.checked = checked;
      this.syncForm(input);
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
    const input = this.renderRoot.querySelector<HTMLInputElement>('input');
    const root = this.renderRoot.querySelector<HTMLElement>('[data-lab-switch]');
    if (!input || !root) return;
    const labels = Array.from(this.internals?.labels ?? []);
    if (
      labels.length !== this.observedLabels.length ||
      labels.some((label, index) => label !== this.observedLabels[index])
    ) {
      this.labelObserver?.disconnect();
      this.observedLabels = labels;
      if (labels.length) {
        this.labelObserver ??= new MutationObserver(() => this.requestUpdate());
        // Only associated labels are observed. No document scan or idle work.
        for (const label of labels)
          this.labelObserver.observe(label, {
            childList: true,
            characterData: true,
            subtree: true,
          });
      }
    }
    // Property writes belong to the client: Lit SSR serializes .checked=false
    // as the present HTML boolean attribute checked="false" (which means ON).
    input.checked = this.checked;
    // ARIA element references can cross the shadow boundary, unlike IDREF strings.
    // The string in render() also names the control on older browser engines.
    if ('ariaLabelledByElements' in input) {
      const accessible = input as HTMLInputElement & { ariaLabelledByElements: Element[] | null };
      const externalLabels = Array.from(this.internals?.labels ?? []).filter(
        (node): node is Element => node.nodeType === 1,
      );
      if (!this.ariaLabel && !this.hasStart && !this.hasEnd && externalLabels.length) {
        accessible.ariaLabelledByElements = externalLabels;
      } else if (input.getAttribute('aria-labelledby') === '') {
        accessible.ariaLabelledByElements = null;
      }
    }
    this.syncForm(input);
    this.motion ??= mountSwitchMotion(root, input);
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
    const checked = this.checked || (!this.controlled && !this.hasUpdated && this.defaultChecked);
    const disabled = this.disabled || this.disabledByForm;
    const externalName = Array.from(this.internals?.labels ?? [])
      .map((label) => label.textContent ?? '')
      .join(' ')
      .trim();
    const accessibleName = this.ariaLabel || externalName;
    const labels =
      this.hasStart || this.hasEnd || !accessibleName ? `${this.uid}-start ${this.uid}-label` : '';
    return html`
      <label data-lab-switch data-type=${this.type} data-size=${this.size}
        data-appearance=${switchAppearance(this.type, checked)}
        ?data-checked=${checked} ?data-disabled=${disabled} ?data-icon=${this.icon}
        ?data-custom-on=${this.hasIconOn} ?data-custom-off=${this.hasIconOff}>
        <span class="lab-switch-label lab-switch-label-start" id=${`${this.uid}-start`}><slot name="label-start" @slotchange=${this.onSlotChange}></slot></span>
        <span class="lab-switch-control" part="control" aria-hidden="true">
          <span class="lab-switch-thumb" part="thumb">
            <span class="lab-switch-icon lab-switch-icon-on"><slot name="icon-on" @slotchange=${this.onSlotChange}></slot></span>
            <span class="lab-switch-icon lab-switch-icon-off"><slot name="icon-off" @slotchange=${this.onSlotChange}></slot></span>
          </span>
        </span>
        <input id=${`${this.uid}-input`} type="checkbox" role="switch" ?checked=${checked}
          ?disabled=${disabled} ?required=${this.required} name=${this.name || nothing} value=${this.value}
          aria-labelledby=${labels || nothing} aria-label=${labels ? nothing : accessibleName || nothing}
          @change=${this.onChange} />
        <span class="lab-switch-label" part="label" id=${`${this.uid}-label`}><slot @slotchange=${this.onSlotChange}></slot></span>
      </label>`;
  }
}
declare global {
  interface HTMLElementTagNameMap {
    'lab-switch': LabSwitch;
  }
}
if (typeof customElements !== 'undefined' && !customElements.get('lab-switch'))
  customElements.define('lab-switch', LabSwitch);
