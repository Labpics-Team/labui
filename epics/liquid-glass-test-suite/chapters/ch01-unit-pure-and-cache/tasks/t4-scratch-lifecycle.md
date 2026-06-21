---
id: t4-scratch-lifecycle
chapter: ch01-unit-pure-and-cache
epic: liquid-glass-test-suite
title: "Chromium memory-stress: scratch grows-on-demand + releases after idle, cache bounded under storm"
status: ready
priority: 2
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

# Chromium memory-stress: scratch lifecycle + cache bound under a resize storm

## What
Port `C:/Users/Daniel/lg-memstress.mjs` into the repo (repo-relative server + @playwright resolution). Drive the REAL engine and assert:
1. **scratch grows-on-demand:** after a build, `__cacheStats().scratchAllocated == true`; a larger geometry reuses/grows the same scratch (no error, bytes identical).
2. **scratch released after idle:** wait > SCRATCH_IDLE_MS (2000ms, use ~2400ms) → `scratchAllocated == false` (no permanent high-water mark — the memory-bound the engine added).
3. **cache bounded under a 40-distinct-size storm:** peak size ≤ live + zombieCap + 1; zombies ≤ cap.
4. **warm resize-back still hits:** resize back to a recent parked size → size does not grow.
5. (Keep the reference's `firstPaintSync` check if it holds for the repo engine — the first build paints the lens synchronously; if the repo engine differs, drop it with a note rather than forcing it.)

## Must NOT Do
- Do NOT shorten the idle wait below SCRATCH_IDLE_MS — the release is exactly what's under test.
- Do NOT depend on GC timing or `performance.memory` — assert via the deterministic `__cacheStats()` flags only.
- Do NOT hardcode external Windows/@playwright paths.

## Verification
- [ ] All checks pass; deterministic across 3 runs.
- [ ] Temporarily disabling `armScratchRelease()`/`releaseScratch` (local) makes check 2 FAIL (proves it bites the high-water-mark class). Revert immediately.
- [ ] Runs under `pnpm test` via the t1 script.

## References
- `C:/Users/Daniel/lg-memstress.mjs` — source to port.
- `prototypes/liquid-glass/liquid-glass.js:103-138` — sDx/sRGBA/sCanvas scratch, releaseScratch, armScratchRelease, SCRATCH_IDLE_MS=2000.
- `prototypes/liquid-glass/liquid-glass.js:163-165, 238-240` — grow-on-demand allocation.
