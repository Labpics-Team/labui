import type { ResolvedTokens } from '../domain/build.js';
import { cssVarName } from '../domain/alias.js';
import type { ResolvedAlias, ResolvedToken } from '../domain/token.js';

/**
 * Generate the typed TS token module.
 *
 * Each scale becomes a `const` object mapping token name -> `var(--lab-...)`
 * reference, plus a string-literal union type of its keys. Consumers get
 * autocomplete and compile-time safety; the runtime value is always a `var()`
 * reference so the live CSS custom property stays the single source of truth at
 * paint time (re-theming via `:root` overrides just works).
 */
export function generateTs(tokens: ResolvedTokens): string {
  const parts: string[] = [banner()];

  parts.push(scaleConst('space', tokens.spacing, tokens.spacingAliases));
  parts.push(scaleConst('radius', tokens.radii, tokens.radiiAliases));
  parts.push(scaleConst('zIndex', tokens.zIndex));
  parts.push(scaleConst('fontSize', tokens.fontSizes));
  parts.push(scaleConst('lineHeight', tokens.lineHeights));
  parts.push(scaleConst('fontWeight', tokens.fontWeights));

  return `${parts.join('\n\n')}\n`;
}

function banner(): string {
  return [
    '/**',
    ' * LabUI dimension tokens — GENERATED. Do not edit by hand.',
    ' *',
    ' * Values are `var(--lab-*)` references: the live CSS custom property is the',
    ' * source of truth at paint time, so `:root` overrides re-theme without a',
    ' * rebuild. Import names give compile-time safety and autocomplete.',
    ' */',
  ].join('\n');
}

function scaleConst(
  exportName: string,
  tokens: readonly ResolvedToken[],
  aliases: readonly ResolvedAlias[] = [],
): string {
  const entries: Array<[string, string]> = [];
  for (const t of tokens) {
    entries.push([t.name, `var(${cssVarName(t.kind, t.name)})`]);
  }
  for (const a of aliases) {
    // Reference the alias's OWN custom property, not its target's: collapsing
    // to the primitive would skip the semantic layer, so a `:root` override of
    // the semantic token would never reach TS consumers.
    entries.push([a.name, `var(${cssVarName(a.kind, a.name)})`]);
  }

  const body = entries.map(([k, v]) => `  ${quoteKey(k)}: '${v}',`).join('\n');
  const typeName = capitalize(exportName);

  return [
    `export const ${exportName} = {`,
    body,
    '} as const;',
    '',
    `export type ${typeName}Token = keyof typeof ${exportName};`,
  ].join('\n');
}

function quoteKey(key: string): string {
  // Valid JS identifiers stay bare; everything else (digits, hyphens) is quoted.
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : `'${key}'`;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
