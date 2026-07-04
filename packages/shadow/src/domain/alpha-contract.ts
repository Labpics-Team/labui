import { SHADOW_SLOTS, SLOT_ALPHA, type ShadowSlotName } from './layer.js';

export type ShadowTheme = 'light' | 'dark';

/**
 * The default per-slot alphas are the owner's FIXED Figma values, identical
 * across every elevation level: s1=0.12 / s2=0.04 / s3=0.02 / s4=0.01. Both
 * themes use the SAME set — the owner's effect-style export (2026-06-13) gives
 * one ladder; a theme changes only the colour anchor, not the alphas.
 *
 * CONFLICT OF SOURCES (named, not papered over): the older Variables snapshot
 * carried a SEPARATE dark alpha set (@2/@4/@12/@20). We take the fresher styles
 * export as the default (one set, no dark-specific alphas). Any dark
 * amplification is applied as a PROVISIONAL multiplier (below), defaulting to 1
 * — i.e. faithful to the styles, with the Variables direction available as an
 * opt-in until the two sources are reconciled by lab-colors.
 */
export function defaultAlpha(slot: ShadowSlotName): number {
  return SLOT_ALPHA[slot];
}

/** Ordered default alphas, slot order = stack order. Same for both themes. */
export function defaultAlphas(): readonly number[] {
  return SHADOW_SLOTS.map((slot) => defaultAlpha(slot));
}

/**
 * PROVISIONAL dark-amplification multiplier applied to every slot alpha on the
 * dark theme. Default 1 = no amplification (the styles export gives one set).
 *
 * Provenance of the two source numbers, both named so nothing is a silent
 * placeholder:
 *   - Styles export (2026-06-13, FRESHER): one alpha set, no dark-specific
 *     values → multiplier 1.
 *   - Variables snapshot (older, 488 tokens): dark @2/@4/@12/@20 vs light
 *     @1/@2/@4/@12 → roughly a 2× lift on the near plies.
 * We default to the fresher source (1). When lab-colors reconciles the JND
 * surface contracts, this multiplier is the single knob to re-set.
 */
export const DARK_ALPHA_MULTIPLIER_DEFAULT = 1;
