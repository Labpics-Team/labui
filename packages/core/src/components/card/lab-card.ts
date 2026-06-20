/**
 * `<lab-card>` — a presentational container that groups related content into a
 * single surface, with optional header / media / body / footer slots.
 *
 * OPT-OUT (documented, per core-CONTRACT §1): Card is PRESENTATIONAL. It has NO
 * interaction state a machine would own — no open/value/checked/pressed/roving/
 * typeahead. It is a static surface that slots content. So, exactly like
 * `<lab-badge>` / `<lab-loader>`, it legitimately opts out of the Zag Behaviors
 * seam and extends `LabElement` only for the shared base conventions
 * (delegatesFocus, the token contract). Wiring a machine here would be an onion
 * around a `<div>` (craft-arch: no onion for a surface). The honest test of the
 * opt-out: nothing about a card changes over time in response to the user except
 * the focus/hover affordance of the OPTIONAL interactive variant — and that is
 * native CSS + a host `tabindex`, not a state machine.
 *
 * Semantics are NATIVE, not faked: the host renders a real `<article>` when it is
 * a self-contained unit (the default — a card is the textbook `<article>` use
 * case in the HTML spec), the header projects through a `header` slot, and the
 * footer through a `footer` slot. When the whole card is a single interactive
 * target (`interactive` + an `href`-less click handler the consumer attaches),
 * the host exposes `tabindex="0"` and a `button`/`link` role is the CONSUMER's
 * responsibility on the slotted control — the element never fabricates an
 * accessible name or a role it cannot honour. An interactive card with no
 * keyboard operability would be a P5 accessibility trap, so the interactive
 * variant only adds the focus affordance; the actionable semantics stay with a
 * real control the consumer slots in.
 *
 * Axes (the surface model — Variant × Padding × Interactive):
 *   - variant:     elevated | outlined | filled   (the surface treatment)
 *   - padding:     none | s | m | l               (inner spacing of body region)
 *   - interactive: a hoverable/focusable affordance for whole-card targets (bool)
 *
 * Token contract (core-CONTRACT §2): consumes ONLY semantic --lab-* roles +
 * dimension tokens through `litVar`. The surface reads `--lab-bg-primary` /
 * `--lab-bg-secondary`; borders read `--lab-border-base` / `--lab-border-soft`;
 * elevation reads the `--lab-fx-shadow-*` role (NOT a baked-in hex shadow — an
 * honest elevation comes from the role layer or it does not exist); the focus
 * ring reads `--lab-border-focus`. No hex, no primitive, no invented role.
 */
import { type TemplateResult, css, html } from 'lit';
import { litVar } from '../../css.js';
import { LabElement } from '../../lit/lab-element.js';

/** Surface treatment of the card. */
export type LabCardVariant = 'elevated' | 'outlined' | 'filled';
/** Inner spacing of the card body region. */
export type LabCardPadding = 'none' | 's' | 'm' | 'l';

export class LabCard extends LabElement {
  static override properties = {
    variant: { reflect: true },
    padding: { reflect: true },
    /** Adds a hover + focus affordance for whole-card interactive targets. */
    interactive: { type: Boolean, reflect: true },
  };

  declare variant: LabCardVariant;
  declare padding: LabCardPadding;
  declare interactive: boolean;

  constructor() {
    super();
    this.variant = 'elevated';
    this.padding = 'm';
    this.interactive = false;
  }

