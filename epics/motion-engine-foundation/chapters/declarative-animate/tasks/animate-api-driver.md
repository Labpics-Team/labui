---
id: animate-api-driver
chapter: declarative-animate
epic: motion-engine-foundation
title: "Declarative animate(target, keyframes, options) + injectable clock/driver + reduced-motion short-circuit (TDD)"
status: ready
priority: 2
depends_on:
  - reduced-motion-policy
blocks:
  - public-api-pin
agent_profile:
  category: deep
  skills: [craft-arch, craft-qa, craft-frontend]
started: null
completed: null
refine_after: []
---

# Declarative animate API + driver

## What
Build the public orchestration layer (Layer 3 + 4). TDD: failing tests first.
- `packages/motion/src/animate.ts` — `animate(target, keyframes, options)` composing solver (CH-01) + reduced-motion policy (Layer 2) + a driver. Define the public option/keyframe shape (duration, easing or spring params, onUpdate callback). Returns a controllable handle (e.g. `{ finished: Promise, cancel() }`) — keep it minimal and dependency-free.
- The DRIVER (rAF/clock) lives behind an INJECTABLE interface (default: `requestAnimationFrame`+`performance.now`; tests inject a step-clock). This is the ONLY place rAF/perf.now appear. Put it in animate.ts or a small `driver.ts` per craft-arch.
- Reduced-motion short-circuit: when the policy says reduce, resolve to the FINAL keyframe value in ≤1 tick and NEVER enter the solver loop (invariant 4). When it says animate, drive the solver to completion, ending exactly at the target.
- Validate options; throw a typed `errors.ts` error on non-finite duration / unknown easing (no silent NaN).
- Every `onUpdate` value MUST be finite (invariant 2) in both states.

## Tests (RED first)
- Reduce state: solver loop NOT entered (spy the injected driver), resolves to final in ≤1 tick (`unit`).
- Animate state with injected step-clock: monotonic finite progression from→to, ends at `to` (`unit`, deterministic — no real rAF).
- Output finiteness asserted in both states (`unit`, invariant 2).
- Invalid options → typed error (`unit`).

## Must NOT Do
- Use a real `requestAnimationFrame` in unit tests — inject the clock (determinism).
- Let `matchMedia`/preference logic live here — call the Layer-2 policy.
- Add any runtime dependency.
- Enter the solver loop when reduce is active (invariant 4).

## Verification
- [ ] All four test classes pass; RED-proof recorded for each.
- [ ] grep: `requestAnimationFrame`/`performance.now` appear only in animate.ts/driver.ts.
- [ ] `pnpm --filter @labpics/ui-motion test` + typecheck + build pass; `dependencies` empty.

## References
- `packages/motion/src/spring.ts`, `tween.ts` — composed solver.
- `packages/motion/src/reduced-motion.ts` — the policy this calls.
- EPIC.md Architecture — Layers 3/4 + invariants 2/4.
