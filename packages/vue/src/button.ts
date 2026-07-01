/**
 * <Button> (Vue) — the native-Vue twin of the Lit `<lab-button>` (ADR-0001).
 *
 * Same public axes, same semantic --lab-* roles, same structure (spinner +
 * label with an optional leading icon slot), same interaction states as the
 * Lit element and the React twin — so parity across all three renderers is a
 * matter of CSS + markup, not a second behaviour implementation.
 *
 * Thin per ADR-0001/A-prime: the axis types are a type-only import from
 * @labpics/ui-core (no Lit runtime pulled in), and a Button has no interaction
 * state a state machine would own (same opt-out the Lit element documents) —
 * so this is a plain `defineComponent` with a render function. No Vue SFC
 * compiler is needed (no `.vue` file): `h()` calls compile with the same
 * esbuild pass tsup already runs, keeping the Vue package's toolchain as thin
 * as its runtime footprint.
 *
 * A real native `<button>` is rendered (not a wrapper element), so role,
 * Enter/Space activation, and focus come from the platform — the component
 * only paints and forwards attributes, exactly like the React twin.
 */
import type {
  LabButtonHtmlType,
  LabButtonKind,
  LabButtonSize,
  LabButtonType,
} from '@labpics/ui-core';
import { type PropType, type SlotsType, type VNodeChild, defineComponent, h } from 'vue';
import './button.css';

export interface ButtonProps {
  /** Semantic intent of the action. */
  type?: LabButtonType;
  /** Surface treatment. Separation is by surface, never a border on top. */
  kind?: LabButtonKind;
  /** Control size. */
  size?: LabButtonSize;
  /**
   * Square, icon-only button (the `icon` slot fills it; no label). An
   * icon-only button has no visible text, so it MUST be named with an
   * `aria-label` — that attribute reaches the native `<button>` via Vue's
   * automatic attribute fallthrough (parity with the Lit host `aria-label`
   * forwarding and the React `{...rest}` spread — ADR-0001, one prop, every
   * renderer).
   */
  icon?: boolean;
  /** Shows a spinner and blocks interaction without collapsing layout. */
  loading?: boolean;
  /** Disables the control. */
  disabled?: boolean;
  /** Native button behaviour inside a form. Maps to the DOM `type` attribute. */
  htmlType?: LabButtonHtmlType;
}

/** Parity with the Lit `icon` slot / React `iconSlot` prop, and the default slot. */
export interface ButtonSlots {
  /** Leading icon content. */
  icon?: () => unknown;
  /** Label content. */
  default?: () => unknown;
}

export const Button = defineComponent({
  name: 'LabButtonVue',
  props: {
    type: { type: String as PropType<LabButtonType>, default: 'accent' },
    kind: { type: String as PropType<LabButtonKind>, default: 'fill' },
    size: { type: String as PropType<LabButtonSize>, default: 'm' },
    icon: { type: Boolean, default: false },
    loading: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    htmlType: { type: String as PropType<LabButtonHtmlType>, default: 'button' },
  },
  slots: Object as SlotsType<ButtonSlots>,
  setup(props, { slots, attrs }) {
    return () => {
      // Loading OR disabled blocks interaction — same rule as the Lit element
      // and the React twin.
      const inactive = props.disabled || props.loading;
      return h(
        'button',
        {
          // Native attrs (aria-label, name, form, …) fall through onto the real
          // <button> — Vue's default, undeclared-prop passthrough (parity with
          // React's `{...rest}` spread).
          ...attrs,
          type: props.htmlType,
          disabled: inactive,
          'aria-busy': props.loading ? 'true' : undefined,
          'aria-disabled': props.disabled ? 'true' : undefined,
          'data-lab-button': '',
          'data-type': props.type,
          'data-kind': props.kind,
          'data-size': props.size,
          'data-icon': props.icon || undefined,
          'data-loading': props.loading || undefined,
        },
        [
          h('span', { class: 'lab-button-spinner', 'aria-hidden': 'true' }),
          h('span', { class: 'lab-button-label' }, [
            slots.icon?.() as VNodeChild,
            slots.default?.() as VNodeChild,
          ]),
        ],
      );
    };
  },
});
