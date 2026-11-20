import type { MachineSchema } from '@zag-js/core';
/**
 * LabElement — the base class every LabUI Lit component extends.
 *
 * It encodes the conventions shared by all ~38 components so a component file
 * carries only its own visuals + machine choice, never boilerplate:
 *   - `delegatesFocus`: focusing the host moves focus to the inner interactive
 *     node, so host-level focus styling and tab order are correct (a11y).
 *   - `runMachine(module, getProps)`: one call wires a Zag behavior to this
 *     element through a `ZagController` (the Behaviors seam). The component does
 *     not touch `VanillaMachine` directly — it depends on the abstraction.
 *
 * It deliberately does NOT define styles, props, or a `render()`. Those are the
 * component's single responsibility; the base only owns cross-cutting wiring.
 * Theming is invisible here by design: the element reads semantic `--lab-*`
 * roles in its own styles and never branches on the active theme/material.
 */
import { type CSSResultGroup, type CSSResultOrNative, LitElement, css } from 'lit';
import { LAB_INPUTS_PROPERTY, type LabInputBinding, forwardDeclared } from '../adapter-runtime.js';
import type { MachineModule, MachineProps } from '../behaviors/types.js';
import { ensureSlotProjection } from '../slot-projection.js';
import type { LabPropertyDeclaration } from './property.js';
import { LAB_ELEMENT_BRAND, SSR_INPUTS_ATTRIBUTE, parseSsrInputs } from './ssr-inputs.js';
import { ZagController } from './zag-controller.js';

/** Process-wide counter backing {@link LabElement.uid} — stable per instance. */
let labUidCounter = 0;

/**
 * Форма угла для shadow-контента: документные правила shadow-границу не
 * пересекают, а corner-shape не наследуется — лист добавляется каждому
 * компоненту через finalizeStyles (одна точка на всю систему). Значение ручки
 * приходит кастом-свойством (те наследуются): --lab-radius-corner-k из
 * токен-слоя. Без поддержки (не Chromium 139+) свойство игнорируется.
 */
const cornerShapeStyles = css`
  *,
  *::before,
  *::after {
    corner-shape: superellipse(var(--lab-radius-corner-k, 1.1));
  }
`;

export class LabElement extends LitElement {
  static readonly [LAB_ELEMENT_BRAND] = true;
  private restoredServerInputs = false;

  override connectedCallback(): void {
    ensureSlotProjection();
    super.connectedCallback();
  }

  /** Keep server artwork until its imported resources reach the upgraded element. */
  protected override shouldUpdate(): boolean {
    if (!this.hasUpdated && this.shadowRoot?.hasChildNodes()) {
      for (const [name, declaration] of (this.constructor as typeof LabElement).elementProperties) {
        if (
          (declaration as LabPropertyDeclaration).resource &&
          Reflect.get(this, name) === undefined
        )
          return false;
      }
    }
    return true;
  }

  /**
   * Non-reflected adapter input binding. A framework's ordinary property patch
   * runs before DOM insertion, so connection and machine startup see all inputs.
   * Hydration uses the same forwarder to adopt SSR values without replaying them
   * over a recovered user draft. No scheduling or component-specific behavior.
   */
  set [LAB_INPUTS_PROPERTY](binding: LabInputBinding | undefined) {
    if (binding) forwardDeclared(this, binding.specs, binding.props);
  }

  static override get observedAttributes(): string[] {
    // biome-ignore lint/complexity/noThisInStatic: preserve each subclass's declared attribute list
    return [...super.observedAttributes, SSR_INPUTS_ATTRIBUTE];
  }

  override attributeChangedCallback(name: string, old: string | null, value: string | null): void {
    if (name !== SSR_INPUTS_ATTRIBUTE) {
      super.attributeChangedCallback(name, old, value);
      return;
    }
    if (this.restoredServerInputs || value === null || this.hasUpdated) return;
    this.restoredServerInputs = true;
    const properties = (this.constructor as typeof LabElement).elementProperties;
    // Attribute reactions run after construction and before connectedCallback.
    // Component-specific dirty-input recovery and controllers see these inputs
    // in the same order as ordinary HTML attributes.
    for (const [property, input] of Object.entries(parseSsrInputs(value))) {
      const options = properties.get(property);
      if (options && !options.state && !(options as LabPropertyDeclaration).resource)
        Reflect.set(this, property, input);
    }
  }

  /** Форма угла — всем наследникам, поверх их собственных styles. */
  protected static override finalizeStyles(styles?: CSSResultGroup): Array<CSSResultOrNative> {
    // biome-ignore lint/complexity/noThisInStatic: super в статик-переопределении — точный механизм цепочки Lit (имя класса сломало бы промежуточных наследников)
    return [cornerShapeStyles, ...super.finalizeStyles(styles)];
  }

  static override shadowRootOptions: ShadowRootInit = {
    ...LitElement.shadowRootOptions,
    delegatesFocus: true,
  };

  /**
   * A stable, unique id for THIS instance — the Lit mirror of React's `useId`.
   * Generated once at construction and never reused, so a machine seeded with it
   * (`id: this.uid`) produces unique scoped ids per instance, never the colliding
   * `<component>:undefined:*` ids that result from passing no id at all. Scoped to
   * this element's shadow root anyway, so a plain counter is sufficient and
   * SSR-deterministic within a render pass.
   */
  protected readonly uid: string = `lab-${(labUidCounter++).toString(36)}`;

  /**
   * Whether this element has visible DEFAULT-slot content (i.e. a real label),
   * ignoring nodes assigned to a NAMED slot (decorative icons) and whitespace.
   * Used to decide the accessible-name source: a default-slot label feeds the
   * machine's `aria-labelledby`; without one, the control is named via
   * `aria-label`. Element children with a `slot=` attribute and whitespace-only
   * text nodes do not count.
   */
  protected hasDefaultSlotContent(): boolean {
    // SSR-safety: under @lit-labs/ssr the element instance has no traversable light
    // DOM, and the global DOM shim's `childNodes` is not iterable — iterating it
    // throws. We cannot know the slotted content at server render time, so assume the
    // common case (a visible default-slot label is present) and let client hydration
    // resolve the icon-only edge case. Client behaviour (iterable childNodes) is
    // unchanged; only the non-iterable SSR path is guarded.
    const nodes = this.childNodes as ArrayLike<Node> & { [Symbol.iterator]?: unknown };
    if (typeof nodes?.[Symbol.iterator] !== 'function') return true;
    for (const node of this.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        if (node.textContent?.trim()) return true;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        if (!(node as Element).hasAttribute('slot')) return true;
      }
    }
    return false;
  }

  /**
   * Attach a Zag behavior to this element. Returns the controller so the
   * component can read `.api` in `render()`, `.spread()` nodes in `updated()`,
   * and `.send()` events from handlers.
   */
  protected runMachine<T extends MachineSchema, Api>(
    module: MachineModule<T, Api>,
    getProps: () => MachineProps<T>,
  ): ZagController<T, Api> {
    return new ZagController<T, Api>(this, module, getProps);
  }
}
