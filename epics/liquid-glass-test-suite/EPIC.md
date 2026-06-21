---
id: liquid-glass-test-suite
title: "Rigorous CI-wired test suite for the existing Liquid Glass engine"
status: active
priority: 1
created: 2026-06-21
goal: "Lock the existing Liquid Glass engine's pixel output and memory invariants behind a CI gate that genuinely bites, without changing one byte of the rendered picture."
success_criteria:
  - "Biome 1.9.4 lint + format pass on prototypes/liquid-glass with zero new suppressions beyond the one pre-existing biome-ignore."
  - "Unit tests (Node, no browser) cover pure math (sdRoundRect, clamp01, smoothstep) and the encoding constants; they run under `pnpm test` and pass."
  - "Cache/memory invariant tests (refcount accounting, zombie-LRU bound, scratch lifecycle) run in headless Chromium against the REAL engine module and pass."
  - "A deterministic Playwright visual-regression gate diffs #pane AND #panel across the full state matrix against a baseline re-frozen FROM THIS REPO's engine; verdict PASS at threshold meanDelta<1 OR maxDelta<8 OR pctChanged<1."
  - "A Class-D mutation harness weakens each of the 10 effect dimensions in a throwaway copy and asserts the visual gate FAILS for every one (allCaught == true) — the RED bite-proof."
  - "CI (.github/workflows/ci.yml) runs the unit+cache tests via `pnpm test` and the visual gate via the e2e job, both green, on Node 22 / Playwright 1.49.1, Chromium-only for the lens gate."
  - "The engine's public API (attach, supportsRefraction, returned state.destroy) is unchanged; git diff on liquid-glass.js/css render-path logic is empty except non-behavioural cleanliness fixes review surfaces."
  - "A PR is opened on branch feat/liquid-glass. It is NEVER merged by the agent."
depends_on: []
---

# Rigorous CI-wired test suite for the existing Liquid Glass engine

## Goal
Lock the existing Liquid Glass engine's pixel output and memory invariants behind a CI gate that genuinely bites, without changing one byte of the rendered picture.

## The CLASS of problem this closes
Not "write some tests for this file." The class is: **an optimised, hand-tuned visual engine has NO executable definition of "correct", so any future edit — a refactor, a dependency bump, a well-meaning cleanup — can silently degrade the look or re-leak the memory that was just hardened, and nobody finds out until a human eyeballs it.** This epic installs the missing executable specification at three altitudes (pure math → memory discipline → rendered pixels) and proves the top altitude actually catches breakage (mutation). After it, "the picture changed" and "the cache leaks again" become CI failures, not eyeball lottery.

## Architecture — layers & dependency direction (Clean / DDD applied to a TEST suite)
The test code is the new artifact; it must depend on the engine, never the reverse. Dependencies point inward toward the unchanged engine.

```
            ┌─────────────────────────────────────────────┐
   CI gate  │  .github/workflows/ci.yml (orchestration)    │  ← outermost, knows pnpm scripts only
            └───────────────┬─────────────────────────────┘
                            │ invokes
   ┌────────────────────────┼───────────────────────────────────────┐
   │ Test layer (NEW, the only code added)                            │
   │  • unit (Node)            — imports pure fns / constants          │
   │  • cache+memory (Chromium)— imports the engine MODULE, reads      │
   │                             __cacheStats(), drives attach/destroy │
   │  • visual gate (Chromium) — drives the playground DOM, pixel-diff │
   │  • mutation harness       — copies engine, weakens, RE-RUNS gate  │
   └────────────────────────┬───────────────────────────────────────┘
                            │ depends on (read-only)
            ┌───────────────▼─────────────────────────────┐
   Domain   │  prototypes/liquid-glass/  (UNCHANGED ENGINE)│  ← innermost, zero knowledge of tests
            │  liquid-glass.js · liquid-glass.css ·        │
            │  playground.js · index.html                  │
            └─────────────────────────────────────────────┘
```

**SOLID notes that shape the tasks:**
- **DIP** — tests depend on the engine's *public surface* (`attach`, `supportsRefraction`, the already-exported `__cacheStats`, and CSS custom-property contract), not its internals. The one inversion needed: pure math (`sdRoundRect`/`clamp01`/`smoothstep`) and the encoding constants must be *importable by Node without a DOM*. They currently live module-private inside a browser ES module. The SRP-correct move is a tiny **non-behavioural** extraction (see ch01) — pure functions split into a sibling module that the browser engine re-imports, so the runtime is byte-identical and Node can unit-test the math directly. If extraction is judged to perturb the engine, the fallback is a string-eval/`import()` shim — decided in ch01-t1 with evidence, never guessed.
- **OCP** — the state matrix and the mutation list are data tables (arrays of descriptors), so adding a state or a dimension is a data edit, not a control-flow edit. This is already the shape of the reference scripts; preserve it.
- **SRP** — four chapters, four single responsibilities: (1) invariants invisible to pixels, (2) the pixel truth, (3) proving the pixel truth bites, (4) making CI run all of it.

