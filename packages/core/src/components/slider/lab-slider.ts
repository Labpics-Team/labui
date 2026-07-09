/**
 * `<lab-slider>` — a value slider: a track with a filled range and one or more
 * draggable thumbs, driven end-to-end by the `@zag-js/slider` machine.
 *
 * MACHINE, not opt-out (core-CONTRACT §1): a slider HAS shared interaction state a
 * machine owns — a numeric value (or value tuple for a range), min/max/step, the
 * thumb's `role="slider"` + `aria-valuenow/valuemin/valuemax/valuetext/orientation`,
 * Arrow/Home/End/PageUp-Down keyboard stepping, pointer drag + track-click, multi-thumb
 * collision handling, and a hidden input per thumb for forms. Hand-rolling roving
 * focus + value math is exactly the "machinery Zag ships" the seam exists to consume.
 * So this element runs the machine through `ZagController`: the machine owns
 * value/keyboard/drag/ARIA; the element only paints (DIP — it depends on the injected
 * `MachineModule`, never on hand-written stepping or roving).
 *
 * REUSES the field a11y seam (core-CONTRACT §4), it does NOT duplicate it: the
 * GROUP label / helper / error association is the same shared `field-a11y` helper
 * that `<lab-input>` / `<lab-textarea>` / `<lab-number-input>` use. The MACHINE owns
 * each thumb's `role="slider"` + value ARIA and points the thumb's `aria-labelledby`
 * at the label part it spreads — so the label is rendered as the machine's label
 * part (giving the thumbs their accessible name). The helper/error are linked from the
 * field's `aria-describedby`/`aria-errormessage` on each focusable `role="slider"`
 * THUMB — the element a reader lands on, mirroring number-input's field ARIA on its
 * `<input>` — so the description is actually announced (the inert group label never
 * receives focus, so a describedby there is never read). Neither layer re-implements
 * the other.
 *
 * Compound, keyed by INDEX (the slider's stable thumb key): the machine's per-thumb
 * getters take `{ index }` and the id it puts on each thumb is `slider:<id>:thumb:<i>`.
 * Each thumb node carries `data-index`; `updated()` spreads the per-thumb getters by
 * that index, never a positional DOM query that could drift. We do NOT clearSpreads()
 * between renders — `data-focus`/`data-dragging` MOVE between thumbs as the user
 * navigates, and spreadProps' per-node diff removes attributes that drop out; clearing
 * it each render would leave a stale state on the previously-active thumb (the
 * select/tabs canon).
 *
 * Axes (the Figma model — Size × Orientation × State):
 *   - size:        s | m | l   (track thickness + thumb diameter)
 *   - orientation: horizontal (default) | vertical
 *   - state:       disabled · readonly · invalid   (reflected, drive CSS + ARIA)
 *
 * Token contract (core-CONTRACT §2): ONLY semantic --lab-* roles + dimensions via
 * `litVar`. The track is `--lab-fill-primary`; the filled range is
 * `--lab-fill-accent`; the thumb is `--lab-control-bg` with a `--lab-border-base`
 * ring; the focus ring is `--lab-border-focus`. No hex, no primitive, no colour-role
 * fallback.
 *
 * SSR (core-CONTRACT §7): structure is always present; the machine spreads the
 * slider role + value ARIA in `updated()`, so `@lit-labs/ssr` emits a meaningful,
 * styled control in the declarative shadow DOM before any JS upgrades it.
 */
import * as sliderMachine from '@zag-js/slider';
import { type PropertyValues, type TemplateResult, css, html, nothing } from 'lit';
import type { MachineModule, SchemaOf } from '../../behaviors/types.js';
import { litVar } from '../../css.js';
import { LabElement } from '../../lit/lab-element.js';
import type { ZagController } from '../../lit/zag-controller.js';
import {
  type FieldA11yInput,
  type LabFieldSize,
  fieldControlAria,
  fieldErrorIsActive,
  fieldPartIds,
} from '../field/field-a11y.js';

