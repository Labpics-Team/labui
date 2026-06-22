import type { ShadowSlotName } from './layer.js';

/**
 * The five elevation levels of the owner's Shadow ladder — the size primitive a
 * surface picks. Names and order are the owner's: XS is barely off the page, XL
 * floats well above everything (labui-figma-styles.md, 2026-06-13).
 *
 * Semantic ROLES (resting/raised/overlay/modal) are an alias layer over these
 * sizes — see `alias.ts`. The size is the primitive; the role is a named alias.
 */
export const ELEVATION_LEVELS = ['xs', 's', 'm', 'l', 'xl'] as const;

export type ElevationLevelName = (typeof ELEVATION_LEVELS)[number];

/**
 * One drop-shadow ply's GEOMETRY, in CSS px, taken verbatim from the owner's
 * Figma stack. `blur` is the Gaussian blur radius (Figma `r`); `offsetY` is the
 * downward throw (Figma `y`). There is no per-ply offset-x: the owner's stack is
 * a pure vertical light (all offset.x = 0); horizontal offset is derived ONLY
 * from a non-zero global light angle, never stored here. `spread` is 0
 * everywhere in the owner's data.
 */
export interface SlotGeometry {
  readonly blur: number;
  readonly offsetY: number;
}

/** One elevation level: its four slot geometries, slot order = stack order. */
export interface ElevationLevelShape {
  readonly name: ElevationLevelName;
  readonly slots: Readonly<Record<ShadowSlotName, SlotGeometry>>;
}

/**
 * THE LADDER — transcribed verbatim from labui-figma-styles.md (the owner's
 * effect-style export, 2026-06-13). Every value here is a Figma `r`/`y` in px;
 * nothing is computed. This is the opora: at light-angle 0 the generated CSS
 * reproduces this table bit-for-bit (offset-x = 0, offset-y = `y`px, blur =
 * `r`px). Do not "tidy" these numbers into a formula — depth is the owner's
 * hand-tuned geometry, not a progression.
 *
 *   | Level | s1 (a.12) | s2 (a.04) | s3 (a.02) | s4 (a.01) |
 *   | XS | r1 y0  | r1 y1  | r2 y2   | r2 y4   |
 *   | S  | r2 y1  | r2 y2  | r4 y4   | r8 y12  |
 *   | M  | r2 y1  | r4 y4  | r8 y12  | r12 y24 |
 *   | L  | r8 y4  | r12 y12| r16 y24 | r24 y48 |
 *   | XL | r36 y16| r48 y24| r64 y36 | r96 y48 |
 */
export const ELEVATION_SHAPES: readonly ElevationLevelShape[] = [
  {
    name: 'xs',
    slots: {
      s1: { blur: 1, offsetY: 0 },
      s2: { blur: 1, offsetY: 1 },
      s3: { blur: 2, offsetY: 2 },
      s4: { blur: 2, offsetY: 4 },
    },
  },
  {
    name: 's',
    slots: {
      s1: { blur: 2, offsetY: 1 },
      s2: { blur: 2, offsetY: 2 },
      s3: { blur: 4, offsetY: 4 },
      s4: { blur: 8, offsetY: 12 },
    },
  },
  {
    name: 'm',
    slots: {
      s1: { blur: 2, offsetY: 1 },
      s2: { blur: 4, offsetY: 4 },
      s3: { blur: 8, offsetY: 12 },
      s4: { blur: 12, offsetY: 24 },
    },
  },
  {
    name: 'l',
    slots: {
      s1: { blur: 8, offsetY: 4 },
      s2: { blur: 12, offsetY: 12 },
      s3: { blur: 16, offsetY: 24 },
      s4: { blur: 24, offsetY: 48 },
    },
  },
  {
    name: 'xl',
    slots: {
      s1: { blur: 36, offsetY: 16 },
      s2: { blur: 48, offsetY: 24 },
      s3: { blur: 64, offsetY: 36 },
      s4: { blur: 96, offsetY: 48 },
    },
  },
];

/**
 * The runtime alpha-contract custom property for a slot, e.g.
 * `--lab-shadow-alpha-s1`. This is the integration seam with lab-colors: today
 * it carries the owner's fixed Figma alphas (the stub default); when lab-colors
 * publishes JND-calibrated alphas they are written to the SAME names and the
 * stack re-derives with zero geometry changes.
 */
export function alphaVar(slot: ShadowSlotName): string {
  return `--lab-shadow-alpha-${slot}`;
}
