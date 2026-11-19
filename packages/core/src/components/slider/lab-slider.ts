import { type TemplateResult, css, html, nothing, unsafeCSS } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';
import { LabElement } from '../../lit/lab-element.js';
import {
  type LabSliderOrientation,
  type LabSliderSize,
  type LabSliderVariant,
  SliderState,
  sliderCircleGeometry as circle,
  parseSliderValues,
  sliderArc,
  sliderBounds,
  sliderFraction,
  sliderThumbStyle,
} from './contract.js';
import { type SliderRuntime, mountSlider } from './runtime.js';
import { sliderCss } from './styles.js';
export type { LabSliderOrientation, LabSliderSize, LabSliderVariant } from './contract.js';
let sequence = 0;

/** Native ranges own keyboard and accessibility; a shared runtime maps authored pointer geometry. */
export class LabSlider extends LabElement {
  static formAssociated = true;
  static override properties = {
    variant: { reflect: true },
    orientation: { reflect: true },
    size: { reflect: true },
    label: {},
    labelHidden: { type: Boolean, attribute: 'label-hidden', reflect: true },
    helper: {},
    error: {},
    name: { reflect: true },
    form: { reflect: true },
    value: {
      converter: {
        fromAttribute: (raw: string | null) => (raw === null ? null : parseSliderValues(raw)),
      },
    },
    defaultValue: { attribute: 'default-value', converter: { fromAttribute: parseSliderValues } },
    min: { type: Number },
    max: { type: Number },
    step: { type: Number },
    showValue: { type: Boolean, attribute: 'show-value', reflect: true },
    readonly: { type: Boolean, reflect: true },
    disabled: { type: Boolean, reflect: true },
    invalid: { type: Boolean, reflect: true },
    disabledByForm: { state: true },
    thumbLabels: {
      attribute: 'thumb-labels',
      converter: { fromAttribute: (raw: string | null) => JSON.parse(raw ?? '[]') },
    },
  };
  declare variant: LabSliderVariant;
  declare orientation: LabSliderOrientation;
  /** @deprecated Authored geometry is selected by variant. */
  declare size: LabSliderSize;
  declare label: string;
  declare labelHidden: boolean;
  declare helper: string;
  declare error: string;
  declare name: string;
  declare form: string | null;
  declare value: number[] | null;
  declare defaultValue: number[];
  declare min: number;
  declare max: number;
  declare step: number;
  declare showValue: boolean;
  declare readonly: boolean;
  declare disabled: boolean;
  declare invalid: boolean;
  declare thumbLabels: string[];
  private declare disabledByForm: boolean;
  private readonly state = new SliderState();
  private runtime?: SliderRuntime;
  private readonly internals?: ElementInternals;
  private readonly fieldId = `lab-slider-${++sequence}`;
  constructor() {
    super();
    this.variant = 'linear';
    this.orientation = 'horizontal';
    this.size = 'm';
    this.label = '';
    this.labelHidden = false;
    this.helper = '';
    this.error = '';
    this.name = '';
    this.form = null;
    this.value = null;
    this.defaultValue = [50];
    this.min = 0;
    this.max = 100;
    this.step = 1;
    this.showValue = false;
    this.readonly = false;
    this.disabled = false;
    this.invalid = false;
    this.disabledByForm = false;
    this.thumbLabels = [];
    if (typeof ElementInternals !== 'undefined') this.internals = this.attachInternals();
  }
  static override styles = [css`:host { display:block; }`, unsafeCSS(sliderCss)];
  private input() {
    return {
      value: this.value,
      defaultValue: this.defaultValue,
      min: this.min,
      max: this.max,
      step: this.step,
      variant: this.variant,
      orientation: this.orientation,
      disabled: this.disabled || this.disabledByForm,
      readOnly: this.readonly,
    };
  }
  private syncFormValue(): void {
    if (!this.internals) return;
    if (!this.name || this.disabled || this.disabledByForm) {
      this.internals.setFormValue(null);
      return;
    }
    const data = new FormData();
    for (const value of this.state.values(this.input())) data.append(this.name, String(value));
    this.internals.setFormValue(data);
  }
  formDisabledCallback(disabled: boolean): void {
    this.disabledByForm = disabled;
  }
  formResetCallback(): void {
    this.state.reset(this.input());
    this.runtime?.reset();
    this.requestUpdate();
  }
  override disconnectedCallback(): void {
    this.runtime?.dispose();
    this.runtime = undefined;
    super.disconnectedCallback();
  }
  protected override updated(): void {
    const root = this.renderRoot.querySelector<HTMLElement>('[data-lab-slider]');
    if (!root) return;
    this.runtime ??= mountSlider(root, this.state, () => ({
      ...this.input(),
      onValueChange: (value) => {
        this.dispatchEvent(
          new CustomEvent('value-change', { detail: { value }, bubbles: true, composed: true }),
        );
        this.requestUpdate();
      },
      onValueChangeEnd: (value) =>
        this.dispatchEvent(
          new CustomEvent('value-change-end', { detail: { value }, bubbles: true, composed: true }),
        ),
      onUpdate: () => this.syncFormValue(),
    }));
    this.runtime.update();
  }
  override render(): TemplateResult {
    const input = this.input();
    const values = this.state.values(input);
    const fractions = values.map((value) => sliderFraction(value, input));
    const bounds = sliderBounds(input);
    const start = values.length === 2 ? (fractions[0] ?? 0) : 0;
    const end = fractions.at(-1) ?? 0;
    const large = this.variant === 'large';
    const label = this.label || 'Value';
    const description = [
      this.helper ? `${this.fieldId}-helper` : '',
      this.invalid && this.error ? `${this.fieldId}-error` : '',
    ]
      .filter(Boolean)
      .join(' ');
    return html`<div data-lab-slider data-variant=${this.variant} data-orientation=${this.orientation}
      ?data-disabled=${input.disabled} ?data-readonly=${this.readonly} ?data-invalid=${this.invalid}
      ?data-range=${values.length === 2} ?data-empty=${end === 0}
      style=${styleMap({ '--_slider-start': `${start * 100}%`, '--_slider-end': `${end * 100}%` })}>
      ${
        !large && ((!this.labelHidden && this.label) || this.showValue)
          ? html`<div class="lab-slider-label-row">
        <span class=${this.labelHidden ? 'lab-slider-hidden' : 'lab-slider-label'}>${this.label}</span>
        ${this.showValue ? html`<span class="lab-slider-value-text">${values.join(' – ')}</span>` : nothing}
      </div>`
          : nothing
      }
      <div class="lab-slider-control" part="control">
        ${
          this.variant === 'circular'
            ? html`<svg class="lab-slider-circle" viewBox=${`0 0 ${circle.diameter} ${circle.diameter}`} aria-hidden="true"><circle cx=${circle.center} cy=${circle.center} r=${circle.radius}/><path class="lab-slider-arc" d=${sliderArc(start, end)}/></svg>`
            : large
              ? html`<span class="lab-slider-large-label" aria-hidden="true"><span>${label}</span></span><div class="lab-slider-large-fill" aria-hidden="true"><span class="lab-slider-large-label"><span>${label}</span></span></div>`
              : html`<div class="lab-slider-track" part="track"></div><div class="lab-slider-range" part="range"></div>`
        }
        ${values.map(
          (value, index) => html`<span class="lab-slider-thumb" data-thumb-index=${index}
          style=${sliderThumbStyle(fractions[index] ?? 0, this.variant, this.orientation === 'vertical')} part="thumb">
          ${large ? html`<span class="lab-slider-large-mask" aria-hidden="true"></span>` : nothing}
          <span class="lab-slider-thumb-visual" aria-hidden="true"></span>
          <input type="range" aria-label=${this.thumbLabels[index] || (values.length === 1 ? label : `${label} ${index === 0 ? 'minimum' : 'maximum'}`)}
            aria-orientation=${this.orientation} aria-readonly=${this.readonly ? 'true' : nothing}
            aria-invalid=${this.invalid ? 'true' : nothing} aria-describedby=${description || nothing}
            aria-errormessage=${this.invalid && this.error ? `${this.fieldId}-error` : nothing}
            min=${values[index - 1] ?? bounds.min} max=${values[index + 1] ?? bounds.max}
            step=${bounds.step} value=${value} ?disabled=${input.disabled}/>
        </span>`,
        )}
      </div>
      ${this.helper ? html`<span class="lab-slider-helper" id=${`${this.fieldId}-helper`}>${this.helper}</span>` : nothing}
      ${this.invalid && this.error ? html`<span class="lab-slider-error" id=${`${this.fieldId}-error`} role="alert">${this.error}</span>` : nothing}
    </div>`;
  }
}
declare global {
  interface HTMLElementTagNameMap {
    'lab-slider': LabSlider;
  }
}
if (typeof customElements !== 'undefined' && !customElements.get('lab-slider'))
  customElements.define('lab-slider', LabSlider);
