import { TOKEN_PREFIX } from '../config/types.js';
import type { ScaleKind } from './token.js';

/**
 * Token names reach this module from user-overridable config keys, so they are
 * validated at the single chokepoint where names become CSS custom properties.
 * Allowed: alphanumeric segments joined by single hyphens, with an optional
 * leading hyphen for negative step fallbacks (e.g. `-2`). Anything else (spaces,
 * slashes, `/`-paths from Figma) would silently corrupt tokens.css.
 */
const VALID_TOKEN_NAME = /^-?[a-z0-9]+(?:-[a-z0-9]+)*$/i;

function validateTokenName(name: string): string {
  if (!VALID_TOKEN_NAME.test(name)) {
    throw new Error(
      `Invalid token name "${name}": must match ${VALID_TOKEN_NAME} (cssVarName/aliasCssRef — fix the offending steps/aliases config key)`,
    );
  }
  return name;
}

/**
 * The CSS custom-property name for a token, e.g. `--lab-space-4`.
 *
 * Centralized so the prefix and naming convention have exactly one definition —
 * CSS, TS and DTCG generators all derive names from here.
 */
export function cssVarName(kind: ScaleKind, name: string): string {
  return `--${TOKEN_PREFIX}-${kind}-${validateTokenName(name)}`;
}

/**
 * A `var()` reference to another token in the same scale, used by aliases so a
 * semantic role resolves through the primitive — never duplicating its value.
 * `full` is special-cased: it lives at `--lab-radius-full`, not a step key.
 */
export function aliasCssRef(kind: ScaleKind, target: string): string {
  return `var(${cssVarName(kind, target)})`;
}
