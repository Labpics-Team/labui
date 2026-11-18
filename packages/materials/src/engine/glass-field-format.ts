/** Encoded zero vector, not a surface colour. feDisplacementMap decodes each
 * channel around 0.5; byte128 is the nearest representable midpoint.
 */
export const NEUTRAL_VECTOR_BYTE = 128;
export const NEUTRAL_VECTOR_RGBA =
  (0xff000000 | (NEUTRAL_VECTOR_BYTE << 16) | (NEUTRAL_VECTOR_BYTE << 8) | NEUTRAL_VECTOR_BYTE) >>>
  0;