  static override styles = css`
    :host {
      --_pad: ${litVar('--lab-space-lg', '1.5rem')};
      --_radius: ${litVar('--lab-radius-card', '0.75rem')};

      display: block;
    }

    :host([padding='none']) {
      --_pad: 0;
    }
    :host([padding='s']) {
      --_pad: ${litVar('--lab-space-sm', '0.5rem')};
    }
    :host([padding='m']) {
      --_pad: ${litVar('--lab-space-md', '1rem')};
    }
    :host([padding='l']) {
      --_pad: ${litVar('--lab-space-lg', '1.5rem')};
    }

    .card {
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      border-radius: var(--_radius);
      background-color: ${litVar('--lab-bg-primary')};
      color: ${litVar('--lab-label-primary')};
      /* A transparent border is always present so the variant rules only swap its
         colour — the box never resizes between variants (CLS, craft-frontend P4). */
      border: ${litVar('--lab-stroke-hairline')} solid transparent;
    }

    /* ── variant=elevated: raised surface + an honest role-layer shadow ─────── */
    :host([variant='elevated']) .card {
      background-color: ${litVar('--lab-bg-secondary')};
      box-shadow: ${litVar('--lab-fx-shadow-minor')};
    }

    /* ── variant=outlined: flat surface, a real border ──────────────────────── */
    :host([variant='outlined']) .card {
      background-color: ${litVar('--lab-bg-primary')};
      border-color: ${litVar('--lab-border-base')};
    }

    /* ── variant=filled: a tinted, borderless surface ───────────────────────── */
    :host([variant='filled']) .card {
      background-color: ${litVar('--lab-fill-neutral-tinted')};
    }

    /* ── interactive: hover + focus affordance for whole-card targets ───────── */
    :host([interactive]) .card {
      cursor: pointer;
      transition: box-shadow 160ms ease, border-color 160ms ease;
    }
    :host([interactive]:hover) .card {
      border-color: ${litVar('--lab-border-soft')};
    }
    :host([interactive][variant='elevated']:hover) .card {
      box-shadow: ${litVar('--lab-fx-shadow-major')};
    }
    /* The host delegates focus; draw the ring when any inner control is
       focus-visible OR the host itself is focused (consumer-set tabindex). */
    :host([interactive]:focus-within) .card {
      outline: ${litVar('--lab-focus-ring-width')} solid ${litVar('--lab-border-focus')};
      outline-offset: ${litVar('--lab-focus-ring-offset')};
    }

    /* ── slot regions ───────────────────────────────────────────────────────── */
    .media {
      display: block;
    }
    /* Media bleeds to the card edges regardless of body padding. */
    ::slotted([slot='media']) {
      display: block;
      width: 100%;
    }

    .header {
      padding: var(--_pad) var(--_pad) 0;
    }

    .body {
      flex: 1 1 auto;
      padding: var(--_pad);
    }

    .footer {
      padding: 0 var(--_pad) var(--_pad);
    }

    /* An empty region adds no space. ::slotted cannot be queried from :has, so
       emptiness is tracked by a slotchange listener that sets data-empty on the
       region wrapper — a robust, engine-agnostic collapse (the body region is
       never collapsed: its default slot is the card's primary content). */
    .region[data-empty] {
      display: none;
    }
  `;

  /**
   * Mark a region empty when its slot has no assigned nodes, so empty header /
   * media / footer regions collapse and add no padding. This is the honest way
   * to react to slotted (light-DOM) content from the shadow root — `::slotted`
   * is not reachable from a structural selector like `:has`.
   */
  private readonly onSlotChange = (event: Event): void => {
    const slot = event.target as HTMLSlotElement;
    const region = slot.closest<HTMLElement>('.region');
    if (!region) return;
    const hasContent = slot.assignedNodes({ flatten: true }).length > 0;
    region.toggleAttribute('data-empty', !hasContent);
  };

  override firstUpdated(): void {
    // Initialise the empty-state of the optional regions on first paint.
    for (const slot of this.renderRoot.querySelectorAll<HTMLSlotElement>(
      'slot[name="media"], slot[name="header"], slot[name="footer"]',
    )) {
      const region = slot.closest<HTMLElement>('.region');
      if (region) {
        region.toggleAttribute('data-empty', slot.assignedNodes({ flatten: true }).length === 0);
      }
    }
  }

  override render(): TemplateResult {
    // Native semantics: an <article> is the self-contained-composition element in
    // the HTML spec, which a card is by definition. Header/footer project through
    // the matching native landmark slots; media + body are plain regions. The
    // element adds no ARIA role — the slotted content carries its own semantics,
    // and an interactive card's actionable control is the consumer's to slot.
    return html`
      <article class="card" part="card">
        <div class="region media">
          <slot name="media" @slotchange=${this.onSlotChange}></slot>
        </div>
        <header class="region header">
          <slot name="header" @slotchange=${this.onSlotChange}></slot>
        </header>
        <div class="region body"><slot></slot></div>
        <footer class="region footer">
          <slot name="footer" @slotchange=${this.onSlotChange}></slot>
        </footer>
      </article>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lab-card': LabCard;
  }
}

// Idempotent registration (core-CONTRACT §7) — safe to import across module
// instances on both the SSR and client paths.
if (typeof customElements !== 'undefined' && !customElements.get('lab-card')) {
  customElements.define('lab-card', LabCard);
}
