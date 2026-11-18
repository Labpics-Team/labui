import { mountMaterialRuntime } from '@labpics/ui-materials';
import { materialCss } from '@labpics/ui-materials/css';
import * as paginationMachine from '@zag-js/pagination';
import { VanillaMachine, normalizeProps } from '@zag-js/vanilla';
import {
  type PropertyValues,
  type TemplateResult,
  css,
  html,
  isServer,
  nothing,
  unsafeCSS,
} from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import type { MachineModule, SchemaOf } from '../../behaviors/types.js';
import { LabElement } from '../../lit/lab-element.js';
import type { ZagController } from '../../lit/zag-controller.js';
import {
  type LabPageChangeDetails,
  type LabPaginationVariant,
  compactPages,
  paginationCount,
  paginationHref,
  paginationKeyPage,
  paginationPage,
  paginationPageSize,
  paginationProgress,
  paginationSiblings,
} from './contract.js';
import { paginationCss } from './styles.js';

export type { LabPageChangeDetails, LabPaginationVariant } from './contract.js';
type Schema = SchemaOf<paginationMachine.Service>;
const module: MachineModule<Schema, paginationMachine.Api> = paginationMachine;
const optionalNumber = {
  fromAttribute: (value: string | null) => (value === null ? undefined : Number(value)),
};

/** Paged navigation. Controlled requests never change the consumer's page input. */
export class LabPagination extends LabElement {
  static override properties = {
    count: { type: Number, reflect: true, useDefault: true },
    pageSize: { type: Number, attribute: 'page-size', reflect: true, useDefault: true },
    page: { type: Number, reflect: true, useDefault: true, converter: optionalNumber },
    defaultPage: { type: Number, attribute: 'default-page', reflect: true, useDefault: true },
    siblingCount: { type: Number, attribute: 'sibling-count', reflect: true, useDefault: true },
    variant: { reflect: true, useDefault: true },
    disabled: { type: Boolean, reflect: true, useDefault: true },
    ambient: { type: Boolean, reflect: true, useDefault: true },
    progress: { type: Number, reflect: true, useDefault: true, converter: optionalNumber },
    href: { reflect: true, useDefault: true },
    label: { reflect: true, useDefault: true },
    previousLabel: { attribute: 'previous-label', reflect: true, useDefault: true },
    nextLabel: { attribute: 'next-label', reflect: true, useDefault: true },
    pageLabel: { attribute: 'page-label', reflect: true, useDefault: true },
    internalPage: { state: true },
  };
  declare count: number;
  declare pageSize: number;
  declare page: number | undefined;
  declare defaultPage: number;
  declare siblingCount: number;
  declare variant: LabPaginationVariant;
  declare disabled: boolean;
  declare ambient: boolean;
  /** Compact track progress, 0…1. The application's media clock supplies it. */
  declare progress: number | undefined;
  /** Native destination template; supports {page} and {pageSize}. */
  declare href: string;
  declare label: string;
  declare previousLabel: string;
  declare nextLabel: string;
  declare pageLabel: string;
  private declare internalPage: number | undefined;
  private readonly machineCtl: ZagController<Schema, paginationMachine.Api>;
  private disposeMaterial?: () => void;