/** Control size — drives track thickness and thumb diameter. */
export type LabSliderSize = LabFieldSize;
/** Slider orientation. */
export type LabSliderOrientation = 'horizontal' | 'vertical';

type SliderSchema = SchemaOf<sliderMachine.Service>;
type SliderApi = sliderMachine.Api;

/**
 * The `@zag-js/slider` package seen through the renderer-agnostic seam — the SAME
 * `MachineModule` shape the Lit base binds for every machine-driven component, no
 * casts. The namespace already matches `MachineModule` structurally.
 */
const sliderModule: MachineModule<SliderSchema, SliderApi> = sliderMachine;

/** Per-instance machine id source — keeps the root/thumb/label ids deterministic
 * and the derived helper/error ids collision-free. */
let sliderSeq = 0;

export class LabSlider extends LabElement {
  static override properties = {
    size: { reflect: true },
    orientation: { reflect: true },
    /** Visible group label text. Rendered as the machine's label part (the thumbs'
     * accessible name) and carries the field's required mark. */
    label: {},
    /** When set, the label is clipped (kept in the a11y tree, visually hidden). */
    labelHidden: { type: Boolean, attribute: 'label-hidden', reflect: true },
    /** Helper / description text shown below the control and linked via describedby. */
    helper: {},
    /** Error message; announced (role="alert") and linked only when `invalid`. */
    error: {},
    /**
     * Controlled value(s). A custom element can't carry an array in a plain
     * attribute, so this is primarily a JS PROPERTY; a JSON / comma string attribute
     * (`value="40"` or `value="20,80"`) is parsed for pure-HTML/SSR use.
     */
    value: {
      attribute: 'value',
      converter: { fromAttribute: (raw: string | null): number[] => parseValues(raw) },
    },
    /** Uncontrolled initial value(s) — read once by the machine at init. */
    defaultValue: {
      attribute: 'default-value',
      converter: { fromAttribute: (raw: string | null): number[] => parseValues(raw) },
    },
    /** Minimum value. */
    min: { type: Number },
    /** Maximum value. */
    max: { type: Number },
    /** Step the drag and Arrow keys move by. */
    step: { type: Number },
    /** Show value markers along the track. */
    marks: {
      attribute: 'marks',
      converter: { fromAttribute: (raw: string | null): number[] => parseValues(raw) },
    },
    /** Show the live value text above the control. */
    showValue: { type: Boolean, attribute: 'show-value', reflect: true },
    /** Non-editable: reads its value but cannot be changed. */
    readonly: { type: Boolean, reflect: true },
    /** Non-interactive and dimmed. */
    disabled: { type: Boolean, reflect: true },
    /** Invalid — drives aria-invalid / aria-errormessage and the danger styling. */
    invalid: { type: Boolean, reflect: true },
    /** Native form field name for the hidden input(s). */
    name: {},
  };

  declare size: LabSliderSize;
  declare orientation: LabSliderOrientation;
  declare label: string;
  declare labelHidden: boolean;
  declare helper: string;
  declare error: string;
  declare value: number[];
  declare defaultValue: number[];
  declare min: number;
  declare max: number;
  declare step: number;
  declare marks: number[];
  declare showValue: boolean;
  declare readonly: boolean;
  declare disabled: boolean;
  declare invalid: boolean;
  declare name: string;

  private readonly machineCtl: ZagController<SliderSchema, SliderApi>;
  /** Stable machine id — the root/thumb/label ids and the derived helper/error ids
   * all key off this, so nothing collides across instances. */
  private readonly fieldId = `lab-slider-${++sliderSeq}`;

