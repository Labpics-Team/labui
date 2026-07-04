/**
 * @labpics/ui-core — the cross-stack component core (ADR-0001, A-prime).
 *
 * This barrel is the renderer-agnostic + Lit surface every LabUI component
 * builds on. It exports:
 *   - the Behaviors seam (`MachineModule`) — the one abstraction both the Lit
 *     and React renderers depend on (DIP);
 *   - the Lit base (`LabElement`) and its Zag bridge (`ZagController`);
 *   - the theming contract (selector convention) and token-consumption helper.
 *
 * Two things live behind their own entries, intentionally NOT here, so they
 * never leak into a client bundle that doesn't need them:
 *   - the Lit SSR shim → `@labpics/ui-core/ssr`;
 *   - the `<lab-proof>` element (self-registering) → `@labpics/ui-core/proof`.
 *
 * CSS surfaces (`materials.css`, `glass.css`, `theme.css`) ship as side-effect
 * stylesheet exports.
 */

// Behaviors seam — the cross-renderer contract.
export type {
  Machine,
  MachineBaseProps,
  MachineModule,
  MachineProps,
  MachineSchema,
  NormalizeProps,
  PropTypes,
  SchemaOf,
  Service,
} from './behaviors/types.js';

// Lit base + Zag bridge.
export { LabElement } from './lit/lab-element.js';
export { type Attrs, ZagController } from './lit/zag-controller.js';

// Theming contract (selectors + helpers).
export {
  MATERIAL_ATTR,
  MATERIALS,
  type Material,
  setMaterial,
  setTheme,
  THEME_ATTR,
  THEME_FALLBACK,
  THEMES,
  type Theme,
} from './theme.js';

// Token-consumption convention.
export {
  cssVar,
  DIMENSION_PREFIXES,
  FORBIDDEN_PRIMITIVE_PREFIXES,
  type LabVar,
  litVar,
  SEMANTIC_ROLE_PREFIXES,
} from './css.js';

// Component axis types — the SINGLE source of truth for the public API shape, so
// the Lit element and the native React renderer never drift (core-CONTRACT §3).
// Type-only: importing these pulls NO Lit runtime into the React bundle.
export type {
  LabButtonHtmlType,
  LabButtonKind,
  LabButtonSize,
  LabButtonType,
} from './components/button/lab-button.js';
export type { LabBadgeColor, LabBadgeType } from './components/badge/lab-badge.js';
export type { LabKbdSize } from './components/kbd/lab-kbd.js';
export type { LabLoaderSize } from './components/loader/lab-loader.js';
export type {
  LabAvatarColor,
  LabAvatarSize,
  LabAvatarStatus,
} from './components/avatar/lab-avatar.js';
export type { LabCardPadding, LabCardVariant } from './components/card/lab-card.js';

// Machine-driven form controls — the first PRODUCTION consumers of the Behaviors
// seam (they own checked/indeterminate state, so they MUST run a Zag machine,
// unlike Button which honestly opted out). Type-only: no Lit runtime pulled in.
export type { LabSwitchSize, LabSwitchType } from './components/switch/lab-switch.js';
export type {
  LabCheckboxChecked,
  LabCheckboxSize,
  LabCheckboxType,
} from './components/checkbox/lab-checkbox.js';

// Text fields — PRESENTATIONAL form controls (Input / Textarea). @zag-js has no
// plain text-input machine (the native control owns value/caret/editing), so they
// honestly opt out of the seam — but they OWN the form-field a11y wiring (label /
// helper / error association), computed by the SHARED `field-a11y` helper so the
// Lit elements and the React twins cannot drift. The axis types are type-only (no
// Lit runtime); the a11y helper is framework-free runtime, consumed by both
// renderers as the single source of truth for the ARIA contract.
export type { LabInputSize, LabInputType } from './components/input/lab-input.js';
export type { LabTextareaSize, LabTextareaType } from './components/textarea/lab-textarea.js';

