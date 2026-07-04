/**
 * The four shadow slots of one elevation level, named by depth order. Each
 * elevation level (XS..XL) is EXACTLY four DROP_SHADOW plies — this is a law of
 * the owner's Figma FX/Shadow stack (labui-figma-styles.md, 2026-06-13): four
 * layers per level, no more, no fewer.
 *
 * A layered soft shadow is the sum of several drop-shadows of growing blur — the
 * physically-correct approximation of one soft shadow (Tobias Ahlin / Josh
 * Comeau). Slot 1 is the near, sharp contact ply (highest alpha); slot 4 is the
 * far, wide diffuse ply (lowest alpha).
 */
export const SHADOW_SLOTS = ['s1', 's2', 's3', 's4'] as const;

export type ShadowSlotName = (typeof SHADOW_SLOTS)[number];

/**
 * The per-slot alpha, FIXED across every elevation level. This is the owner's
 * law: alphas do not change between XS and XL — only the geometry (blur radius +
 * vertical offset) grows. Depth is communicated by geometry alone, never by
 * making the ink denser.
 *
 *   s1 = 0.12   s2 = 0.04   s3 = 0.02   s4 = 0.01
 *
 * Read order = stack order = slot order. These are real alpha units (0..1).
 */
export const SLOT_ALPHA: Readonly<Record<ShadowSlotName, number>> = {
  s1: 0.12,
  s2: 0.04,
  s3: 0.02,
  s4: 0.01,
};

/** Ordered list of the fixed slot alphas, slot order = stack order. */
export const SLOT_ALPHAS: readonly number[] = SHADOW_SLOTS.map((slot) => SLOT_ALPHA[slot]);
