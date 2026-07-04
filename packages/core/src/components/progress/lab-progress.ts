import * as progressMachine from '@zag-js/progress';
/**
 * `<lab-progress>` — a linear progress bar that CONSUMES the `@zag-js/progress`
 * machine through the Behaviors seam (core-CONTRACT §1). Like `<lab-switch>` it
 * runs a SINGLE (non-group) machine: the machine owns the value→percent maths,
 * the `role="progressbar"` + `aria-valuemin/max/now` wiring, and the
 * determinate-vs-indeterminate state; the element only paints with semantic
 * --lab-* roles (DIP — injected `MachineModule`, no hand-rolled ARIA).
 *
 * ACCESSIBLE NAME (WCAG 4.1.2): the machine names the track via `aria-label` set to
 * the formatted VALUE string ("60%"), NOT `aria-valuetext`, and emits no
 * `aria-labelledby`. When a visible label is present this element overrides that —
 * naming the track by the label via `aria-labelledby` and dropping the value
 * `aria-label` (see `nameTrackProps`). The numeric percent stays on `aria-valuenow`.
 *
 * HONEST two-mode contract (no fake progress, round-1 lesson 6): BOTH modes are
 * real and machine-derived.
 *   - DETERMINATE: a numeric `value` in [`min`, `max`]. The machine computes the
 *     percent; the range fills to that percent and `aria-valuenow` carries the
 *     real number. There is no synthetic animation pretending to know progress.
 *   - INDETERMINATE: `value = null` (omit the attribute or set it to "null"). The
 *     machine drops `aria-valuenow` entirely and reports `data-state=indeterminate`;
 *     the bar shows a genuinely-unknown-progress animation. It NEVER fabricates a
 *     percent it does not have.
 * Whether a bar is indeterminate is the machine's `value == null` decision, surfaced
 * verbatim — the element does not invent a third state or a placeholder fill.
 *
 * Axes (the progress model — Mode × Size):
 *   - value: number | null   (a real value, or null = indeterminate)
 *   - min / max:             the value range (machine-owned percent maths)
 *   - size:  s | m | l        (track thickness; reflected)
 *   - label:                 an optional visible label (machine's label part)
 *
 * Token contract (core-CONTRACT §2): ONLY semantic --lab-* roles + dimension
 * tokens via `litVar`. The track reads `--lab-fill-neutral-tinted`; the range
 * reads `--lab-fill-accent`; the label reads `--lab-label-primary`; the value
 * text reads `--lab-label-secondary`. No hex, no primitive, no invented role.
 *
 * SSR (core-CONTRACT §7): structure is always present (the machine spreads ARIA
 * in `updated()`), so the declarative shadow DOM emits a meaningful, styled bar
 * before any JS upgrades it.
 */
import { type TemplateResult, css, html, nothing } from 'lit';
import type { MachineModule, SchemaOf } from '../../behaviors/types.js';
import { litVar } from '../../css.js';
import { LabElement } from '../../lit/lab-element.js';
import type { Attrs, ZagController } from '../../lit/zag-controller.js';

/** Track thickness. */
export type LabProgressSize = 's' | 'm' | 'l';

type ProgressSchema = SchemaOf<progressMachine.Service>;
type ProgressApi = progressMachine.Api;

/**
 * The `@zag-js/progress` package seen through the renderer-agnostic seam — the
 * SAME `MachineModule` shape the Lit base binds for switch/tabs, no casts.
 */
const progressModule: MachineModule<ProgressSchema, ProgressApi> = progressMachine;

export class LabProgress extends LabElement {
  static override properties = {
    size: { reflect: true },
    /**
     * The current value. A number is determinate; `null` is indeterminate. Set as
     * a property; the `value` attribute accepts a number string or "null". Not
     * reflected — the machine spreads `data-state` onto the track in `updated()`.
     */
    value: {
      converter: {
        fromAttribute: (raw: string | null): number | null => parseValue(raw),
      },
    },
    /** Lower bound of the value range. */
    min: { type: Number },
    /** Upper bound of the value range. */
    max: { type: Number },
    /** Optional visible label rendered as the machine's label part. */
    label: {},
    /** Whether to show the numeric value text next to the label. */
    showValueText: { attribute: 'show-value-text', type: Boolean },
  };

  declare size: LabProgressSize;
  declare value: number | null;
  declare min: number;
  declare max: number;
  declare label: string;
  declare showValueText: boolean;

  private readonly machineCtl: ZagController<ProgressSchema, ProgressApi>;

  constructor() {
    super();
    this.size = 'm';
    this.value = null;
    this.min = 0;
    this.max = 100;
    this.label = '';
    this.showValueText = false;
    // Wire the Zag progress behavior. `value === null` is passed THROUGH to the
    // machine as the indeterminate signal — the element never substitutes a fake
    // number. The machine derives percent + ARIA from these props.
    this.machineCtl = this.runMachine(progressModule, () => ({
      value: this.value,
      min: this.min,
      max: this.max,
    }));
  }

