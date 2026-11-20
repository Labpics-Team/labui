import { type TemplateResult, html } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import type { LabMenubarItem } from '../menu/contract.js';
import { LabMenuBase } from '../menu/lab-menu-base.js';
import type { MenuOptions } from '../menu/runtime.js';
export type { LabMenuItem, LabMenubarItem, LabMenuTone } from '../menu/contract.js';

/** Horizontal menu commands with one open root and RTL-aware arrow navigation. */
export class LabMenubar extends LabMenuBase {
  static override properties = {
    menus: { type: Array },
    value: {},
    defaultValue: { attribute: 'default-value' },
  };
  declare menus: readonly LabMenubarItem[];
  declare value: string | null | undefined;
  declare defaultValue: string | null;
  protected override variant = 'menubar' as const;
  constructor() {
    super();
    this.menus = [];
    this.defaultValue = null;
  }
  protected override configuration(): Partial<MenuOptions> & Pick<MenuOptions, 'items'> {
    return { items: [], menus: this.menus, value: this.value, defaultValue: this.defaultValue };
  }
  protected override changedValue(value: string | null): void {
    this.dispatchEvent(
      new CustomEvent('value-change', { detail: { value }, bubbles: true, composed: true }),
    );
  }
  protected override renderControl(): TemplateResult {
    return html`<div data-menu-bar class="lab-menubar lab-material lab-material--soft" role="menubar" aria-label=${this.label}>
      ${repeat(
        this.menus,
        (root) => root.value,
        (root) =>
          html`<button type="button" class="lab-menubar-item" data-menu-root=${root.value} role="menuitem" aria-haspopup="menu" aria-expanded="false" tabindex=${root === this.menus.find((r) => !r.disabled) ? 0 : -1} ?disabled=${this.disabled || root.disabled}>${root.label}</button>`,
      )}
    </div>`;
  }
}
declare global {
  interface HTMLElementTagNameMap {
    'lab-menubar': LabMenubar;
  }
}
if (typeof customElements !== 'undefined' && !customElements.get('lab-menubar'))
  customElements.define('lab-menubar', LabMenubar);
