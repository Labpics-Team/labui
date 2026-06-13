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

export const PACKAGE_NAME = '@labpics/ui-core';
