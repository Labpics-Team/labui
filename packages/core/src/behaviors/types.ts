/**
 * The Behaviors seam — the one abstraction both renderers depend on (DIP).
 *
 * A LabUI component's interaction logic lives in a Zag machine package
 * (`@zag-js/<component>`): a `machine` definition plus a `connect(service,
 * normalize)` that maps a running service to a typed prop-getter API. That pair
 * is the *only* thing a renderer needs to know about a component's behavior.
 *
 * `MachineModule<T, Api>` names that pair. The Lit base (via a reactive
 * controller running `@zag-js/vanilla`) and the native React base (via
 * `@zag-js/react`) both consume a `MachineModule` — neither the machine nor the
 * other renderer knows which renderer is driving it. Swapping Zag for a
 * hand-rolled Behaviors layer later changes the modules behind this type, not
 * the components that consume it (ADR-0001, "reversible default").
 */
import type { Machine, MachineSchema, Service } from '@zag-js/core';
import type { NormalizeProps, PropTypes } from '@zag-js/types';

/**
 * A component's behavior, renderer-agnostic: the Zag machine plus its `connect`.
 *
 * `T` is the machine schema (state, props, context, events). `Api` is the shape
 * `connect` returns — the typed prop-getter surface the visual layer spreads
 * onto its DOM nodes. Every `@zag-js/<component>` package already matches this
 * shape; this type just pins the contract so renderers stay decoupled from any
 * specific machine.
 */
export interface MachineModule<T extends MachineSchema, Api> {
  readonly machine: Machine<T>;
  connect<P extends PropTypes>(service: Service<T>, normalize: NormalizeProps<P>): Api;
}

/**
 * Props every Zag machine accepts regardless of component, mirrored from core's
 * internal `MachineBaseProps` (not exported by `@zag-js/core`). A renderer always
 * supplies `id` (SSR-stable) and, for Shadow DOM, `getRootNode`; component
 * packages don't always re-declare these on their own props interface, so the
 * seam adds them back.
 */
export interface MachineBaseProps {
  id?: string | undefined;
  ids?: Record<string, string> | undefined;
  getRootNode?: (() => ShadowRoot | Document | Node) | undefined;
}

/** The props a machine accepts, as seen by a renderer wiring it up. */
export type MachineProps<T extends MachineSchema> = Partial<T['props']> & MachineBaseProps;

/**
 * Recover a machine's schema from its `Service` type. Zag component packages
 * export `Service` (= `Service<Schema>`) but not always the bare `Schema`; this
 * lets a renderer name the schema without the package re-exporting it.
 */
export type SchemaOf<S> = S extends Service<infer T> ? T : never;

export type { Machine, MachineSchema, Service } from '@zag-js/core';
export type { NormalizeProps, PropTypes } from '@zag-js/types';
