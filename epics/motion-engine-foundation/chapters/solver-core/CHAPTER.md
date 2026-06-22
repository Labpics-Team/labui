---
id: solver-core
epic: motion-engine-foundation
title: "Pure dependency-free spring/tween solver — deterministic, idempotent, NaN/Infinity-proof"
user_story: "technical enabler"
enabler_for: "CH-03 — the declarative animate API and every LabUI component that needs motion. End-user value lands when a component animates smoothly and honours reduced-motion; this chapter is the physics core that makes that possible."
status: ready
priority: 1
depends_on: []
refine_after: []
parallel_group: ""
agent_profile:
  category: deep
  skills: [craft-arch, craft-qa]
---

# Pure spring/tween solver

## User Story
Technical enabler for CH-03 (declarative animate API). No direct end user — this is the innermost domain ring (pure physics). A fabricated "as a developer" story would be theater (P7); this is honestly an enabler.

## Purpose
Create the pure, dependency-free physics core of `@labpics/ui-motion`: a spring solver and a tween/easing solver as side-effect-free functions of (params, time). No DOM, no clock, no `window`. This is the DDD domain core where the determinism and CSS-safety invariants are enforced. It also bootstraps the package's test harness (vitest) that CH-02/CH-03 reuse.

## Tasks
| Task | Status | Agent | Depends On |
|------|--------|-------|------------|
| `tasks/bootstrap-test-harness.md` | ready | deep | — |
| `tasks/spring-tween-solver.md`    | ready | deep | bootstrap-test-harness |
| `tasks/solver-property-fuzz.md`   | ready | deep | spring-tween-solver |

## Exit Criteria
(These ARE the acceptance criteria — Given/When/Then.)
- [ ] Given `packages/motion`, When `pnpm --filter @labpics/ui-motion test` runs, Then vitest executes from a `vitest.config.ts` (node env) and `package.json` has a `"test": "vitest run"` script with `vitest@2.1.8` pinned in devDependencies and `dependencies` still empty.
- [ ] Given the spring solver, When called twice with identical `(mass, stiffness, damping, from, to, velocity, t)`, Then it returns byte-identical output (determinism + idempotency), proven by a unit test.
- [ ] Given the tween/easing solver, When evaluated at `t=0` and `t=1`, Then it returns exactly `from` and `to` respectively (boundary correctness), proven by a unit test.
- [ ] Given a property/fuzz test over bounded `mass`/`stiffness`/`damping` (≥500 pseudo-random cases from a seeded deterministic LCG, zero new deps), When the solver runs across the sampled timeline, Then NO output is `NaN`, `Infinity`, or `-Infinity` — every value is a finite number (CSS-safe), and the test is itself RED-proven against a deliberately broken solver before GREEN.
- [ ] Given invalid params (negative/zero mass, non-finite stiffness), When passed to the solver, Then it throws a typed error from `errors.ts` (fails loud at the boundary) — proven by a unit test.
