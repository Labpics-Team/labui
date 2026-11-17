/** Material modes describe capture behaviour, not allowed DOM topology. */
import type { MaterialMode } from './material-guarantee';
export type { MaterialMode };
export const LIVE_BLUR_MODES = ['glass', 'acrylic'] as const;
/** Normal and blend paint roles. Solid has its independent author role. */
export const MATERIAL_FILL_FAMILY = '--lab-bg-material-' as const;
export function isLiveBlur(mode: MaterialMode): boolean {
  return mode !== 'solid';
}
/** A pair of modes does not prohibit nesting. Each surface captures its actual
 * backdrop; nested optics accumulate, and overlay roots belong to the layout. */
export function canNest(_outer: MaterialMode, _inner: MaterialMode): boolean {
  return true;
}