  constructor() {
    super();
    this.count = 0;
    this.pageSize = 10;
    this.page = undefined;
    this.defaultPage = 1;
    this.siblingCount = 1;
    this.variant = 'numbered';
    this.disabled = false;
    this.ambient = false;
    this.progress = undefined;
    this.href = '';
    this.label = 'Pagination';
    this.previousLabel = 'Previous page';
    this.nextLabel = 'Next page';
    this.pageLabel = 'Page {page}';
    this.internalPage = undefined;
    this.machineCtl = this.runMachine(module, () => this.machineProps());
  }
  get selectedPage(): number {
    return paginationPage(this.page ?? this.internalPage ?? this.defaultPage, this.totalPages);
  }
  get totalPages(): number {
    return Math.ceil(paginationCount(this.count) / paginationPageSize(this.pageSize));
  }
  private machineProps(): paginationMachine.Props {
    return {
      id: this.uid,
      count: paginationCount(this.count),
      pageSize: paginationPageSize(this.pageSize),
      page: this.selectedPage,
      siblingCount: paginationSiblings(this.siblingCount),
      onPageChange: (detail: LabPageChangeDetails) => {
        if (this.disabled) return;
        if (this.page === undefined) this.internalPage = detail.page;
        this.dispatchEvent(
          new CustomEvent<LabPageChangeDetails>('page-change', {
            detail,
            bubbles: true,
            composed: true,
          }),
        );
      },
    };
  }
  private get api(): paginationMachine.Api {
    // A never-started service gives SSR the same range algorithm, without DOM effects.
    return isServer || !this.isConnected
      ? paginationMachine.connect(
          new VanillaMachine(module.machine, () => this.machineProps()).service,
          normalizeProps,
        )
      : this.machineCtl.api;
  }
  protected override willUpdate(changed: PropertyValues): void {
    if (
      this.page === undefined &&
      (this.internalPage === undefined || changed.has('count') || changed.has('pageSize'))
    )
      this.internalPage = this.selectedPage;
  }
  static override styles = [
    css`:host { display: block; min-inline-size: 0; }`,
    unsafeCSS(materialCss),
    unsafeCSS(paginationCss),
  ];
  override updated(): void {
    const nav = this.renderRoot.querySelector<HTMLElement>('nav');
    if (this.variant === 'compact' && this.ambient && nav)
      this.disposeMaterial ??= mountMaterialRuntime(nav);
    else {
      this.disposeMaterial?.();
      this.disposeMaterial = undefined;
    }
  }
  override disconnectedCallback(): void {
    this.disposeMaterial?.();
    this.disposeMaterial = undefined;
    super.disconnectedCallback();
  }
  private request(event: MouseEvent, page: number, disabled: boolean): void {
    if (disabled) {
      event.preventDefault();
      return;
    }
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    this.api.setPage(page);
  }
  private async keyPage(event: KeyboardEvent): Promise<void> {
    if (
      this.variant !== 'compact' ||
      this.disabled ||
      event.altKey ||
      event.metaKey ||
      event.ctrlKey
    )
      return;
    const page = paginationKeyPage(
      event.key,
      this.selectedPage,
      this.totalPages,
      getComputedStyle(this).direction === 'rtl',
    );
    if (page === undefined) return;
    event.preventDefault();
    this.api.setPage(page);
    await this.updateComplete;
    this.renderRoot.querySelector<HTMLElement>(`[data-page='${this.selectedPage}']`)?.focus();
  }
  private control(page: number, kind: 'page' | 'prev' | 'next', receding = false): TemplateResult {
    const current = kind === 'page' && page === this.selectedPage;
    const compact = this.variant === 'compact';
    const disabled = this.disabled || page < 1 || page > this.totalPages;
    const href = disabled
      ? undefined
      : paginationHref(this.href, page, paginationPageSize(this.pageSize));
    const label =
      kind === 'prev'
        ? this.previousLabel
        : kind === 'next'
          ? this.nextLabel
          : this.pageLabel.replaceAll('{page}', String(page));
    const progress = current && compact ? paginationProgress(this.progress) : undefined;
    const content =
      kind !== 'page'
        ? html`<span class="lab-pagination-chevron" aria-hidden="true"></span>`
        : compact
          ? html`<span class="lab-pagination-dot" aria-hidden="true">${progress !== undefined ? html`<span class="lab-pagination-progress" style=${`--_pg-progress:${progress}`}></span>` : nothing}</span>`
          : page;
    const cls = `lab-pagination-control ${kind === 'page' ? 'lab-pagination-item' : `lab-pagination-trigger lab-pagination-${kind}`}`;
    const tab = disabled || (compact && !current) ? -1 : 0;
    return this.href
      ? html`<a class=${cls} href=${href ?? nothing} aria-label=${label} aria-current=${current ? 'page' : nothing}
          aria-disabled=${disabled ? 'true' : nothing} tabindex=${tab} data-page=${kind === 'page' ? page : nothing}
          ?data-receding=${receding} ?data-progress=${progress !== undefined} @click=${(event: MouseEvent) => this.request(event, page, disabled)}>${content}</a>`
      : html`<button class=${cls} type="button" ?disabled=${disabled} aria-label=${label} aria-current=${current ? 'page' : nothing}
          tabindex=${tab} data-page=${kind === 'page' ? page : nothing} ?data-receding=${receding} ?data-progress=${progress !== undefined}
          @click=${(event: MouseEvent) => this.request(event, page, disabled)}>${content}</button>`;
  }
  override render(): TemplateResult {
    const compact = this.variant === 'compact';
    const pages = compact
      ? compactPages(this.selectedPage, this.totalPages).map((value) => ({
          type: 'page' as const,
          value,
        }))
      : this.api.pages;
    return html`<nav data-lab-pagination data-variant=${compact ? 'compact' : 'numbered'} ?data-ambient=${compact && this.ambient}
        ?data-disabled=${this.disabled} aria-label=${this.label} @keydown=${this.keyPage}>
      ${compact && this.ambient ? html`<span class="lab-pagination-surface lab-material lab-material--base" aria-hidden="true"></span>` : nothing}
      ${compact ? nothing : this.control(this.selectedPage - 1, 'prev')}
      ${repeat(
        pages,
        (entry, index) =>
          entry.type === 'page'
            ? `page-${entry.value}`
            : `ellipsis-${index === 1 ? 'start' : 'end'}`,
        (entry, index) =>
          entry.type === 'page'
            ? this.control(
                entry.value,
                'page',
                compact &&
                  ((index === 0 && entry.value > 1) ||
                    (index === pages.length - 1 && entry.value < this.totalPages)),
              )
            : html`<span class="lab-pagination-ellipsis" aria-hidden="true"><span class="lab-pagination-dots"><i></i><i></i><i></i></span></span>`,
      )}
      ${compact ? nothing : this.control(this.selectedPage + 1, 'next')}
    </nav>`;
  }
}
declare global {
  interface HTMLElementTagNameMap {
    'lab-pagination': LabPagination;
  }
}
if (typeof customElements !== 'undefined' && !customElements.get('lab-pagination'))
  customElements.define('lab-pagination', LabPagination);
