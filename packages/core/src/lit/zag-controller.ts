/**
 * ZagController — runs a Zag machine inside a Lit element via `@zag-js/vanilla`.
 *
 * This is the Lit side of the Behaviors seam. It owns exactly one responsibility
 * (SRP): drive a `VanillaMachine` through the host's reactive lifecycle and keep
 * the host re-rendering when machine state changes. It does NOT paint and does
 * NOT define the machine — the machine is injected (DIP), the painting is the
 * element's `render()`.
 *
 * Two halves of the bridge:
 *   - machine -> Lit:  `subscribe` requests a host update on every transition, so
 *                      `render()` re-runs `connect(...)` and reflects new state.
 *   - Lit -> DOM:      `spread(node, props)` applies a `connect` prop-getter's
 *                      output (attributes, ARIA, event handlers) onto a real
 *                      shadow-DOM node, the vanilla way. Call it from
 *                      `hostUpdated()` once nodes exist.
 *
 * Shadow DOM: Zag queries the DOM through `getRootNode`. We point it at the
 * host's `renderRoot` (the shadow root) so id-based lookups resolve inside the
 * component, not the document — the documented Zag pattern for custom elements.
 */
import type { MachineSchema, Service } from '@zag-js/core';
import { type Attrs, VanillaMachine, normalizeProps, spreadProps } from '@zag-js/vanilla';
import type { ReactiveController, ReactiveControllerHost } from 'lit';
import type { MachineModule, MachineProps } from '../behaviors/types.js';

/** A Lit host that also exposes its render root (LitElement does). */
type LitHost = ReactiveControllerHost & { readonly renderRoot: HTMLElement | DocumentFragment };

export class ZagController<T extends MachineSchema, Api> implements ReactiveController {
  private readonly host: LitHost;
  private readonly module: MachineModule<T, Api>;
  private readonly getProps: () => MachineProps<T>;
  private machine?: VanillaMachine<T>;
  private unsubscribe?: () => void;
  /** Cleanups from each `spread()` call, run before the next paint to avoid leaks. */
  private spreadCleanups: Array<() => void> = [];

  /**
   * @param host     the Lit element hosting this controller.
   * @param module   the behavior to run (machine + connect) — the injected seam.
   * @param getProps reads the host's current props for the machine. Called on
   *                 connect and on every update so reflected attributes flow in.
   */
  constructor(host: LitHost, module: MachineModule<T, Api>, getProps: () => MachineProps<T>) {
    this.host = host;
    this.module = module;
    this.getProps = getProps;
    host.addController(this);
  }

  /**
   * Scope Zag's DOM queries to this element's render root. `renderRoot` is the
   * shadow root for a LitElement; Zag's `getRootNode` accepts any `Node`, so no
   * cast is needed (a `ShadowRoot`/`DocumentFragment` IS a `Node`).
   */
  private readonly getRootNode = (): Node => this.host.renderRoot;

  /** The machine props for this render: scope + the host's current props. */
  private machineProps(): MachineProps<T> & { getRootNode: () => Node } {
    return { getRootNode: this.getRootNode, ...this.getProps() };
  }

  hostConnected(): void {
    this.machine = new VanillaMachine(this.module.machine, () => this.machineProps());
    this.unsubscribe = this.machine.subscribe(() => this.host.requestUpdate());
    this.machine.start();
    this.host.requestUpdate();
  }

  hostUpdate(): void {
    // Feed the latest host props into the running machine before it renders, so
    // a reflected attribute change (e.g. `disabled`) reaches the machine.
    this.machine?.updateProps(() => this.machineProps());
  }

  hostDisconnected(): void {
    this.clearSpreads();
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    this.machine?.stop();
    this.machine = undefined;
  }

  /** The live machine API for this render. Call inside `render()`/`updated()`. */
  get api(): Api {
    if (!this.machine) {
      throw new Error('ZagController.api read before hostConnected — machine not started.');
    }
    return this.module.connect(this.machine.service as Service<T>, normalizeProps);
  }

  /** Send an event to the machine. */
  send(event: T['event']): void {
    this.machine?.send(event);
  }

  /**
   * Apply a `connect` prop-getter result onto a real shadow-DOM node (attrs,
   * ARIA, listeners) the vanilla way. Returns nothing; cleanup is tracked and
   * run automatically before the next paint and on disconnect.
   */
  spread(node: Element, props: Attrs): void {
    const cleanup = spreadProps(node, props);
    this.spreadCleanups.push(cleanup);
  }

  /** Drop all prior spreads. Call at the top of the element's `updated()`. */
  clearSpreads(): void {
    for (const cleanup of this.spreadCleanups) cleanup();
    this.spreadCleanups = [];
  }
}

export type { Attrs };
