import * as tabsMachine from '@zag-js/tabs';
import { type TemplateResult, css, html, isServer, nothing, unsafeCSS } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import type { MachineModule, SchemaOf } from '../../behaviors/types.js';
import { LabElement } from '../../lit/lab-element.js';
import type { ZagController } from '../../lit/zag-controller.js';
import { mountTabsMotion } from './runtime.js';
import { tabsCss } from './styles.js';

export type LabTabsOrientation = 'horizontal' | 'vertical';
export type LabTabsSize = 's' | 'm' | 'l';
export type LabTabsVariant = 'tinted' | 'underlined';
/** Indicator edge across the list axis. Vertical edges follow the text direction. */
export type LabTabsEdge = 'start' | 'end';
export type LabTabsActivationMode = 'automatic' | 'manual';

export interface LabTabItem {
  readonly value: string;
  /** Accessible name, kept even when iconOnly hides the visible text. */
  readonly label: string;
  readonly disabled?: boolean;
  /** Names of decorative light-DOM slots, distinct from panel slot names. */
  readonly icon?: string;
  readonly iconEnd?: string;
  readonly iconOnly?: boolean;
}

type TabsSchema = SchemaOf<tabsMachine.Service>;
type TabsApi = tabsMachine.Api;
const tabsModule: MachineModule<TabsSchema, TabsApi> = tabsMachine;

/** One Zag group owns keyboard and selection. Keyed, mounted panels retain drafts. */
export class LabTabs extends LabElement {
  static override properties = {
    variant: { reflect: true },
    edge: { reflect: true },
    orientation: { reflect: true },
    size: { reflect: true },
    activationMode: { attribute: 'activation-mode', reflect: true },
    /** undefined is uncontrolled; null is a controlled selection of no tab. */
    value: { converter: { fromAttribute: (value: string | null) => value ?? undefined } },
    defaultValue: { attribute: 'default-value' },
    label: {},
    dir: { reflect: true },
    items: { attribute: false },
  };

  declare variant: LabTabsVariant;
  declare edge: LabTabsEdge;
  declare orientation: LabTabsOrientation;
  declare size: LabTabsSize;
  declare activationMode: LabTabsActivationMode;
  declare value: string | null | undefined;
  declare defaultValue: string | null | undefined;
  declare label: string;
  declare items: ReadonlyArray<LabTabItem>;

  private readonly machineCtl: ZagController<TabsSchema, TabsApi>;
  private tabsId = this.uid;
  private motion?: ReturnType<typeof mountTabsMotion>;

  constructor() {
    super();
    this.variant = 'underlined';
    this.edge = 'end';
    this.orientation = 'horizontal';
    this.size = 'm';
    this.activationMode = 'automatic';
    this.value = undefined;
    this.defaultValue = undefined;
    this.label = '';
    this.items = [];
    this.machineCtl = this.runMachine(tabsModule, () => ({
      id: this.tabsId,
      ids: this.partIds(),
      value: this.value,
      defaultValue: this.defaultValue ?? undefined,
      orientation: this.orientation,
      activationMode: this.activationMode,
      dir: this.direction,
      translations: { listLabel: this.label || this.getAttribute('aria-label') || undefined },
      onValueChange: (details: tabsMachine.ValueChangeDetails) => {
        this.dispatchEvent(
          new CustomEvent<tabsMachine.ValueChangeDetails>('value-change', {
            detail: details,
            bubbles: true,
            composed: true,
          }),
        );
      },
    }));
  }

  /** Current selection. `value` is only the consumer's controlled input. */
  get selectedValue(): string | null {
    return isServer || !this.isConnected
      ? this.value === undefined
        ? (this.defaultValue ?? null)
        : this.value
      : this.machineCtl.api.value;
  }

  private get direction(): 'ltr' | 'rtl' {
    if (this.dir === 'ltr' || this.dir === 'rtl') return this.dir;
    if (!isServer && this.isConnected)
      return getComputedStyle(this).direction === 'rtl' ? 'rtl' : 'ltr';
    return 'ltr';
  }

  private partIds() {
    return {
      root: `${this.tabsId}-root`,
      list: `${this.tabsId}-list`,
      trigger: (value: string) => `${this.tabsId}-tab-${encodeURIComponent(value)}`,
      content: (value: string) => `${this.tabsId}-panel-${encodeURIComponent(value)}`,
    };
  }

  static override styles = [
    unsafeCSS(tabsCss),
    css`
    :host { display: block; min-width: 0; }
    .lab-tabs-icon ::slotted(*) { width: 100%; height: 100%; }
  `,
  ];

