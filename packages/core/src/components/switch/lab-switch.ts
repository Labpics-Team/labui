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
 * state machine owns — a `checked` lifecycle, Space activation, focus management,
 * and the checkbox input's accessibility and form props. Hand-rolling
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
import { type TemplateResult, css, html, nothing } from 'lit';
import { ifDefined } from 'lit/directives/if-defined.js';
import type { MachineModule, SchemaOf } from '../../behaviors/types.js';
import { litVar } from '../../css.js';
import { LabElement } from '../../lit/lab-element.js';
import type { ZagController } from '../../lit/zag-controller.js';
import { type SwitchMotion, mountSwitchMotion } from '../../motion/index.js';
import {
  type SwitchLabelContent,
  observeSwitchLabelContent,
  switchLabelDomContent,
} from './label-content.js';

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

function isLabelElement(node: Node): node is Element {
  return node.nodeType === Node.ELEMENT_NODE;
}

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
    /** Подпись перед дорожкой; default slot сохраняет подпись после неё. */
    labelStart: { attribute: 'label-start', reflect: true },
    /** Скрытая сторона не занимает место и не участвует в доступном имени. */
    hideLabelStart: { type: Boolean, attribute: 'hide-label-start', reflect: true },
    hideLabelEnd: { type: Boolean, attribute: 'hide-label-end', reflect: true },
  };

  declare type: LabSwitchType;
  declare size: LabSwitchSize;
  declare defaultChecked: boolean;
  declare disabled: boolean;
  declare ariaLabel: string | null;
  declare name: string | null;
  declare labelStart: string;
  declare hideLabelStart: boolean;
  declare hideLabelEnd: boolean;

  private readonly machineCtl: ZagController<SwitchSchema, SwitchApi>;
  private thumbMotion?: SwitchMotion;
  private checkedValue: boolean | undefined;
  private stopLabelObservation?: () => void;
  private labelSlot?: HTMLSlotElement;

  private get labelStartId(): string {
    return `${this.uid}-label-start`;
  }

  private get labelEndId(): string {
    return `${this.uid}-label-end`;
  }

  private labelEndContent(): SwitchLabelContent {
    const slot = this.renderRoot?.querySelector<HTMLSlotElement>('.label-end > slot');
    if (slot) return switchLabelDomContent([slot], undefined, slot.parentElement ?? undefined);
    const nodes = this.childNodes as ArrayLike<Node> & { [Symbol.iterator]?: unknown };
    // Lit SSR не предоставляет light DOM; итоговая SSR-проекция видит назначение.
    if (typeof nodes?.[Symbol.iterator] !== 'function') return 'unknown';
    return switchLabelDomContent(
      [...this.childNodes].filter(
        (node) => !isLabelElement(node) || !(node.getAttribute('slot') ?? ''),
      ),
    );
  }

  private visibleLabelIds(): string[] {
    return [
      !this.hideLabelStart && this.labelStart?.trim() ? this.labelStartId : undefined,
      !this.hideLabelEnd && this.labelEndContent() === 'present' ? this.labelEndId : undefined,
    ].filter((id): id is string => id !== undefined);
  }

  get checked(): boolean {
    return this.checkedValue ?? false;
  }

  set checked(value: boolean) {
    this.checkedValue = value;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // При reconnect Lit сохраняет shadow nodes; updated возвращает им motion scope.
    this.requestUpdate();
  }

  override disconnectedCallback(): void {
    this.thumbMotion?.dispose();
    this.thumbMotion = undefined;
    this.stopLabelObservation?.();
    this.stopLabelObservation = undefined;
    this.labelSlot = undefined;
    super.disconnectedCallback();
  }

  constructor() {
    super();
    this.type = 'accent';
    this.size = 'm';
    this.defaultChecked = false;
    this.disabled = false;
    this.ariaLabel = null;
    this.name = null;
    this.labelStart = '';
    this.hideLabelStart = false;
    this.hideLabelEnd = false;
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

    .label[hidden],
    .label-start[hidden] {
      display: none;
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
      /* Цвет назначается сразу: промежуточные пары контраста не квалифицированы. */
    }

    /* Одна проекция состояния для SSR и Zag управляет всей анатомией.
       Цветовой longhand читает роль прямо, без дополнительной цепочки var(). */
    :host([type='accent']) .root[data-state='checked'] .control {
      background-color: ${litVar('--lab-fill-accent')};
    }
    :host([type='neutral']) .root[data-state='checked'] .control {
      background-color: ${litVar('--lab-fill-neutral')};
    }
    :host([type='danger']) .root[data-state='checked'] .control {
      background-color: ${litVar('--lab-fill-danger')};
    }

    /* Положение бегунка читает ту же проекцию состояния, что дорожка и иконки. */
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
    .root[data-state='checked'] .thumb {
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
      /* Содержимое не проходит через промежуточную прозрачность. */
      pointer-events: none;
    }
    .icon-on {
      left: var(--_inset);
    }
    .icon-off {
      right: var(--_inset);
      color: ${litVar('--lab-label-tertiary')};
    }
    .root[data-state='checked'] .icon-on {
      opacity: 1;
    }
    .root[data-state='unchecked'] .icon-off {
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
    // Apply the machine's connect props onto the real shadow nodes (ARIA,
    // click/keyboard handlers, hidden input). Clear prior spreads
    // first to avoid stacking listeners across renders.
    this.machineCtl.clearSpreads();
    const api = this.machineCtl.api;
    const root = this.renderRoot.querySelector<HTMLElement>('.root');
    const control = this.renderRoot.querySelector<HTMLElement>('.control');
    const thumb = this.renderRoot.querySelector<HTMLElement>('.thumb');
    const labelStart = this.renderRoot.querySelector<HTMLElement>('.label-start');
    const labelEnd = this.renderRoot.querySelector<HTMLElement>('.label-end');
    const input = this.renderRoot.querySelector<HTMLInputElement>('input');
    const slot = labelEnd?.querySelector<HTMLSlotElement>('slot');
    if (slot && this.isConnected && slot !== this.labelSlot) {
      this.stopLabelObservation?.();
      this.labelSlot = slot;
      this.stopLabelObservation = observeSwitchLabelContent(
        slot,
        this.requestLabelUpdate,
        labelEnd ?? undefined,
      );
    }
    if (root) this.machineCtl.spread(root, api.getRootProps());
    if (control) this.machineCtl.spread(control, api.getControlProps());
    if (thumb) this.machineCtl.spread(thumb, api.getThumbProps());
    // Поведение остаётся у Zag; двумя существующими сторонами и их ID владеет Switch.
    if (labelStart) {
      this.machineCtl.spread(labelStart, { ...api.getLabelProps(), id: this.labelStartId });
    }
    if (labelEnd) {
      this.machineCtl.spread(labelEnd, { ...api.getLabelProps(), id: this.labelEndId });
    }
    if (input) {
      const ids = this.visibleLabelIds();
      this.machineCtl.spread(input, {
        ...api.getHiddenInputProps(),
        // null удаляет SSR-атрибут даже при первом spread; undefined не меняет его.
        'aria-labelledby': ids.length ? ids.join(' ') : null,
        'aria-label': ids.length ? null : this.ariaLabel,
      });
    }
    if (control && thumb && this.isConnected) {
      this.thumbMotion ??= mountSwitchMotion(this.renderRoot, control, thumb, api.checked);
      this.thumbMotion.update(api.checked);
    }
  }

  override render(): TemplateResult {
    const checked = this.checked;
    const ids = this.visibleLabelIds();
    // Structure only; behavior (input props, keyboard, focus) is
    // spread in `updated()` from the machine. SSR emits this real markup so first
    // paint is meaningful before any JS upgrades the element. The hidden input is
    // a SIBLING of the (aria-hidden) control — NOT a descendant — so it stays in
    // the accessibility tree (an aria-hidden ancestor would erase it).
    return html`
      <label class="root" data-state=${checked ? 'checked' : 'unchecked'} data-lab-switch>
        <span class="label-start" id=${this.labelStartId}
          ?hidden=${this.hideLabelStart || !this.labelStart?.trim()}>${this.labelStart || nothing}</span>
        <input type="checkbox" ?checked=${checked} ?disabled=${this.disabled}
          name=${ifDefined(this.name ?? undefined)}
          aria-labelledby=${ifDefined(ids.length ? ids.join(' ') : undefined)}
          aria-label=${ifDefined(this.ariaLabel ?? undefined)} />
        <span class="control">
          <span class="icon icon-on" aria-hidden="true"><slot name="icon-on"></slot></span>
          <span class="icon icon-off" aria-hidden="true"><slot name="icon-off"></slot></span>
          <span class="thumb"></span>
        </span>
        <span class="label label-end" id=${this.labelEndId}
          ?hidden=${this.hideLabelEnd || this.labelEndContent() === 'empty'}><slot></slot></span>
      </label>
    `;
  }

  private readonly requestLabelUpdate = (): void => {
    this.requestUpdate();
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'lab-switch': LabSwitch;
  }
}
