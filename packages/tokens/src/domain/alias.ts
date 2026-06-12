import { TOKEN_PREFIX } from '../config/types.js';
import type { ScaleKind } from './token.js';

/**
 * The CSS custom-property name for a token, e.g. `--lab-space-4`.
 *
 * Centralized so the prefix and naming convention have exactly one definition —
 * CSS, TS and DTCG generators all derive names from here.
 */
export function cssVarName(kind: ScaleKind, name: string): string {
  return `--${TOKEN_PREFIX}-${kind}-${name}`;
}

/**
 * A `var()` reference to another token in the same scale, used by aliases so a
 * semantic role resolves through the primitive — never duplicating its value.
 * `full` is special-cased: it lives at `--lab-radius-full`, not a step key.
 */
export function aliasCssRef(kind: ScaleKind, target: string): string {
  return `var(${cssVarName(kind, target)})`;
}
