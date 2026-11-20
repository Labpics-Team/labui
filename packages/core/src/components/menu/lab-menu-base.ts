import { materialCss } from '@labpics/ui-materials/css';
import { type PropertyDeclarations, type TemplateResult, css, html, unsafeCSS } from 'lit';
import { LabElement } from '../../lit/lab-element.js';
import { type LabMenuItem, type LabMenuPlacement, menuItemsConverter } from './contract.js';
import { type MenuOptions, type MenuVariant, mountMenu } from './runtime.js';
import { menuCss } from './styles.js';

/** Shared state contract; undefined selects the corresponding default state. */
export class LabMenuBase extends LabElement {
  static override properties: PropertyDeclarations = {
    label: {},
    placement: {},
    disabled: { type: Boolean, reflect: true },
    checkedValues: { type: Array, attribute: 'checked-values' },
    defaultCheckedValues: { type: Array, attribute: 'default-checked-values' },
  };
  declare label: string;
  declare placement: LabMenuPlacement;
  declare disabled: boolean;
  declare checkedValues: readonly string[] | undefined;
  declare defaultCheckedValues: readonly string[];
  protected variant: MenuVariant = 'dropdown';
  private controller?: ReturnType<typeof mountMenu>;
  constructor() {
    super();
    this.label = 'Menu';
    this.placement = 'bottom-start';
    this.disabled = false;
    this.defaultCheckedValues = [];
  }
  static override styles = [
    css`:host { display: inline-block; vertical-align: middle; }`,
    unsafeCSS(materialCss),
    unsafeCSS(menuCss),
  ];
  private options(): MenuOptions {
    return {
      ...this.configuration(),
      variant: this.variant,
      label: this.label,
      placement: this.placement,
      disabled: this.disabled,
      checkedValues: this.checkedValues,
      defaultCheckedValues: this.defaultCheckedValues,
      onOpenChange: (open) => this.changedOpen(open),
      onValueChange: (value) => this.changedValue(value),
      onCheckedValuesChange: (values) =>
        this.dispatchEvent(
          new CustomEvent('checked-values-change', {
            detail: { values },
            bubbles: true,
            composed: true,
          }),
        ),
      onSelect: (value) =>
        this.dispatchEvent(
          new CustomEvent('select', { detail: { value }, bubbles: true, composed: true }),
        ),
    };
  }
  protected configuration(): Partial<MenuOptions> & Pick<MenuOptions, 'items'> {
    return { items: [] };
  }
  protected changedOpen(_open: boolean): void {}
  protected changedValue(_value: string | null): void {}
  override connectedCallback(): void {
    super.connectedCallback();
    this.requestUpdate();
  }
  override disconnectedCallback(): void {
    this.controller?.dispose();
    this.controller = undefined;
    super.disconnectedCallback();
  }
  override updated(): void {
    const host = this.renderRoot.querySelector<HTMLElement>('.lab-menu-family');
    if (!host || !this.isConnected) return;
    if (!this.controller) this.controller = mountMenu(host, this.options());
    else this.controller.update(this.options());
  }
  override render(): TemplateResult {
    return html`<div class="lab-menu-family">
      ${this.renderControl()}
      <div data-menu-panels></div>
    </div>`;
  }
  protected renderControl(): TemplateResult {
    return html`<button data-menu-trigger class="lab-menu-trigger" type="button" part="trigger" aria-haspopup="menu" aria-expanded="false" ?disabled=${this.disabled}>${this.label}</button>`;
  }
}

/** Popup-only inputs; Menubar exposes its root selection separately. */
export class LabMenuPopup extends LabMenuBase {
  static override properties = {
    heading: {},
    items: { converter: menuItemsConverter },
    open: { type: Boolean },
    defaultOpen: { type: Boolean, attribute: 'default-open' },
  };
  declare heading: string;
  declare items: readonly LabMenuItem[];
  declare open: boolean | undefined;
  declare defaultOpen: boolean;
  constructor() {
    super();
    this.heading = '';
    this.items = [];
    this.defaultOpen = false;
  }
  protected override configuration(): Partial<MenuOptions> & Pick<MenuOptions, 'items'> {
    return {
      items: this.items,
      heading: this.heading,
      open: this.open,
      defaultOpen: this.defaultOpen,
    };
  }
  protected override changedOpen(open: boolean): void {
    this.dispatchEvent(
      new CustomEvent('open-change', { detail: { open }, bubbles: true, composed: true }),
    );
  }
}
