import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
// Progressive blur — pure-math unit suite (Class A, browserless).
//
// Covers the DOM-free heart the strip builder trusts blindly: the CSS
// cubic-bezier solver, the Figma-like stops parser (commas inside
// cubic-bezier(…) must not split), the piecewise-eased profile, the geometric
// level ladder, run extraction over monotone AND non-monotone profiles, and
// the band→bbox geometry that keeps strips tight (the perf invariant).
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const MATH = resolve(HERE, '../../../../prototypes/progressive-blur/pb-math.js');
const {
  MIN_VISIBLE_BLUR,
  bandBBox,
  bandify,
  blurAt,
  cubicBezier,
  levelLadder,
  parseStops,
  resolveEase,
} = await import(`file://${MATH}`);

test('cubicBezier: endpoints exact, linear params ≈ identity, symmetric S-curve hits centre', () => {
  const lin = cubicBezier(0, 0, 1, 1);
  assert.equal(lin(0), 0);
  assert.equal(lin(1), 1);
  for (const t of [0.1, 0.25, 0.5, 0.75, 0.9]) {
    assert.ok(Math.abs(lin(t) - t) < 1e-4, `linear bezier at ${t}: ${lin(t)}`);
  }
  const s = cubicBezier(0.42, 0, 0.58, 1); // ease-in-out: odd-symmetric about centre
  assert.ok(Math.abs(s(0.5) - 0.5) < 1e-4);
  assert.ok(s(0.25) < 0.25, 'ease-in-out starts slow');
  assert.ok(s(0.75) > 0.75, 'ease-in-out ends fast');
});

test('cubicBezier is monotone non-decreasing on [0,1] for CSS-legal params', () => {
  const fns = [
    cubicBezier(0.42, 0, 1, 1),
    cubicBezier(0.25, 0.1, 0.25, 1),
    cubicBezier(0.2, 0, 0.8, 1),
  ];
  for (const fn of fns) {
    let prev = 0;
    for (let i = 0; i <= 100; i++) {
      const y = fn(i / 100);
      assert.ok(y >= prev - 1e-6, `monotone violated at ${i / 100}`);
      prev = y;
    }
  }
});

test('resolveEase: keywords resolve, cubic-bezier() parses, garbage falls back to linear', () => {
  assert.ok(resolveEase('ease-in')(0.5) < 0.5);
  assert.ok(Math.abs(resolveEase('cubic-bezier(0.42, 0, 0.58, 1)')(0.5) - 0.5) < 1e-4);
  const junk = resolveEase('bounce-typo');
  for (const t of [0.2, 0.5, 0.8]) assert.equal(junk(t), t);
});

test('parseStops: percent/unitless positions, per-stop easing, commas inside cubic-bezier survive', () => {
  const stops = parseStops('0 24px, 55% 4px ease-in-out, 1 0px cubic-bezier(.2, 0, .8, 1)');
  assert.equal(stops.length, 3);
  assert.deepEqual(
    stops.map((s) => s.at),
    [0, 0.55, 1],
  );
  assert.deepEqual(
    stops.map((s) => s.blur),
    [24, 4, 0],
  );
  assert.equal(stops[1].ease, 'ease-in-out');
  assert.match(stops[2].ease, /^cubic-bezier/);
});

test('parseStops: sorts by position, clamps to [0,1], rejects garbage and single stops', () => {
  const stops = parseStops('120% 2px, -0.5 10px');
  assert.deepEqual(
    stops.map((s) => [s.at, s.blur]),
    [
      [0, 10],
      [1, 2],
    ],
  );
  assert.throws(() => parseStops('0 24px'), /at least 2/);
  assert.throws(() => parseStops('hello, world'), /unparseable/);
});

test('blurAt: clamps beyond outer stops, linear between, easing bends the segment', () => {
  const lin = parseStops('0 0px, 1 20px');
  assert.equal(blurAt(lin, -1), 0);
  assert.equal(blurAt(lin, 2), 20);
  assert.ok(Math.abs(blurAt(lin, 0.5) - 10) < 1e-6);
  const eased = parseStops('0 0px, 1 20px ease-in');
  assert.ok(blurAt(eased, 0.5) < 10, 'ease-in keeps the first half nearer the start value');
});

test('blurAt: multi-stop profile is piecewise and non-monotone-capable', () => {
  const stops = parseStops('0 20px, 0.5 0px, 1 20px');
  assert.ok(Math.abs(blurAt(stops, 0.25) - 10) < 1e-6);
  assert.equal(blurAt(stops, 0.5), 0);
  assert.ok(Math.abs(blurAt(stops, 0.75) - 10) < 1e-6);
});

