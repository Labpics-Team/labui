/*
 * lab-veil pure-math invariants — ported from the prototype's harness
 * (`prototypes/progressive-blur/pb-harness.mjs` + its pb-math unit gate).
 *
 * The prototype's PHYSICAL gate (contrast profiles measured on screenshots,
 * Class-D mutation bite-proof) stays with the prototype — it needs a browser
 * and golden calibration. What lands here is every invariant that is pure
 * math, asserted against the package's single source `src/engine/veil-math.ts`
 * (the runtime imports exactly these symbols, so proving the math proves the
 * strips' radii and extents):
 *   · parseStops — the Figma-like stop grammar (easing per segment, commas
 *     inside cubic-bezier(…), sorting, clamping, loud failure);
 *   · easing — keyword curves, cubic-bezier solving, linear fallback;
 *   · blurAt — clamp beyond outer stops, linear-in-radius segments, easing
 *     bends the profile (harness "easing-bends-profile");
 *   · levelLadder — geometric ladder, exact top, density (harness
 *     "ladder-dense-enough"), zero-level handling;
 *   · bandify — exact [0,1] coverage, monotone and NON-monotone profiles
 *     (`0 0px, 50% 20px, 1 0px`), sliver merging;
 *   · incremental radii — √(L_k² − L_{k−1}²) telescopes to the strongest stop
 *     (harness "cumulative-blur-at-strong-end", exact in pure math);
 *   · bandBBox — tight slab geometry (the "strips-stay-tight" perf guarantee).
 */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MAX_LEVELS,
  EASINGS,
  MIN_VISIBLE_BLUR,
  bandBBox,
  bandify,
  blurAt,
  levelLadder,
  parseStops,
  resolveEase,
} from '../src/engine/veil-math';

describe('parseStops — the Figma-like stop grammar', () => {
  it('parses stops with per-segment easing; commas inside cubic-bezier() do not split', () => {
    const stops = parseStops('0 24px, 55% 4px ease-in-out, 1 0px cubic-bezier(.2,0,.8,1)');
    expect(stops).toEqual([
      { at: 0, blur: 24 },
      { at: 0.55, blur: 4, ease: 'ease-in-out' },
      { at: 1, blur: 0, ease: 'cubic-bezier(.2,0,.8,1)' },
    ]);
  });

  it('percent and unitless positions are equivalent', () => {
    expect(parseStops('0% 8px, 100% 0px')).toEqual(parseStops('0 8px, 1 0px'));
  });

  it('принимает конечную экспоненциальную запись CSS-чисел', () => {
    expect(parseStops('0 1e-7px, 1e2% +2.5E+1px')).toEqual([
      { at: 0, blur: 1e-7 },
      { at: 1, blur: 25 },
    ]);
  });

  it('не принимает частично прочитанные и нечисловые значения', () => {
    for (const input of [
      '0 1.2.3px, 1 0px',
      '0.5.1 8px, 1 0px',
      '0 1e309px, 1 0px',
      '1e309 8px, 1 0px',
    ]) {
      expect(() => parseStops(input)).toThrow();
    }
  });

  it('sorts stops by position', () => {
    const stops = parseStops('1 0px, 0 24px');
    expect(stops.map((s) => s.at)).toEqual([0, 1]);
    expect(stops.map((s) => s.blur)).toEqual([24, 0]);
  });

  it('clamps positions into [0,1]', () => {
    const stops = parseStops('-0.5 8px, 2 0px');
    expect(stops.map((s) => s.at)).toEqual([0, 1]);
  });

  it('throws loudly on an unparseable stop (silent half-parse is worse)', () => {
    expect(() => parseStops('nonsense')).toThrow(/unparseable stop/);
    expect(() => parseStops('0 24')).toThrow(/unparseable stop/);
  });

  it('throws on fewer than 2 stops', () => {
    expect(() => parseStops('0 24px')).toThrow(/at least 2 stops/);
  });

  it('throws on a negative blur', () => {
    expect(() => parseStops('0 -5px, 1 0px')).toThrow(/invalid stop/);
  });
});

