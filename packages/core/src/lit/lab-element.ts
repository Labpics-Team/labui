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

export class LabElement extends LitElement {
  static override shadowRootOptions: ShadowRootInit = {
    ...LitElement.shadowRootOptions,
    delegatesFocus: true,
  };

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
