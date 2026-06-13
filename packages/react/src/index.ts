/**
 * @labpics/ui-react — the native React renderer (ADR-0001, A-prime).
 *
 * Thin React components over the shared Zag behaviors. No Lit in this path; the
 * heavy, shared weight (machines, the seam types) lives in @labpics/ui-core and
 * is re-exported here so React consumers have one import surface.
 */

// The React side of the Behaviors seam.
export { useZag } from './use-zag.js';

// Re-export the seam types from core so React consumers don't reach past the
// renderer for them.
export type {
  LabCheckboxChecked,
  MachineModule,
  MachineProps,
  MachineSchema,
  SchemaOf,
} from '@labpics/ui-core';

// PROOF element (see proof.tsx — a proof of the seam, not the production Button).
export { LabProofReact, type LabProofReactProps } from './proof.js';

// PRODUCTION Button — the native-React twin of the Lit `<lab-button>`.
export { Button, type ButtonProps } from './button.js';

// PRODUCTION machine-driven form controls — native-React twins of the Lit
// `<lab-switch>` / `<lab-checkbox>`, running the SAME Zag machines via `useZag`.
export { Switch, type SwitchProps } from './switch.js';
export { Checkbox, type CheckboxProps } from './checkbox.js';

// PRESENTATIONAL primitives — native-React twins of the Lit elements.
export { Badge, type BadgeProps } from './badge.js';
export { Kbd, type KbdProps } from './kbd.js';
export { Loader, type LoaderProps } from './loader.js';
export { Avatar, type AvatarProps } from './avatar.js';

// POSITIONED OVERLAYS — native-React twins of the Lit `<lab-tooltip>` /
// `<lab-popover>`, running the SAME `@zag-js/{tooltip,popover}` machines via `useZag`.
export { Tooltip, type TooltipProps } from './tooltip.js';
export { Popover, type PopoverProps } from './popover.js';

export const PACKAGE_NAME = '@labpics/ui-react';
