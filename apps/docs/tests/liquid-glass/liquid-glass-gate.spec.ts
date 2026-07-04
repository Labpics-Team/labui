import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

/**
 * Liquid Glass — hermetic visual-regression gate (test plan #6), the
 * cross-engine fallback guard (#7), and the determinism cross-check (#9).
 *
 * HERMETIC, NOT GOLDEN-FILE: the reference is frozen ON THIS MACHINE from the
 * BASE git ref (PR base in CI via LG_GATE_BASE, the branch upstream locally),
 * then the working engine is diffed against it across the ~14-state matrix at
 * meanDelta<1 OR maxDelta<8 OR pctChanged<1. Committed PNG baselines are
 * font/raster-coupled to the OS that froze them (Playwright: "run tests in the
 * same environment where the baseline screenshots were generated") and are
 * test artifacts that do not belong in the repo — freezing per-machine removes
 * both problems at once. What the gate then asserts is exactly the PR
 * guarantee: THIS change does not move the glass's pixels.
 *
 * The gate is Chromium-only: under WebKit (which does not refract) it SKIPS
 * cleanly (#7). Failures are explicit assertions — never a bare import crash,
 * never a flaky timeout standing in for red.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const HARNESS = resolve(HERE, '../../../../prototypes/liquid-glass/lg-harness.mjs');

type Verdict = {
  pass: boolean;
  threshold: { meanDelta: number; maxDelta: number; pctChanged: number };
  results: { state: string; element: string; fail: boolean }[];
};
type Harness = {
  runHermeticGate?: (opts?: { base?: string; runs?: number }) => Promise<{
    base: string;
    runs: Verdict[];
    pass: boolean;
  }>;
  resolveGateBase?: () => string;
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
    `repo harness prototypes/liquid-glass/lg-harness.mjs must exist; import failed: ${String(importError)}`,
  ).not.toBeNull();
  const fn = harness?.runHermeticGate;
  expect(
    typeof fn,
    'lg-harness.mjs must export async runHermeticGate({base?, runs?}) — the on-machine freeze-and-diff gate',
  ).toBe('function');
  return fn as NonNullable<Harness['runHermeticGate']>;
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

  // ── #6: hermetic pane+panel gate — head engine vs base engine, one machine ──
  test('pane + panel match the base-ref engine across the full state matrix', async () => {
    // Measured: freeze + one diff ≈ 40s on a slow Windows raster host; 10 min
    // is a generous ceiling that still fits the job budget with margin.
    test.setTimeout(10 * 60_000);
    const runHermeticGate = needGate();

    const { base, runs, pass } = await runHermeticGate({ runs: 1 });
    expect(base, 'the gate must resolve a base ref to freeze from').toBeTruthy();
    const verdict = runs[0];
    expect(verdict, 'hermetic gate must produce a diff verdict').toBeDefined();
    if (!verdict) return; // narrowed for TS — the expect above already failed

    // The de-duplicated matrix must stay substantial and cover BOTH elements —
    // a shrunken matrix silently narrows the gate.
    expect(
      verdict.results.length,
      'gate must diff a substantial, de-duplicated matrix of perturbed rows',
    ).toBeGreaterThan(12);
    const elements = new Set(verdict.results.map((r) => r.element));
    expect(elements.has('#pane'), 'gate must capture #pane').toBe(true);
    expect(elements.has('#panel'), 'gate must capture #panel').toBe(true);
    const rowKeys = verdict.results.map((r) => `${r.state}/${r.element}`);
    expect(new Set(rowKeys).size, 'every diffed row must be unique').toBe(rowKeys.length);

    // Threshold is locked: meanDelta<1 OR maxDelta<8 OR pctChanged<1.
    expect(verdict.threshold).toEqual({ meanDelta: 1.0, maxDelta: 8, pctChanged: 1.0 });

    const movers = verdict.results.filter((r) => r.fail).map((r) => `${r.state}/${r.element}`);
    expect(
      pass,
      `picture must match the base-ref engine (${base}); movers: ${movers.join(', ')}`,
    ).toBe(true);
  });

  // ── #9: determinism — 3 consecutive diff runs against ONE freeze stably PASS ─
  test('three consecutive gate runs stably pass (determinism, warm-up preserved)', async () => {
    test.setTimeout(15 * 60_000); // one freeze + three diffs (≈4× a single run)
    const runHermeticGate = needGate();
    const { runs, pass } = await runHermeticGate({ runs: 3 });
    expect(runs.length, 'determinism needs 3 diff runs').toBe(3);
    for (const [i, verdict] of runs.entries()) {
      expect(verdict.pass, `gate run #${i + 1} must pass (stable, no AA/raster flake)`).toBe(true);
    }
    expect(pass).toBe(true);
  });
});
