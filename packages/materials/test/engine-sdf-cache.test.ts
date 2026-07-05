/*
 * SDF distance-field cache — counter-asserts (ceiling criterion б) + key-mutation.
 *
 * The displacement field is SEPARABLE: `inside = -sdRoundRect(...)` depends only on
 * geometry (w,h,corner,sc), never on `depth`. The engine caches that distance field
 * per geometry so a depth change reuses it with ZERO sdRoundRect recomputes. These
 * tests pin that with COUNTER assertions (not wall-time — CI-stable): `__fieldStats().
 * sdfComputes` is the cumulative sdRoundRect call count.
 *
 *   · byte-identity of the cached path is locked separately by engine-map-golden
 *     (any drift flips a SHA-256 there) — here we prove the CACHE BEHAVES.
 *
 * RED-PROOF (each assertion bites a real mutation):
 *   · counter-assert: revert the cache (always call sdRoundRect) → a depth reuse
 *     adds a full rim of computes instead of 0 → FAILS.
 *   · key-completeness: drop any component from `sdfKey` (e.g. omit corner) → two
 *     geometries differing only in that component collide onto one field → the
 *     second build adds 0 computes (wrong) → the `> 0` assertion FAILS. (A collision
 *     would ALSO fail engine-map-golden with wrong bytes.)
 *   · cap bound: remove the eviction loop → sdfEntries exceeds the cap → FAILS.
 */
import { describe, expect, it } from 'vitest';
import { __computeDisplacementField, __fieldStats } from '../src/engine/liquid-glass';

/** sdRoundRect calls added by running `fn()`. */
function computesDelta(fn: () => void): number {
  const before = __fieldStats().sdfComputes;
  fn();
  return __fieldStats().sdfComputes - before;
}

describe('SDF cache — depth is O(encode), 0 field recomputes (criterion б)', () => {
  it('a first build of a fresh geometry computes the field (baseline > 0)', () => {
    // Unique geometry so no earlier test warmed it.
    const first = computesDelta(() => __computeDisplacementField(413, 277, 31, 40, 2));
    expect(first).toBeGreaterThan(0);
  });

  it('a depth DECREASE on the same geometry recomputes ZERO of the field', () => {
    __computeDisplacementField(401, 263, 22, 60, 2); // warm at a wide band
    // A smaller band is a strict subset of the covered rim → 0 sdRoundRect calls.
    const onShrink = computesDelta(() => __computeDisplacementField(401, 263, 22, 30, 2));
    expect(onShrink).toBe(0);
    // …and re-visiting an already-seen depth is also free.
    const onRevisit = computesDelta(() => __computeDisplacementField(401, 263, 22, 60, 2));
    expect(onRevisit).toBe(0);
  });

  it('a depth INCREASE computes only the uncovered delta (work partitions exactly)', () => {
    const G = { w: 409, h: 271, corner: 26, dpr: 2 };
    const at = (depth: number) => () =>
      __computeDisplacementField(G.w, G.h, G.corner, depth, G.dpr);
    const narrow = computesDelta(at(24)); // fresh: cols [0, end24]
    const grow = computesDelta(at(72)); // widen: only the ring [end24+1, end72]
    // Evict G (LRU) with more-than-cap unrelated geometries, then a from-scratch
    // band-72 build of the SAME dims recomputes the WHOLE band-72 field.
    const { sdfCacheCap } = __fieldStats();
    for (let i = 0; i <= sdfCacheCap; i++)
      __computeDisplacementField(1300 + i * 13, 400, 20, 40, 1);
    const fromScratch72 = computesDelta(at(72));
    expect(grow).toBeGreaterThan(0); // it did extend the rim
    expect(grow).toBeLessThan(fromScratch72); // …but by less than a full band-72 build
    // Exact partition: the incremental computes sum to the from-scratch total —
    // proves ZERO double-compute of the covered region AND zero missed column.
    expect(narrow + grow).toBe(fromScratch72);
  });
});

describe('SDF cache — key includes ALL geometry (mutation bites collisions)', () => {
  // Each variant differs from the base in exactly ONE key component. If the key
  // dropped that component, the variant would hit the base's cached field →
  // 0 new computes → these `> 0` assertions fail (and golden bytes would be wrong).
  const base = { w: 331, h: 217, corner: 19, dpr: 2 } as const;
  const build = (g: { w: number; h: number; corner: number; dpr: number }, depth = 40): void => {
    __computeDisplacementField(g.w, g.h, g.corner, depth, g.dpr);
  };

  it('a corner-only change is a cache MISS (fresh field)', () => {
    build(base);
    expect(computesDelta(() => build({ ...base, corner: 0 }))).toBeGreaterThan(0);
  });

  it('a width-only change is a cache MISS', () => {
    build(base);
    expect(computesDelta(() => build({ ...base, w: 332 }))).toBeGreaterThan(0);
  });

  it('a height-only change is a cache MISS', () => {
    build(base);
    expect(computesDelta(() => build({ ...base, h: 218 }))).toBeGreaterThan(0);
  });

  it('a dpr(scale)-only change is a cache MISS', () => {
    build(base);
    expect(computesDelta(() => build({ ...base, dpr: 1 }))).toBeGreaterThan(0);
  });
});

describe('SDF cache — memory is bounded by the cap (eviction bites)', () => {
  it('more distinct geometries than the cap never grow the field set past it', () => {
    const { sdfCacheCap } = __fieldStats();
    // Build cap+5 distinct geometries; the LRU eviction must hold the set at cap.
    for (let i = 0; i < sdfCacheCap + 5; i++) {
      __computeDisplacementField(500 + i * 11, 300 + i * 7, 20, 40, 1);
    }
    expect(__fieldStats().sdfEntries).toBe(sdfCacheCap);
  });
});
