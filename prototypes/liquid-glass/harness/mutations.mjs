/*
 * lg-harness/mutations — the Class-D bite-proof: weaken one dimension in a
 * throwaway engine copy, the named isolating gate row must move.
 * See lg-harness.mjs (facade) for the contract.
 */
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PROTO_DIR } from './common.mjs';
import { runVisualGate } from './visual-gate.mjs';

/* ════════════════════════════════════════════════════════════════════════════
 * #8 — Class-D mutation bite-proof. Port of lg-mutate-test.mjs. Freezes the
 *   CURRENT engine on THIS machine as the reference, then for each of the 10
 *   effect dimensions mkdtemp-copies the engine, weakens ONE dimension, re-runs
 *   the gate against that fresh reference, and asserts the gate FAILS (caught).
 *   The committed engine is never mutated; no baseline is ever committed.
 * ════════════════════════════════════════════════════════════════════════════ */
// C2: each mutation names the SPECIFIC baseline row that ISOLATES its dimension
// — the row where that effect is actually visible. A lens-relevant dimension
// (MAX_PULL, dispersion, depth) MUST be caught by a LENS row, never by a flat
// frost/duplicate row that moved for an unrelated reason. We assert the named
// row itself failed, not merely that ≥1 of ~20 rows moved somewhere.
//   · `state__element` of `isolating` must exist as a committed baseline PNG
//     (survive the C1 dedup) and must show this effect.
const MUTATIONS = [
  {
    dimension: 'lens-strength',
    file: 'lg-math.js',
    find: 'export const MAX_PULL = 0.15;',
    repl: 'export const MAX_PULL = 0.138;',
    // Displacement magnitude → the strongest pure-lens row (refraction 2,
    // dispersion 0): the bend, not the fringe, must shift.
    isolating: { state: 'depth-default', element: '#pane' },
  },
  {
    dimension: 'dispersion',
    file: 'liquid-glass.js',
    find: 'const k = dispersion * 0.08; // gentle per-channel spread',
    repl: 'const k = dispersion * 0.04; // gentle per-channel spread',
    // Chromatic rim fringe → the dispersion-0.9 row (the only state that turns
    // dispersion up); a flat frost row cannot see this.
    isolating: { state: 'dispersion', element: '#pane' },
  },
  {
    dimension: 'blur',
    file: 'liquid-glass.css',
    find: '  --lg-radius: 4px;',
    repl: '  --lg-radius: 2px;',
    // Default CSS backdrop blur → the default-param resting pane.
    isolating: { state: 'dark-rest', element: '#pane' },
  },
  {
    dimension: 'tint',
    file: 'liquid-glass.css',
    find: '  --lg-tint-opacity: 0.03;',
    repl: '  --lg-tint-opacity: 0.06;',
    // The base --lg-tint-opacity:0.03 is OVERRIDDEN to 0.05 by the dark-theme
    // rule, so this mutation only renders under LIGHT theme. Its isolating row is
    // therefore a light-theme row, not a dark one. (This is the C2 catch: the old
    // ≥1-row check passed `tint` for the WRONG reason — a coincidental dark row
    // moved while the actual base-tint guard is light.)
    isolating: { state: 'light-rest', element: '#pane' },
  },
  {
    dimension: 'rim-sheen',
    file: 'liquid-glass.css',
    find: '    rgba(255, 255, 255, 0.22) 0%,',
    repl: '    rgba(255, 255, 255, 0.11) 0%,',
    isolating: { state: 'dark-rest', element: '#pane' },
  },
  {
    dimension: 'depth',
    file: 'liquid-glass.css',
    find: '  --lg-depth: 40; /* consumed by JS — px width of the magnified rim band */',
    repl: '  --lg-depth: 34; /* consumed by JS — px width of the magnified rim band */',
    // Default lens-band width → resting pane carries the default depth lens.
    isolating: { state: 'dark-rest', element: '#pane' },
  },
  {
    dimension: 'saturate',
    file: 'liquid-glass.css',
    find: '  --lg-saturate: 1.3;',
    repl: '  --lg-saturate: 1.0;',
    isolating: { state: 'dark-rest', element: '#pane' },
  },
  {
    dimension: 'brightness',
    file: 'liquid-glass.css',
    find: '  --lg-brightness: 1.05;',
    repl: '  --lg-brightness: 0.95;',
    isolating: { state: 'dark-rest', element: '#pane' },
  },
  {
    dimension: 'contrast',
    file: 'liquid-glass.css',
    find: '  --lg-contrast: 1.2; /* contrast, not blur, gives the "glassy" body */',
    repl: '  --lg-contrast: 1.05; /* contrast, not blur, gives the "glassy" body */',
    isolating: { state: 'dark-rest', element: '#pane' },
  },
  {
    dimension: 'reduced-tint-opacity',
    file: 'liquid-glass.css',
    find: '    --lg-tint-opacity: 1;',
    repl: '    --lg-tint-opacity: 0.85;',
    // The reduced-transparency block only applies under prefers-reduced-
    // transparency → only the reduced state isolates it.
    isolating: { state: 'reduced-transparency', element: '#pane' },
  },
];

export async function runMutationHarness() {
  const results = {};
  const detail = {};
  // Hermetic reference: frozen from the CURRENT engine on THIS machine, so a
  // mutant row can only move because of the mutation — never because the
  // machine's fonts/raster differ from wherever a committed PNG was born.
  const refWork = await mkdtemp(join(tmpdir(), 'lg-mut-ref-'));
  const refDir = join(refWork, 'ref');
  try {
    await runVisualGate({ mode: 'baseline', dir: PROTO_DIR, ref: refDir });
    await runMutations(results, detail, refDir);
  } finally {
    await rm(refWork, { recursive: true, force: true });
  }
  const allCaught = Object.values(results).every(Boolean);
  return { ...results, allCaught, detail };
}

async function runMutations(results, detail, refDir) {
  for (const m of MUTATIONS) {
    const work = await mkdtemp(join(tmpdir(), 'lg-mut-'));
    const copy = join(work, 'engine');
    try {
      await cp(PROTO_DIR, copy, { recursive: true });
      const target = join(copy, m.file);
      const src = await readFile(target, 'utf8');
      if (!src.includes(m.find)) {
        throw new Error(`[${m.dimension}] anchor not found in ${m.file}: ${m.find}`);
      }
      const patched = src.replace(m.find, m.repl);
      if (patched === src) throw new Error(`[${m.dimension}] patch was a no-op`);
      await writeFile(target, patched);

      // Diff the PATCHED copy against the fresh on-machine reference. A
      // weakening must move pixels past threshold — AND, for C2 correctness, it
      // must do so in the SPECIFIC row that isolates this dimension.
      const verdict = await runVisualGate({ mode: 'diff', dir: copy, ref: refDir });
      const iso = m.isolating;
      const row = verdict.results.find((r) => r.state === iso.state && r.element === iso.element);
      if (!row) {
        // The isolating row vanished from the baseline (e.g. dedup dropped it) —
        // the dimension is no longer guarded by a real row. That is a HOLE, not a
        // catch: leave caught=false so allCaught fails loudly.
        results[m.dimension] = false;
        detail[m.dimension] = `isolating row ${iso.state}/${iso.element} absent from gate results`;
        continue;
      }
      // Caught == the isolating row itself moved past threshold.
      results[m.dimension] = row.fail === true;
      detail[m.dimension] =
        `${iso.state}/${iso.element} mean=${row.meanDelta} max=${row.maxDelta} pct=${row.pctChanged} fail=${row.fail}`;
    } finally {
      await rm(work, { recursive: true, force: true });
    }
  }
}
