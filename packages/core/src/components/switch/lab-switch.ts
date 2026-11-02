import * as switchMachine from '@zag-js/switch';
/**
 * `<lab-switch>` — the first PRODUCTION component that CONSUMES a Zag machine
 * through the Behaviors seam (core-CONTRACT §1, the inverse of Button).
 *
 * Axes (the Figma model — Type × Toggle × Size × State × Icon):
 *   - type:  accent | neutral | danger   (semantic intent of the ON state)
 *   - size:  s | m | l
 *   - checked: текущее состояние элемента, отражённое для CSS и SSR
 *   - defaultChecked: начальное состояние до первого render
 *   - disabled: non-interactive
 *
 * Why a machine here, when Button opted out: a Switch HAS interaction state a
 * state machine owns — a `checked` lifecycle, `role="switch"` + `aria-checked`,
 * Space/Enter activation, focus management, and a hidden form input. Hand-rolling
 * those is exactly the "machinery the platform/Zag ships" Button declined to
 * rebuild. So this element runs `@zag-js/switch` through `ZagController`: the
 * машина задаёт переходы, клавиатуру, фокус и ARIA; текущее значение хранит элемент
 * (DIP — it depends on the injected `MachineModule`, never on a hand-written
 * toggle).
 *
 * Token contract (core-CONTRACT §2): ONLY semantic --lab-* roles + dimension
 * tokens via `litVar`. The ON track is `--lab-fill-{accent|neutral|danger}`; the
 * OFF track is `--lab-fill-primary`; the thumb is `--lab-control-bg`. No
 * hex, no primitive, no invented role. A theme is a different binding of those
 * roles on an ancestor — the element never knows which theme is active.
 *
 * SSR (core-CONTRACT §7): structure is always present (the machine spreads ARIA
 * in `updated()`), so `@lit-labs/ssr` emits a meaningful, styled control in the
 * declarative shadow DOM before any JS upgrades it.
 */
import { type TemplateResult, css, html } from 'lit';
import type { MachineModule, SchemaOf } from '../../behaviors/types.js';
import { litVar } from '../../css.js';
import { LabElement } from '../../lit/lab-element.js';
import type { ZagController } from '../../lit/zag-controller.js';

/** Semantic intent of the switch's ON state. */
export type LabSwitchType = 'accent' | 'neutral' | 'danger';
/** Control size. */
export type LabSwitchSize = 's' | 'm' | 'l';

type SwitchSchema = SchemaOf<switchMachine.Service>;
type SwitchApi = switchMachine.Api;

/**
 * The `@zag-js/switch` package seen through the renderer-agnostic seam. The
 * namespace already matches `MachineModule` structurally (a `machine` + a
 * `connect`); this binding names that fact so the controller is fully typed
 * with no casts — the SAME pattern the proof used for `@zag-js/toggle`.
 */
const switchModule: MachineModule<SwitchSchema, SwitchApi> = switchMachine;

export class LabSwitch extends LabElement {
  static override properties = {
    type: { reflect: true },
    size: { reflect: true },
    /** Текущее состояние; обновляется вводом и присваиванием свойства. */
    checked: { type: Boolean, reflect: true },
    /** Начальный вход; обычный атрибут отражает только разрешённый checked. */
    defaultChecked: { type: Boolean, attribute: 'default-checked' },
    disabled: { type: Boolean, reflect: true },
    /**
     * Accessible name for the no-visible-label case (e.g. an icon-only switch).
     * When set, it names the hidden input directly; a visible slotted label is
     * preferred over it via the machine's `aria-labelledby` when present.
     */
    ariaLabel: { attribute: 'aria-label', reflect: true },
    /** Native form field name for the hidden input (form participation). */
    name: { reflect: true },
  };

  declare type: LabSwitchType;
  declare size: LabSwitchSize;
  declare defaultChecked: boolean;
  declare disabled: boolean;
  declare ariaLabel: string | null;
  declare name: string | null;

  private readonly machineCtl: ZagController<SwitchSchema, SwitchApi>;
  private checkedValue: boolean | undefined;

  get checked(): boolean {
    return this.checkedValue ?? false;
  }

  set checked(value: boolean) {
    this.checkedValue = value;
  }

  constructor() {
    super();
    this.type = 'accent';
    this.size = 'm';
    this.defaultChecked = false;
    this.disabled = false;
    this.ariaLabel = null;
    this.name = null;
    // Значение всегда принадлежит элементу. Отражённый checked — проекция для
    // CSS, а не признак смены владельца: false тоже передаётся машине явно.
    // `id` is a stable per-instance value (mirrors React's `useId`) so the
    // machine's scoped ids — including the label id the input references — are
    // unique and real, never the colliding `switch:undefined:*`.
    this.machineCtl = this.runMachine(switchModule, () => ({
      id: this.uid,
      name: this.name ?? undefined,
      checked: this.checked,
      disabled: this.disabled,
      onCheckedChange: (details: switchMachine.CheckedChangeDetails) => {
        this.checked = details.checked;
        this.dispatchEvent(
          new CustomEvent<switchMachine.CheckedChangeDetails>('checked-change', {
            detail: details,
            bubbles: true,
            composed: true,
          }),
        );
      },
    }));
  }

