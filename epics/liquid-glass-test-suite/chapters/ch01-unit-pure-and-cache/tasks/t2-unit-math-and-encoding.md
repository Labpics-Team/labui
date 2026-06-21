---
id: t2-unit-math-and-encoding
chapter: ch01-unit-pure-and-cache
epic: liquid-glass-test-suite
title: "Node unit tests: sdRoundRect / clamp01 / smoothstep + displacement-encoding invariants"
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

# Node unit tests: pure math + displacement-encoding invariants

## What
A pure-Node test file (node:test or the repo's chosen runner — no browser) over the pure module from t1. Two groups:

**A. Pure math (property + example):**
- `clamp01`: ==0 below 0, ==1 above 1, identity in [0,1]; check 0, 0.5, 1, -0.3, 1.7.
- `smoothstep`: 0→0, 1→1, 0.5→0.5, monotonic increasing on [0,1], matches x*x*(3-2x) closed form on a sampled grid.
- `sdRoundRect`: for a known box (e.g. 200×120, r=28) assert <0 at centre (deep inside), ≈0 within tolerance on the rim, >0 outside the box; assert the 4-way symmetry the encoding relies on (value at (px,py) == value at mirror points (w-px,py),(px,h-py)).

**B. Encoding invariants** (replicate the byte math from buildMap WITHOUT a canvas — compute the float field for a small geometry in JS and assert the encode formula, OR if buildMap is browser-bound, assert the constants + the encode arithmetic on a hand-computed field):
- Interior (neutral) pixel encodes R≈128, G≈128 (i.e. `0*norm255+127.5`).
- B channel constant == 128; A channel constant == 255 (the `0xff800000` fill little-endian).
- A rim pixel at full pull encodes R/G approaching the [-maxAbs,maxAbs]→[0,1] extreme: `±dx*norm255+127.5` with `norm=1/(2*maxAbs)` reconstructs the displacement (assert round-trip: decode(encode(dx)) ≈ dx within ½ LSB).
- maxAbs ≥ |any encoded displacement| (no clipping — every value fits the band).

## Must NOT Do
- Do NOT import anything that touches `document`, `canvas`, `Image`, `matchMedia`, or `window` — this suite MUST run in bare Node.
- Do NOT assert exact rendered pixels here — that is ch02's job. This is math, not picture.
- Do NOT re-implement the formulas with different constants — import the real constants/functions from the t1 module so a constant change is caught.

## Verification
- [ ] `node --test` (or the chosen runner) runs the file green with zero DOM shims.
- [ ] Deliberately flipping a local copy of MAX_PULL or the B/A constants makes a relevant assertion FAIL (quick RED sanity, reverted) — proves the test bites.
- [ ] Runs under `pnpm test` via the t1 script.

## References
- `prototypes/liquid-glass/liquid-glass.js:91-101` — clamp01/smoothstep/sdRoundRect.
- `prototypes/liquid-glass/liquid-glass.js:193-219` — float field (pull = MAX_PULL*m; dx/dy).
- `prototypes/liquid-glass/liquid-glass.js:242-278` — encode: norm255, +127.5, B=128/A=255 fill.
