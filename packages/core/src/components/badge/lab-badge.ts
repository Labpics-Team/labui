import { type TemplateResult, css, html, unsafeCSS } from 'lit';
import { LabElement } from '../../lit/lab-element.js';
import {
  type LabBadgeColor,
  type LabBadgeType,
  badgeColor,
  badgeDefaultColor,
} from './contract.js';
import { badgeCss } from './styles.js';

export type { LabBadgeColor, LabBadgeType } from './contract.js';

/** Author Badge: a presentational label with optional decorative signs. */
export class LabBadge extends LabElement {
  static override properties = {
    color: { reflect: true },
    type: { reflect: true },
    disabled: { type: Boolean, reflect: true },
  };
  declare color: LabBadgeColor;
  declare type: LabBadgeType;
  declare disabled: boolean;

  constructor() {
    super();
    this.color = badgeDefaultColor;
    this.type = 'fill';
    this.disabled = false;
  }

  static override styles = [
    css`:host { display: inline-flex; vertical-align: middle; }`,
    unsafeCSS(badgeCss),
  ];

  override render(): TemplateResult {
    return html`<span class="badge" part="badge" data-lab-badge data-color=${badgeColor(this.color)} data-type=${this.type} data-disabled=${this.disabled}>
      <slot name="icon" class="lab-badge-icon" aria-hidden="true"></slot>
      <slot name="dot" class="lab-badge-dot" aria-hidden="true"></slot>
      <span class="lab-badge-label" part="label"><slot></slot></span>
      <slot name="icon-end" class="lab-badge-icon" aria-hidden="true"></slot>
    </span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lab-badge': LabBadge;
  }
}
if (typeof customElements !== 'undefined' && !customElements.get('lab-badge'))
  customElements.define('lab-badge', LabBadge);