// Numeric form controls — machine-driven (they own a parsed numeric value with
// min/max/step, so they MUST run a Zag machine, unlike the plain text fields). They
// REUSE the SAME shared `field-a11y` helper for the label / helper / error
// association (not a second implementation). Type-only here: no Lit runtime pulled in.
export type {
  LabNumberInputSize,
  LabNumberInputType,
} from './components/number-input/lab-number-input.js';
export type { LabSliderOrientation, LabSliderSize } from './components/slider/lab-slider.js';
export {
  type FieldA11yInput,
  type FieldControlAria,
  type FieldPartIds,
  fieldControlAria,
  fieldControlAriaProps,
  fieldErrorIsActive,
  fieldPartIds,
  type LabFieldSize,
  type LabFieldType,
} from './components/field/field-a11y.js';

// Disclosure — the compound `<lab-accordion>` (a GROUP machine, the Radio/Tabs
// canon) and the single-machine `<lab-progress>`. Type-only: no Lit runtime
// pulled into the React bundle.
export type {
  LabAccordionItem,
  LabAccordionOrientation,
  LabAccordionSize,
} from './components/accordion/lab-accordion.js';
export type { LabProgressSize } from './components/progress/lab-progress.js';

// Compound + positioned controls — the canon fusing the keyed-compound group
// machine (radio-group) with the positioned, dismissable overlay (popover). Each
// runs its own Zag machine and is consumed by the React twin. Type-only here: no
// Lit runtime is pulled into the React bundle.
export type {
  LabSelectItem,
  LabSelectPlacement,
  LabSelectSize,
} from './components/select/lab-select.js';
export type {
  LabMenuItem,
  LabMenuPlacement,
  LabMenuSize,
} from './components/menu/lab-menu.js';

// Combobox — the COMPOUND + POSITIONED listbox (the Select canon) FUSED with the
// form-field a11y seam (the Input canon): a text input that NARROWS a positioned
// listbox as the user types. It runs `@zag-js/combobox` (machine-owned roles /
// aria-expanded/controls/activedescendant/autocomplete / keyboard / dismiss / value)
// AND reuses the SHARED `field-a11y` helper for the label / helper / error association,
// so the ARIA contract is one source of truth across both renderers. Type-only here:
// no Lit runtime is pulled into the React bundle. `filterComboboxItems` is the shared
// default filter (runtime), so narrowing is ONE rule across both renderers.
export type {
  LabComboboxItem,
  LabComboboxPlacement,
  LabComboboxSize,
  LabComboboxType,
} from './components/combobox/lab-combobox.js';
export { filterComboboxItems } from './components/combobox/lab-combobox.js';

// Advanced form inputs — both machine-driven, both REUSE the SHARED `field-a11y` helper
// for the label / helper / error association (not a second implementation):
//   - Pin Input (`@zag-js/pin-input`): N single-character segments; the machine owns each
//     box's value + focus-auto-advance + paste-fill + masking, the field a11y lands on the
//     control GROUP (role=group + describedby/required/invalid). Segments keyed by index
//     (they never reorder — index IS the machine's stable key).
//   - Tags Input (`@zag-js/tags-input`): a text input + removable chips; the machine owns
//     the tag array + input + add/remove/edit/keyboard, the field a11y lands on the input.
//     Идентичность чипа позиционна — {index, value} (allow-duplicates делает значение
//     неуникальным, value-ключ глушил бы дубли). The chip-control translations are
//     shared (runtime) so the delete-trigger / edit-input names are one rule across both
//     renderers. Type-only axis exports here: no Lit runtime pulled into the React bundle.
export type {
  LabPinInputSize,
  LabPinInputType,
  LabPinInputValueType,
} from './components/pin-input/lab-pin-input.js';
export type {
  LabTagsInputSize,
  LabTagsInputType,
} from './components/tags-input/lab-tags-input.js';
export { tagsInputTranslations } from './components/tags-input/lab-tags-input.js';

export const PACKAGE_NAME = '@labpics/ui-core';
