import * as paginationMachine from '@zag-js/pagination';
/**
 * `<lab-pagination>` — navigate a paged collection one page at a time.
 *
 * Axes (the Figma Pagination model — Size × SiblingCount):
 *   - size: s | m | l        (control density; reflected)
 *   - siblingCount: number   (pages shown either side of the current one)
 *   - page: machine-owned current page (controlled by SETTING the attribute)
 *   - count / pageSize: the data shape the page range is derived from
 *
 * Why a machine here, when Breadcrumb opts out: pagination OWNS a `page` value
 * and navigates it (prev / next / jump) — a `value` is the first machine-eligible
 * state listed in core-CONTRACT §1, so this element MUST drive the seam rather
 * than hand-roll the page-window algorithm, the controlled/uncontrolled split,
 * and the `aria-current` wiring. It runs `@zag-js/pagination` through
 * `ZagController`: the machine owns the page value, derives the page range
 * (including ellipses) from `count` + `pageSize`, and wires each control's ARIA;
 * the element only paints (DIP). `boundaryCount` is intentionally NOT exposed —
 * the machine fixes the first/last boundary at 1; faking a knob the behavior does
 * not own would be a misleading stop-gap.
 *
 * Semantics (machine-provided, native shell): a `<nav>` of real `<button>`
 * controls. The current page carries `aria-current="page"`; prev/next disable at
 * the bounds; ellipses are `aria-hidden`. Clicking a page or prev/next runs the
 * machine, which is the single source of truth for the page value.
 *
 * Token contract (core-CONTRACT §2): every COLOUR is a semantic --lab-* role via
 * `litVar`, and dimensions bind a token wherever a semantic role exists — gap
 * (`--lab-space-xs`), padding (`--lab-space-sm`), font size (`--lab-font-size-*`),
 * radius (`--lab-radius-control`). The current page reads `--lab-fill-accent` +
 * `--lab-label-on-accent`; idle items read `--lab-label-secondary`; the focus
 * ring reads `--lab-border-focus`. No hex, no primitive, no invented role.
 * Exceptions, by design: the per-size control box (`--_size`: 1.75 / 2.25 /
 * 2.75rem) and the 120ms hover transition are raw literals — the token layer
 * exposes no semantic control-size or motion-duration role to bind, and faking
 * one (or borrowing a `--lab-space-*` primitive) would be a misleading stop-gap.
 * This mirrors the sibling controls (avatar, switch), which size the same way.
 */
import { type TemplateResult, css, html } from 'lit';
import type { MachineModule, SchemaOf } from '../../behaviors/types.js';
import { litVar } from '../../css.js';
import { LabElement } from '../../lit/lab-element.js';
import type { ZagController } from '../../lit/zag-controller.js';

/** Control density. */
export type LabPaginationSize = 's' | 'm' | 'l';

/**
 * Accessible names for the prev/next triggers — capitalized UI polish, kept
 * IDENTICAL to the native React twin (`pagination.tsx`) so the two renderers
 * never drift. Zag's machine emits a lowercase `aria-label` ('previous page' /
 * 'next page') from its trigger prop-getters; both renderers override it with
 * these so the accessible name is one source of truth, not the machine default.
 */
const PREV_LABEL = 'Previous page';
const NEXT_LABEL = 'Next page';

type PaginationSchema = SchemaOf<paginationMachine.Service>;
type PaginationApi = paginationMachine.Api;

/**
 * The `@zag-js/pagination` package seen through the renderer-agnostic seam — the
 * SAME binding pattern `<lab-switch>` uses. No casts.
 */
const paginationModule: MachineModule<PaginationSchema, PaginationApi> = paginationMachine;

export class LabPagination extends LabElement {
  static override properties = {
    size: { reflect: true },
    /** Total number of data items the pages are derived from. */
    count: { type: Number, reflect: true },
    /** Items per page — `count / pageSize` gives the page total. */
    pageSize: { type: Number, attribute: 'page-size', reflect: true },
    /** Pages shown either side of the current page. */
    siblingCount: { type: Number, attribute: 'sibling-count', reflect: true },
    /**
     * Current page. NOT reflected: a numeric property reflects its default (1) to
     * a `page="1"` attribute, which would read back as a controlled value and
     * override `default-page`. Kept as a plain property the machine mirrors via
     * `onPageChange`; controlled mode is opted into by SETTING the `page` attribute.
     */
    page: { type: Number },
    /** Uncontrolled initial page — read once by the machine at init. */
    defaultPage: { type: Number, attribute: 'default-page', reflect: true },
  };

  declare size: LabPaginationSize;
  declare count: number;
  declare pageSize: number;
  declare siblingCount: number;
  declare page: number;
  declare defaultPage: number;

  private readonly machineCtl: ZagController<PaginationSchema, PaginationApi>;

  constructor() {
    super();
    this.size = 'm';
    this.count = 0;
    this.pageSize = 10;
    this.siblingCount = 1;
    this.page = 1;
    this.defaultPage = 1;
    this.machineCtl = this.runMachine(paginationModule, () => ({
      count: this.count,
      pageSize: this.pageSize,
      siblingCount: this.siblingCount,
      page: this.hasAttribute('page') ? this.page : undefined,
      defaultPage: this.defaultPage,
      onPageChange: (details: paginationMachine.PageChangeDetails) => {
        this.page = details.page;
        this.dispatchEvent(
          new CustomEvent<paginationMachine.PageChangeDetails>('page-change', {
            detail: details,
            bubbles: true,
            composed: true,
          }),
        );
      },
    }));
  }