  protected override willUpdate(): void {
    // Lit уже восстановил свойства, заданные до upgrade. Инициализация идёт
    // до hostUpdate контроллера и работает также при SSR; явный false сохранён.
    if (this.checkedValue === undefined) this.checked = this.defaultChecked;
  }

  static override styles = css`
    :host {
      /* Size knobs the size axis maps onto. Dimension tokens may carry a literal
         fallback so the control is usable before tokens load; colour roles never
         do (css.ts rule). */
      --_track-w: ${litVar('--lab-size-switch-track-m', '2.25rem')};
      --_track-h: ${litVar('--lab-size-switch-track-h-m', '1.25rem')};
      --_thumb: ${litVar('--lab-size-switch-thumb-m', '1rem')};
      /* Одинаковый отступ бегунка по обеим осям и в обоих состояниях. */
      --_inset: calc((var(--_track-h) - var(--_thumb)) / 2);
      --_gap: ${litVar('--lab-space-sm', '0.5rem')};
      --_font: ${litVar('--lab-font-size-switch-label', '1rem')};
      --_line: ${litVar('--lab-line-height-switch-label', '1.5')};
      --_tracking: ${litVar('--lab-letter-spacing-switch-label', '-0.015625em')};
      --_weight: ${litVar('--lab-font-weight-regular', '400')};

      display: inline-flex;
      vertical-align: middle;
    }

    :host([size='s']) {
      --_track-w: ${litVar('--lab-size-switch-track-s', '1.75rem')};
      --_track-h: ${litVar('--lab-size-switch-track-h-s', '1rem')};
      --_thumb: ${litVar('--lab-size-switch-thumb-s', '0.75rem')};
    }
    :host([size='l']) {
      --_track-w: ${litVar('--lab-size-switch-track-l', '2.75rem')};
      --_track-h: ${litVar('--lab-size-switch-track-h-l', '1.5rem')};
      --_thumb: ${litVar('--lab-size-switch-thumb-l', '1.25rem')};
      --_font: ${litVar('--lab-font-size-switch-label-l', '1.25rem')};
      --_line: ${litVar('--lab-line-height-switch-label-l', '1')};
      --_tracking: ${litVar('--lab-letter-spacing-switch-label-l', '-0.0165em')};
      --_gap: ${litVar('--lab-space-switch-label-gap-l', '0.75rem')};
      --_weight: ${litVar('--lab-font-weight-medium', '500')};
    }

    /* Root is the Zag label element: the whole control is one click/label target. */
    .root {
      display: inline-flex;
      align-items: center;
      min-height: ${litVar('--lab-size-switch-row', '1.5rem')};
      gap: var(--_gap);
      font: inherit;
      font-size: var(--_font);
      font-weight: var(--_weight);
      letter-spacing: var(--_tracking);
      line-height: var(--_line);
      color: ${litVar('--lab-label-primary')};
      cursor: pointer;
    }

    /* The track — the Zag control element. OFF surface is a neutral tint. */
    .control {
      box-sizing: border-box;
      position: relative;
      flex: 0 0 auto;
      display: inline-flex;
      align-items: center;
      width: var(--_track-w);
      height: var(--_track-h);
      padding: var(--_inset);
      border-radius: ${litVar('--lab-radius-full', '9999px')};
      background-color: ${litVar('--lab-fill-primary')};
      outline: var(--_lab-control-outline, none);
      transition: background-color var(--lab-motion-transition-duration) var(--lab-motion-transition-easing);
    }

    /* ON track surface, per type. Driven by the reflected checked attribute,
       which is driven by the machine — one source of truth. The longhand is set
       DIRECTLY (no var()->var() chain across the shadow boundary, which can go
       stale in Chromium on theme swap — proto-A note). */
    :host([checked][type='accent']) .control {
      background-color: ${litVar('--lab-fill-accent')};
    }
    :host([checked][type='neutral']) .control {
      background-color: ${litVar('--lab-fill-neutral')};
    }
    :host([checked][type='danger']) .control {
      background-color: ${litVar('--lab-fill-danger')};
    }

    /* The thumb — the Zag thumb element. Slides on the checked attribute. */
    .thumb {
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: var(--_thumb);
      height: var(--_thumb);
      border-radius: ${litVar('--lab-radius-full', '9999px')};
      background-color: ${litVar('--lab-control-bg')};
      outline: var(--_lab-control-outline, none);
      box-shadow: var(--lab-elevation-raised);
      transition: transform var(--lab-motion-transition-duration) var(--lab-motion-transition-easing);
      transform: translateX(0);
    }
    :host([checked]) .thumb {
      transform: translateX(calc(var(--_track-w) - var(--_thumb) - 2 * var(--_inset)));
    }

    /* Icon slots ride inside the track, revealed by checked state. */
    .icon {
      position: absolute;
      top: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: var(--_thumb);
      height: var(--_thumb);
      font-size: calc(var(--_track-h) * 0.5);
      color: ${litVar('--lab-label-on-accent')};
      transform: translateY(-50%);
      opacity: 0;
      transition: opacity var(--lab-motion-transition-duration) var(--lab-motion-transition-easing);
      pointer-events: none;
    }
    .icon-on {
      left: var(--_inset);
    }
    .icon-off {
      right: var(--_inset);
      color: ${litVar('--lab-label-tertiary')};
    }
    :host([checked]) .icon-on {
      opacity: 1;
    }
    :host(:not([checked])) .icon-off {
      opacity: 1;
    }

    /* Прямой соседний селектор обновляет кольцо при focus/blur в Shadow DOM.
       Input остаётся снаружи aria-hidden control и сохраняет доступность. */
    input:focus-visible + .control {
      outline: ${litVar('--lab-focus-ring-width')} solid ${litVar('--lab-border-focus')};
      outline-offset: ${litVar('--lab-focus-ring-offset')};
    }

    :host([disabled]) .root {
      cursor: not-allowed;
      opacity: 0.45;
    }

    /* The Zag hidden input — visually removed but kept in the a11y + form tree. */
    input {
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
  `;