  constructor() {
    super();
    this.size = 'm';
    this.orientation = 'horizontal';
    this.label = '';
    this.labelHidden = false;
    this.helper = '';
    this.error = '';
    this.value = [];
    this.defaultValue = [50];
    this.min = 0;
    this.max = 100;
    this.step = 1;
    this.marks = [];
    this.showValue = false;
    this.readonly = false;
    this.disabled = false;
    this.invalid = false;
    this.name = '';
    // Wire the Zag slider behavior. `value` is passed only when the consumer set the
    // attribute (controlled); otherwise the machine owns it from `defaultValue`
    // (uncontrolled) — the same honest two-mode contract as the other controls. The
    // machine owns the slider role, value ARIA, keyboard, drag, collision and the
    // hidden inputs; the element only paints.
    this.machineCtl = this.runMachine(sliderModule, () => ({
      id: this.fieldId,
      value: this.hasAttribute('value') ? this.value : undefined,
      defaultValue: this.defaultValue.length ? this.defaultValue : undefined,
      min: this.min,
      max: this.max,
      step: this.step,
      orientation: this.orientation,
      // Centre the thumb on the value point (our CSS translates -50%): the standard
      // slider look, and — unlike the "contain" default — it does NOT hide the thumb
      // behind a thumb-size measurement, which is brittle inside a shadow root. The
      // `.control` reserves half-a-thumb of padding so a centred thumb never clips.
      thumbAlignment: 'center',
      disabled: this.disabled,
      readOnly: this.readonly,
      invalid: this.invalid,
      name: this.name || undefined,
      onValueChange: (details: sliderMachine.ValueChangeDetails) => {
        this.value = details.value;
        this.dispatchEvent(
          new CustomEvent<sliderMachine.ValueChangeDetails>('value-change', {
            detail: details,
            bubbles: true,
            composed: true,
          }),
        );
      },
      onValueChangeEnd: (details: sliderMachine.ValueChangeDetails) => {
        this.dispatchEvent(
          new CustomEvent<sliderMachine.ValueChangeDetails>('value-change-end', {
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
      /* Size knobs the size axis maps onto. Dimension tokens may carry a literal
         fallback so the control is usable before tokens load; colour roles never do. */
      --_track-thickness: 0.375rem;
      --_thumb: 1.125rem;
      --_gap: ${litVar('--lab-space-xs', '0.25rem')};
      --_font: ${litVar('--lab-font-size-md', '1rem')};
      --_label-font: ${litVar('--lab-font-size-xs', '0.8333rem')};
      --_label-tracking: ${litVar('--lab-letter-spacing-xs', '-0.0009em')};
      --_help-font: ${litVar('--lab-font-size-xxs', '0.6944rem')};
      --_help-tracking: ${litVar('--lab-letter-spacing-xxs', '0.0064em')};
      --_line: ${litVar('--lab-line-height-md', '1.5')};

      display: block;
    }

    :host([size='s']) {
      --_track-thickness: 0.25rem;
      --_thumb: 0.875rem;
    }
    :host([size='l']) {
      --_track-thickness: 0.5rem;
      --_thumb: 1.375rem;
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: var(--_gap);
      font: inherit;
    }

    .label-row {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: ${litVar('--lab-space-sm', '0.5rem')};
    }

    .label {
      font-size: var(--_label-font);
      letter-spacing: var(--_label-tracking);
      line-height: var(--_line);
      color: ${litVar('--lab-label-secondary')};
    }
    :host([label-hidden]) .label {
      position: absolute;
      width: 1px;
      height: 1px;
      margin: -1px;
      padding: 0;
      border: 0;
      clip: rect(0 0 0 0);
      clip-path: inset(50%);
      overflow: hidden;
      white-space: nowrap;
    }

    /* The live value readout (the Zag valueText part). */
    .value-text {
      font-size: var(--_label-font);
      letter-spacing: var(--_label-tracking);
      line-height: var(--_line);
      color: ${litVar('--lab-label-primary')};
      font-variant-numeric: tabular-nums;
    }

    /* The control frame holds the track; padding reserves room for the thumb so it
       never clips at the ends (the machine positions the thumb in [0,100]%). */
    .control {
      position: relative;
      display: flex;
      align-items: center;
      padding-block: calc(var(--_thumb) / 2);
    }
    :host([orientation='vertical']) .control {
      height: 12rem;
      padding-block: 0;
      padding-inline: calc(var(--_thumb) / 2);
    }

    /* The track — the Zag track element. A neutral tint the range fills over. */
    .track {
      position: relative;
      flex: 1 1 auto;
      border-radius: ${litVar('--lab-radius-full', '9999px')};
      background-color: ${litVar('--lab-fill-primary')};
    }
    :host([orientation='horizontal']) .track {
      width: 100%;
      height: var(--_track-thickness);
    }
    :host([orientation='vertical']) .track {
      width: var(--_track-thickness);
      height: 100%;
    }

    /* The filled range — the Zag range element. Floating UI writes its inset via the
       machine's style, so it spans from the origin to the thumb(s). */
    .range {
      position: absolute;
      border-radius: inherit;
      background-color: ${litVar('--lab-fill-accent')};
    }
    :host([orientation='horizontal']) .range {
      top: 0;
      bottom: 0;
    }
    :host([orientation='vertical']) .range {
      left: 0;
      right: 0;
    }
    :host([invalid]) .range {
      background-color: ${litVar('--lab-fill-danger')};
    }

    /* The thumb — the Zag thumb element (role=slider). The machine writes its
       inset-inline/block-start as a percentage; we centre it on that point. */
    .thumb {
      position: absolute;
      width: var(--_thumb);
      height: var(--_thumb);
      border-radius: ${litVar('--lab-radius-full', '9999px')};
      background-color: ${litVar('--lab-control-bg')};
      border: ${litVar('--lab-stroke-hairline')} solid ${litVar('--lab-border-base')};
      box-shadow: var(--lab-elevation-raised);
      outline: none;
      cursor: grab;
      transform: translate(-50%, -50%);
      transition: box-shadow 120ms ease;
    }
    :host([orientation='horizontal']) .thumb {
      top: 50%;
    }
    :host([orientation='vertical']) .thumb {
      left: 50%;
    }
    .thumb:focus-visible {
      border-color: ${litVar('--lab-border-focus')};
      box-shadow: 0 0 0 ${litVar('--lab-focus-ring-width')} ${litVar('--lab-border-focus')};
    }
    :host([invalid]) .thumb:focus-visible {
      border-color: ${litVar('--lab-border-danger')};
      box-shadow: 0 0 0 ${litVar('--lab-focus-ring-width')} ${litVar('--lab-border-danger')};
    }
    .thumb[data-dragging] {
      cursor: grabbing;
    }

    /* Markers along the track — the Zag marker-group + marker elements. */
    .marker-group {
      position: absolute;
      inset: 0;
    }
    .marker {
      position: absolute;
      width: 0.125rem;
      height: 0.125rem;
      border-radius: ${litVar('--lab-radius-full', '9999px')};
      background-color: ${litVar('--lab-border-strong')};
      transform: translate(-50%, -50%);
    }
    :host([orientation='horizontal']) .marker {
      top: 50%;
    }
    :host([orientation='vertical']) .marker {
      left: 50%;
    }

    :host([disabled]) .control {
      cursor: not-allowed;
      opacity: 0.5;
    }
    :host([disabled]) .thumb {
      cursor: not-allowed;
    }

    /* Helper / error text, reusing the field's low-emphasis treatment. */
    .helper {
      font-size: var(--_help-font);
      letter-spacing: var(--_help-tracking);
      line-height: var(--_line);
      color: ${litVar('--lab-label-tertiary')};
    }
    .error {
      font-size: var(--_help-font);
      letter-spacing: var(--_help-tracking);
      line-height: var(--_line);
      color: ${litVar('--lab-label-danger')};
    }

    @media (prefers-reduced-motion: reduce) {
      .thumb {
        transition: none;
      }
    }
  `;

  /** The semantic inputs the shared a11y helper resolves the helper/error contract
   * from. The base id is the machine id, so the derived helper/error ids sit in the
   * same namespace as the machine's root/thumb/label ids without colliding. */
  private a11yInput(): FieldA11yInput {
    return {
      id: this.fieldId,
      invalid: this.invalid,
      // A slider has no native `required` (no empty state), so required is never set;
      // kept false so the field helper never emits aria-required on a group.
      required: false,
      hasHelper: this.helper.length > 0,
      hasError: this.error.length > 0,
    };
  }

  /** The number of thumbs the machine is driving this render — one per value entry. */
  private thumbCount(): number {
    const count = this.machineCtl.api.value.length;
    return count > 0 ? count : 1;
  }

  /** The live value readout text — the machine's current value(s) joined for display.
   * The Zag `getValueTextProps()` carries only the id + data-attrs, so the renderer
   * must write the text; this mirrors the React twin's `api.value.join(' – ')` exactly
   * so the visible readout is identical across renderers (ADR-0001 parity). */
  private valueText(): string {
    return this.machineCtl.api.value.join(' – ');
  }

  override updated(_changed: PropertyValues): void {
    // Spread the machine's connect props onto the real shadow nodes: group-level
    // (root, label, valueText, control, track, range, marker group) and the per-thumb
    // getters keyed by data-index. We do NOT clearSpreads() between renders — the
    // thumb getters set/clear data-focus/data-dragging as the active thumb changes,
    // and spreadProps' per-node diff removes attributes that drop out; clearing it
    // each render would leave a stale data-focus on the previously-active thumb (the
    // select/tabs canon).
    const api = this.machineCtl.api;
    const root = this.renderRoot;

    const rootEl = root.querySelector<HTMLElement>('.field');
    if (rootEl) this.machineCtl.spread(rootEl, api.getRootProps());

    const labelEl = root.querySelector<HTMLElement>('.label');
    if (labelEl) this.machineCtl.spread(labelEl, api.getLabelProps());

    // getValueTextProps() carries only the id + data-attrs (no text). The visible
    // value text is written reactively in render() via valueText(), mirroring the React
    // twin — here we only spread the machine's id/data-attrs onto the same span.
    const valueTextEl = root.querySelector<HTMLElement>('.value-text');
    if (valueTextEl) this.machineCtl.spread(valueTextEl, api.getValueTextProps());

    const controlEl = root.querySelector<HTMLElement>('.control');
    if (controlEl) this.machineCtl.spread(controlEl, api.getControlProps());

    const trackEl = root.querySelector<HTMLElement>('.track');
    if (trackEl) this.machineCtl.spread(trackEl, api.getTrackProps());

    const rangeEl = root.querySelector<HTMLElement>('.range');
    if (rangeEl) this.machineCtl.spread(rangeEl, api.getRangeProps());

    // The FIELD a11y contract — the description (helper) / errormessage wiring. The
    // machine's getThumbProps() emits the thumb's slider role + value ARIA +
    // aria-labelledby (its NAME), but NOT aria-describedby/aria-errormessage. So the
    // field's description must be applied to the THUMB itself — the focusable
    // role="slider" element a reader actually lands on — exactly as the sibling
    // number-input spreads field ARIA onto its focusable <input>. On the inert group
    // <label> it would never be announced (the label never receives focus).
    const fieldAria = fieldControlAria(this.a11yInput());

    // Per-thumb getters, keyed by the STABLE thumb index — never a positional DOM
    // query. Each thumb carries data-index; the machine keys its getters by index and
    // the id it puts on the thumb is what aria-labelledby/roving target. A hidden
    // input rides inside each thumb for form submission.
    const thumbs = root.querySelectorAll<HTMLElement>('.thumb');
    for (const thumbEl of thumbs) {
      const index = Number(thumbEl.dataset.index);
      if (Number.isNaN(index)) continue;
      this.machineCtl.spread(thumbEl, api.getThumbProps({ index }));
      // Apply the field description AFTER the machine spread (so it cannot be clobbered):
      // every focusable thumb announces the helper/error wherever roving focus lands.
      setOrRemove(thumbEl, 'aria-describedby', fieldAria['aria-describedby']);
      setOrRemove(thumbEl, 'aria-errormessage', fieldAria['aria-errormessage']);
      const hiddenInput = thumbEl.querySelector<HTMLInputElement>('input');
      if (hiddenInput) this.machineCtl.spread(hiddenInput, api.getHiddenInputProps({ index }));
    }

    // Markers, keyed by their value (the machine keys getMarkerProps by value).
    const markerGroup = root.querySelector<HTMLElement>('.marker-group');
    if (markerGroup) this.machineCtl.spread(markerGroup, api.getMarkerGroupProps());
    const markerEls = root.querySelectorAll<HTMLElement>('.marker');
    for (const markerEl of markerEls) {
      const value = Number(markerEl.dataset.value);
      if (Number.isNaN(value)) continue;
      this.machineCtl.spread(markerEl, api.getMarkerProps({ value }));
    }
  }

  override render(): TemplateResult {
    const ids = fieldPartIds(this.fieldId);
    const showError = fieldErrorIsActive(this.a11yInput());
    const thumbIndices = Array.from({ length: this.thumbCount() }, (_unused, i) => i);
    // Structure only; behaviour (slider role, value ARIA, keyboard, drag, positioning,
    // form value) is spread in updated() from the machine. The group label / helper /
    // error association is the shared field-a11y contract. SSR emits this real markup
    // so first paint is meaningful before any JS upgrades the element.
    return html`
      <div class="field" part="field">
        <div class="label-row">
          <label class="label" part="label">${this.label}</label>
          ${
            this.showValue
              ? html`<span class="value-text" part="value-text">${this.valueText()}</span>`
              : nothing
          }
        </div>
        <div class="control" part="control">
          <div class="track" part="track">
            <div class="range" part="range"></div>
            ${
              this.marks.length
                ? html`<div class="marker-group" part="marker-group">
                    ${this.marks.map(
                      (markValue) =>
                        html`<span class="marker" part="marker" data-value="${markValue}"></span>`,
                    )}
                  </div>`
                : nothing
            }
            ${thumbIndices.map(
              (index) => html`
                <div class="thumb" part="thumb" data-index="${index}">
                  <input />
                </div>
              `,
            )}
          </div>
        </div>
        ${
          this.helper
            ? html`<span id=${ids.helper} class="helper" part="helper">${this.helper}</span>`
            : nothing
        }
        ${
          showError
            ? html`<span id=${ids.error} class="error" part="error" role="alert">${this.error}</span>`
            : nothing
        }
      </div>
    `;
  }
}

/** Parse the `value` / `default-value` / `marks` attribute into a number[]. Accepts
 * JSON (`[20,80]`) or a comma/space list (`20,80`); a single number is one entry;
 * malformed or empty input is an empty list. */
function parseValues(raw: string | null): number[] {
  if (raw === null) return [];
  const trimmed = raw.trim();
  if (trimmed === '') return [];
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed.filter((v): v is number => typeof v === 'number' && !Number.isNaN(v));
    }
    if (typeof parsed === 'number' && !Number.isNaN(parsed)) return [parsed];
  } catch {
    // Not JSON — fall through to the comma/space list parse.
  }
  return trimmed
    .split(/[\s,]+/)
    .map((part) => Number(part))
    .filter((value) => !Number.isNaN(value));
}

/** Set an attribute when the value is defined, otherwise remove it. */
function setOrRemove(el: Element, name: string, value: string | undefined): void {
  if (value === undefined) el.removeAttribute(name);
  else el.setAttribute(name, value);
}

declare global {
  interface HTMLElementTagNameMap {
    'lab-slider': LabSlider;
  }
}

// Idempotent registration — safe across Lit SSR and client module instances.
if (typeof customElements !== 'undefined' && !customElements.get('lab-slider')) {
  customElements.define('lab-slider', LabSlider);
}
