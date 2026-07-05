/*
 * Engine math (engine/lg-math.ts) — the DOM-free heart of the refraction
 * engine, asserted without a browser (ADR-0003 ch-02).
 *
 * What matters here is the CONTRACT the browser engine leans on:
 *   1. the SDF's 4-way mirror symmetry (the ¼-pixel optimisation is built on it),
 *   2. sign/rim conventions (<0 inside, 0 on the rim),
 *   3. the displacement encoding being a true affine involution: encode∘decode
 *      loses nothing beyond the 8-bit quantisation step, with 0 ↔ 128 exact,
 *   4. the falloff helpers' endpoints (seamless rim → clear middle).
 */
import { describe, expect, it } from 'vitest';
import {
  A_CHANNEL,
  B_CHANNEL,
  MAX_PULL,
  channelNorm255,
  clamp01,
  decodeChannel,
  encodeChannel,
  sdRoundRect,
  smoothstep,
} from '../src/engine/lg-math';

describe('clamp01 / smoothstep (rim falloff primitives)', () => {
  it('clamp01 confines to [0,1]', () => {
    expect(clamp01(-5)).toBe(0);
    expect(clamp01(0)).toBe(0);
    expect(clamp01(0.25)).toBe(0.25);
    expect(clamp01(1)).toBe(1);
    expect(clamp01(7)).toBe(1);
  });

  it('smoothstep hits exact endpoints with zero slope character (0→0, 1→1, ½→½)', () => {
    expect(smoothstep(0)).toBe(0);
    expect(smoothstep(1)).toBe(1);
    expect(smoothstep(0.5)).toBe(0.5);
    // monotone on [0,1] — the falloff never reverses inside the band
    let prev = 0;
    for (let i = 1; i <= 100; i++) {
      const v = smoothstep(i / 100);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
});

describe('sdRoundRect (signed distance, rounded rect)', () => {
  const w = 320;
  const h = 200;
  const r = 28;

  it('is negative inside, ~0 on the flat rim, positive outside', () => {
    expect(sdRoundRect(w / 2, h / 2, w, h, r)).toBeLessThan(0);
    expect(sdRoundRect(w / 2, 0, w, h, r)).toBeCloseTo(0, 10); // top edge midpoint
    expect(sdRoundRect(0, h / 2, w, h, r)).toBeCloseTo(0, 10); // left edge midpoint
    expect(sdRoundRect(-10, h / 2, w, h, r)).toBeGreaterThan(0);
    expect(sdRoundRect(w / 2, h + 5, w, h, r)).toBeGreaterThan(0);
  });

  it('rounds the corner: the sharp corner point sits OUTSIDE the rounded rim', () => {
    expect(sdRoundRect(0, 0, w, h, r)).toBeGreaterThan(0);
    // …by exactly r·(√2−1) for the corner-circle geometry
    expect(sdRoundRect(0, 0, w, h, r)).toBeCloseTo(r * (Math.SQRT2 - 1), 10);
  });

  it('is 4-way mirror-symmetric about both centre axes (the ¼-pixel contract)', () => {
    // The engine computes only the top-left quadrant and mirrors bytes into the
    // other three. That is sound ONLY if the SDF itself is exactly symmetric.
    const probes: Array<[number, number]> = [
      [3.5, 7.5],
      [17.5, 2.5],
      [60.5, 99.5],
      [159.5, 0.5],
      [1.5, 42.5],
    ];
    for (const [px, py] of probes) {
      const d = sdRoundRect(px, py, w, h, r);
      expect(sdRoundRect(w - px, py, w, h, r)).toBe(d);
      expect(sdRoundRect(px, h - py, w, h, r)).toBe(d);
      expect(sdRoundRect(w - px, h - py, w, h, r)).toBe(d);
    }
  });
});

describe('displacement encoding (float → byte → float)', () => {
  it('centres zero displacement on the neutral byte 128 exactly', () => {
    expect(encodeChannel(0, MAX_PULL)).toBe(B_CHANNEL);
    expect(decodeChannel(128, MAX_PULL)).toBeCloseTo(0.5 / channelNorm255(MAX_PULL), 10);
    // …decode(128) is half a quantisation step from true 0 — the affine map
    // centres on 127.5, and that offset IS the spec, not an accident:
    expect(Math.abs(decodeChannel(128, MAX_PULL))).toBeLessThanOrEqual(
      0.5 / channelNorm255(MAX_PULL) + 1e-12,
    );
  });

  it('maps the extremes with no clipping: ±maxAbs → 255/0', () => {
    const maxAbs = 12.34;
    expect(encodeChannel(maxAbs, maxAbs)).toBe(255);
    expect(encodeChannel(-maxAbs, maxAbs)).toBe(0);
    // Uint8ClampedArray clamps anything beyond the design range
    expect(encodeChannel(maxAbs * 2, maxAbs)).toBe(255);
    expect(encodeChannel(-maxAbs * 2, maxAbs)).toBe(0);
  });

  it('roundtrips within one quantisation step across the full range', () => {
    const maxAbs = 7.7;
    const step = 1 / channelNorm255(maxAbs); // displacement per byte
    for (let i = 0; i <= 200; i++) {
      const v = -maxAbs + (i / 200) * 2 * maxAbs;
      const back = decodeChannel(encodeChannel(v, maxAbs), maxAbs);
      expect(Math.abs(back - v)).toBeLessThanOrEqual(step / 2 + 1e-9);
    }
  });

  it('keeps the constants the map fill depends on (0xff800000 ⇒ B=128, A=255)', () => {
    expect(B_CHANNEL).toBe(128);
    expect(A_CHANNEL).toBe(255);
    expect(MAX_PULL).toBe(0.15);
  });
});
