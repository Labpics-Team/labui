import type { ResolvedTokens } from '../domain/build.js';
import { num } from '../domain/format.js';
import type { ResolvedToken } from '../domain/token.js';

/**
 * A W3C DTCG token node. Dimensions carry their canonical px magnitude as
 * `{ value, unit }`; the CSS string (which may be a clamp) is preserved under
 * `$extensions` so the export is round-trip-safe without losing the rendered
 * form.
 */
interface DtcgToken {
  $type: 'dimension' | 'number' | 'fontFamily' | 'fontFeatureSettings';
  $value: number | { value: number; unit: 'px' | 'rem' } | string | readonly string[];
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
      // Сохраняет точный em-трекинг фиксированных ролей, например −0.25/16.
      $value: Number(num(requireNumeric(t), 6)),
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
      // The canonical scalar is the wide-anchor (max) size — the "design" size.
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
