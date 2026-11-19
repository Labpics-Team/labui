import { type TextStyleRole, textStyle, textStyleMetrics } from '@labpics/ui-tokens';

/** Keep the authored line box while centering its cap-to-alphabetic text edge.
 * Uses the loaded font's metrics, so components need no per-font pixel offset.
 * Only first/last leading is trimmed; wrapped lines retain their line-height.
 */
export function authoredTextBoxCss(selector: string): string {
  return `@supports (text-box-trim: trim-both) {
  ${selector} {
    text-box-trim: trim-both; text-box-edge: cap alphabetic;
    box-sizing: border-box; min-block-size: 1lh;
    padding-block: calc((1lh - 1cap) / 2);
  }
}`;
}

/** One area setting supplies both the full text style and numeric optical sizing. */
export interface TypographyScale {
  readonly role: TextStyleRole;
  readonly rootFontSize: number;
  readonly fontSize: number;
}
export type TypographySize = number | `${number}px` | `${number}rem` | `${number}em`;

function positive(value: number): number {
  if (!Number.isFinite(value) || value <= 0)
    throw new RangeError('Typography sizes must be finite positive CSS pixels');
  return value;
}

/** rootFontSize is a CSS-pixel setting, never device pixels or browser zoom. */
export function createTypographyScale(
  role: TextStyleRole = 'body',
  rootFontSize = 16,
): TypographyScale {
  const metrics = textStyleMetrics[role];
  if (!metrics) throw new RangeError(`Unknown text role: ${role}`);
  return Object.freeze({
    role,
    rootFontSize: positive(rootFontSize),
    fontSize: (metrics.fontSize * rootFontSize) / 16,
  });
}

/** An explicit area scale also writes text in pixels, so outside CSS cannot double-scale it. */
export function typographyStyle(scale: TypographyScale) {
  const metrics = textStyleMetrics[scale.role];
  const factor = positive(scale.rootFontSize) / 16;
  return {
    ...textStyle[scale.role],
    fontSize: `${positive(scale.fontSize)}px`,
    lineHeight: `${metrics.lineHeight * factor}px`,
    fontWeight: metrics.fontWeight,
    letterSpacing: `${metrics.letterSpacing * factor}px`,
  } as const;
}

/** Resolve once from shared area settings; never measure or observe an individual icon. */
export function resolveTypographySize(size: TypographySize, scale?: TypographyScale) {
  let pixels: number;
  if (typeof size === 'number') pixels = size;
  else {
    const match = /^(\d+(?:\.\d+)?|\.\d+)(px|rem|em)$/.exec(size);
    if (!match) throw new TypeError('size must be a positive number, px, rem or em');
    const amount = Number(match[1]);
    const unit = match[2];
    if (unit === 'px') pixels = amount;
    else {
      if (!scale)
        throw new TypeError(
          'Relative sizes require the shared TypographyScale; use numeric CSS pixels otherwise',
        );
      pixels = amount * positive(unit === 'rem' ? scale.rootFontSize : scale.fontSize);
    }
  }
  positive(pixels);
  return { css: `${pixels}px`, pixels };
}
