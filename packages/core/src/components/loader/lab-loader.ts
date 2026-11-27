import { loaderProfile } from '@labpics/ui-tokens';
import { type PropertyValues, type TemplateResult, css, html, nothing, svg, unsafeCSS } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';
import { LabElement } from '../../lit/lab-element.js';
import { type LabLoaderSize, progressState, progressValueConverter } from '../progress/contract.js';
import { type ProgressMotion, mountProgressMotion } from '../progress/runtime.js';
import { progressCss } from '../progress/styles.js';
export type { LabLoaderSize } from '../progress/contract.js';

/** Compact authored feedback: eight-spoke waiting, medium sector or large ring for a measured value. */
export class LabLoader extends LabElement {
  static override properties = {
    size: { reflect: true },
    label: { reflect: true },
    value: { reflect: true, converter: progressValueConverter },
    min: { type: Number, reflect: true },
    max: { type: Number, reflect: true },
  };
  declare size: LabLoaderSize;
  declare label: string;
  declare value: number | null;
  declare min: number;
  declare max: number;
  private motion?: ProgressMotion;
  constructor() {
    super();
    this.size = 'm';
    this.label = 'Загрузка';
    this.value = null;
    this.min = 0;
    this.max = 100;
  }
  static override styles = [
    unsafeCSS(progressCss),
    css`:host{display:inline-flex;vertical-align:middle;color:var(--lab-label-primary);}.lab-loader{color:inherit;}`,
  ];
  override connectedCallback(): void {
    super.connectedCallback();
    this.requestUpdate();
  }
  override updated(_changed: PropertyValues): void {
    const root = this.renderRoot.querySelector<HTMLElement>('.lab-loader');
    if (root) {
      this.motion ??= mountProgressMotion(root, 'loader');
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
    const center = loaderProfile.viewBox / 2;
    const medium = loaderProfile.determinate.medium;
    const large = loaderProfile.determinate.large;
    return html`<span class="lab-loader" data-size=${this.size} data-state=${state.status} style=${styleMap({ '--_progress-target': state.fraction })}
      role="progressbar" aria-label=${this.getAttribute('aria-label') ?? this.label} aria-valuemin=${state.min} aria-valuemax=${state.max} aria-valuenow=${state.value ?? nothing} aria-valuetext=${unknown ? nothing : state.text}>
      <svg viewBox=${`0 0 ${loaderProfile.viewBox} ${loaderProfile.viewBox}`} aria-hidden="true" style=${unknown ? '' : 'display:none'}><g class="lab-progress-spin">${loaderProfile.spokeOpacity.map((opacity, index) => svg`<rect x=${loaderProfile.segment.x} y=${loaderProfile.segment.y} width=${loaderProfile.segment.width} height=${loaderProfile.segment.height} rx=${loaderProfile.segment.radius} fill="currentColor" opacity=${opacity} transform=${`rotate(${(index * 360) / loaderProfile.spokeOpacity.length} ${loaderProfile.viewBox / 2} ${loaderProfile.viewBox / 2})`}></rect>`)}</g></svg>
      <svg viewBox=${`0 0 ${loaderProfile.viewBox} ${loaderProfile.viewBox}`} aria-hidden="true" style=${unknown ? 'display:none' : ''}>
        <circle class="lab-loader-medium" cx=${center} cy=${center} r=${medium.ringRadius} fill="none" stroke="currentColor" stroke-width=${medium.stroke}></circle>
        <g class="lab-loader-large"><circle cx=${center} cy=${center} r=${large.ringRadius} fill="none" stroke=${`var(--lab-${large.trackRole})`} stroke-width=${large.stroke}></circle>
          <circle class="lab-progress-arc" cx=${center} cy=${center} r=${large.ringRadius} fill="none" stroke="currentColor" stroke-width=${large.stroke} pathLength="1" transform=${`rotate(-90 ${center} ${center})`} visibility=${state.fraction === 0 ? 'hidden' : 'visible'}></circle></g>
      </svg><span class="lab-loader-sector" aria-hidden="true" style=${unknown ? 'display:none' : ''}></span>
    </span>`;
  }
}
declare global {
  interface HTMLElementTagNameMap {
    'lab-loader': LabLoader;
  }
}
if (typeof customElements !== 'undefined' && !customElements.get('lab-loader'))
  customElements.define('lab-loader', LabLoader);
