/**
 * Token-consumption convention — the three languages, enforced in code.
 *
 * primitives -> semantic roles -> components. A component reads ONLY the
 * semantic role layer (`--lab-label-*`, `--lab-fill-*`, `--lab-border-*`,
 * `--lab-bg-*`, `--lab-fx-*`), the material roles (`--lab-mat-*`), and the
 * dimension layer (`--lab-space-*`, `--lab-radius-*`, `--lab-z-*`,
 * `--lab-font-*`, `--lab-line-height-*`). It NEVER reads a primitive
 * (`--lab-neutral-*`, `--lab-accent-*`) and NEVER hardcodes a hex.
 *
 * `cssVar` is the single way to reference a token in TS-authored styles, so the
 * `--lab-*` contract is the only surface a component touches. The exact role
 * names are owned by @labpics/colors (it extends the contract to the full
 * Labels/Fills/Border/Backgrounds/FX set); this scaffold depends on the NAMES,
 * never on the values.
 */

import { type CSSResult, unsafeCSS } from 'lit';

/** A `--lab-*` custom-property name (the only token shape a component may read). */
export type LabVar = `--lab-${string}`;

/**
 * Reference a token, optionally with a fallback. The fallback may be another
 * token (a `--lab-*` name → wrapped in its own `var()`, as CSS requires) or a
 * literal dimension value (e.g. `1rem`). Fallbacks are for DIMENSION tokens,
 * where a sensible default keeps a component usable before tokens load; role
 * (colour) tokens take no literal fallback — a missing role is a contract bug,
 * not something to paper over with a baked-in colour.
 */
export function cssVar(name: LabVar, fallback?: LabVar | (string & {})): string {
  if (fallback === undefined) return `var(${name})`;
  // A `--lab-*` fallback is a custom property, not a value: it must be `var()`-ed.
  const resolved = fallback.startsWith('--') ? `var(${fallback})` : fallback;
  return `var(${name}, ${resolved})`;
}

/**
 * The same token reference as `cssVar`, typed as a Lit `CSSResult` for use inside
 * a `css\`\`` template. The name is a controlled `--lab-*` token (never user
 * input), so `unsafeCSS` is safe here — it is the documented Lit way to splice a
 * computed token reference into scoped styles. Lit components use this; React /
 * inline-style consumers use the string `cssVar`.
 */
export function litVar(name: LabVar, fallback?: LabVar | (string & {})): CSSResult {
  return unsafeCSS(cssVar(name, fallback));
}

/**
 * The semantic role families a component is permitted to read. This is a
 * documentation+lint anchor, not an exhaustive enum (the full set is owned by
 * @labpics/colors) — it states the LANGUAGE boundary: these prefixes are legal,
 * primitive prefixes are not.
 */
export const SEMANTIC_ROLE_PREFIXES = [
  '--lab-label-', // text / foreground
  '--lab-fill-', // surface fills
  '--lab-border-', // borders
  '--lab-bg-', // backgrounds
  '--lab-fx-', // glow / focus-ring / shadow / skeleton
  '--lab-mat-', // material roles (from materials.css)
] as const;

/** The dimension role families (from @labpics/ui-tokens). Always legal to read. */
export const DIMENSION_PREFIXES = [
  '--lab-space-',
  '--lab-radius-',
  '--lab-z-',
  '--lab-font-',
  '--lab-line-height-',
  '--lab-stroke-', // border / divider line widths (not the --lab-border-* colour role)
  '--lab-focus-ring-', // focus indicator width + offset
] as const;

/**
 * Primitive prefixes a component must NEVER read directly (they are the first of
 * the three languages, reserved for the colour engine). Listed so reviews and a
 * future lint rule have a concrete denylist.
 */
export const FORBIDDEN_PRIMITIVE_PREFIXES = ['--lab-neutral-', '--lab-accent-'] as const;