  static override styles = css`
    :host {
      --_thickness: 0.5rem;
      --_font: ${litVar('--lab-font-size-xs', '0.8333rem')};

      display: block;
    }

    :host([size='s']) {
      --_thickness: 0.25rem;
    }
    :host([size='l']) {
      --_thickness: 0.75rem;
    }

    .root {
      display: flex;
      flex-direction: column;
      gap: ${litVar('--lab-space-xs', '0.25rem')};
    }

    .meta {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: ${litVar('--lab-space-sm', '0.5rem')};
    }

    .label {
      font: inherit;
      font-size: var(--_font);
      font-weight: ${litVar('--lab-font-weight-semibold', '600')};
      color: ${litVar('--lab-label-primary')};
    }

    .value-text {
      font: inherit;
      font-size: var(--_font);
      color: ${litVar('--lab-label-secondary')};
      font-variant-numeric: tabular-nums;
    }

    /* The Zag track element — carries role=progressbar + aria-value*. */
    .track {
      position: relative;
      width: 100%;
      height: var(--_thickness);
      border-radius: ${litVar('--lab-radius-full', '9999px')};
      background-color: ${litVar('--lab-fill-neutral-tinted')};
      overflow: hidden;
    }

    /* The Zag range element — the filled portion. Width is the machine's percent
       (determinate). For indeterminate the machine omits the width; we paint a
       sliding segment so an unknown-progress bar reads as genuinely unknown,
       never as a fabricated percentage. */
    .range {
      height: 100%;
      border-radius: inherit;
      background-color: ${litVar('--lab-fill-accent')};
    }

    /* Indeterminate: the machine sets data-state=indeterminate on the ROOT and
       drops the range width. Drive a sliding segment off that state — no fake
       percent, just an honest "working" animation. */
    :host .root[data-state='indeterminate'] .range {
      width: 40%;
      animation: lab-progress-indeterminate 1.2s ease-in-out infinite;
    }

    @keyframes lab-progress-indeterminate {
      0% {
        transform: translateX(-110%);
      }
      100% {
        transform: translateX(275%);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .root[data-state='indeterminate'] .range {
        animation: none;
        /* Reduced motion: a static centered segment — still honestly not a
           percentage, just a stilled indicator. */
        width: 100%;
        opacity: 0.5;
      }
    }
  `;

  override updated(): void {
    // Apply the machine's connect props onto the real shadow nodes. We do NOT
    // `clearSpreads()` between renders so `spreadProps`' per-node diff can remove
    // attributes that drop out (e.g. `aria-valuenow` when value goes null →
    // indeterminate). Accumulated cleanups run once on disconnect.
    const api = this.machineCtl.api;
    const root = this.renderRoot.querySelector<HTMLElement>('.root');
    const track = this.renderRoot.querySelector<HTMLElement>('.track');
    const range = this.renderRoot.querySelector<HTMLElement>('.range');
    const labelEl = this.renderRoot.querySelector<HTMLElement>('.label');
    const valueText = this.renderRoot.querySelector<HTMLElement>('.value-text');
    if (root) this.machineCtl.spread(root, api.getRootProps());
    if (track) this.machineCtl.spread(track, this.nameTrackProps(api.getTrackProps()));
    if (range) this.machineCtl.spread(range, api.getRangeProps());
    if (labelEl) this.machineCtl.spread(labelEl, api.getLabelProps());
    if (valueText) this.machineCtl.spread(valueText, api.getValueTextProps());
  }

  /**
   * ACCESSIBLE NAME (WCAG 4.1.2). The machine's `getTrackProps()` names the
   * progressbar with `aria-label` = the formatted VALUE string ("60%", or
   * "loading..." when indeterminate), NOT the task this bar tracks — and it emits no
   * `aria-labelledby`, so the visible label is never the progressbar's name. When a
   * visible label is rendered, NAME the track by it: point `aria-labelledby` at the
   * label part's own id (the same id `getLabelProps()` puts on the `.label` span) and
   * drop the value `aria-label` so it cannot shadow the labelledby name. With no
   * visible label we leave the machine's value `aria-label` as a degraded-but-present
   * name. The `spreadProps` per-node diff removes `aria-label` when set to undefined.
   * Mirrors the React twin verbatim ⇒ both renderers resolve the SAME name.
   */
  private nameTrackProps(trackProps: ReturnType<ProgressApi['getTrackProps']>): Attrs {
    if (!this.label) return trackProps;
    const labelId = this.machineCtl.api.getLabelProps().id;
    return { ...trackProps, 'aria-label': undefined, 'aria-labelledby': labelId };
  }

  override render(): TemplateResult {
    // Structure only; behavior (role=progressbar, aria-value*, percent → width) is
    // spread in `updated()` from the machine. The value text shows the machine's
    // `percentAsString` ONLY when requested and ONLY when determinate (it is empty
    // for indeterminate by the machine's own contract — honesty, not a placeholder).
    const showText = this.showValueText && this.value !== null;
    return html`
      <div class="root">
        ${
          this.label || showText
            ? html`
              <div class="meta">
                ${this.label ? html`<span class="label">${this.label}</span>` : nothing}
                ${
                  showText
                    ? html`<span class="value-text">${this.machineCtl.api.percentAsString}</span>`
                    : nothing
                }
              </div>
            `
            : nothing
        }
        <div class="track">
          <div class="range"></div>
        </div>
      </div>
    `;
  }
}

/** Parse the `value` attribute: a number string, or "null"/"" → indeterminate. */
function parseValue(raw: string | null): number | null {
  if (raw === null || raw === '' || raw === 'null') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

declare global {
  interface HTMLElementTagNameMap {
    'lab-progress': LabProgress;
  }
}

// Idempotent registration — safe across Lit SSR and client module instances.
if (typeof customElements !== 'undefined' && !customElements.get('lab-progress')) {
  customElements.define('lab-progress', LabProgress);
}
