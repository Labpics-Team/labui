/**
 * <Button> (Vue) — a THIN wrapper over the Lit `<lab-button>` custom element.
 *
 * ADR-0001 (A-prime): React is the ONE native renderer; Vue / Svelte / Solid /
 * Astro are delivered AS the Lit Web Components, not as a second visual
 * implementation. So this component renders the real `<lab-button>` custom
 * element and forwards props → attributes/properties, events, and slots onto
 * it. It re-implements NOTHING: the markup (spinner + label + icon slot), the
 * styles (semantic `--lab-*` roles in the element's shadow root), the a11y
 * (role / Enter-Space / focus / accessible-name forwarding) and the SSR shape
 * all live once in the Lit core. The only weight this package adds is the thin
 * Vue prop/slot binding.
 *
 * Registration: the side-effect import below upgrades `<lab-button>`, so
 * consuming `<Button>` from Vue brings the element with it — no separate setup
 * step (parity with how the React demo imports `@labpics/ui-core/button`).
 * `@labpics/ui-core` is external to this package's build (tsup), so the Lit
 * runtime is resolved once at the consumer, never bundled per-adapter.
 *
 * Axis types are a type-only import from the same core, so the Vue API cannot
 * drift from the Lit / React ones (core-CONTRACT §3 — one source of truth).
 */
import '@labpics/ui-core/button';

import type {
  LabButtonHtmlType,
  LabButtonKind,
  LabButtonSize,
  LabButtonType,
} from '@labpics/ui-core';
import { type PropType, type SlotsType, type VNodeChild, defineComponent, h } from 'vue';

export interface ButtonProps {
  /** Semantic intent of the action. */
  type?: LabButtonType;
  /** Surface treatment. Separation is by surface, never a border on top. */
  kind?: LabButtonKind;
  /** Control size. */
  size?: LabButtonSize;
  /**
   * Square, icon-only button (the `icon` slot fills it; no label). An icon-only
   * button has no visible text, so it MUST be named with an `aria-label` — that
   * attribute falls through onto the `<lab-button>` host (Vue attribute
   * forwarding), and the Lit element forwards it onto the inner shadow
   * `<button>` for the icon-only case (WCAG 4.1.2). One prop, every renderer
   * (ADR-0001 parity).
   */
  icon?: boolean;
  /** Shows a spinner and blocks interaction without collapsing layout. */
  loading?: boolean;
  /** Disables the control. */
  disabled?: boolean;
  /** Native button behaviour inside a form. Maps to the `<button type>` inside. */
  htmlType?: LabButtonHtmlType;
}

/** Parity with the Lit `icon` slot / React `iconSlot` prop, and the default slot. */
export interface ButtonSlots {
  /** Leading icon content (projected into the element's `icon` slot). */
  icon?: () => unknown;
  /** Label content (projected into the element's default slot). */
  default?: () => unknown;
}

export const Button = defineComponent({
  name: 'LabButtonVue',
  // We forward attrs onto the custom element explicitly (below), so opt out of
  // Vue's automatic root-inheritance to avoid applying them twice.
  inheritAttrs: false,
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
      const iconSlot = slots.icon?.();
      return h(
        'lab-button',
        {
          // Native attrs (aria-label, data-*, name, form, onClick, …) reach the
          // custom-element host — Vue attribute forwarding, the parity twin of
          // React's `{...rest}` spread and the Lit host attributes.
          ...attrs,
          type: props.type,
          kind: props.kind,
          size: props.size,
          // Booleans as `value || undefined`: correct whether Vue sets a DOM
          // property (element already upgraded) OR an attribute (pre-upgrade /
          // SSR) — a bare `false` would render `icon="false"`, which Lit's
          // boolean attribute converter reads as PRESENT ⇒ true. `undefined`
          // removes it on every path.
          icon: props.icon || undefined,
          loading: props.loading || undefined,
          disabled: props.disabled || undefined,
          // The element observes the `html-type` attribute (its property is
          // `htmlType`); passing the attribute name resolves correctly on both
          // the client and under SSR, independent of upgrade timing.
          'html-type': props.htmlType,
        },
        [
          // The icon goes into the element's named `icon` slot. `display:contents`
          // keeps the projection wrapper out of layout, so the shadow flex row is
          // identical to a directly-authored `<lab-button>`.
          iconSlot
            ? h('span', { slot: 'icon', style: 'display:contents' }, [iconSlot as VNodeChild])
            : null,
          slots.default?.() as VNodeChild,
        ],
      );
    };
  },
});