describe('easing — resolveEase / keyword curves', () => {
  it('keyword curves pin their endpoints', () => {
    for (const fn of Object.values(EASINGS)) {
      expect(fn(0)).toBe(0);
      expect(fn(1)).toBe(1);
    }
  });

  it('ease-in sags below linear mid-curve; ease-out rises above it', () => {
    const easeIn = EASINGS['ease-in'];
    const easeOut = EASINGS['ease-out'];
    if (!easeIn || !easeOut) throw new Error('keyword curves missing');
    expect(easeIn(0.5)).toBeLessThan(0.5);
    expect(easeOut(0.5)).toBeGreaterThan(0.5);
  });

  it('resolveEase resolves keywords to the canonical curves', () => {
    const easeIn = EASINGS['ease-in'];
    if (!easeIn) throw new Error('keyword curve missing');
    expect(resolveEase('ease-in')(0.3)).toBe(easeIn(0.3));
  });

  it('resolveEase solves cubic-bezier(…) — matches the equivalent keyword', () => {
    const custom = resolveEase('cubic-bezier(0.42, 0, 1, 1)'); // ≡ ease-in
    const easeIn = EASINGS['ease-in'];
    if (!easeIn) throw new Error('keyword curve missing');
    for (const t of [0.1, 0.25, 0.5, 0.75, 0.9]) {
      expect(custom(t)).toBeCloseTo(easeIn(t), 4);
    }
  });

  it('unknown and out-of-range specs fall back to linear (a typo straightens, never blanks)', () => {
    expect(resolveEase('bogus-curve')(0.3)).toBe(0.3);
    expect(resolveEase('cubic-bezier(2, 0, 0.5, 1)')(0.3)).toBe(0.3); // x1 ∉ [0,1]
    expect(resolveEase('cubic-bezier(a, b, c, d)')(0.7)).toBe(0.7);
  });

  it('no spec means linear', () => {
    expect(resolveEase(undefined)(0.42)).toBe(0.42);
  });
});

describe('blurAt — the continuous profile', () => {
  it('clamps flat beyond the outer stops', () => {
    const stops = parseStops('0.2 24px, 0.8 0px');
    expect(blurAt(stops, 0)).toBe(24);
    expect(blurAt(stops, 0.1)).toBe(24);
    expect(blurAt(stops, 0.9)).toBe(0);
    expect(blurAt(stops, 1)).toBe(0);
  });

  it('interpolates linearly in radius mid-segment', () => {
    const stops = parseStops('0 24px, 1 0px');
    expect(blurAt(stops, 0.5)).toBe(12);
    expect(blurAt(stops, 0.25)).toBe(18);
  });

  it('easing bends the profile (harness "easing-bends-profile")', () => {
    // ease-in on the 24→0 segment keeps blur HIGHER through the middle:
    // linear B(0.5) = 12px, ease-in ≈ 16.4px.
    const linear = blurAt(parseStops('0 24px, 1 0px'), 0.5);
    const eased = blurAt(parseStops('0 24px, 1 0px ease-in'), 0.5);
    expect(linear).toBe(12);
    expect(eased).toBeGreaterThan(14);
  });
});

describe('levelLadder — the geometric level ladder', () => {
  it('collapses to [0] when the whole profile is sub-visible', () => {
    expect(levelLadder(0, MIN_VISIBLE_BLUR / 2)).toEqual([0]);
  });

  it('ramp-to-zero: zero level appended, EXACT top, strictly ascending, within budget', () => {
    const levels = levelLadder(0, 24);
    expect(levels[0]).toBe(0);
    expect(levels[levels.length - 1]).toBe(24); // the strongest stop renders exactly
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i] ?? Number.NaN).toBeGreaterThan(levels[i - 1] ?? Number.NaN);
    }
    expect(levels.length).toBeLessThanOrEqual(DEFAULT_MAX_LEVELS);
  });

  it('is dense enough (harness "ladder-dense-enough"): rungs step ≤×3 with ≥4 rungs', () => {
    const rungs = levelLadder(0, 24).filter((l) => l > 0);
    expect(rungs.length).toBeGreaterThanOrEqual(4);
    for (let i = 1; i < rungs.length; i++) {
      expect((rungs[i] ?? 0) / (rungs[i - 1] ?? 1)).toBeLessThanOrEqual(3.0);
    }
  });

  it('maxLevels binds the budget', () => {
    const levels = levelLadder(0, 24, 3);
    expect(levels.length).toBeLessThanOrEqual(3);
    expect(levels[levels.length - 1]).toBe(24);
  });

  it('no zero level when the profile never leaves the visible range', () => {
    const levels = levelLadder(8, 24);
    expect(levels).not.toContain(0);
    expect(levels[0]).toBe(8);
    expect(levels[levels.length - 1]).toBe(24);
  });
});

