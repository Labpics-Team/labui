/*
 * Deterministic CPU bench for the displacement-map hot core
 * (`__computeDisplacementField` in engine/liquid-glass.ts).
 *
 * WHAT THIS MEASURES — and why it is the honest baseline for the perf work:
 *   `__computeDisplacementField` is the ENTIRE synchronous, main-thread-blocking
 *   part of a map build (the ¼-symmetric SDF field loop + the float→byte encode
 *   loop). Everything after it — putImageData, the PNG encode (canvas.toBlob),
 *   the feImage decode — is either already off-thread or browser-only. So the
 *   number below is exactly:
 *     · the work a Web Worker would move OFF the main thread   (ceiling crit. а)
 *     · the work an SDF distance-field cache would cut on a depth change (crit. б)
 *   measured with no canvas, no DOM, no PNG — pure, reproducible arithmetic.
 *
 * METHOD: median of B batches × N iters via process.hrtime.bigint(). The engine
 * reuses module-level scratch across builds, so a warmup primes both the scratch
 * and the JIT before timing. Absolute ns are runtime-coupled (tsx/V8) and NOT a
 * CI gate — the value is the BEFORE/AFTER ratio on ONE machine+runtime. (The
 * engine notes a known tsx JIT artefact on no-interior degenerate maps; those are
 * excluded from the headline groups and reported separately.)
 *
 * Run:  pnpm --filter @labpics/ui-materials bench
 */
import { __computeDisplacementField } from '../src/engine/liquid-glass';
import { MAP_CORPUS, type MapCase } from '../test/engine-map-corpus';

interface Row {
  name: string;
  dims: string;
  medianUs: number;
  minUs: number;
  bytes: number;
}

const BATCHES = 15;

function iterFor(px: number): number {
  // Scale iteration count inversely with map area so every case gets a stable
  // median in comparable wall-time (tiny maps need many reps; 1024² needs few).
  if (px <= 4_096) return 4000;
  if (px <= 65_536) return 800;
  if (px <= 262_144) return 200;
  return 60;
}

function benchCase(c: MapCase): Row {
  const probe = __computeDisplacementField(c.w, c.h, c.corner, c.depth, c.dpr);
  const px = probe.W * probe.H;
  const iters = iterFor(px);
  // Warmup: prime scratch + JIT for THIS geometry.
  for (let i = 0; i < Math.min(iters, 500); i++) {
    __computeDisplacementField(c.w, c.h, c.corner, c.depth, c.dpr);
  }
  const batchUs: number[] = [];
  for (let b = 0; b < BATCHES; b++) {
    const t0 = process.hrtime.bigint();
    for (let i = 0; i < iters; i++) {
      __computeDisplacementField(c.w, c.h, c.corner, c.depth, c.dpr);
    }
    const t1 = process.hrtime.bigint();
    batchUs.push(Number(t1 - t0) / 1000 / iters); // µs per build
  }
  batchUs.sort((a, b) => a - b);
  return {
    name: c.name,
    dims: `${probe.W}×${probe.H}`,
    medianUs: batchUs[BATCHES >> 1] as number,
    minUs: batchUs[0] as number,
    bytes: probe.data.length,
  };
}

/** Depth-sweep: the cost of dragging the depth slider today. Depth is part of the
 *  cache geoKey, so every tick is a FULL rebuild of the same geometry — this is
 *  the "before" for ceiling criterion (б) (depth change should become O(encode),
 *  0 SDF recomputes). One typical glass panel, depth swept across a realistic
 *  slider range; we report the total and per-tick build cost. */
function benchDepthSweep(): { totalMs: number; ticks: number; perTickUs: number } {
  const w = 360;
  const h = 220;
  const corner = 24;
  const dpr = 2;
  const depths: number[] = [];
  for (let d = 8; d <= 88; d += 4) depths.push(d); // 21 slider positions
  // warmup
  for (const d of depths) __computeDisplacementField(w, h, corner, d, dpr);
  const reps = 40;
  const t0 = process.hrtime.bigint();
  for (let r = 0; r < reps; r++) {
    for (const d of depths) __computeDisplacementField(w, h, corner, d, dpr);
  }
  const t1 = process.hrtime.bigint();
  const totalNs = Number(t1 - t0);
  const ticks = reps * depths.length;
  return {
    totalMs: totalNs / 1e6 / reps,
    ticks: depths.length,
    perTickUs: totalNs / 1000 / ticks,
  };
}

function fmt(n: number, w: number): string {
  return n.toFixed(2).padStart(w);
}

function main(): void {
  const rows = MAP_CORPUS.map(benchCase);
  // Headline groups (representative real surfaces).
  const pick = (name: string): Row => rows.find((r) => r.name === name) as Row;
  const headline = ['small-square-dpr2', 'medium-card-dpr2', 'large-panel'].map(pick);

  process.stdout.write('\n=== __computeDisplacementField — per-build CPU (median µs) ===\n');
  process.stdout.write('case                       device      median    min\n');
  for (const r of rows) {
    process.stdout.write(
      `${r.name.padEnd(26)} ${r.dims.padStart(10)}  ${fmt(r.medianUs, 8)} ${fmt(r.minUs, 8)}\n`,
    );
  }

  const sweep = benchDepthSweep();
  process.stdout.write('\n=== depth-slider sweep (before: every tick = full rebuild) ===\n');
  process.stdout.write(
    `360×220 @dpr2, ${sweep.ticks} positions: ${sweep.totalMs.toFixed(3)} ms/full-sweep, ` +
      `${sweep.perTickUs.toFixed(2)} µs/tick\n`,
  );

  process.stdout.write('\n=== headline ===\n');
  for (const r of headline) {
    process.stdout.write(`${r.name.padEnd(26)} ${r.dims.padStart(10)}  ${fmt(r.medianUs, 8)} µs\n`);
  }
  process.stdout.write('\n');
}

main();
