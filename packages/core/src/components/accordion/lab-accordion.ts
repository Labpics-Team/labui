import * as accordionMachine from '@zag-js/accordion';
import { type TemplateResult, css, html, isServer, nothing, unsafeCSS } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import type { MachineModule, SchemaOf } from '../../behaviors/types.js';
import { LabElement } from '../../lit/lab-element.js';
import type { ZagController } from '../../lit/zag-controller.js';
import { accordionCss } from './styles.js';
import { mountAccordionMotion } from './runtime.js';

/** Horizontal grouping is an extension; the authored arrangement is vertical. */
export type LabAccordionOrientation = 'vertical' | 'horizontal';
/** Medium follows Figma; small and large are density extensions. */
export type LabAccordionSize = 's' | 'm' | 'l';
export interface LabAccordionItem {
  readonly value: string;
  readonly label: string;
  readonly disabled?: boolean;
}

function parseItems(raw: string | null): ReadonlyArray<LabAccordionItem> {
  if (raw === null) return [];
  try {
    const items: unknown = JSON.parse(raw);
    return Array.isArray(items) &&
      items.every(
        (item) =>
          item !== null &&
          typeof item === 'object' &&
          typeof item.value === 'string' &&
          typeof item.label === 'string' &&
          (item.disabled === undefined || typeof item.disabled === 'boolean'),
      )
      ? items
      : [];
  } catch {
    return [];
  }
}

function parseValues(raw: string | null): string[] | null {
  if (raw === null) return null;
  if (!raw.trimStart().startsWith('['))
    return raw
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
  try {
    const values: unknown = JSON.parse(raw);
    return Array.isArray(values) && values.every((value) => typeof value === 'string')
      ? values
      : [];
  } catch {
    return [];
  }
}

type AccordionSchema = SchemaOf<accordionMachine.Service>;
type AccordionApi = accordionMachine.Api;
const accordionModule: MachineModule<AccordionSchema, AccordionApi> = accordionMachine;

/** A disclosure group with stable panels and a complete, interactive server frame. */
export class LabAccordion extends LabElement {
  static override properties = {
    orientation: { reflect: true },
    size: { reflect: true },
    multiple: { type: Boolean, reflect: true },
    collapsible: { type: Boolean, reflect: true },
    disabled: { type: Boolean, reflect: true },
    headingLevel: { type: Number, attribute: 'heading-level', reflect: true, useDefault: true },
    value: {
      type: Array,
      reflect: true,
      useDefault: true,
      converter: { fromAttribute: parseValues },
    },
    defaultValue: {
      type: Array,
      attribute: 'default-value',
      reflect: true,
      useDefault: true,
      converter: { fromAttribute: parseValues },
    },
    items: {
      type: Array,
      reflect: true,
      useDefault: true,
      converter: { fromAttribute: parseItems },
    },
  };

  declare orientation: LabAccordionOrientation;
  declare size: LabAccordionSize;
  declare multiple: boolean;
  declare collapsible: boolean;
  declare disabled: boolean;
  declare headingLevel: number;
  /** Null leaves selection to the component; an array, including [], is controlled. */
  declare value: string[] | null;
  declare defaultValue: string[] | null;
  declare items: ReadonlyArray<LabAccordionItem>;

  private readonly machineCtl: ZagController<AccordionSchema, AccordionApi>;
  private accordionId = this.uid;
  private motion: ReturnType<typeof mountAccordionMotion> | undefined;

  constructor() {
    super();
    this.orientation = 'vertical';
    this.size = 'm';
    this.multiple = false;
    this.collapsible = true;
    this.disabled = false;
    this.headingLevel = 3;
    this.value = null;
    this.defaultValue = null;
    this.items = [];
    this.machineCtl = this.runMachine(accordionModule, () => ({
      id: this.accordionId,
      ids: this.partIds(),
      value: this.value ?? undefined,
      defaultValue: this.defaultValue ?? undefined,
      multiple: this.multiple,
      collapsible: this.collapsible,
      disabled: this.disabled,
      orientation: this.orientation,
      onValueChange: (details: accordionMachine.ValueChangeDetails) => {
        this.dispatchEvent(
          new CustomEvent<accordionMachine.ValueChangeDetails>('value-change', {
            detail: details,
            bubbles: true,
            composed: true,
          }),
        );
      },
    }));
  }

  get expandedValues(): readonly string[] {
    return isServer || !this.isConnected
      ? (this.value ?? this.defaultValue ?? [])
      : this.machineCtl.api.value;
  }

  private partIds() {
    return {
      root: `${this.accordionId}-root`,
      item: (value: string) => `${this.accordionId}-item-${encodeURIComponent(value)}`,
      itemTrigger: (value: string) => `${this.accordionId}-trigger-${encodeURIComponent(value)}`,
      itemContent: (value: string) => `${this.accordionId}-content-${encodeURIComponent(value)}`,
    };
  }

