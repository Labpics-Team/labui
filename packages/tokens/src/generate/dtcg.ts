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
  $type: 'dimension' | 'number';
  $value: number | { value: number; unit: 'px' | 'rem' };
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
    radius: dimensionGroup(tokens.radii),
    'z-index': numberGroup(tokens.zIndex),
    'font-size': fontSizeGroup(tokens.fontSizes),
    'line-height': numberGroup(tokens.lineHeights),
  };
  return `${JSON.stringify(doc, null, 2)}\n`;
}

function dimensionGroup(list: readonly ResolvedToken[]): DtcgGroup {
  const group: DtcgGroup = {};
  for (const t of list) {
    group[t.name] = {
      $type: 'dimension',
      $value: { value: round(t.numeric ?? 0), unit: 'px' },
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
      $value: round(t.numeric ?? 0),
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
      $value: { value: round(f ? f.maxPx : (t.numeric ?? 0)), unit: 'px' },
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

function round(value: number): number {
  return Number(num(value));
}
