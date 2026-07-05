/*
 * Fixed input corpus + a fast content hash for the displacement-map golden lock
 * (engine/liquid-glass.ts `__computeDisplacementField`).
 *
 * WHY a shared, committed module (not inline in the test): the byte-for-byte
 * perf work leans on ONE corpus of geometries — small/medium/large, varied
 * radius/dpr, and the degenerate edges (radius 0, radius > half, 1px, odd dims,
 * circle-ish r = half). The golden test freezes a hash per entry; an offline
 * bench replays the SAME corpus to compare optimised-vs-baseline timings. Both
 * import here so the two can never drift apart.
 *
 * The corpus deliberately includes r = min(w,h)/2 (a full circle/stadium): its
 * rim band follows the corner arc inward, which is the exact case a naive
 * axis-aligned interior skip would corrupt — so the golden lock proves the
 * rim-skip stays correct there, not just on straight-edged rects.
 */
import { createHash } from 'node:crypto';

export interface MapCase {
  /** stable key — used in the golden table and the bench report */
  readonly name: string;
  readonly w: number;
  readonly h: number;
  readonly corner: number;
  readonly depth: number;
  readonly dpr: number;
}

/** The frozen input corpus. Order is irrelevant (each case hashes independently)
 *  but kept stable so the golden table reads top-to-bottom. */
export const MAP_CORPUS: readonly MapCase[] = [
  { name: 'small-square-dpr1', w: 48, h: 48, corner: 12, depth: 40, dpr: 1 },
  { name: 'small-square-dpr2', w: 48, h: 48, corner: 12, depth: 40, dpr: 2 },
  { name: 'small-radius0', w: 48, h: 48, corner: 0, depth: 40, dpr: 1 },
  { name: 'small-radius-over-half', w: 48, h: 48, corner: 40, depth: 40, dpr: 1 },
  { name: 'medium-card', w: 320, h: 200, corner: 28, depth: 40, dpr: 1 },
  { name: 'medium-card-dpr2', w: 320, h: 200, corner: 28, depth: 40, dpr: 2 },
  { name: 'medium-radius0', w: 320, h: 200, corner: 0, depth: 40, dpr: 1 },
  { name: 'medium-circleish', w: 320, h: 320, corner: 160, depth: 40, dpr: 1 },
  { name: 'medium-deep-band', w: 320, h: 320, corner: 28, depth: 200, dpr: 1 },
  { name: 'large-panel', w: 1024, h: 1024, corner: 28, depth: 40, dpr: 1 },
  { name: 'large-panel-dpr2', w: 1024, h: 768, corner: 28, depth: 40, dpr: 2 },
  { name: 'large-radius0', w: 1024, h: 1024, corner: 0, depth: 40, dpr: 1 },
  { name: 'large-circle', w: 1024, h: 1024, corner: 512, depth: 40, dpr: 1 },
  { name: 'large-thin-band', w: 1024, h: 1024, corner: 28, depth: 8, dpr: 1 },
  { name: 'wide-thin', w: 1024, h: 64, corner: 28, depth: 40, dpr: 1 },
  { name: 'tall-thin', w: 64, h: 1024, corner: 28, depth: 40, dpr: 1 },
  { name: 'degenerate-1px', w: 1, h: 1, corner: 0, depth: 40, dpr: 1 },
  { name: 'degenerate-2px', w: 2, h: 2, corner: 1, depth: 40, dpr: 1 },
  { name: 'odd-dims', w: 321, h: 201, corner: 15, depth: 33, dpr: 1 },
  { name: 'dpr3-clamped', w: 320, h: 320, corner: 28, depth: 40, dpr: 3 },
];

/** SHA-256 over the exact bytes of the RGBA map (native, collision-free, and
 *  fast enough to hash the 1024² cases without slowing the suite). Views into a
 *  reused scratch buffer are honoured via byteOffset/byteLength. */
export function hashBytes(bytes: Uint8ClampedArray | Uint8Array): string {
  return createHash('sha256')
    .update(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength))
    .digest('hex');
}