  static override styles = [
    css`:host { display: block; min-inline-size: 0; }`,
    unsafeCSS(accordionCss),
  ];

  override connectedCallback(): void {
    const existing = this.shadowRoot?.querySelector<HTMLElement>('[data-accordion-id]');
    if (!this.hasUpdated && existing?.dataset.accordionId)
      this.accordionId = existing.dataset.accordionId;
    super.connectedCallback();
  }

  private readonly focusTriggerBeforeToggle = (event: Event): void => {
    const target = event.target as HTMLElement | null;
    const trigger = target?.closest<HTMLButtonElement>('.trigger');
    if (trigger && !trigger.disabled && this.shadowRoot?.activeElement !== trigger) trigger.focus();
  };

  override firstUpdated(): void {
    // WebKit does not consistently focus buttons on pointer activation. Zag's
    // click transition needs that focus in the same dispatch.
    this.renderRoot
      .querySelector('.root')
      ?.addEventListener('click', this.focusTriggerBeforeToggle, true);
  }

  override updated(): void {
    this.machineCtl.clearSpreads();
    const api = this.machineCtl.api;
    const root = this.renderRoot.querySelector<HTMLElement>('.root');
    if (root) this.machineCtl.spread(root, api.getRootProps());
    const items = new Map(this.items.map((item) => [item.value, item]));
    for (const node of this.renderRoot.querySelectorAll<HTMLElement>('[data-item-value]')) {
      const item = items.get(node.dataset.itemValue ?? '');
      if (!item) continue;
      if (node.classList.contains('item')) this.machineCtl.spread(node, api.getItemProps(item));
      else if (node.classList.contains('trigger'))
        this.machineCtl.spread(node, api.getItemTriggerProps(item));
      else if (node.classList.contains('indicator'))
        this.machineCtl.spread(node, api.getItemIndicatorProps(item));
      else if (node.classList.contains('content'))
        this.machineCtl.spread(node, {
          ...api.getItemContentProps(item),
          role: this.useRegions ? 'region' : undefined,
        });
    }
    if (root) {
      this.motion ??= mountAccordionMotion(root);
      this.motion.update();
    }
  }

  override disconnectedCallback(): void {
    this.motion?.dispose();
    this.motion = undefined;
    super.disconnectedCallback();
  }

  private get useRegions(): boolean {
    return !this.multiple || this.items.length <= 6;
  }

  override render(): TemplateResult {
    const ids = this.partIds();
    const expanded = new Set(this.expandedValues);
    const headingLevel =
      Number.isInteger(this.headingLevel) && this.headingLevel >= 1 && this.headingLevel <= 6
        ? this.headingLevel
        : 3;
    return html`<div class="root" id=${ids.root} data-lab-accordion data-accordion-id=${this.accordionId}
      data-orientation=${this.orientation} data-size=${this.size}>
      ${repeat(
        this.items,
        (item) => item.value,
        (item) => {
          const open = expanded.has(item.value);
          const disabled = this.disabled || item.disabled;
          const fixed = open && !this.multiple && !this.collapsible;
          return html`<div class="item lab-accordion-item" id=${ids.item(item.value)} data-item-value=${item.value}
          data-state=${open ? 'open' : 'closed'} ?data-disabled=${disabled}>
          <div class="lab-accordion-heading" role="heading" aria-level=${headingLevel}>
            <button class="trigger lab-accordion-trigger" id=${ids.itemTrigger(item.value)} type="button"
              data-item-value=${item.value} data-state=${open ? 'open' : 'closed'} ?data-disabled=${disabled}
              ?disabled=${disabled} aria-disabled=${fixed ? 'true' : nothing} aria-expanded=${open}
              aria-controls=${ids.itemContent(item.value)}>
              <span class="lab-accordion-label">${item.label}</span>
              <span class="indicator lab-accordion-indicator" data-item-value=${item.value}
                data-state=${open ? 'open' : 'closed'} aria-hidden="true"></span>
            </button>
          </div>
          <div class="content lab-accordion-content" id=${ids.itemContent(item.value)} data-item-value=${item.value}
            role=${this.useRegions ? 'region' : nothing} aria-labelledby=${ids.itemTrigger(item.value)}
            data-state=${open ? 'open' : 'closed'} ?hidden=${!open} ?inert=${!open}
            aria-hidden=${!open ? 'true' : nothing}>
            <div class="lab-accordion-body"><slot name=${item.value}></slot></div>
          </div>
        </div>`;
        },
      )}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lab-accordion': LabAccordion;
  }
}
if (typeof customElements !== 'undefined' && !customElements.get('lab-accordion'))
  customElements.define('lab-accordion', LabAccordion);
