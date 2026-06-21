import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

/**
 * Liquid Glass — deterministic visual-regression gate (test plan #6), the
 * cross-engine fallback guard (#7), and the determinism + baseline sanity
 * cross-check (#9).
 *
 * Golden-master gate: diff BOTH #pane and #panel across the ~14-state matrix
 * (dark/light rest, drag, dispersion 0.9, big-corner, distinct-geo = 2 live cache
 * entries, refraction=0, reduced-transparency via CDP, panel-lens, body/depth
 * sentinels) at meanDelta<1 OR maxDelta<8 OR pctChanged<1, against a baseline
 * re-frozen FROM THIS repo's engine.
 *
 * THE CONTRACT UNDER TEST (ch02 + ch03 must create it):
 *   prototypes/liquid-glass/lg-harness.mjs — exports `runVisualGate({ mode })` and
 *   `runMutationHarness()` ported from C:/Users/Daniel/lg-qadiff2.mjs and
 *   lg-mutate-test.mjs (external Windows/@playwright absolute paths DROPPED, repo
 *   baseline dir), serving prototypes/liquid-glass/ from a repo-relative server.
 *   The committed baseline PNGs live under a repo-relative dir, frozen on Linux
 *   Chromium (ch02-t3) — NOT on Windows.
 *
 * RED until the harness module + the committed baseline exist. The gate is
 * Chromium-only: under WebKit (which does not refract) it SKIPS cleanly (#7).
 * Failures are explicit assertions about the MISSING harness/baseline — never a
 * bare import crash, never a flaky timeout standing in for red.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const HARNESS = resolve(HERE, '../../../../prototypes/liquid-glass/lg-harness.mjs');
const BASELINE_DIR = resolve(HERE, '../../../../prototypes/liquid-glass/__gate_baseline__');

// Dynamically load the (not-yet-existing) repo harness. A missing module yields a
// null harness asserted explicitly below, not an uncaught module-not-found.
type Harness = {
  runVisualGate?: (opts: { mode: 'diff' }) => Promise<{
    pass: boolean;
    threshold: { meanDelta: number; maxDelta: number; pctChanged: number };
    results: { state: string; element: string; fail: boolean }[];
  }>;
  runMutationHarness?: () => Promise<Record<string, boolean> & { allCaught: boolean }>;
};

let harness: Harness | null = null;
let importError: unknown = null;
try {
  harness = (await import(`file://${HARNESS}`)) as Harness;
} catch (err) {
  importError = err;
}

function needGate() {
  expect(
    harness,
    `repo harness prototypes/liquid-glass/lg-harness.mjs must exist (ch02 port of lg-qadiff2.mjs, external absolute paths dropped); import failed: ${String(importError)}`,
  ).not.toBeNull();
  const fn = harness?.runVisualGate;
  expect(typeof fn, 'lg-harness.mjs must export async runVisualGate({mode})').toBe('function');
  return fn as NonNullable<Harness['runVisualGate']>;
}

// ── #7: cross-engine fallback guard — the lens gate is Chromium-ONLY ──────────
// WebKit falls back to honest frost (supportsRefraction false), so the pixel gate
// does not run there. This skip keeps the existing materials/component specs green
// under the WebKit project.
test.describe('liquid-glass visual gate', () => {
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'lens visual gate is Chromium-only — WebKit falls back to frost (no refraction)',
  );

  // ── #6: deterministic pane+panel golden-master vs the frozen baseline ───────
  test('pane + panel match the frozen baseline across the full state matrix', async () => {
    const runVisualGate = needGate();

    // The baseline must be re-frozen FROM THIS engine and committed (ch02-t3,
    // Linux Chromium). Its absence is the missing behaviour, asserted directly.
    expect(
      existsSync(BASELINE_DIR),
      `committed gate baseline ${BASELINE_DIR} must exist (ch02-t3: re-frozen from THIS engine on Linux Chromium, both #pane and #panel per state)`,
    ).toBe(true);

    const verdict = await runVisualGate({ mode: 'diff' });

    // C1 fix: each state diffs ONLY the element(s) it perturbs, so there are no
    // byte-identical duplicate rows that diff nothing (was ~28 rows, ~30% of them
    // duplicate PNGs). The de-duplicated matrix is ~17 unique rows; assert a
    // meaningful floor and that BOTH elements are still represented.
    expect(
      verdict.results.length,
      'gate must diff a substantial, de-duplicated matrix of perturbed rows',
    ).toBeGreaterThan(12);
    const elements = new Set(verdict.results.map((r) => r.element));
    expect(elements.has('#pane'), 'gate must capture #pane').toBe(true);
    expect(elements.has('#panel'), 'gate must capture #panel').toBe(true);
    // Every diffed row must be a DISTINCT state/element coordinate (no row diffed
    // twice) — the dedup must not collapse the matrix into repeats.
    const rowKeys = verdict.results.map((r) => `${r.state}/${r.element}`);
    expect(new Set(rowKeys).size, 'every diffed row must be unique').toBe(rowKeys.length);

    // Threshold is locked: meanDelta<1 OR maxDelta<8 OR pctChanged<1.
    expect(verdict.threshold).toEqual({ meanDelta: 1.0, maxDelta: 8, pctChanged: 1.0 });

    const movers = verdict.results.filter((r) => r.fail).map((r) => `${r.state}/${r.element}`);
    expect(
      verdict.pass,
      `picture must match the frozen baseline; movers: ${movers.join(', ')}`,
    ).toBe(true);
  });

  // ── #9: determinism — 3 consecutive diff runs stably PASS (warm-up preserved) ─
  test('three consecutive gate runs stably pass (determinism, warm-up preserved)', async () => {
    const runVisualGate = needGate();
    expect(existsSync(BASELINE_DIR), `committed gate baseline ${BASELINE_DIR} must exist`).toBe(
      true,
    );
    for (let i = 0; i < 3; i++) {
      const verdict = await runVisualGate({ mode: 'diff' });
      expect(verdict.pass, `gate run #${i + 1} must pass (stable, no AA/raster flake)`).toBe(true);
    }
  });
});
