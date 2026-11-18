import { type TemplateResult, css, html, nothing, unsafeCSS } from 'lit';
import { LabElement } from '../../lit/lab-element.js';
import {
  type LabBreadcrumbItem,
  type LabBreadcrumbSize,
  breadcrumbIndices,
  breadcrumbLimit,
  breadcrumbSize,
} from './contract.js';
import { breadcrumbCss } from './styles.js';

export type { LabBreadcrumbItem, LabBreadcrumbSize } from './contract.js';

/** A native navigation trail. The disclosure reveals the middle without changing its order. */
export class LabBreadcrumb extends LabElement {
  static override properties = {
    size: { reflect: true, useDefault: true },
    separator: { reflect: true, useDefault: true },
    items: { attribute: false },
    maxItems: { type: Number, attribute: 'max-items', reflect: true, useDefault: true },
    label: { reflect: true, useDefault: true },
    expandLabel: { attribute: 'expand-label', useDefault: true },
    expanded: { state: true },
  };

  declare size: LabBreadcrumbSize;
  /** Optional custom punctuation. An empty string selects the authored chevron. */
  declare separator: string;
  declare items: ReadonlyArray<LabBreadcrumbItem>;
  declare maxItems: number;
  declare label: string;
  declare expandLabel: string;
  private declare expanded: boolean;

  constructor() {
    super();
    this.size = 'm';
    this.separator = '';
    this.items = [];
    this.maxItems = breadcrumbLimit(undefined);
    this.label = 'Навигационная цепочка';
    this.expandLabel = 'Показать все разделы';
    this.expanded = false;
  }

  static override styles = [
    css`:host { display: block; min-inline-size: 0; }`,
    unsafeCSS(breadcrumbCss),
  ];

  private async expand() {
    this.expanded = true;
    await this.updateComplete;
    this.renderRoot
      .querySelector<HTMLElement>('[data-breadcrumb-index="1"] .lab-breadcrumb-link')
      ?.focus();
  }

  override render(): TemplateResult {
    const items = this.items ?? [];
    const indices = breadcrumbIndices(items.length, breadcrumbLimit(this.maxItems), this.expanded);
    return html`<nav aria-label=${this.label} data-lab-breadcrumb data-size=${breadcrumbSize(this.size)} part="nav">
      <ol class="lab-breadcrumb-list" part="list">${indices.map((index, position) => {
        const current = index === items.length - 1;
        const item = items[index];
        return html`<li class="lab-breadcrumb-item" part="item" data-breadcrumb-index=${index}>
          ${
            index === -1
              ? html`<button class="lab-breadcrumb-expand" type="button" aria-label=${this.expandLabel} @click=${this.expand}><span class="lab-breadcrumb-ellipsis" aria-hidden="true"></span></button>`
              : current
                ? html`<span class="lab-breadcrumb-current current" part="current" aria-current="page">${item?.label}</span>`
                : item?.href != null
                  ? html`<a class="lab-breadcrumb-link" part="link" href=${item.href}>${item.label}</a>`
                  : html`<span class="lab-breadcrumb-link" part="link" tabindex="-1">${item?.label}</span>`
          }
          ${position === indices.length - 1 ? nothing : html`<span class="lab-breadcrumb-separator separator" part="separator" aria-hidden="true">${this.separator || html`<span class="lab-breadcrumb-chevron"></span>`}</span>`}
        </li>`;
      })}</ol>
    </nav>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lab-breadcrumb': LabBreadcrumb;
  }
}
if (typeof customElements !== 'undefined' && !customElements.get('lab-breadcrumb'))
  customElements.define('lab-breadcrumb', LabBreadcrumb);
