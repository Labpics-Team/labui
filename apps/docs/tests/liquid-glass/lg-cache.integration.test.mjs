import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
// Liquid Glass — cache refcount / LRU / scratch-lifecycle integration tests.
//
// Test plan items #3 (cache refcount + hit-sharing + zombie-LRU bound),
// #4 (refcount-leak regression: re-render before decode) and #5 (scratch
// lifecycle: grow-on-demand + idle release). Class: integration + regression.
// These run the REAL engine module in headless Chromium and read the inert
// `__cacheStats()` export — invariants the pixel gate cannot see.
//
// THE CONTRACT UNDER TEST (ch01-t3 / ch01-t4 + ch04 wiring must create it):
//   prototypes/liquid-glass/lg-harness.mjs — a repo-resident, path-portable
//   harness that (a) serves `prototypes/liquid-glass/` from a repo-relative http
//   server (NO external C:/Users/... absolute paths, NO foreign @playwright
//   path) and (b) exports `runCacheSuite()` and `runScratchSuite()` returning the
//   ported case results. The reference scripts (C:/Users/Daniel/lg-cache-test.mjs,
//   lg-memstress.mjs) are the source; the repo port is what this test invokes.
//
// RED until lg-harness.mjs exists. Failure is an explicit assertion about the
// MISSING repo harness contract — never a bare uncaught import crash, never a
// browser timeout masquerading as red.
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const HARNESS = resolve(HERE, '../../../../prototypes/liquid-glass/lg-harness.mjs');

let harness = null;
let importError = null;
try {
  harness = await import(`file://${HARNESS}`);
} catch (err) {
  importError = err;
}

function needHarness(fnName) {
  assert.ok(
    harness !== null,
    `repo harness prototypes/liquid-glass/lg-harness.mjs must exist and serve the engine from a repo-relative path (ch01-t3/t4 + ch04 port of lg-cache-test.mjs / lg-memstress.mjs); import failed: ${importError ? importError.message : 'unknown'}`,
  );
  const fn = harness[fnName];
  assert.equal(
    typeof fn,
    'function',
    `lg-harness.mjs must export async \`${fnName}()\` (ported suite), got ${typeof fn}`,
  );
  return fn;
}

// ── #3 + #4: refcount, cache-hit sharing, zombie-LRU bound, refcount-leak ─────

test('cache suite: refcount accounting, hit-sharing, zombie-LRU bound, refcount-leak', async () => {
  const runCacheSuite = needHarness('runCacheSuite');
  const { pass, cases } = await runCacheSuite();
  assert.ok(Array.isArray(cases) && cases.length >= 5, 'cache suite must run all ported cases');

  const byName = (frag) => cases.find((c) => c.name.includes(frag));

  // #4 refcount-leak class (re-render before decode): destroy → ZERO live.
  const leak = byName('refcount-leak');
  assert.ok(leak, 'refcount-leak case must be present (the riskiest engine line)');
  assert.equal(leak.pass, true, `refcount-leak: live must be 0 after destroy — ${leak.detail}`);

  // cache-HIT class: 2nd same-geometry instance does NOT grow size; shared entry
  // stays live while one ref is held.
  const hitGrow = byName('size does NOT grow');
  assert.ok(hitGrow?.pass, `cache-hit must not grow size — ${hitGrow?.detail}`);
  const hitLive = byName('stays live');
  assert.ok(hitLive?.pass, `shared entry must stay live — ${hitLive?.detail}`);

  // zombie-LRU bound + memory-bound: >ZOMBIE_CAP distinct geometries keep
  // zombies<=cap, live==0, peak size bounded.
  const zomb = byName('zombies <= ZOMBIE_CAP');
  assert.ok(zomb?.pass, `zombies must stay <= cap — ${zomb?.detail}`);
  const noLeak = byName('no live leaked');
  assert.ok(noLeak?.pass, `no live entry may leak — ${noLeak?.detail}`);
  const bounded = byName('memory-bounded');
  assert.ok(bounded?.pass, `peak size must stay bounded — ${bounded?.detail}`);

  // LRU-revival: resize back to a parked size revives without growing.
  const revive = byName('lru-revival');
  assert.ok(revive?.pass, `parked geometry must revive without growth — ${revive?.detail}`);

  assert.equal(pass, true, 'every cache case must pass against the real engine');
});

// ── #5: scratch lifecycle (grow-on-demand + idle release) ────────────────────

test('scratch suite: grows-on-demand, released after idle, cache bounded under storm', async () => {
  const runScratchSuite = needHarness('runScratchSuite');
  const { memoryBounded, checks } = await runScratchSuite();

  assert.equal(
    checks.scratchAfterBuild ?? checks.firstPaintSynchronous !== undefined,
    true,
    'scratch must be allocated right after a build (scratchAllocated === true)',
  );
  assert.equal(
    checks.scratchNotRetainedAtSteadyState,
    true,
    'scratch must be released after > SCRATCH_IDLE_MS idle (no permanent high-water mark)',
  );
  assert.equal(checks.cacheBounded, true, 'peak size bounded under a 40-distinct-size storm');
  assert.equal(checks.zombiesCapped, true, 'zombies capped under the storm');
  assert.equal(checks.warmResizeStillHits, true, 'warm resize-back still hits');
  assert.equal(memoryBounded, true, 'all scratch/memory invariants hold');
});
