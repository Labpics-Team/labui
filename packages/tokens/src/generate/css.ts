import { cssVarName } from '../domain/alias.js';
import type { ResolvedTokens } from '../domain/build.js';
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
      ...aliasLines(tokens.sizesAliases),
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
    section(
      'Typography — оптический трекинг (em, парно к кеглям: мелкие разрежены, крупные ужаты)',
      tokenLines(tokens.letterSpacings),
    ),
    section('Typography — мера строки (Bringhurst 45–75ch, 66 идеал)', tokenLines(tokens.measures)),
    section(
      'Typography — семейство шрифта (фолбэк-стек, Geist первым) + OpenType-фичи',
      tokenLines(tokens.fonts),
    ),
    section('Borders — stroke widths (rem)', tokenLines(tokens.strokes)),
    section('Borders — focus ring (width + offset, rem)', tokenLines(tokens.focusRing)),
  ];

  return `${header()}\n:root {\n${blocks.join('\n\n')}\n}\n\n${cornerShapeRule()}`;
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

/**
 * Форма угла для light-DOM поверхностей (стекло/карточки демо): corner-shape
 * не наследуется, поэтому внутри скоупа правило универсально — на элементах
 * без радиуса это no-op, слои на border-radius: inherit держат ту же форму,
 * что клип панели. Скоуп .lab-scope — opt-in ПОТРЕБИТЕЛЯ (класс на корне его
 * приложения, обычно <html>): дизайн-система не красит чужой DOM хоста.
 * Внутри shadow DOM компонентов форму доставляет LabElement (finalizeStyles)
 * независимо от скоупа — документные правила shadow-границу не пересекают.
 * Без поддержки (не Chromium 139+) свойство игнорируется — обычный радиус.
 */
function cornerShapeRule(): string {
  return [
    '/* Corner shape — superellipse curvature over any border-radius (opt-in scope). */',
    ':where(.lab-scope),',
    ':where(.lab-scope) *,',
    ':where(.lab-scope) *::before,',
    ':where(.lab-scope) *::after {',
    '  corner-shape: superellipse(var(--lab-radius-corner-k, 1.1));',
    '}',
    '',
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
