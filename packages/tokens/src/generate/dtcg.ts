import type { ResolvedTokens } from '../domain/build.js';
import { num } from '../domain/format.js';
import { authoredTextStyles } from '../domain/text-styles.js';
import type { ResolvedToken } from '../domain/token.js';

/**
 * A W3C DTCG token node. Dimensions carry their canonical px magnitude as
 * `{ value, unit }`; the CSS string (which may be a clamp) is preserved under
 * `$extensions` so the export is round-trip-safe without losing the rendered
 * form.
 */
interface DtcgToken {
  $type: 'dimension' | 'number' | 'fontFamily' | 'fontFeatureSettings' | 'typography';
  $value:
    | number
    | { value: number; unit: 'px' | 'rem' }
    | string
    | readonly string[]
    | Record<string, unknown>;
  $description?: string;
  $extensions?: Record<string, unknown>;
}

type DtcgGroup = { [key: string]: DtcgGroup | DtcgToken };

const EXT_KEY = 'com.labpics.ui-tokens';

/**
 * Generate the canonical DTCG document for all dimension scales.
 *
 * Groups mirror the scale structure (`space`, `radius`, `z-index`,
 * `font-size`, `line-height`). Fluid font sizes record their clamp anchors in
 * `$extensions` so the gradient survives a round-trip even though DTCG has no
 * native fluid primitive.
 */
export function generateDtcg(tokens: ResolvedTokens): string {
  const doc: DtcgGroup = {
    typography: Object.fromEntries(
      Object.entries(authoredTextStyles).map(([name, style]) => [
        name,
        {
          $type: 'typography',
          $value: {
            fontFamily: style.fontFamily,
            fontSize: { value: style.fontSize, unit: 'px' },
            fontWeight: style.fontWeight,
            letterSpacing: { value: style.letterSpacing, unit: 'px' },
            lineHeight: style.lineHeight / style.fontSize,
          },
          $extensions: {
            [EXT_KEY]: { sourceNode: style.sourceNode, sourceTextStyle: style.sourceTextStyle },
          },
        } as DtcgToken,
      ]),
    ),
    space: dimensionGroup(tokens.spacing),
    size: dimensionGroup(tokens.sizes),
    radius: dimensionGroup(tokens.radii),
    'z-index': numberGroup(tokens.zIndex),
    'font-size': fontSizeGroup(tokens.fontSizes),
    'line-height': numberGroup(tokens.lineHeights),
    'font-weight': numberGroup(tokens.fontWeights),
    // DTCG dimension допускает только px|rem — em/ch эмитим числом
    // (магнитуда em / счёт символов), точная CSS-строка в $extensions.css.
    'letter-spacing': numberGroup(tokens.letterSpacings),
    measure: numberGroup(tokens.measures),
    // Оболочка шрифта: fontFamily ($value — массив стека) + fontFeatureSettings
    // (нестандартный для DTCG тип: точная CSS-строка ещё и в $extensions.css).
    font: fontGroup(tokens.fonts),
    stroke: dimensionGroup(tokens.strokes),
    'focus-ring': dimensionGroup(tokens.focusRing),
    state: numberGroup(tokens.states),
    opacity: numberGroup(tokens.opacity),
  };
  for (const token of [...tokens.textStyles, ...tokens.components]) {
    doc[token.kind] ??= {};
    const group = doc[token.kind] as DtcgGroup;
    if (group[token.name])
      throw new Error(`Duplicate component token: ${token.kind}/${token.name}`);
    Object.assign(
      group,
      token.dtcgType === 'dimension' ? dimensionGroup([token]) : numberGroup([token]),
    );
  }
  return `${JSON.stringify(doc, null, 2)}\n`;
}

function dimensionGroup(list: readonly ResolvedToken[]): DtcgGroup {
  const group: DtcgGroup = {};
  for (const t of list) {
    group[t.name] = {
      $type: 'dimension',
      $value: { value: round(requireNumeric(t)), unit: 'px' },
      ...(t.description ? { $description: t.description } : {}),
      $extensions: { [EXT_KEY]: { css: t.cssValue } },
    };
  }
  return group;
}

function numberGroup(list: readonly ResolvedToken[]): DtcgGroup {
  const group: DtcgGroup = {};
  for (const t of list) {
    group[t.name] = {
      $type: 'number',
      $value: round(requireNumeric(t)),
      ...(t.description ? { $description: t.description } : {}),
    };
  }
  return group;
}

function fontSizeGroup(list: readonly ResolvedToken[]): DtcgGroup {
  const group: DtcgGroup = {};
  for (const t of list) {
    const f = t.fluid;
    group[t.name] = {
      $type: 'dimension',
      // Legacy scalar: the wide anchor. Actual fluid behavior lives in extensions;
      // authored text roles use the separate typography composite group.
      $value: { value: round(f ? f.maxPx : requireNumeric(t)), unit: 'px' },
      $extensions: {
        [EXT_KEY]: {
          css: t.cssValue,
          ...(f
            ? {
                fluid: {
                  step: f.step,
                  minPx: round(f.minPx),
                  maxPx: round(f.maxPx),
                  slopeVw: round(f.slopeVw),
                  interceptRem: round(f.interceptRem),
                },
              }
            : {}),
        },
      },
    };
  }
  return group;
}

/**
 * Строковые токены оболочки шрифта. fontFamily → DTCG-нативный тип со значением
 * массивом стека. fontFeatureSettings → тип нестандартный для DTCG, но узел
 * валиден ($type + $value); точную CSS-строку дублируем в $extensions.css.
 */
function fontGroup(list: readonly ResolvedToken[]): DtcgGroup {
  const group: DtcgGroup = {};
  for (const t of list) {
    if (t.stringValue == null) {
      throw new Error(`Font token "${t.name}" is missing its stringValue`);
    }
    if (t.dtcgType === 'fontFamily') {
      group[t.name] = {
        $type: 'fontFamily',
        $value: t.stringValue,
        ...(t.description ? { $description: t.description } : {}),
      };
    } else {
      group[t.name] = {
        $type: 'fontFeatureSettings',
        $value: t.stringValue,
        ...(t.description ? { $description: t.description } : {}),
        $extensions: { [EXT_KEY]: { css: t.cssValue } },
      };
    }
  }
  return group;
}

function round(value: number): number {
  return Number(num(value));
}

/**
 * A scalar token without `numeric` is a contract violation — exporting `0` in
 * its place would silently corrupt the DTCG artifact, so fail loudly instead.
 */
function requireNumeric(t: ResolvedToken): number {
  if (t.numeric == null) {
    throw new Error(`Token "${t.name}" (${t.kind}) is missing its numeric value`);
  }
  return t.numeric;
}
