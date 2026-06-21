---
id: ch01-unit-pure-and-cache
epic: liquid-glass-test-suite
title: "Unit math + constants + cache/scratch invariants (the pixel-invisible class)"
user_story: "technical enabler"
enabler_for: "The whole epic — closes the memory/leak class the optimised engine introduced, and provides the Node-importable pure functions every later chapter and any future refactor relies on. Underlying user benefit (ch02/ch03): the Liquid Glass material stays correct over time."
status: ready
priority: 1
depends_on: []
refine_after: []
parallel_group: ""
agent_profile:
  category: visual-engineering
  skills: [craft-qa, craft-arch]
---

# Unit math + constants + cache/scratch invariants

## User Story
Technical enabler for the epic. The optimised engine added a refcounted cross-instance cache, a bounded zombie-LRU, and reused scratch buffers — all invisible to a pixel diff, so the visual gate (ch02) can NEVER catch a re-leak. This chapter installs the executable definition of those invariants and extracts the pure math so Node can test it without a browser. It also fixes the wiring decision the whole epic hangs on.

## Purpose
Three responsibilities, all "correctness invisible to pixels":
1. **Decide the wiring** (the one fork the rest of the epic depends on) with evidence, and make the engine's pure math + encoding constants importable from Node WITHOUT changing the rendered output.
2. **Unit-test the pure math and encoding invariants** (Node, no browser): `sdRoundRect`, `clamp01`, `smoothstep`; interior pixels encode neutral (~128,128); rim pixels approach the [-maxAbs,maxAbs]→[0,1] extremes; B=128 A=255 constants.
3. **Test the cache/scratch invariants in real Chromium** against the actual engine module: refcount accounting (acquire++/release--/delete at 0), bounded zombie-LRU (never exceeds ZOMBIE_CAP=12 live zero-ref entries), scratch grows-on-demand and releases after idle, and the refcount-leak class (re-render before decode never double-acquires).

## Tasks
| Task | Status | Agent | Depends On |
|------|--------|-------|------------|
| `tasks/t1-wiring-and-pure-extraction.md` | ready | visual-engineering | — |
| `tasks/t2-unit-math-and-encoding.md` | ready | visual-engineering | t1 |
| `tasks/t3-cache-refcount-lru.md` | ready | visual-engineering | t1 |
| `tasks/t4-scratch-lifecycle.md` | ready | visual-engineering | t1 |

## Exit Criteria
- [ ] **Given** the engine on branch feat/liquid-glass, **When** the pure-math/constants are made Node-importable, **Then** `git diff` shows the browser engine's rendered output is byte-identical (proven by re-running the ch02 freeze before/after the extraction, or by a documented eval-shim that adds zero engine change) — and the wiring decision is recorded in t1 with a one-paragraph rationale.
- [ ] **Given** `node` with no DOM, **When** the unit suite runs, **Then** sdRoundRect is asserted <0 inside / >0 outside / 0 on the rim for a known rounded rect; clamp01 and smoothstep match closed-form expected values at 0/0.5/1 and out-of-range; and the encoding invariants hold (interior byte ≈128,128; B==128; A==255; a rim pixel's |byte-127.5| is near the maxAbs extreme).
- [ ] **Given** the REAL engine module loaded in headless Chromium, **When** two instances attach at the same geometry, **Then** `__cacheStats().size` does not grow (one shared entry, refs 1→2); destroying one keeps it live; destroying both deletes it (refs→0).
- [ ] **Given** >ZOMBIE_CAP distinct geometries attached+destroyed, **When** stats are read, **Then** `zombies <= 12` always and `live == 0` after all destroyed, and peak size ≤ live+cap+small constant (memory-bounded).
- [ ] **Given** a same-geometry re-render fired while the first map is still DECODING (window.Image deferral patch), **When** the instance is destroyed, **Then** `__cacheStats().live == 0` (the refcount-leak class is caught).
- [ ] **Given** a build then a >SCRATCH_IDLE_MS (2s) idle, **When** stats are read, **Then** `scratchAllocated` is true right after a build and false after idle (no permanent high-water mark); and a larger geometry grows scratch on demand.
- [ ] **Given** all of the above, **When** invoked via a `test` script on `@labpics/ui-docs`, **Then** they run under `pnpm -r --if-present test` (i.e. `pnpm test`) and exit non-zero on any failure.
