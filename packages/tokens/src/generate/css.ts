import type { ResolvedTokens } from '../domain/build.js';
import { cssVarName } from '../domain/alias.js';
import type { ResolvedAlias, ResolvedToken } from '../domain/token.js';

/**
 * Generate the `:root` stylesheet of `--lab-*` custom properties.
 *
 * Output is deterministic and grouped by scale with header comments. Aliases are
 * emitted as `var()` references to their primitive, never duplicated values, so
 * the three-language split (primitive -> semantic -> component) holds in CSS.
 */
export function generateCss(tokens: ResolvedTokens): string {
  const blocks: string[] = [
    section('Spacing — linear rem multiplier (root font-size scales all)', [
      ...tokenLines(tokens.spacing),
      ...aliasLines(tokens.spacingAliases),
    ]),
    section('Sizes — габариты контрол-бокса оси размера компонента (rem)', [
      ...tokenLines(tokens.sizes),
      ...aliasLines(tokens.sizeAliases),
    ]),
    section('Radii — geometric rem + full pill', [
      ...tokenLines(tokens.radii),
      ...aliasLines(tokens.radiiAliases),
    ]),
    section('Z-index — semantic layers, gap-spaced', tokenLines(tokens.zIndex)),
    section('Typography — fluid font-size gradient (clamp, no media queries)', [
      ...tokenLines(tokens.fontSizes),
    ]),
    section('Typography — line-height multipliers', tokenLines(tokens.lineHeights)),
    section('Typography — font-weight scale (unitless)', tokenLines(tokens.fontWeights)),
    section('Borders — stroke widths (rem)', tokenLines(tokens.strokes)),
    section('Borders — focus ring (width + offset, rem)', tokenLines(tokens.focusRing)),
  ];

  return `${header()}\n:root {\n${blocks.join('\n\n')}\n}\n`;
}

function header(): string {
  return [
    '/*',
    ' * LabUI dimension tokens — GENERATED. Do not edit by hand.',
    ' * Source: packages/tokens/src/config + generator. Run `pnpm --filter',
    ' * @labpics/ui-tokens build` to regenerate from the single config source.',
    ' */',
  ].join('\n');
}

function section(title: string, lines: string[]): string {
  return `  /* ${title} */\n${lines.join('\n')}`;
}

function tokenLines(list: readonly ResolvedToken[]): string[] {
  return list.map((t) => {
    const decl = `  ${cssVarName(t.kind, t.name)}: ${t.cssValue};`;
    return t.description ? `${decl} /* ${t.description} */` : decl;
  });
}

function aliasLines(list: readonly ResolvedAlias[]): string[] {
  return list.map((a) => `  ${cssVarName(a.kind, a.name)}: ${a.cssValue}; /* -> ${a.target} */`);
}