## Invariants that must NEVER regress (the hard contract)
1. **The rendered picture is byte-identical.** This is THE hard invariant. The baseline is re-frozen from THIS repo's engine in ch02; from then on every render-path change is a diff failure. No edit to the displacement-encoding loop, SDF, band formula, MAX_PULL, dispersion math, or the CSS effect knobs is permitted by this epic except where a mutation deliberately breaks a throwaway copy.
2. **Public API is frozen:** `attach(el, opts)`, `supportsRefraction()`, and the returned `state.destroy()` keep their signatures and semantics. `__cacheStats()` stays an inert DEV-only export (never read on a render path).
3. **Zero engine code added for tests** on the render path. The ONLY permitted engine-file change is the non-behavioural pure-math extraction in ch01 (proven byte-identical) plus cleanliness fixes a reviewer surfaces (lint/format) that do not alter output.
4. **Existing tests stay green.** The 30+ component specs and the current `pnpm test` / `pnpm test:e2e` must not regress. The glass visual gate is Chromium-only and must not run (or must skip cleanly) under the WebKit project, since WebKit does not refract.
5. **No secrets, no network, deterministic.** The gate runs headless software-raster Chromium with `workers:1` in CI; no real GPU, no fps thresholds (perf is hardware-flaky — explicitly OUT of the CI gate).

## Chapters
| Chapter | Status | Priority | Responsibility |
|---------|--------|----------|----------------|
| `chapters/ch01-unit-pure-and-cache/` | ready | 1 | Node unit math + constants; Chromium cache/scratch invariants (pixel-invisible class) |
| `chapters/ch02-visual-regression-gate/` | draft | 1 | Port the pane+panel deterministic pixel gate into repo Playwright; re-freeze baseline from THIS engine |
| `chapters/ch03-mutation-bite-proof/` | draft | 1 | Port the 10-dimension Class-D mutation harness; prove the ch02 gate fails on every deliberate weakening |
| `chapters/ch04-ci-wiring-and-pr/` | draft | 2 | Wire unit+mutation into `pnpm test`, gate into e2e; lint clean; open PR (never merge) |

Dependency order is strict and linear: **ch01 → ch02 → ch03 → ch04.** ch03 cannot exist before ch02 (it re-runs ch02's gate). ch04 wires what ch01–ch03 produced. ch02 and ch03 are `draft` with placeholder tasks because their exact wiring (standalone-harness vs `toHaveScreenshot`) is decided by ch01's first task — do not pre-specify on assumptions (P1).

## Key grounded decisions (so builders don't re-derive)
- **Wiring chosen: co-locate under `apps/docs`, keep the gate a SELF-CONTAINED harness, do NOT make `prototypes/liquid-glass` a workspace package.** Rationale grounded in the repo: `pnpm test` = `pnpm -r --if-present test` and `pnpm build` = `pnpm -r build`; adding `prototypes/*` to `pnpm-workspace.yaml` would force a `build` script onto a zero-dep prototype and risk the build job. The reference gate already runs its OWN http server + in-page pixel diff (no Astro/Vite preview needed), so it ports cleanly as a Playwright spec (or a node script invoked by a spec) that serves `prototypes/liquid-glass/` directly. Unit + cache + mutation are plain Node/Playwright scripts invoked by a `test` script on `@labpics/ui-docs` (which `pnpm -r --if-present test` already picks up). The e2e job already runs `pnpm test:e2e`. Final placement detail (a `liquid-glass.spec.ts` that shells the gate vs. inlining it) is locked in ch01-t1.
- **Baseline lives IN the repo**, re-frozen from this engine — NOT copied from `C:/Users/Daniel/lg-qa-baseline2` (those were frozen from `C:/Users/Daniel/lg-cand/HARDENED`, a different checkout; trusting them blindly would bake a foreign render as "truth"). Re-freeze, then diff the re-frozen set against the external 26 PNGs as a SANITY cross-check (expected near-zero delta — if large, investigate before trusting).
- **prefers-reduced-transparency** must be emulated via raw CDP `Emulation.setEmulatedMedia` (the reference does this); the Playwright 1.49 test API cannot set this media feature — the existing materials.spec.ts confirms that limitation. Reuse the CDP path.
- **Reference scripts are at external Windows paths** (`C:/Users/Daniel/lg-*.mjs`) and hardcode `C:/Users/Daniel/Projects/labui/node_modules/...@playwright`. The port MUST drop those absolute paths and use the repo's own `@playwright/test@1.49.1` resolution and repo-relative baseline dir.
- **State-count reconciliation:** the reference `lg-qadiff2.mjs` defines 14 states × 2 elements = 28 capture slots, but `lg-qa-baseline2` holds 26 PNGs (the two `bg:2` body/depth states were added after that freeze). The repo baseline is whatever the committed state matrix produces — reconcile the count in ch02-t1 and commit exactly that many PNGs. Do not chase the GROUND's "16" — it is stale; the state table is the source of truth.

## Notes / risks
- **Determinism risk:** headless Chromium's FIRST composites are nondeterministic — the reference does a warm-up (`shoot` the first state + distinct-geo + first state again) before freezing/diffing. Preserve the warm-up verbatim; it is load-bearing for a stable baseline.
- **Cross-platform baseline risk (HIGH):** the external baseline was frozen on Windows; CI runs ubuntu-latest. A software-raster Chromium pixel can differ subtly across OS/font/AA. The baseline committed to the repo MUST be frozen in the CI-equivalent environment (Linux Chromium), or the gate will false-fail on the first CI run. ch02-t4 closes this explicitly — freeze on Linux (act/container or a CI "freeze" run), not on the Windows dev box. This is the single most likely cause of a red CI and is called out as its own task.
- **Refcount-leak class is the riskiest engine line** (acquireMap/releaseMap, heldKey double-acquire). The cache test's CASE 1 (re-render before decode) is the only thing that catches a regression there — it must be ported faithfully, including the `window.Image` decode-deferral patch.
- **Out of scope (v1):** real-GPU fps/perf thresholds; WebKit/Firefox refraction (they intentionally fall back to frost — only the fallback path is asserted, not a lens); any visual change to the engine; mutation-testing the unit tests themselves (Stryker etc.); touching the 30+ existing component specs.
