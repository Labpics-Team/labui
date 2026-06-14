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

// PRODUCTION text fields — native-React twins of the Lit `<lab-input>` /
// `<lab-textarea>`. PRESENTATIONAL (no machine: the native control owns
// value/caret/editing), but they OWN the form-field a11y wiring (label / helper /
// error association) computed by the SAME shared `field-a11y` helper from core, so
// the ARIA contract is one source of truth across both renderers.
export { Input, type InputProps, type LabInputSize, type LabInputType } from './input.js';
export {
  Textarea,
  type TextareaProps,
  type LabTextareaSize,
  type LabTextareaType,
} from './textarea.js';

// PRODUCTION numeric form controls — native-React twins of the Lit
// `<lab-number-input>` / `<lab-slider>`, running the SAME `@zag-js/{number-input,
// slider}` machines via `useZag`. They REUSE the SAME shared `field-a11y` helper for
// the label / helper / error association as Input / Textarea, so the ARIA contract is
// one source of truth across both renderers and both controls.
export {
  NumberInput,
  type NumberInputProps,
  type LabNumberInputSize,
  type LabNumberInputType,
} from './number-input.js';
export {
  Slider,
  type SliderProps,
  type LabSliderOrientation,
  type LabSliderSize,
} from './slider.js';

// PRODUCTION compound form control — `<RadioGroup>` + `<Radio>` over the SAME
// `@zag-js/radio-group` machine as the Lit `<lab-radio-group>`.
export { RadioGroup, type RadioGroupProps, Radio, type RadioProps } from './radio-group.js';

// PRESENTATIONAL primitives — native-React twins of the Lit elements.
export { Badge, type BadgeProps } from './badge.js';
export { Kbd, type KbdProps } from './kbd.js';
export { Loader, type LoaderProps } from './loader.js';
export { Avatar, type AvatarProps } from './avatar.js';
export { Card, type CardProps } from './card.js';

// DISCLOSURE — native-React twins of the Lit `<lab-accordion>` (compound,
// @zag-js/accordion) and `<lab-progress>` (@zag-js/progress). Same machines via
// `useZag`, same one import surface.
export {
  Accordion,
  AccordionItem,
  type AccordionProps,
  type AccordionItemProps,
} from './accordion.js';
export { Progress, type ProgressProps } from './progress.js';

// POSITIONED OVERLAYS — native-React twins of the Lit `<lab-tooltip>` /
// `<lab-popover>`, running the SAME `@zag-js/{tooltip,popover}` machines via `useZag`.
export { Tooltip, type TooltipProps } from './tooltip.js';
export { Popover, type PopoverProps } from './popover.js';
// MODAL OVERLAYS — native-React twins of the Lit `<lab-dialog>` / `<lab-alert-dialog>`,
// running the SAME `@zag-js/dialog` machine via `useZag`. The floating layer is portalled
// to <body> so the modal focus-trap contains the dialog body with no caveat.
export { Dialog, type DialogProps } from './dialog.js';
export { AlertDialog, type AlertDialogProps } from './alert-dialog.js';
// PRODUCTION navigation — native-React twins of the Lit `<lab-tabs>` /
// `<lab-breadcrumb>` / `<lab-pagination>`. Tabs + Pagination run the SAME Zag
// machines via `useZag`; Breadcrumb is presentational. Same one import surface.
export { Tabs, Tab, TabPanel, type TabsProps, type TabProps, type TabPanelProps } from './tabs.js';
export { Breadcrumb, type BreadcrumbProps } from './breadcrumb.js';
export { Pagination, type PaginationProps } from './pagination.js';

// COMPOUND + POSITIONED controls — native-React twins of the Lit `<lab-select>` /
// `<lab-menu>`, running the SAME `@zag-js/{select,menu}` machines via `useZag`. They
// fuse the keyed-compound group machine (radio-group) with the positioned overlay
// (popover): a trigger + a body-portalled, machine-positioned listbox / menu.
export { Select, type SelectProps } from './select.js';
export { Menu, type MenuProps } from './menu.js';

export const PACKAGE_NAME = '@labpics/ui-react';