describe('bandify — run extraction over the ladder', () => {
  const monotone = parseStops('0 24px, 1 0px');
  const valley = parseStops('0 0px, 50% 20px, 1 0px'); // non-monotone: sharp—blurred—sharp

  it('monotone ramp: runs cover [0,1] exactly and contiguously; adjacent runs differ', () => {
    const { runs } = bandify(monotone);
    expect(runs[0]?.t0).toBe(0);
    expect(runs[runs.length - 1]?.t1).toBe(1);
    for (let i = 1; i < runs.length; i++) {
      expect(runs[i]?.t0).toBe(runs[i - 1]?.t1); // no gaps, no overlaps
      expect(runs[i]?.blur).not.toBe(runs[i - 1]?.blur);
    }
  });

  it('monotone ramp: strongest level owns the strong end, zero-blur run included at the sharp end', () => {
    const { levels, runs } = bandify(monotone);
    expect(runs[0]?.blur).toBe(levels[levels.length - 1]); // = 24, the exact top
    expect(runs[0]?.blur).toBe(24);
    // Zero runs are INCLUDED (blur: 0) — the DOM layer skips them, but their
    // extent positions the neighbours' feather.
    expect(runs[runs.length - 1]?.blur).toBe(0);
  });

  it('non-monotone profile: the peak lands mid-axis and a level owns several disjoint runs', () => {
    const { runs } = bandify(valley);
    // sharp at both ends
    expect(runs[0]?.blur).toBe(0);
    expect(runs[runs.length - 1]?.blur).toBe(0);
    // the strongest run's centre sits at the 50% stop
    const strongest = runs.reduce((a, b) => (b.blur > a.blur ? b : a));
    const centre = (strongest.t0 + strongest.t1) / 2;
    expect(centre).toBeGreaterThan(0.3);
    expect(centre).toBeLessThan(0.7);
    // up-down symmetry: some non-zero level appears in ≥ 2 disjoint runs
    const counts = new Map<number, number>();
    for (const r of runs) {
      if (r.blur > 0) counts.set(r.blur, (counts.get(r.blur) ?? 0) + 1);
    }
    expect([...counts.values()].some((n) => n >= 2)).toBe(true);
  });

  it('never emits sliver runs (< 0.5% of the axis — the DOM must not build sub-pixel strips)', () => {
    for (const stops of [monotone, valley]) {
      const { runs } = bandify(stops);
      for (const r of runs) {
        expect(r.t1 - r.t0).toBeGreaterThanOrEqual(0.005);
      }
    }
  });

  it('every run blur is a ladder level', () => {
    for (const stops of [monotone, valley]) {
      const { levels, runs } = bandify(stops);
      for (const r of runs) {
        expect(levels).toContain(r.blur);
      }
    }
  });
});

describe('incremental radii — the cumulative (onion) strip model', () => {
  /** The increments the runtime paints: r_0 = L_0, r_k = √(L_k² − L_{k−1}²). */
  function increments(ladder: readonly number[]): number[] {
    return ladder.map((lk, k) => {
      const lPrev = k === 0 ? 0 : (ladder[k - 1] ?? 0);
      return k === 0 ? lk : Math.sqrt(lk * lk - lPrev * lPrev);
    });
  }

  it('increments telescope: √Σr² equals the strongest stop exactly (harness "cumulative-blur-at-strong-end")', () => {
    const { levels } = bandify(parseStops('0 24px, 1 0px'));
    const ladder = levels.filter((l) => l > 0);
    const rs = increments(ladder);
    const cumulative = Math.sqrt(rs.reduce((s, r) => s + r * r, 0));
    expect(cumulative).toBeCloseTo(24, 9);
  });

  it('every prefix composes exactly to its ladder level (each band interior renders ITS level)', () => {
    const { levels } = bandify(parseStops('0 24px, 1 0px'));
    const ladder = levels.filter((l) => l > 0);
    const rs = increments(ladder);
    let sq = 0;
    for (let k = 0; k < rs.length; k++) {
      sq += (rs[k] ?? 0) ** 2;
      expect(Math.sqrt(sq)).toBeCloseTo(ladder[k] ?? Number.NaN, 9);
    }
  });

  it('every increment is positive and finite (the ladder is strictly ascending)', () => {
    const { levels } = bandify(parseStops('0 24px, 1 0px'));
    const ladder = levels.filter((l) => l > 0);
    for (const r of increments(ladder)) {
      expect(Number.isFinite(r)).toBe(true);
      expect(r).toBeGreaterThan(0);
    }
  });
});

describe('bandBBox — tight slab geometry (the "strips-stay-tight" perf guarantee)', () => {
  it('degenerate axis covers the whole box', () => {
    expect(bandBBox(400, 300, { x: 10, y: 10 }, { x: 10, y: 10 }, 0, 1)).toEqual({
      x: 0,
      y: 0,
      w: 400,
      h: 300,
    });
  });

  it('a vertical-axis slab maps to exactly its y-band, full width', () => {
    const box = bandBBox(400, 400, { x: 200, y: 0 }, { x: 200, y: 400 }, 0.25, 0.5);
    expect(box).toEqual({ x: 0, y: 100, w: 400, h: 100 });
  });

  it('a horizontal-axis slab maps to exactly its x-band, full height', () => {
    const box = bandBBox(400, 200, { x: 0, y: 100 }, { x: 400, y: 100 }, 0.5, 0.75);
    expect(box).toEqual({ x: 200, y: 0, w: 100, h: 200 });
  });

  it('a slab entirely beyond the box is null (no strip at all)', () => {
    expect(bandBBox(400, 400, { x: 200, y: 0 }, { x: 200, y: 400 }, 1.5, 2)).toBeNull();
  });
});
