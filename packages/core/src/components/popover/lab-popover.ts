import { LabDialog } from '../dialog/lab-dialog.js';
import type { LabPopoverPlacement } from '../dialog/runtime.js';
export type { LabPopoverPlacement } from '../dialog/runtime.js';
export type { LabDialogSize as LabPopoverSize } from '../dialog/runtime.js';

/** Interactive supplementary content anchored to one real control. */
export class LabPopover extends LabDialog {
  static override properties = {
    placement: { reflect: true },
    arrow: {
      reflect: true,
      useDefault: true,
      converter: {
        fromAttribute: (value: string | null) => value !== 'false',
        toAttribute: (value: boolean) => String(value),
      },
    },
  };
  protected override anchored = true;
  declare placement: LabPopoverPlacement;
  declare arrow: boolean;
  constructor() {
    super();
    this.modal = false;
    this.closable = false;
    this.placement = 'bottom';
    this.arrow = true;
  }
}
declare global {
  interface HTMLElementTagNameMap {
    'lab-popover': LabPopover;
  }
}
if (typeof customElements !== 'undefined' && !customElements.get('lab-popover'))
  customElements.define('lab-popover', LabPopover);
