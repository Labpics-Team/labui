import { materialCss } from '@labpics/ui-materials/css';
import { type TemplateResult, css, html, nothing, unsafeCSS } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { styleMap } from 'lit/directives/style-map.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { LabElement } from '../../lit/lab-element.js';
import { type IconSymbol, iconMarkup } from '../icon/runtime.js';
import '../segmented-control/index.js';
import '../switch/index.js';
import {
  ColorPickerState,
  type ColorPlane,
  type LabColorModel,
  type LabColorPickerVariant,
  type LabColorValue,
  channelGradient,
  clamp,
  colorChannelText,
  colorChannels,
  colorCoords,
  colorCss,
  colorDisplay,
  colorPalette,
  colorPickerModels,
  colorPickerVariants,
  colorPlaneAxes,
  defaultColor,
  displayNumber,
  parseColor,
  serializeColor,
} from './contract.js';
import { colorChevron, colorClose, colorComponent, colorCopy, colorEyedropper } from './icons.js';
import { type ColorPickerRuntime, mountColorPicker } from './runtime.js';
import { colorPickerCss } from './styles.js';
export type { LabColorValue, LabColorModel, LabColorPickerVariant } from './contract.js';

/** Authored color panel. Value is structured and lossless; view/model are independent projections. */
export class LabColorPicker extends LabElement {
  static formAssociated = true;
  static override properties = {
    value: {
      converter: {
        fromAttribute: (raw: string | null) => (raw === null ? undefined : parseColor(raw)),
      },
    },
    defaultValue: { attribute: 'default-value', converter: { fromAttribute: parseColor } },
    variant: {},
    model: {},
    defaultVariant: { attribute: 'default-variant' },
    defaultModel: { attribute: 'default-model' },
    label: {},
    name: { reflect: true },
    form: { reflect: true },
    disabled: { type: Boolean, reflect: true },
    readonly: { type: Boolean, reflect: true },
    required: { type: Boolean, reflect: true },
    disabledByForm: { state: true },
    pickScreenColor: { attribute: false },
  };
  declare value: LabColorValue | null | undefined;
  declare defaultValue: LabColorValue | null | undefined;
  declare variant: LabColorPickerVariant | undefined;
  declare model: LabColorModel | undefined;
  declare defaultVariant: LabColorPickerVariant | undefined;
  declare defaultModel: LabColorModel | undefined;
  declare label: string;
  declare name: string;
  declare form: string | null;
  declare disabled: boolean;
  declare readonly: boolean;
  declare required: boolean;
  declare pickScreenColor: ((signal: AbortSignal) => Promise<LabColorValue | null>) | undefined;
  private declare disabledByForm: boolean;
  private readonly state = new ColorPickerState();
  private runtime?: ColorPickerRuntime;
  private readonly internals?: ElementInternals;
  constructor() {
    super();
    this.label = 'Colors';
    this.name = '';
    this.form = null;
    this.disabled = false;
    this.readonly = false;
    this.required = false;
    this.disabledByForm = false;
    if (typeof ElementInternals !== 'undefined') this.internals = this.attachInternals();
  }
  static override styles = [
    css`:host { display:block; min-inline-size:0; max-inline-size:100%; }`,
    unsafeCSS(materialCss),
    unsafeCSS(colorPickerCss),
  ];
  private input() {
    return {
      value: this.value,
      defaultValue: this.defaultValue,
      variant: this.variant,
      model: this.model,
      defaultVariant: this.defaultVariant,
      defaultModel: this.defaultModel,
      disabled: this.disabled || this.disabledByForm,
      readOnly: this.readonly,
      required: this.required,
      name: this.name,
      form: this.form,
      pickScreenColor: this.pickScreenColor,
    };
  }
  get selectedValue() {
    return this.state.value(this.input());
  }
  formDisabledCallback(disabled: boolean) {
    this.disabledByForm = disabled;
  }
  formResetCallback() {
    this.state.reset(this.input());
    this.runtime?.reset();
    this.requestUpdate();
  }
  override disconnectedCallback() {
    this.runtime?.dispose();
    this.runtime = undefined;
    super.disconnectedCallback();
  }
  protected override updated() {
    const root = this.renderRoot.querySelector<HTMLElement>('[data-lab-color-picker]');
    if (!root) return;
    this.runtime ??= mountColorPicker(root, this.state, () => ({
      ...this.input(),
      onValueChange: (value) =>
        this.dispatchEvent(
          new CustomEvent('value-change', { detail: { value }, bubbles: true, composed: true }),
        ),
      onValueChangeEnd: (value) =>
        this.dispatchEvent(
          new CustomEvent('value-change-end', { detail: { value }, bubbles: true, composed: true }),
        ),
      onModelChange: (value) =>
        this.dispatchEvent(
          new CustomEvent('model-change', { detail: { value }, bubbles: true, composed: true }),
        ),
      onVariantChange: (value) =>
        this.dispatchEvent(
          new CustomEvent('variant-change', { detail: { value }, bubbles: true, composed: true }),
        ),
      onClose: () =>
        this.dispatchEvent(new CustomEvent('close-request', { bubbles: true, composed: true })),
      onUpdate: () => this.requestUpdate(),
      onFormValue: (value, missing) => {
        this.internals?.setFormValue(this.input().disabled || !this.name ? null : value);
        this.internals?.setValidity(
          missing ? { valueMissing: true } : {},
          missing ? 'Choose a color.' : '',
          this.renderRoot.querySelector<HTMLInputElement>('[data-validity]') ?? undefined,
        );
      },
    }));
    this.runtime.update();
  }
  private plane(value: LabColorValue, plane: ColorPlane): TemplateResult {
    const axes = colorPlaneAxes(value, plane, this.state.showRec2020);
    const disabled = this.input().disabled;
    return html`<fieldset class="lab-color-plane" data-plane=${plane} aria-label=${`${axes.xLabel} and ${axes.yLabel}`} style=${styleMap({ '--_color-x': `${clamp(axes.x / axes.xMax) * 100}%`, '--_color-y': `${clamp(axes.y / axes.yMax) * 100}%` })}>
      ${plane !== 'spectrum' ? html`<canvas data-graph=${plane} aria-hidden="true"></canvas>` : nothing}<span class="lab-color-marker"></span>
      <input class="lab-color-hidden" type="range" data-axis="x" aria-label=${axes.xLabel} min="0" max=${axes.xMax} step="any" .value=${String(axes.x)} ?disabled=${disabled} aria-readonly=${this.readonly ? 'true' : nothing}/>
      <input class="lab-color-hidden" type="range" data-axis="y" aria-label=${axes.yLabel} min="0" max=${axes.yMax} step="any" .value=${String(axes.y)} ?disabled=${disabled} aria-readonly=${this.readonly ? 'true' : nothing}/>
    </fieldset>`;
  }
  override render() {
    const input = this.input();
    const { variant, model } = this.state.view(input);
    const accepted = this.state.value(input);
    const value = accepted ?? defaultColor;
    const channels = colorChannels(value, model, variant, this.state.showRec2020);
    const rgb = colorCoords(value, 'srgb');
    const palette = colorPalette(model);
    const selected = palette.colors.findIndex((s) =>
      s.coords.every((c, i) => Math.abs(c - rgb[i as 0 | 1 | 2]) < 1e-7),
    );
    const blocked = input.disabled || this.readonly;
    const icon = (symbol: IconSymbol, size = 24) =>
      html`<span style=${styleMap({ display: 'inline-flex', flex: 'none', width: `${size}px`, height: `${size}px` })} aria-hidden="true">${unsafeHTML(iconMarkup({ symbol, size, variant: symbol.id === 'eyedrop' ? 'filled' : 'outline' }))}</span>`;
    const graphNames = ['h', 'l', 'c'] as const;
    return html`<fieldset data-lab-color-picker class="lab-material lab-material--elevated" data-variant=${variant} data-model=${model} aria-label=${this.label} style=${styleMap({ '--_color-columns': String(palette.columns), '--_color-selected': colorCss(value), '--_color-hue': colorCss({ space: 'hsv', coords: [colorCoords(value, 'hsv')[0], 100, 100], alpha: 1 }) })}>
      <header class="lab-color-header"><button class="lab-color-action" data-action="eyedropper" type="button" aria-label="Pick a color" ?disabled=${blocked}>${icon(colorEyedropper)}</button><span class="lab-color-heading">${this.label}</span><button class="lab-color-action" data-action="close" type="button" aria-label="Close color picker">${icon(colorClose)}</button></header>
      <lab-segmented-control .items=${colorPickerVariants} .value=${variant} label="Color selection method" .disabled=${input.disabled} @value-change=${(
        event: CustomEvent<{ value: LabColorPickerVariant }>,
      ) => {
        event.stopPropagation();
        this.runtime?.setVariant(event.detail.value);
      }}></lab-segmented-control>
      ${variant !== 'sliders' ? html`<div class="lab-color-view">${variant === 'spectrum' ? (model === 'lch' ? html`<div class="lab-color-lch-spectrum">${this.plane(value, 'h')}${this.plane(value, 'l')}</div>` : this.plane(value, 'spectrum')) : html`<div class="lab-color-grid" role="radiogroup" aria-label="Color palette">${palette.colors.map((swatch, index) => html`<button type="button" class="lab-color-swatch" data-swatch=${index} role="radio" aria-label=${`Color ${index + 1}: ${colorDisplay(swatch, 'hex')}`} aria-checked=${index === selected ? 'true' : 'false'} tabindex=${index === Math.max(0, selected) ? 0 : -1} ?disabled=${blocked} style=${styleMap({ background: colorCss(swatch) })}></button>`)}</div>`}</div>` : nothing}
      <div class="lab-color-channels">${repeat(
        channels,
        (channel) => channel.key,
        (channel) =>
          html`<div class="lab-color-channel"><div><span class="lab-color-channel-label">${channel.label}</span>${model === 'lch' && variant === 'sliders' && channel.index < 3 && this.state.showGraphs ? this.plane(value, graphNames[channel.index as 0 | 1 | 2]) : nothing}<div class="lab-color-channel-track" style=${styleMap({ '--_color-gradient': channelGradient(value, channel, this.state.showP3, this.state.showRec2020), '--_color-fraction': String(clamp(channel.value / channel.max)) })}><span class="lab-color-channel-paint"></span><span class="lab-color-channel-thumb"></span><input class="lab-color-range" type="range" data-channel=${channel.key} aria-label=${channel.label} min="0" max=${channel.max} step="any" .value=${String(channel.value)} ?disabled=${input.disabled} aria-readonly=${this.readonly ? 'true' : nothing}/></div></div><input class="lab-color-number" data-channel=${channel.key} aria-label=${`${channel.label} value`} inputmode=${channel.hexadecimal ? 'text' : 'decimal'} value=${colorChannelText(channel)} ?disabled=${input.disabled} ?readonly=${this.readonly}/></div>`,
      )}</div>
      <hr class="lab-color-separator"/>
      <div class="lab-color-footer"><label class="lab-color-model">${icon(colorComponent, 16)}<span class="lab-color-model-label">${model.toUpperCase()}</span>${icon(colorChevron, 16)}<select data-model aria-label="Color model" .value=${model} ?disabled=${input.disabled} @change=${(event: Event) => this.runtime?.setModel((event.target as HTMLSelectElement).value as LabColorModel)}>${colorPickerModels.map((m) => html`<option value=${m}>${m.toUpperCase()}</option>`)}</select></label>
      ${
        model === 'hex' || model === 'lch'
          ? html`<div class="lab-color-text-field"><span class="lab-color-dot"></span><input data-color-text aria-label=${`${model.toUpperCase()} color`} value=${accepted ? colorDisplay(value, model) : ''} ?disabled=${input.disabled} ?readonly=${this.readonly}/><button class="lab-color-action" data-action="copy" type="button" aria-label="Copy color" ?disabled=${!accepted}>${icon(colorCopy, 20)}</button></div>`
          : html`<div class="lab-color-coordinates">${colorChannels(
              value,
              model,
              'sliders',
              this.state.showRec2020,
            )
              .slice(0, 3)
              .map(
                (channel, index) =>
                  html`<input class="lab-color-coordinate" data-coordinate=${index + 1} inputmode="decimal" aria-label=${`${model.toUpperCase()} ${channel.label}`} value=${displayNumber(channel.value)} ?disabled=${input.disabled} ?readonly=${this.readonly}/>`,
              )}</div>`
      }</div>
      ${model === 'lch' && variant !== 'grid' ? html`<hr class="lab-color-separator"/><div class="lab-color-options">${(variant === 'sliders' ? (['showGraphs', 'showP3', 'showRec2020'] as const) : (['showP3', 'showRec2020'] as const)).map((key) => html`<lab-switch .checked=${this.state[key]} controlled .disabled=${input.disabled} @checked-change=${(event: CustomEvent<{ checked: boolean }>) => this.runtime?.toggle(key, event.detail.checked)}><span >${key === 'showGraphs' ? 'Show graphs' : key === 'showP3' ? 'Show P3' : 'Show Rec2020'}</span></lab-switch>`)}</div>` : nothing}
      <input data-form-value type="hidden" value=${serializeColor(accepted)}/>
      <input class="lab-color-hidden" data-validity aria-label="Selected color" tabindex="-1" ?disabled=${input.disabled} ?readonly=${this.readonly}/>
      <span role="status" class="lab-color-hidden">${this.state.status}</span>
    </fieldset>`;
  }
}
declare global {
  interface HTMLElementTagNameMap {
    'lab-color-picker': LabColorPicker;
  }
}
if (typeof customElements !== 'undefined' && !customElements.get('lab-color-picker'))
  customElements.define('lab-color-picker', LabColorPicker);
