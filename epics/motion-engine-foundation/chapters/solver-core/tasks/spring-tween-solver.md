---
id: spring-tween-solver
chapter: solver-core
epic: motion-engine-foundation
title: "Pure spring + tween/easing solver + typed errors — deterministic & boundary-correct (TDD)"
status: ready
priority: 2
depends_on:
  - bootstrap-test-harness
blocks:
  - solver-property-fuzz
agent_profile:
  category: deep
  skills: [craft-arch, craft-qa]
started: null
completed: null
refine_after: []
---

# Pure spring/tween solver + typed errors

## What
Implement the DDD domain core as pure, side-effect-free functions. TDD: write the failing unit tests FIRST (RED-proof), then implement.
- `packages/motion/src/spring.ts` — `spring(params, t)` where params = `{ mass, stiffness, damping, from, to, velocity }`, `t` in seconds. Returns `{ value, velocity, done }`, all finite. Use a standard analytic/semi-analytic damped-harmonic-oscillator solution (under/critical/over-damped) — choose the formulation per craft-arch (no library; cite the chosen formula in a comment).
- `packages/motion/src/tween.ts` — `tween(from, to, t01, easing)` for `t01 ∈ [0,1]`; a small set of easing fns (linear + cubic-bezier-driven or a fixed named set). `t=0 → from`, `t=1 → to` EXACTLY.
- `packages/motion/src/errors.ts` — typed error class(es) (e.g. `MotionParamError`) thrown for invalid params (mass ≤ 0, non-finite stiffness/damping/from/to/velocity, easing out of domain).
- Validate params at the boundary and throw the typed error; never let an invalid param reach the math and emit NaN.

## Tests (write RED first)
- Determinism/idempotency: `spring(p, t)` called twice → identical (`unit`).
- Boundary: `tween(from,to,0)===from`, `tween(from,to,1)===to` (`unit`).
- Settling: spring with damping reaches `done` near `to` for a representative param set (`unit`).
- Typed error: invalid params throw `MotionParamError`, not return NaN (`unit`).

## Must NOT Do
- Import DOM, `window`, `matchMedia`, `requestAnimationFrame`, `performance`, or `Date` into spring.ts/tween.ts (invariant 5 — domain purity).
- Add any runtime dependency.
- Use `Math.random` or any global mutable state inside the solver (breaks determinism, invariant 3).
- Emit NaN/Infinity for VALID params (invariant 2) — clamp/guard the math.

## Verification
- [ ] All RED tests proven to fail against an empty/stub implementation first, then pass.
- [ ] `pnpm --filter @labpics/ui-motion test` + `typecheck` + `build` pass.
- [ ] grep confirms zero DOM/clock imports in spring.ts and tween.ts.

## References
- `packages/core/test/css-three-language.test.ts` — existing unit-test style/shape.
- EPIC.md Architecture section — Layer 1 contract + invariants 2/3/5.
