import { progressProfile } from '@labpics/ui-tokens';
import { type PropertyValues, type TemplateResult, css, html, nothing, unsafeCSS } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';
import { LabElement } from '../../lit/lab-element.js';
import {
  type LabProgressSize,
  type LabProgressVariant,
  progressState,
  progressValueConverter,
} from './contract.js';
import { type ProgressMotion, mountProgressMotion } from './runtime.js';
import { progressCss } from './styles.js';
export type { LabProgressSize, LabProgressVariant } from './contract.js';

/** A measured fraction or an explicitly unknown value, in the authored linear/circular drawing. */
export class LabProgress extends LabElement {
  static override properties = {
    size: { reflect: true },
    variant: { reflect: true },
    value: { reflect: true, converter: progressValueConverter },
    min: { type: Number, reflect: true },
    max: { type: Number, reflect: true },
    label: { reflect: true },
    showValueText: { attribute: 'show-value-text', type: Boolean, reflect: true },
  };
  declare size: LabProgressSize;
  declare variant: LabProgressVariant;
  declare value: number | null;
  declare min: number;
  declare max: number;
  declare label: string;
  declare showValueText: boolean;
  private motion?: ProgressMotion;
  private motionKind?: LabProgressVariant;
  constructor() {
    super();
    this.size = 'm';
    this.variant = 'linear';
    this.value = null;
    this.min = 0;
    this.max = 100;
    this.label = '';
    this.showValueText = false;
  }
  static override styles = [
    unsafeCSS(progressCss),
    css`:host{display:block;min-inline-size:0;max-inline-size:100%;}:host([variant='circular']){display:inline-flex;}`,
  ];
  override connectedCallback(): void {
    super.connectedCallback();
    this.requestUpdate();
  }
  override updated(_changed: PropertyValues): void {
    const root = this.renderRoot.querySelector<HTMLElement>('.lab-progress-root');
    if (root) {
      if (this.motionKind !== this.variant) {
        this.motion?.dispose();
        this.motion = undefined;
        this.motionKind = this.variant;
      }
      this.motion ??= mountProgressMotion(root, this.variant);
      const state = progressState(this.value, this.min, this.max);
      this.motion.update(state.value === null ? null : state.fraction);
    }
  }
  override disconnectedCallback(): void {
    this.motion?.dispose();
    this.motion = undefined;
    super.disconnectedCallback();
  }
  override render(): TemplateResult {
    const state = progressState(this.value, this.min, this.max);
    const unknown = state.value === null;
    const showText = this.showValueText && !unknown;
    const circular = this.variant === 'circular';
    const metrics = progressProfile.sizes[this.size] ?? progressProfile.sizes.m;
    const radius = (metrics.circularDiameter - metrics.circularStroke) / 2;
    return html`<div class="lab-progress-root" data-size=${this.size} data-variant=${this.variant} data-state=${state.status} style=${styleMap({ '--_progress-target': state.fraction })}>
      ${this.label || (!circular && showText) ? html`<div class="lab-progress-meta">${this.label ? html`<span class="lab-progress-label">${this.label}</span>` : nothing}${showText && !circular ? html`<span class="lab-progress-value-text">${state.text}</span>` : nothing}</div>` : nothing}
      <div class=${circular ? 'lab-progress-circle' : 'lab-progress-track'} data-state=${state.status} ?data-zero=${!unknown && state.fraction === 0}
        role="progressbar" aria-label=${this.label || this.getAttribute('aria-label') || 'Ход выполнения'} aria-valuemin=${state.min} aria-valuemax=${state.max} aria-valuenow=${state.value ?? nothing} aria-valuetext=${unknown ? nothing : state.text}>
        ${circular ? html`<svg viewBox=${`0 0 ${metrics.circularDiameter} ${metrics.circularDiameter}`} aria-hidden="true"><circle cx="50%" cy="50%" r=${radius} fill="none" stroke=${`var(--lab-${progressProfile.trackRole})`} stroke-width=${metrics.circularStroke}></circle><g class="lab-progress-spin"><circle class="lab-progress-arc" cx="50%" cy="50%" r=${radius} fill="none" stroke="currentColor" stroke-width=${metrics.circularStroke} pathLength="1" transform=${`rotate(-90 ${metrics.circularDiameter / 2} ${metrics.circularDiameter / 2})`}></circle></g></svg>${showText ? html`<span class="lab-progress-value-text" aria-hidden="true"><span>${state.text}</span></span>` : nothing}` : html`<div class="lab-progress-range lab-progress-spin" aria-hidden="true"></div>`}
      </div></div>`;
  }
}
declare global {
  interface HTMLElementTagNameMap {
    'lab-progress': LabProgress;
  }
}
if (typeof customElements !== 'undefined' && !customElements.get('lab-progress'))
  customElements.define('lab-progress', LabProgress);
