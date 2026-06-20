import type { BordersConfig } from '../config/types.js';
import { num, rem } from './format.js';
import type { ResolvedToken } from './token.js';

/**
 * Build the border geometry tokens: named stroke widths + the focus-ring pair.
 *
 * Both are plain rem dimensions (like spacing/radii), emitted as `--lab-stroke-*`
 * and `--lab-focus-ring-{width,offset}`. The `stroke` prefix deliberately avoids
 * the `--lab-border-*` COLOUR namespace — a stroke is a line thickness, not a
 * colour role. numeric carries the canonical px (rem × 16) for tests/DTCG.
 */
export function buildBorders(config: BordersConfig): {
  strokes: ResolvedToken[];
  focusRing: ResolvedToken[];
} {
  assertConfig(config);

  const strokes: ResolvedToken[] = Object.entries(config.widths).map(([name, value]) => ({
    kind: 'stroke',
    name,
    cssValue: rem(value),
    numeric: value * 16,
    dtcgType: 'dimension',
  }));

  const focusRing: ResolvedToken[] = (
    [
      ['width', config.focusRing.width],
      ['offset', config.focusRing.offset],
    ] as const
  ).map(([name, value]) => ({
    kind: 'focus-ring',
    name,
    cssValue: rem(value),
    numeric: value * 16,
    dtcgType: 'dimension',
  }));

  return { strokes, focusRing };
}

function assertConfig(config: BordersConfig): void {
  const widthEntries = Object.entries(config.widths ?? {});
  if (widthEntries.length === 0) {
    throw new Error('borders.widths must define at least one named stroke width');
  }
  for (const [name, value] of widthEntries) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(
        `borders stroke width "${name}" must be a positive rem value, got ${num(value)}`,
      );
    }
  }
  const { width, offset } = config.focusRing ?? {};
  if (!Number.isFinite(width) || width <= 0) {
    throw new Error('borders.focusRing.width must be a positive rem value');
  }
  if (!Number.isFinite(offset) || offset < 0) {
    throw new Error('borders.focusRing.offset must be a non-negative rem value');
  }
}
