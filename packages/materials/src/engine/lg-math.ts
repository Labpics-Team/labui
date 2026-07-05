/*
 * @labpics/ui-materials/engine — pure math + displacement-encoding contract.
 *
 * Landed from `prototypes/liquid-glass/lg-math.js` per ADR-0003 (glass-effects
 * ch-02). This module is the DOM-free heart of the engine: the signed-distance
 * field, the smooth falloff helpers, the lens magnification constant, and the
 * float→byte→float displacement-encoding arithmetic. It is split out of
 * `liquid-glass.ts` (which re-imports every symbol) for ONE reason: so the math
 * is importable by a bare test runner without a browser or a DOM shim. The
 * browser engine's behaviour is byte-identical — it consumes exactly these
 * functions and constants. Nothing here touches `window`, `document`, `canvas`,
 * or any global; it is referentially transparent.
 *
 * Zero dependencies. Imported by liquid-glass.ts (browser) and the unit tests
 * alike.
 */

/** How far a rim pixel samples toward the centre at full refraction (the lens
 *  magnification). Tuned against the Apple references; the per-instance
 *  `--_lg-refraction` knob scales the result linearly. */
export const MAX_PULL = 0.15;

/** The displacement map's neutral blue channel: every pixel writes B=128 (the
 *  feDisplacementMap reads only R/G, so B is a constant 0xff800000 fill byte). */
export const B_CHANNEL = 128;

/** The map's alpha channel: fully opaque on every pixel (the high byte of the
 *  0xff800000 fill). */
export const A_CHANNEL = 255;

/** Clamp to [0,1]. Used to confine the rim falloff parameter. */
export const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Hermite smoothstep on [0,1] (no edge args — input is pre-normalised). The
 *  field applies it TWICE for a gentle, seamless rim falloff. */
export const smoothstep = (x: number): number => x * x * (3 - 2 * x);

/** Signed distance to a rounded rectangle [0,w]×[0,h], corner r. <0 inside,
 *  0 on the rim, >0 outside. 4-way mirror-symmetric about both centre axes —
 *  the property the displacement encoding relies on to compute only ¼ of pixels. */
export function sdRoundRect(px: number, py: number, w: number, h: number, r: number): number {
  const qx = Math.abs(px - w / 2) - (w / 2 - r);
  const qy = Math.abs(py - h / 2) - (h / 2 - r);
  const ax = Math.max(qx, 0);
  const ay = Math.max(qy, 0);
  return Math.sqrt(ax * ax + ay * ay) + Math.min(Math.max(qx, qy), 0) - r;
}

/* ── Displacement encoding ──────────────────────────────────────────────────
 * The field encodes a signed displacement in [-maxAbs, maxAbs] into a single
 * 8-bit channel: `byte = round_clamp(value * (255 / (2·maxAbs)) + 127.5)`. The
 * `+127.5` centres 0 on 128; the `255/(2·maxAbs)` factor maps ±maxAbs onto the
 * channel extremes 0/255 with NO clipping. The engine's hot loop writes the same
 * `value·norm255 + 127.5` float into a Uint8ClampedArray, so these helpers are a
 * bit-for-bit mirror of the render-path arithmetic (round-half-to-even + clamp),
 * not a re-derived approximation. */

/** The float→byte normaliser: 255 / (2·maxAbs). */
export const channelNorm255 = (maxAbs: number): number => 255 / (2 * maxAbs);

/** Encode a signed displacement (in [-maxAbs, maxAbs]) to its [0,255] byte,
 *  exactly as the engine writes it (Uint8ClampedArray round-half-to-even +
 *  clamp). +maxAbs → 255, 0 → 128, −maxAbs → 0. */
export function encodeChannel(value: number, maxAbs: number): number {
  const scratch = new Uint8ClampedArray(1);
  scratch[0] = value * channelNorm255(maxAbs) + 127.5;
  return scratch[0] as number;
}

/** Decode a [0,255] byte back to its signed displacement — the exact inverse of
 *  encodeChannel's affine map (lossy only by the channel's quantisation step). */
export function decodeChannel(byte: number, maxAbs: number): number {
  return (byte - 127.5) / channelNorm255(maxAbs);
}