  static override styles = css`
    :host {
      --_gap: ${litVar('--lab-space-xs', '0.25rem')};
      --_size: var(--lab-size-control-h-m, 2.25rem);
      --_pad-x: ${litVar('--lab-space-sm', '0.5rem')};
      --_font: ${litVar('--lab-font-size-md', '1rem')};

      display: block;
    }

    :host([size='s']) {
      --_size: var(--lab-size-control-h-s, 1.75rem);
      --_font: ${litVar('--lab-font-size-xs', '0.8333rem')};
    }
    :host([size='l']) {
      --_size: var(--lab-size-control-h-l, 2.75rem);
      --_font: ${litVar('--lab-font-size-lg', '1.2rem')};
    }

    nav {
      display: flex;
      align-items: center;
      gap: var(--_gap);
      font: inherit;
      font-size: var(--_font);
    }

    .item,
    .trigger {
      appearance: none;
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: var(--_size);
      height: var(--_size);
      padding-inline: var(--_pad-x);
      border: ${litVar('--lab-stroke-hairline')} solid transparent;
      border-radius: ${litVar('--lab-radius-control', '0.5rem')};
      background: transparent;
      font: inherit;
      font-weight: ${litVar('--lab-font-weight-semibold', '600')};
      color: ${litVar('--lab-label-secondary')};
      cursor: pointer;
      transition: background-color 120ms ease, color 120ms ease, border-color 120ms ease;
    }

    .item:hover:not([data-selected]):not(:disabled),
    .trigger:hover:not(:disabled) {
      background-color: ${litVar('--lab-fill-primary')};
      color: ${litVar('--lab-label-primary')};
    }

    /* The current page — the machine sets data-selected + aria-current. */
    .item[data-selected] {
      background-color: ${litVar('--lab-fill-accent')};
      color: ${litVar('--lab-label-on-accent')};
      cursor: default;
    }

    .item:disabled,
    .trigger:disabled {
      color: ${litVar('--lab-label-tertiary')};
      cursor: not-allowed;
    }

    .item:focus-visible,
    .trigger:focus-visible {
      outline: ${litVar('--lab-focus-ring-width')} solid ${litVar('--lab-border-focus')};
      outline-offset: ${litVar('--lab-focus-ring-offset')};
    }

    .ellipsis {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: var(--_size);
      height: var(--_size);
      color: ${litVar('--lab-label-tertiary')};
      user-select: none;
    }

    @media (prefers-reduced-motion: reduce) {
      .item,
      .trigger {
        transition: none;
      }
    }
  `;

  override updated(): void {
    // We do NOT `clearSpreads()` between renders (unlike Switch): `spreadProps`
    // keeps a per-node diff that both swaps event listeners AND removes attributes
    // that drop out of the props (e.g. `data-selected` / `aria-current` when the
    // page changes). Calling its cleanup each render would reset that diff and
    // leave the old page marked current. The cleanups run once on disconnect.
    const api = this.machineCtl.api;
    const root = this.renderRoot.querySelector<HTMLElement>('nav');
    if (root) this.machineCtl.spread(root, api.getRootProps());

    const prev = this.renderRoot.querySelector<HTMLElement>('.trigger-prev');
    const next = this.renderRoot.querySelector<HTMLElement>('.trigger-next');
    if (prev) {
      this.machineCtl.spread(prev, api.getPrevTriggerProps());
      // Re-assert the capitalized accessible name AFTER the spread: Zag emits a
      // lowercase `aria-label` ('previous page') from getPrevTriggerProps, which
      // would otherwise overwrite the template's value and drift from the React
      // twin (which keeps 'Previous page'). Unify on the capitalized form on both.
      prev.setAttribute('aria-label', PREV_LABEL);
    }
    if (next) {
      this.machineCtl.spread(next, api.getNextTriggerProps());
      next.setAttribute('aria-label', NEXT_LABEL);
    }

    // Spread item/ellipsis props in the SAME order the render emitted them, so the
    // node ↔ page mapping is exact (the machine owns which is current).
    const items = this.renderRoot.querySelectorAll<HTMLElement>('.cell');
    let ellipsisIndex = 0;
    api.pages.forEach((entry, index) => {
      const node = items[index];
      if (!node) return;
      if (entry.type === 'page') {
        this.machineCtl.spread(node, api.getItemProps({ type: 'page', value: entry.value }));
      } else {
        this.machineCtl.spread(node, api.getEllipsisProps({ index: ellipsisIndex }));
        ellipsisIndex += 1;
      }
    });
  }

  override render(): TemplateResult {
    let pages: paginationMachine.Pages;
    try {
      pages = this.machineCtl.api.pages;
    } catch {
      // Pre-connection (Lit SSR runs render() before connectedCallback starts the
      // machine). Emit the nav shell; the client upgrade fills the range in. The
      // machine stays the single source of truth for the page range at runtime.
      pages = [];
    }
    return html`
      <nav>
        <button class="trigger trigger-prev" type="button" aria-label="${PREV_LABEL}">‹</button>
        ${pages.map((entry) =>
          entry.type === 'page'
            ? html`<button class="item cell" type="button">${entry.value}</button>`
            : html`<span class="ellipsis cell" aria-hidden="true">…</span>`,
        )}
        <button class="trigger trigger-next" type="button" aria-label="${NEXT_LABEL}">›</button>
      </nav>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lab-pagination': LabPagination;
  }
}

// Idempotent registration (core-CONTRACT §7) — safe across SSR and client paths.
if (typeof customElements !== 'undefined' && !customElements.get('lab-pagination')) {
  customElements.define('lab-pagination', LabPagination);
}
