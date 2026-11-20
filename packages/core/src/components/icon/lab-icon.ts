import {
  type IconController,
  type IconEffectOptions,
  type IconOptions,
  type IconSymbol,
  type IconVariant,
  type TypographyScale,
  type TypographySize,
  createIconController,
  iconMarkup,
  resolveTypographySize,
} from '@labpics/ui-core/icon/runtime';
import { type PropertyValues, css, html } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { LabElement } from '../../lit/lab-element.js';

/** A reflected ISO instant keeps Date a real client property without resource packets in HTML. */
const dateConverter = {
  fromAttribute: (value: string | null): Date | undefined =>
    value === null ? undefined : new Date(value),
  toAttribute: (value: Date | undefined): string | null => value?.toISOString() ?? null,
};

export class LabIcon extends LabElement implements IconOptions {
  static override properties = {
    symbol: { attribute: false, resource: true },
    variant: { reflect: true },
    size: { attribute: false },
    scale: { attribute: false },
    weight: { type: Number },
    opsz: { attribute: false },
    state: {},
    date: { converter: dateConverter, reflect: true },
    timeZone: { attribute: 'time-zone' },
    duration: { type: Number },
    reducedMotion: { type: Boolean, attribute: 'reduced-motion' },
    effect: {},
    effectKey: { attribute: false },
    label: {},
  };
  declare symbol: IconSymbol | null | undefined;
  declare variant: IconVariant | undefined;
  declare size: TypographySize;
  declare scale: TypographyScale | undefined;
  declare weight: number;
  declare opsz: number | 'auto';
  declare state: string | undefined;
  declare date: Date | undefined;
  declare timeZone: string | undefined;
  declare duration: number;
  declare reducedMotion: boolean;
  declare effect: string | undefined;
  declare effectKey: string | number | undefined;
  declare label: string;
  private controller?: IconController;
  private firstMarkup?: string;
  constructor() {
    super();
    this.size = 24;
    this.weight = 400;
    this.opsz = 'auto';
    this.duration = 180;
    this.reducedMotion = false;
    this.label = '';
  }
  static override styles =
    css`:host{display:inline-flex;flex:none;line-height:0;vertical-align:middle}span{display:inline-flex;flex:none;line-height:0}.artwork{width:100%;height:100%}`;
  override connectedCallback(): void {
    super.connectedCallback();
    this.requestUpdate();
  }
  override updated(_changed: PropertyValues): void {
    if (!this.isConnected) return;
    const root = this.renderRoot.querySelector<HTMLElement>('.artwork');
    if (!root) return;
    if (!this.controller) this.controller = createIconController(root, this.options());
    else this.controller.update(this.options());
  }
  private options(): IconOptions {
    return {
      symbol: this.symbol,
      variant: this.variant,
      size: this.size,
      scale: this.scale,
      weight: this.weight,
      opsz: this.opsz,
      state: this.state,
      date: this.date,
      timeZone: this.timeZone,
      duration: this.duration,
      reducedMotion: this.reducedMotion,
      effect: this.effect,
      effectKey: this.effectKey,
    };
  }
  async playEffect(name: string, options?: IconEffectOptions) {
    await this.updateComplete;
    return this.controller?.playEffect(name, options) ?? null;
  }
  override disconnectedCallback(): void {
    this.controller?.dispose();
    this.controller = undefined;
    super.disconnectedCallback();
  }
  override render() {
    // The opaque artwork subtree belongs to the controller. Lit's part markers
    // stay outside it, including when motion replaces the initial server SVG.
    if (!this.controller) this.firstMarkup = `<span class="artwork">${iconMarkup(this)}</span>`;
    const size = resolveTypographySize(this.size, this.scale).css;
    return html`<span aria-hidden=${this.label ? 'false' : 'true'} role=${this.label ? 'img' : 'presentation'} aria-label=${this.label} style=${styleMap({ width: size, height: size })}>${unsafeHTML(this.firstMarkup)}</span>`;
  }
}
declare global {
  interface HTMLElementTagNameMap {
    'lab-icon': LabIcon;
  }
}
if (typeof customElements !== 'undefined' && !customElements.get('lab-icon'))
  customElements.define('lab-icon', LabIcon);
