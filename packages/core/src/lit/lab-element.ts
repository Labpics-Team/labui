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
import { LitElement } from 'lit';
import type { MachineSchema } from '@zag-js/core';
import type { MachineModule, MachineProps } from '../behaviors/types.js';
import { ZagController } from './zag-controller.js';

/** Process-wide counter backing {@link LabElement.uid} — stable per instance. */
let labUidCounter = 0;

export class LabElement extends LitElement {
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
   * Reconcile the accessible name on a hidden `<input>` inside a Zag-machine
   * control (checkbox, switch). Both elements share identical logic:
   *
   * - With a visible default-slot label the machine's `aria-labelledby` (set by
   *   `spread()` onto the `.label` part) names the input correctly — remove any
   *   stale `aria-label` so it cannot compete.
   * - Without a visible label, `aria-labelledby` would resolve to an empty string
   *   and (per ARIA 1.2) still outrank `aria-label`, leaving the control unnamed.
   *   Drop the dangling reference and apply `aria-label` from the host attribute.
   */
  protected nameHiddenInput(input: HTMLInputElement, ariaLabel: string | null): void {
    if (this.hasDefaultSlotContent()) {
      input.removeAttribute('aria-label');
      return;
    }
    input.removeAttribute('aria-labelledby');
    if (ariaLabel) input.setAttribute('aria-label', ariaLabel);
    else input.removeAttribute('aria-label');
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