test('levelLadder: geometric coverage, exact top, zero level only when profile reaches ~0', () => {
  const withZero = levelLadder(0, 24, 6);
  assert.equal(withZero[0], 0);
  assert.equal(withZero[withZero.length - 1], 24);
  assert.ok(withZero.length <= 6);
  for (let i = 2; i < withZero.length; i++) {
    assert.ok(withZero[i] > withZero[i - 1], 'ascending');
  }
  const noZero = levelLadder(8, 24, 6);
  assert.ok(noZero[0] >= 8, 'floor respects the profile minimum');
  assert.equal(noZero[noZero.length - 1], 24);
  assert.deepEqual(levelLadder(0, 0.1, 6), [0], 'sub-visible profile needs no strips');
});

test('bandify: monotone ramp → ascending runs covering [0,1], neighbours always differ', () => {
  const { runs } = bandify(parseStops('0 0px, 1 24px'));
  assert.ok(runs.length >= 3, `expected several bands, got ${runs.length}`);
  assert.equal(runs[0].t0, 0);
  assert.equal(runs[runs.length - 1].t1, 1);
  for (let i = 1; i < runs.length; i++) {
    assert.ok(Math.abs(runs[i].t0 - runs[i - 1].t1) < 1e-9, 'runs tile the axis without gaps');
    assert.notEqual(runs[i].blur, runs[i - 1].blur, 'adjacent runs must differ');
    assert.ok(runs[i].blur > runs[i - 1].blur, 'monotone profile → ascending levels');
  }
  assert.equal(runs[0].blur, 0, 'ramp from zero starts with a sharp (no-strip) run');
  assert.equal(runs[runs.length - 1].blur, 24, 'strongest stop renders exactly');
});

test('bandify: non-monotone profile owns disjoint runs of the same level', () => {
  const { runs } = bandify(parseStops('0 24px, 0.5 0px, 1 24px'));
  const maxRuns = runs.filter((r) => r.blur === 24);
  assert.equal(maxRuns.length, 2, 'peak level appears on both flanks');
  assert.ok(
    runs.some((r) => r.blur === 0),
    'sharp valley in the middle',
  );
  for (const r of runs) assert.ok(r.t1 - r.t0 >= 0.005 - 1e-9, 'no sub-sliver runs survive');
});

test('bandify: steep transition breeds a real sub-sliver and the 0.005 merge absorbs it', () => {
  // Two stops 0.002 apart cross the whole ladder: at 512 samples exactly one
  // sample (t = 0.5) lands inside the window and owns a 1/512 ≈ 0.00195 run.
  // Without the sliver-merge guard that run reaches the DOM as a sub-pixel
  // strip; mutating the guard (0.005 → 0) makes THIS test fail. The smooth
  // valley profile above never breeds a sliver, so this is the named killer.
  const { runs } = bandify(parseStops('0 0px, 0.499 0px, 0.501 24px, 1 24px'));
  assert.ok(runs.length >= 2, `cliff must keep both flanks, got ${runs.length}`);
  for (const r of runs) {
    assert.ok(r.t1 - r.t0 >= 0.005 - 1e-9, `sliver run survived: [${r.t0}, ${r.t1}]`);
  }
  assert.equal(runs[0].t0, 0);
  assert.equal(runs[runs.length - 1].t1, 1);
  for (let i = 1; i < runs.length; i++) {
    assert.ok(Math.abs(runs[i].t0 - runs[i - 1].t1) < 1e-9, 'merge must not leave gaps');
  }
  assert.equal(runs[runs.length - 1].blur, 24, 'strongest stop still renders exactly');
});

test('bandBBox: axis-aligned slabs are tight; diagonal slabs clip to the box; misses are null', () => {
  const vertical = bandBBox(100, 200, { x: 50, y: 0 }, { x: 50, y: 200 }, 0.25, 0.5);
  assert.deepEqual(vertical, { x: 0, y: 50, w: 100, h: 50 });
  const horizontal = bandBBox(100, 200, { x: 0, y: 100 }, { x: 100, y: 100 }, 0.1, 0.3);
  assert.deepEqual(horizontal, { x: 10, y: 0, w: 20, h: 200 });
  const diag = bandBBox(100, 100, { x: 0, y: 0 }, { x: 100, y: 100 }, 0, 0.5);
  assert.ok(diag && diag.x === 0 && diag.y === 0, 'diagonal slab starts at origin corner');
  assert.ok(diag.w > 45 && diag.w <= 100 && diag.h > 45 && diag.h <= 100);
  assert.equal(bandBBox(100, 100, { x: 50, y: 0 }, { x: 50, y: 100 }, 1.5, 2), null);
  const degenerate = bandBBox(80, 60, { x: 10, y: 10 }, { x: 10, y: 10 }, 0, 1);
  assert.deepEqual(degenerate, { x: 0, y: 0, w: 80, h: 60 });
});
