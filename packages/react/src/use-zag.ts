/**
 * useZag — the React side of the Behaviors seam.
 *
 * Mirror of the Lit `LabElement.runMachine`: one call turns a `MachineModule`
 * (machine + connect — the SAME module the Lit base consumes) into the typed
 * prop-getter API, driven by `@zag-js/react`. The React renderer therefore
 * depends on the abstraction (`MachineModule`), never on the Lit controller and
 * never on a different machine (DIP, ADR-0001).
 *
 * This is deliberately the whole React "base" — A-prime's React path is native
 * and thin: there is no element base class to mirror, because React components
 * ARE functions. The shared weight (the machine, its types) lives in core; only
 * the visual binding is duplicated, which is the accepted cost of A-prime.
 */
'use client';

import type { MachineModule, MachineProps, MachineSchema } from '@labpics/ui-core';
import { normalizeProps, useMachine } from '@zag-js/react';

/**
 * Run a behavior in a React component and get its connected API.
 *
 * @param module   the behavior (machine + connect) — the injected seam.
 * @param props    machine props (id, defaults, change handlers). Pass a stable
 *                 `id` (e.g. from React's `useId`) for SSR-safe hydration.
 */
export function useZag<T extends MachineSchema, Api>(
  module: MachineModule<T, Api>,
  props: MachineProps<T>,
): Api {
  const service = useMachine(module.machine, props);
  return module.connect(service, normalizeProps);
}