  override connectedCallback(): void {
    const existing = this.shadowRoot?.querySelector<HTMLElement>('[data-tabs-id]');
    if (!this.hasUpdated && existing?.dataset.tabsId) {
      this.tabsId = existing.dataset.tabsId;
      if (this.value === undefined && existing.hasAttribute('data-tabs-controlled')) {
        this.value = existing.getAttribute('data-tabs-value');
      }
    }
    super.connectedCallback();
  }

  override disconnectedCallback(): void {
    this.motion?.dispose();
    this.motion = undefined;
    super.disconnectedCallback();
  }

  override updated(): void {
    // All semantic attributes are rendered below, including removals. Clear old
    // listeners here so keyed reorders/removals do not retain stale closures.
    this.machineCtl.clearSpreads();
    const api = this.machineCtl.api;
    const root = this.renderRoot.querySelector<HTMLElement>('.root');
    const list = this.renderRoot.querySelector<HTMLElement>('.list');
    if (root) this.machineCtl.spread(root, api.getRootProps());
    if (list) this.machineCtl.spread(list, api.getListProps());
    const tabStop = this.tabStopValue();
    const items = new Map(this.items.map((item) => [item.value, item]));
    for (const node of this.renderRoot.querySelectorAll<HTMLElement>('.trigger')) {
      const item = items.get(node.dataset.itemValue ?? '');
      if (!item) continue;
      this.machineCtl.spread(node, {
        ...api.getTriggerProps(item),
        tabIndex: item.value === tabStop ? 0 : -1,
      });
    }
    for (const node of this.renderRoot.querySelectorAll<HTMLElement>('.panel')) {
      this.machineCtl.spread(node, api.getContentProps({ value: node.dataset.itemValue ?? '' }));
    }
    if (root) {
      this.motion ??= mountTabsMotion(root);
      this.motion.update();
    }
  }

  private tabStopValue(): string | undefined {
    const focusedValue =
      isServer || !this.isConnected ? undefined : this.machineCtl.api.focusedValue;
    const focused = this.items.find((tab) => tab.value === focusedValue && !tab.disabled);
    const selected = this.items.find((tab) => tab.value === this.selectedValue && !tab.disabled);
    return (focused ?? selected ?? this.items.find((tab) => !tab.disabled))?.value;
  }

  override render(): TemplateResult {
    const ids = this.partIds();
    const value = this.selectedValue;
    const tabStop = this.tabStopValue();
    return html`
      <div class="root" id=${ids.root} data-lab-tabs data-tabs-id=${this.tabsId}
        data-variant=${this.variant} data-edge=${this.edge} data-orientation=${this.orientation}
        data-size=${this.size} data-count=${this.items.length} dir=${this.dir || nothing}
        ?data-tabs-controlled=${this.value !== undefined} data-tabs-value=${this.value ?? nothing}>
        <div class="list lab-tabs-list" id=${ids.list} role="tablist"
          aria-orientation=${this.orientation} aria-label=${this.label || this.getAttribute('aria-label') || nothing}>
          ${repeat(
            this.items,
            (item) => item.value,
            (item) => html`
            <button class="trigger lab-tabs-trigger" type="button" role="tab"
              id=${ids.trigger(item.value)} data-item-value=${item.value} data-value=${item.value}
              ?disabled=${item.disabled} ?data-disabled=${item.disabled} ?data-icon-only=${item.iconOnly}
              ?data-selected=${item.value === value} aria-selected=${item.value === value}
              aria-controls=${item.value === value ? ids.content(item.value) : nothing}
              tabindex=${item.value === tabStop ? 0 : -1}>
              <span class="lab-tabs-active" aria-hidden="true"></span>
              ${item.icon ? html`<span class="lab-tabs-icon" aria-hidden="true"><slot name=${item.icon}></slot></span>` : nothing}
              <span class="lab-tabs-label">${item.label}</span>
              ${item.iconEnd ? html`<span class="lab-tabs-icon" aria-hidden="true"><slot name=${item.iconEnd}></slot></span>` : nothing}
            </button>`,
          )}
        </div>
        ${repeat(
          this.items,
          (item) => item.value,
          (item) => html`
          <div class="panel lab-tabs-panel" role="tabpanel" id=${ids.content(item.value)}
            data-item-value=${item.value} aria-labelledby=${ids.trigger(item.value)}
            ?data-selected=${item.value === value} ?hidden=${item.value !== value}
            ?inert=${item.value !== value} aria-hidden=${item.value !== value ? 'true' : nothing} tabindex="0">
            <slot name=${item.value}></slot>
          </div>`,
        )}
      </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lab-tabs': LabTabs;
  }
}
if (typeof customElements !== 'undefined' && !customElements.get('lab-tabs'))
  customElements.define('lab-tabs', LabTabs);
