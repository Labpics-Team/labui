import { LabMenuPopup } from './lab-menu-base.js';
export type { LabMenuItem, LabMenuPlacement, LabMenuTone } from './contract.js';

/** Authored dropdown menu with action, check, radio and nested items. */
export class LabMenu extends LabMenuPopup {}
declare global {
  interface HTMLElementTagNameMap {
    'lab-menu': LabMenu;
  }
}
if (typeof customElements !== 'undefined' && !customElements.get('lab-menu'))
  customElements.define('lab-menu', LabMenu);