  override updated(): void {
    // Apply the machine's connect props onto the real shadow nodes (role,
    // aria-checked, click/keyboard handlers, hidden input). Clear prior spreads
    // first to avoid stacking listeners across renders.
    this.machineCtl.clearSpreads();
    const api = this.machineCtl.api;
    const root = this.renderRoot.querySelector<HTMLElement>('.root');
    const control = this.renderRoot.querySelector<HTMLElement>('.control');
    const thumb = this.renderRoot.querySelector<HTMLElement>('.thumb');
    const label = this.renderRoot.querySelector<HTMLElement>('.label');
    const input = this.renderRoot.querySelector<HTMLInputElement>('input');
    if (root) this.machineCtl.spread(root, api.getRootProps());
    if (control) this.machineCtl.spread(control, api.getControlProps());
    if (thumb) this.machineCtl.spread(thumb, api.getThumbProps());
    // Spread the label part so the id the machine's `aria-labelledby` targets
    // actually exists — without this the reference dangles and the name is lost.
    if (label) this.machineCtl.spread(label, api.getLabelProps());
    if (input) {
      this.machineCtl.spread(input, api.getHiddenInputProps());
      this.nameHiddenInput(input);
    }
  }

  /**
   * Reconcile the input's accessible name. With a visible label the machine's
   * `aria-labelledby` (→ the `.label` part) names it. With NO visible label, that
   * reference would resolve to empty and (per ARIA) outrank `aria-label`, leaving
   * the control unnamed — so drop the dangling reference and apply `aria-label`.
   */
  private nameHiddenInput(input: HTMLInputElement): void {
    if (this.hasDefaultSlotContent()) {
      input.removeAttribute('aria-label');
      return;
    }
    input.removeAttribute('aria-labelledby');
    if (this.ariaLabel) input.setAttribute('aria-label', this.ariaLabel);
    else input.removeAttribute('aria-label');
  }

  override render(): TemplateResult {
    // Structure only; behavior (role=switch, aria-checked, keyboard, focus) is
    // spread in `updated()` from the machine. SSR emits this real markup so first
    // paint is meaningful before any JS upgrades the element. The hidden input is
    // a SIBLING of the (aria-hidden) control — NOT a descendant — so it stays in
    // the accessibility tree (an aria-hidden ancestor would erase it).
    return html`
      <label class="root">
        <input type="checkbox" />
        <span class="control">
          <span class="icon icon-on" aria-hidden="true"><slot name="icon-on"></slot></span>
          <span class="icon icon-off" aria-hidden="true"><slot name="icon-off"></slot></span>
          <span class="thumb"></span>
        </span>
        <span class="label"><slot></slot></span>
      </label>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lab-switch': LabSwitch;
  }
}

// Idempotent registration — safe across Lit SSR and client module instances.
if (typeof customElements !== 'undefined' && !customElements.get('lab-switch')) {
  customElements.define('lab-switch', LabSwitch);
}
