import { describe, expect, it } from 'vitest';
import {
  computeScrimFloor,
  corridorFromPixels,
  resolveOnBoundary,
  resolveOnImageRegion,
  resolveOnMaterial,
  resolveOnSolid,
  resolveOnTainted,
} from '../src/legibility-ladder';
import { type Rgba, relativeLuminance } from '../src/luminance';
import { WCAG_AA_NORMAL } from '../src/material-guarantee';

/*
 * Task #58 — the guarantee LADDER for text on complex backgrounds. Every case
 * ends in one of two states: a PROVEN corridor guarantee, or a mandatory scrim.
 * There is no "put the text down and hope" path — the resolver structurally
 * cannot return `guaranteed` without the corridor worst-case clearing the floor.
 *
 * Cases: (a) solid → direct, (b) material → corridor, (c) readable image →
 * region corridor → solver → forced scrim floor if unreachable, (d) tainted →
 * scrim mandatory by contract, (e) boundary-crossing → union corridor.
 *
 * Classes: A (unit), C (property: the union contains both; the scrim always
 * restores the floor when feasible).
 */

const WHITE_LABEL: Rgba = { r: 255, g: 255, b: 255, a: 1 };
const BLACK_LABEL: Rgba = { r: 0, g: 0, b: 0, a: 1 };
const OPAQUE = (r: number, g: number, b: number): Rgba => ({ r, g, b, a: 1 });

describe('(a) solid → direct solver', () => {
  it('a dark solid under a white label is guaranteed', () => {
    const d = resolveOnSolid(WHITE_LABEL, OPAQUE(20, 20, 20));
    expect(d.outcome).toBe('guaranteed');
    if (d.outcome === 'guaranteed') {
      expect(d.case).toBe('solid');
      expect(d.effLow).toBe(d.effHigh); // opaque surface → the band is a point
      expect(d.worstContrast).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
    }
  });

  it('a light solid under a white label is scrim-required (no contrast)', () => {
    const d = resolveOnSolid(WHITE_LABEL, OPAQUE(240, 240, 240));
    expect(d.outcome).toBe('scrim-required');
  });
});

describe('(b) material → corridor', () => {
  it('a sheer white tint under a white label cannot hold over [black,white] → scrim', () => {
    const d = resolveOnMaterial(WHITE_LABEL, { r: 191, g: 191, b: 191, a: 0.3 });
    expect(d.outcome).toBe('scrim-required');
    if (d.outcome === 'scrim-required') {
      expect(d.case).toBe('material');
      expect(d.scrim).not.toBeNull();
    }
  });

  it('a dense dark tint under a white label holds across the whole corridor', () => {
    const d = resolveOnMaterial(WHITE_LABEL, { r: 20, g: 20, b: 20, a: 0.95 });
    expect(d.outcome).toBe('guaranteed');
  });
});

describe('(c) readable image region → corridor → forced scrim floor if unreachable', () => {
  it('a label over a dark image region is guaranteed by the region corridor', () => {
    // pixels all in [0..30] luminance — the white label holds directly.
    const corridor = corridorFromPixels(
      new Uint8ClampedArray([10, 10, 10, 255, 25, 20, 30, 255, 0, 5, 8, 255]),
    );
    const d = resolveOnImageRegion(WHITE_LABEL, corridor);
    expect(d.outcome).toBe('guaranteed');
    if (d.outcome === 'guaranteed') expect(d.case).toBe('image');
  });

  it('a label over a HIGH-CONTRAST image region (black→white) is unreachable → forced scrim', () => {
    const corridor = corridorFromPixels(
      new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255, 128, 128, 128, 255]),
    );
    const d = resolveOnImageRegion(WHITE_LABEL, corridor);
    expect(d.outcome).toBe('scrim-required');
    if (d.outcome === 'scrim-required') {
      expect(d.scrim).not.toBeNull();
      // The system inserts the scrim itself — the returned floor must actually restore AA.
      const s = d.scrim as { colour: Rgba; alpha: number };
      expect(s.alpha).toBeGreaterThan(0);
      expect(s.alpha).toBeLessThanOrEqual(1);
    }
  });

  it('the forced scrim floor, once applied, actually clears the floor (property)', () => {
    const corridor = corridorFromPixels(new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255]));
    const scrim = computeScrimFloor(WHITE_LABEL, corridor, BLACK_LABEL, WCAG_AA_NORMAL);
    expect(scrim).not.toBeNull();
    if (scrim) {
      // Re-run the solver with the scrim painted at its computed alpha → guaranteed.
      const painted = resolveOnImageRegion(WHITE_LABEL, corridor, {
        scrim: { colour: scrim.colour, alpha: scrim.alpha },
      });
      expect(painted.outcome).toBe('guaranteed');
    }
  });
});

describe('(d) tainted / cross-origin → scrim mandatory by contract', () => {
  it('a tainted background can NEVER be declared guaranteed', () => {
    const d = resolveOnTainted(WHITE_LABEL);
    expect(d.outcome).toBe('scrim-required');
    if (d.outcome === 'scrim-required') {
      expect(d.case).toBe('tainted');
      expect(d.reason).toMatch(/tainted|cross-origin|unreadable/i);
      // A conservative scrim over the unknown [black,white] corridor is still offered.
      expect(d.scrim).not.toBeNull();
    }
  });

  it('the tainted contract holds for a dark label too (symmetry)', () => {
    const d = resolveOnTainted(BLACK_LABEL);
    expect(d.outcome).toBe('scrim-required');
  });
});

describe('(e) label crossing two backgrounds → union corridor', () => {
  it('a label guaranteed on each region separately can FAIL on the union', () => {
    // Region A is all-dark (white label holds); region B is all-light (white label
    // fails). Straddling both, the white label must clear the union → it cannot.
    const darkRegion = corridorFromPixels(new Uint8ClampedArray([10, 10, 10, 255]));
    const lightRegion = corridorFromPixels(new Uint8ClampedArray([240, 240, 240, 255]));
    const onDark = resolveOnImageRegion(WHITE_LABEL, darkRegion);
    expect(onDark.outcome).toBe('guaranteed');
    const straddling = resolveOnBoundary(WHITE_LABEL, darkRegion, lightRegion);
    expect(straddling.outcome).toBe('scrim-required');
    if (straddling.outcome === 'scrim-required') expect(straddling.case).toBe('boundary');
  });
});

describe('corridorFromPixels — per-channel extremes of a readable region', () => {
  it('bounds every pixel luminance in the region', () => {
    const pixels = new Uint8ClampedArray([10, 200, 30, 255, 220, 5, 250, 255, 128, 128, 0, 255]);
    const corridor = corridorFromPixels(pixels);
    for (let i = 0; i < pixels.length; i += 4) {
      const l = relativeLuminance({
        r: pixels[i] ?? 0,
        g: pixels[i + 1] ?? 0,
        b: pixels[i + 2] ?? 0,
        a: 1,
      });
      expect(l).toBeGreaterThanOrEqual(relativeLuminance(corridor.min) - 1e-9);
      expect(l).toBeLessThanOrEqual(relativeLuminance(corridor.max) + 1e-9);
    }
  });

  it('throws on an empty / fully-transparent region (no readable background)', () => {
    expect(() => corridorFromPixels(new Uint8ClampedArray([]))).toThrow();
    expect(() => corridorFromPixels(new Uint8ClampedArray([1, 2, 3, 0]))).toThrow();
  });
});
