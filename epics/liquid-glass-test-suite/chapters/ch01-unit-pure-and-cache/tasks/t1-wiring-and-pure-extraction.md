---
id: t1-wiring-and-pure-extraction
chapter: ch01-unit-pure-and-cache
epic: liquid-glass-test-suite
title: "Decide test wiring + make pure math/constants Node-importable, byte-identical engine"
status: ready
priority: 1
depends_on: []
blocks:
  - t2-unit-math-and-encoding
  - t3-cache-refcount-lru
  - t4-scratch-lifecycle
agent_profile:
  category: visual-engineering
  skills: [craft-qa, craft-arch]
started: null
completed: null
refine_after: []
---

# Decide test wiring + make pure math/constants Node-importable, byte-identical engine

## What
This task resolves the one fork the whole epic depends on, and unblocks Node unit testing.

1. **Lock the wiring** (record the decision + rationale in this task's body when done). The EPIC's grounded default is: co-locate tests under `apps/docs`, keep the visual gate a self-contained harness (own http server + in-page diff serving `prototypes/liquid-glass/`), invoked by a `test:liquid-glass` (unit+cache+mutation) and an e2e spec; do NOT make `prototypes/liquid-glass` a workspace package. Confirm this against the repo (`pnpm -r --if-present test`, `pnpm -r build`, `pnpm test:e2e` filter to `@labpics/ui-docs`) and either adopt or, with evidence, choose the alternative. Add a `test` (or `test:liquid-glass`) script to `apps/docs/package.json` so `pnpm test` runs the Node unit+cache+mutation tests.
2. **Make the pure math + encoding constants importable from Node without a DOM.** Preferred (SRP-correct): extract `clamp01`, `smoothstep`, `sdRoundRect`, and the encoding constants (B=128, A=255, the MAX_PULL value, the [-maxAbs,maxAbs]→[0,1] norm) into a tiny sibling pure module (e.g. `prototypes/liquid-glass/lg-math.js`) that has ZERO DOM/browser references, and have `liquid-glass.js` import them. The browser bundle's behaviour must be byte-identical.
3. **Prove byte-identical.** Before extraction, freeze the ch02 state matrix once (or capture a hash of a representative built map's data-URI for ≥2 geometries); after extraction, re-capture and assert identical. If extraction cannot be proven non-perturbing, FALL BACK to a documented import shim (load the engine source, eval/extract the pure fns) that adds ZERO change to `liquid-glass.js` — and record why.

## Must NOT Do
- Do NOT change any rendered output. The displacement loop, SDF, band formula, MAX_PULL value, dispersion math, CSS knobs, and public API (attach/supportsRefraction/destroy) stay exactly as committed.
- Do NOT add `prototypes/*` to `pnpm-workspace.yaml` unless you also prove `pnpm build` and the e2e job still pass — the grounded default avoids this.
- Do NOT copy the external `C:/Users/Daniel/lg-*.mjs` absolute paths or the hardcoded external `@playwright` path into the repo.
- Do NOT guess the wiring — verify against the actual root `package.json` scripts and `apps/docs/package.json`.

## Verification
- [ ] `pnpm test` invokes the new script (even if it currently runs an empty/placeholder suite) — proven by output.
- [ ] The pure module imports cleanly in plain Node (`node -e "import('...')"`) with no DOM error.
- [ ] Byte-identical proof recorded: identical map data-URI hash (or identical ch02 freeze) before vs after the extraction, for ≥2 distinct geometries.
- [ ] Decision + rationale written into this task body under a "## Decision" heading.

## References
- `prototypes/liquid-glass/liquid-glass.js:91-101` — clamp01, smoothstep, sdRoundRect (extraction source).
- `prototypes/liquid-glass/liquid-glass.js:44` — MAX_PULL=0.15; lines 250 (B=128/A=255 fill), 242-243 (norm) — encoding constants.
- `package.json:13-24` — `test` = `pnpm -r --if-present test`, `test:e2e` filters `@labpics/ui-docs`.
- `apps/docs/package.json` — where the `test`/`test:liquid-glass` script lands.
- `pnpm-workspace.yaml` — workspace globs are `packages/*` + `apps/*` (prototypes NOT a member).
