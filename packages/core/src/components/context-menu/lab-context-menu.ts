import { type TemplateResult, html } from 'lit';
import { LabMenuPopup } from '../menu/lab-menu-base.js';
export type { LabMenuItem, LabMenuPlacement, LabMenuTone } from '../menu/contract.js';

/** Context actions: right click, long press, ContextMenu key or Shift+F10. */
export class LabContextMenu extends LabMenuPopup {
  protected override variant = 'context' as const;
  protected override renderControl(): TemplateResult {
    return html`<div data-menu-trigger class="lab-menu-context-trigger" part="trigger" tabindex="0" aria-label=${this.label}><slot>${this.label}</slot></div>`;
  }
}
declare global {
  interface HTMLElementTagNameMap {
    'lab-context-menu': LabContextMenu;
  }
}
if (typeof customElements !== 'undefined' && !customElements.get('lab-context-menu'))
  customElements.define('lab-context-menu', LabContextMenu);
