---
id: t3-cache-refcount-lru
chapter: ch01-unit-pure-and-cache
epic: liquid-glass-test-suite
title: "Chromium cache test: refcount accounting, cache-hit sharing, zombie-LRU bound, refcount-leak class"
status: ready
priority: 1
depends_on:
  - t1-wiring-and-pure-extraction
blocks: []
agent_profile:
  category: visual-engineering
  skills: [craft-qa]
started: null
completed: null
refine_after: []
---

# Chromium cache test: refcount + LRU + the refcount-leak class

## What
Port `C:/Users/Daniel/lg-cache-test.mjs` into the repo as a Node-driven Playwright script that serves `prototypes/liquid-glass/liquid-glass.js` from a repo-relative http server and asserts, via `__cacheStats()` and real `attach()`/`destroy()`:
1. **refcount-leak class (CASE 1):** patch `window.Image` so feImage decode is DEFERRED; attach + two same-geometry `update()` calls while decode pends; flush; destroy → `live == 0`. This is the riskiest class (heldKey double-acquire). Port the decode-deferral patch faithfully.
2. **cache-HIT class:** two instances at the SAME geometry → `size` does not grow; destroying one keeps the entry live; destroying both → entry gone.
3. **eviction + memory-bound class:** attach+destroy >ZOMBIE_CAP (40) distinct geometries → `zombies <= zombieCap` and `live == 0` and `maxSize <= cap + small`.
4. **LRU-revival class:** destroy a geometry (parks a zombie), re-attach the SAME geometry → revives without growing size; revived entry is live.

Drop the external absolute paths; resolve `@playwright/test@1.49.1` from the repo; point ENGINE at the repo prototype. Exit non-zero on any failed case.

## Must NOT Do
- Do NOT read engine internals other than the public `attach`/`destroy` and the inert `__cacheStats()` export.
- Do NOT weaken the decode-deferral patch — without it CASE 1 cannot catch the leak class.
- Do NOT hardcode Windows paths or the external node_modules @playwright path.

## Verification
- [ ] All four cases pass against the repo engine, headless Chromium, deviceScaleFactor 2.
- [ ] Reverting the engine's double-acquire fix (temporarily, local) makes CASE 1 FAIL (proves the test bites the refcount-leak class). Revert immediately.
- [ ] Runs under `pnpm test` via the t1 script; deterministic across 3 consecutive runs.

## References
- `C:/Users/Daniel/lg-cache-test.mjs` — source to port (4 cases + window.Image deferral).
- `prototypes/liquid-glass/liquid-glass.js:300-342` — ZOMBIE_CAP, evictZombies, acquireMap/releaseMap.
- `prototypes/liquid-glass/liquid-glass.js:485-498` — heldKey gating (the refcount-leak fix under test).
- `prototypes/liquid-glass/liquid-glass.js:594-599` — `__cacheStats()` shape {size, live, zombies, zombieCap, scratchAllocated}.
