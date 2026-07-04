/*
 * lab-liquid-glass — repo-resident, path-portable test harness.
 *
 * The reference QA scripts (C:/Users/Daniel/lg-cache-test.mjs, lg-memstress.mjs,
 * lg-qadiff2.mjs, lg-mutate-test.mjs) proved the engine's memory discipline and
 * pixel output, but hardcoded external Windows paths and a foreign @playwright
 * resolution. This module is their committed port:
 *
 *   · serves prototypes/liquid-glass/ from a REPO-RELATIVE http server,
 *   · resolves @playwright/test from THIS repo (apps/docs devDependency),
 *
 * and exports the async entry points the test files invoke:
 *   runCacheSuite()        → { pass, cases }              (cache refcount/LRU/leak)
 *   runScratchSuite()      → { memoryBounded, checks }    (scratch lifecycle)
 *   runVisualGate({mode,dir,ref}) → baseline: { ok, froze }   (freeze a reference)
 *                                   diff: { pass, threshold, results } (pixel gate)
 *   runHermeticGate({base,runs})  → { base, runs, pass }  (freeze base engine ON
 *                                    THIS machine, diff HEAD engine against it)
 *   runMutationHarness()   → { <dim>: caught, allCaught } (Class-D bite-proof)
 *
 * HERMETIC BASELINES — never committed, always frozen on the machine that
 * diffs them. Screenshot pixels are font/raster-coupled to the OS (Playwright:
 * "run tests in the same environment where the baseline screenshots were
 * generated"); a committed PNG set frozen on one OS moves EVERY row on another
 * and the gate turns into noise (the exact class that kept CI red). Instead the
 * gate freezes its reference from the BASE git ref (PR base in CI, @{upstream}
 * locally) in a throwaway worktree and diffs the working engine against it on
 * the same machine — deterministic everywhere, zero binary artifacts in git.
 *
 * Self-contained: it owns its http server + Chromium lifecycle. No external
 * preview server, no Astro/Vite — it serves the static prototype directly.
 */

// The monolith is split by suite (the god-module debt from the arch review);
// this facade keeps every existing import path stable.
export { PROTO_DIR, REPO_ROOT, chromium, serveDir } from './harness/common.mjs';
export { runCacheSuite, runPendingDecodeRegression, runScratchSuite } from './harness/suites.mjs';
export { baseHasEngine, resolveGateBase, runHermeticGate, runVisualGate } from './harness/visual-gate.mjs';
export { runMutationHarness } from './harness/mutations.mjs';
