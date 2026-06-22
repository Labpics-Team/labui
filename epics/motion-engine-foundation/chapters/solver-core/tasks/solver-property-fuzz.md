---
id: solver-property-fuzz
chapter: solver-core
epic: motion-engine-foundation
title: "Property/fuzz the solver bounds: never NaN/Infinity across mass/stiffness/damping (zero new deps)"
status: ready
priority: 3
depends_on:
  - spring-tween-solver
blocks: []
agent_profile:
  category: deep
  skills: [craft-qa]
started: null
completed: null
refine_after: []
---

# Property/fuzz test — CSS-safe across the param space

## What
Close the CLASS "solver emits a non-finite value into a CSS value" with a property/fuzz test — not hand-picked inputs.
- Implement a tiny SEEDED deterministic PRNG (LCG, ~5 lines) in the test file — NO new dependency (do not add fast-check; a bounded hand-rolled fuzzer is sufficient for the finiteness class and keeps zero deps).
- Sample ≥500 cases of `{ mass, stiffness, damping }` across the documented valid bounds (and a band of extreme-but-valid edges: very high stiffness, near-critical damping, large from→to deltas).
- For each case, evaluate `spring` across a sampled timeline (e.g. t = 0 … settle, stepped) and assert EVERY `value` and `velocity` is `Number.isFinite(...)` — no NaN, no ±Infinity.
- Because the PRNG is seeded, the test is itself deterministic and reproducible (a failure prints the offending seed+params).
- RED-proof: first run the property test against a deliberately broken solver branch (e.g. divide-by-zero on damping) to prove it CATCHES non-finite output, then against the real solver (GREEN).

## Must NOT Do
- Add fast-check or any fuzzing dependency (zero-dep invariant; and "no dep from memory" per CLAUDE.md without a check).
- Sample INVALID params here (those are the typed-error unit test's job) — this test covers the VALID/edge band.
- Make the fuzzer non-deterministic (no `Math.random` seed-from-time) — reproducibility is required.

## Verification
- [ ] Property test runs ≥500 seeded cases; all outputs `Number.isFinite`.
- [ ] RED-proof recorded: the test fails against a broken solver, passes against the real one.
- [ ] `pnpm --filter @labpics/ui-motion test` green; no new entry in `dependencies`.

## References
- `packages/motion/src/spring.ts` — system under test.
- craft-qa skill — class C (property/fuzz) guidance.
- EPIC.md invariant 2 (CSS-safe) + 3 (determinism).
