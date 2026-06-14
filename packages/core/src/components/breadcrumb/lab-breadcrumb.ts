/**
 * `<lab-breadcrumb>` — the trail of ancestor pages leading to the current one.
 *
 * Axes (the Figma Breadcrumb model — Size × Separator):
 *   - size: s | m | l        (text + spacing density; reflected)
 *   - separator: string      (the glyph drawn between items; reflected, default '/')
 *
 * Separator type — a DELIBERATE, documented asymmetry with the React twin
 * (ADR-0001): the Lit `separator` is a reflected string attribute (a glyph like
 * '/', '›', '·'), because an HTML attribute can only carry a string. The React
 * `<Breadcrumb separator>` additionally accepts a `ReactNode`, so React callers
 * may pass an icon element. An icon separator on the Lit side would need a real
 * `<slot>` rendered once PER gap (not a single default slot) — a larger feature,
 * not a small clean addition — so it is intentionally out of scope here. Lit
 * callers who need an icon glyph pass its character (e.g. a Material codepoint) as
 * the string. If/when icon-node separators are required on Lit, that is a separate,
 * tracked change.
 *
 * Breadcrumb is PRESENTATIONAL — it has NONE of the machine-eligible states from
 * core-CONTRACT §1: no `open`, no `value`/`selected` it OWNS (which crumb is
 * "current" is purely positional — the last item — not interaction state), no
 * `pressed`, no roving focus (each link is independently tab-focusable, the
 * platform default), no typeahead. So it legitimately opts out of the Zag seam
 * and extends `LabElement` only for the shared base conventions. (craft-arch: no
 * onion for a list of links.) Future agents must NOT bolt a machine onto it.
 *
 * Semantics (honest, native): a real `<nav aria-label="Breadcrumb">` wrapping an
 * ordered `<ol>`; intermediate crumbs are real `<a href>` links; the final crumb
 * is the current page, rendered as text with `aria-current="page"` and NO link
 * (you don't link to where you already are). Separators are `aria-hidden` so a
 * screen reader announces the trail, not the punctuation.
 *
 * Hrefless non-current crumb (the Figma "disabled crumb"): an intermediate crumb
 * whose `href` is omitted is a non-navigable waypoint — a section that exists in
 * the hierarchy but has no page of its own (e.g. a grouping label). It renders as
 * a bare `<span part="link">` with NO `role` and NO `aria-current` (it is neither
 * a link nor the current page): honest, inert text that still reads the link role
 * token. This is deliberately NOT a disabled `<a>` — a link with no destination is
 * a lie to assistive tech; plain text is the truthful primitive.
 *
 * Token contract (core-CONTRACT §2): consumes ONLY semantic --lab-* roles +
 * dimension tokens through `litVar`. Links read `--lab-label-secondary`
 * (→ `--lab-label-accent` on hover); the current crumb reads `--lab-label-primary`;
 * separators read `--lab-label-tertiary`. No hex, no primitive, no colour fallback.
 */
import { type TemplateResult, css, html } from 'lit';
import { litVar } from '../../css.js';
import { LabElement } from '../../lit/lab-element.js';

/** Text + spacing density. */
export type LabBreadcrumbSize = 's' | 'm' | 'l';

/** One crumb: a visible `label` and, for non-current crumbs, an `href`. */
export interface LabBreadcrumbItem {
  /** Visible crumb text. */
  readonly label: string;
  /** Destination. Omit on the final (current) crumb — it is not a link. */
  readonly href?: string;
}

export class LabBreadcrumb extends LabElement {
  static override properties = {
    size: { reflect: true },
    separator: { reflect: true },
    /** The crumbs, root → current. Set as a property (not an attribute). */
    items: { attribute: false },
  };

  declare size: LabBreadcrumbSize;
  declare separator: string;
  declare items: ReadonlyArray<LabBreadcrumbItem>;

  constructor() {
    super();
    this.size = 'm';
    this.separator = '/';
    this.items = [];
  }

  static override styles = css`
    :host {
      --_gap: ${litVar('--lab-space-sm', '0.5rem')};
      --_font: ${litVar('--lab-font-size-md', '1rem')};

      display: block;
    }

    :host([size='s']) {
      --_gap: ${litVar('--lab-space-xs', '0.25rem')};
      --_font: ${litVar('--lab-font-size-xs', '0.8333rem')};
    }
    :host([size='l']) {
      --_gap: ${litVar('--lab-space-md', '1rem')};
      --_font: ${litVar('--lab-font-size-lg', '1.2rem')};
    }

    ol {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--_gap);
      margin: 0;
      padding: 0;
      list-style: none;
      font: inherit;
      font-size: var(--_font);
      line-height: ${litVar('--lab-line-height-md', '1.5')};
    }

    li {
      display: inline-flex;
      align-items: center;
      gap: var(--_gap);
    }

    a {
      color: ${litVar('--lab-label-secondary')};
      text-decoration: none;
      border-radius: ${litVar('--lab-radius-control', '0.5rem')};
    }
    a:hover {
      color: ${litVar('--lab-label-accent')};
      text-decoration: underline;
    }
    a:focus-visible {
      outline: 0.125rem solid ${litVar('--lab-border-focus')};
      outline-offset: 0.125rem;
    }

    /* The current page — the final crumb. Text, never a link. */
    .current {
      color: ${litVar('--lab-label-primary')};
      font-weight: 600;
    }

    /* Decorative trail glyph — announced by no screen reader (aria-hidden). */
    .separator {
      color: ${litVar('--lab-label-tertiary')};
      user-select: none;
    }
  `;

  override render(): TemplateResult {
    const lastIndex = this.items.length - 1;
    return html`
      <nav aria-label="Breadcrumb" part="nav">
        <ol part="list">
          ${this.items.map((item, index) => {
            const isCurrent = index === lastIndex;
            const crumb = isCurrent
              ? html`<span class="current" part="current" aria-current="page">${item.label}</span>`
              : item.href != null
                ? html`<a part="link" href=${item.href}>${item.label}</a>`
                : // Hrefless non-current crumb (Figma "disabled crumb"): a bare
                  // <span part="link"> — no role, no aria-current. Truthful inert
                  // text, not a destination-less <a>.
                  html`<span part="link">${item.label}</span>`;
            return html`<li part="item">
              ${crumb}${
                isCurrent
                  ? ''
                  : html`<span class="separator" part="separator" aria-hidden="true"
                    >${this.separator}</span
                  >`
              }
            </li>`;
          })}
        </ol>
      </nav>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lab-breadcrumb': LabBreadcrumb;
  }
}

// Idempotent registration (core-CONTRACT §7) — safe across SSR and client paths.
if (typeof customElements !== 'undefined' && !customElements.get('lab-breadcrumb')) {
  customElements.define('lab-breadcrumb', LabBreadcrumb);
}
